import os
import tempfile

import librosa
import numpy as np
import torch
from fastapi import FastAPI, File, UploadFile
from transformers import Wav2Vec2Model, Wav2Vec2Processor

# Load AI model once at startup.
processor = Wav2Vec2Processor.from_pretrained("facebook/wav2vec2-base-960h")
model = Wav2Vec2Model.from_pretrained("facebook/wav2vec2-base-960h")

app = FastAPI()


def clamp(value, lower=0.0, upper=1.0):
    return max(lower, min(upper, float(value)))


def compute_ai_confidence(y, amplitude, avg_pitch, energy, duration):
    try:
        inputs = processor(y, sampling_rate=16000, return_tensors="pt", padding=True)

        with torch.no_grad():
            outputs = model(**inputs)

        hidden_state = outputs.last_hidden_state.squeeze(0)
        embedding_strength = float(hidden_state.abs().mean().item())
        embedding_stability = float(hidden_state.std().item())

        # Convert model activations into bounded confidence components.
        model_signal_score = np.tanh(embedding_strength * 14.0)
        model_stability_score = np.tanh(embedding_stability * 6.0)

        # Blend model output with speech heuristics so the score reflects clarity and command delivery.
        amplitude_score = clamp(amplitude / 0.08)
        pitch_score = clamp(1.0 - min(abs(avg_pitch - 180.0), 220.0) / 220.0) if avg_pitch > 0 else 0.0
        energy_score = clamp(energy / 1200.0)
        duration_score = clamp(1.0 - min(abs(duration - 1.8), 1.8) / 1.8) if duration > 0 else 0.0

        confidence = 100.0 * (
            0.34 * model_signal_score +
            0.22 * model_stability_score +
            0.14 * amplitude_score +
            0.12 * pitch_score +
            0.10 * energy_score +
            0.08 * duration_score
        )

        return round(clamp(confidence, 0.0, 100.0), 2)
    except Exception as exc:
        print("AI error:", exc)
        return 0.0


@app.post("/analyze")
async def analyze_audio(file: UploadFile = File(...)):
    temp_path = None

    try:
        with tempfile.NamedTemporaryFile(delete=False) as tmp:
            tmp.write(await file.read())
            temp_path = tmp.name

        y, sr = librosa.load(temp_path, sr=16000)

        amplitude = np.mean(np.abs(y))
        energy = np.sum(y ** 2)

        pitches, _ = librosa.piptrack(y=y, sr=sr)
        pitch_vals = pitches[pitches > 0]
        avg_pitch = pitch_vals.mean() if len(pitch_vals) > 0 else 0

        duration = librosa.get_duration(y=y, sr=sr)
        ai_confidence = compute_ai_confidence(y, amplitude, avg_pitch, energy, duration)

        score = 0
        feedback = []

        if amplitude > 0.02:
            score += 30
        else:
            feedback.append("Speak louder")

        if 80 < avg_pitch < 300:
            score += 30
        else:
            feedback.append("Improve pitch clarity")

        if energy > 5:
            score += 20
        else:
            feedback.append("Increase confidence")

        if 1 < duration < 3:
            score += 20
        else:
            feedback.append("Command timing is off")

        if ai_confidence >= 70:
            score += 10
        elif ai_confidence >= 40:
            score += 5

        score = min(score, 100)

        return {
            "score": score,
            "amplitude": float(amplitude),
            "pitch": float(avg_pitch),
            "energy": float(energy),
            "duration": float(duration),
            "ai_confidence": float(ai_confidence),
            "feedback": feedback,
        }
    finally:
        if temp_path and os.path.exists(temp_path):
            os.unlink(temp_path)
