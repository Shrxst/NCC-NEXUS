from fastapi import FastAPI, File, UploadFile
import librosa
import numpy as np
import tempfile

app = FastAPI()

@app.post("/analyze")
async def analyze_audio(file: UploadFile = File(...)):
    
    # Save file temporarily
    with tempfile.NamedTemporaryFile(delete=False) as tmp:
        tmp.write(await file.read())
        path = tmp.name

    # Load audio
    y, sr = librosa.load(path, sr=16000)

    # Features
    amplitude = np.mean(np.abs(y))
    energy = np.sum(y**2)

    pitches, _ = librosa.piptrack(y=y, sr=sr)
    pitch_vals = pitches[pitches > 0]
    avg_pitch = pitch_vals.mean() if len(pitch_vals) > 0 else 0

    duration = librosa.get_duration(y=y, sr=sr)

    # Scoring
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

    return {
        "score": score,
        "amplitude": float(amplitude),
        "pitch": float(avg_pitch),
        "energy": float(energy),
        "duration": float(duration),
        "feedback": feedback
    }