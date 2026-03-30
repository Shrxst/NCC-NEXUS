import React, { useEffect, useMemo, useRef, useState } from "react";
import {
  AlertCircle,
  CheckCircle2,
  Filter,
  LoaderCircle,
  Mic,
  Pause,
  Play,
  RotateCcw,
  Search,
  Sparkles,
  Square,
} from "lucide-react";
import WaveSurfer from "wavesurfer.js";
import VoiceCommandCard from "./VoiceCommandCard";
import { VOICE_COMMANDS, VOICE_COMMAND_TYPES } from "./voiceCommandsData";
import commandAudio from "./assets/command-sample.mp3";
import "./voiceCommands.css";

const LEARNED_STORAGE_KEY = "voice_commands_learned_v1";
const VOICE_ANALYZE_URL = "http://localhost:5000/api/voice/analyze";

const safeReadLearned = () => {
  try {
    const raw = localStorage.getItem(LEARNED_STORAGE_KEY);
    if (!raw) return {};
    const parsed = JSON.parse(raw);
    return parsed && typeof parsed === "object" ? parsed : {};
  } catch (_error) {
    return {};
  }
};

const getSupportedMimeType = () => {
  if (typeof window === "undefined" || !window.MediaRecorder) {
    return "";
  }

  const candidates = ["audio/wav", "audio/mp4", "audio/webm;codecs=opus", "audio/webm", "audio/ogg;codecs=opus"];
  return candidates.find((type) => window.MediaRecorder.isTypeSupported(type)) || "";
};

const encodeWav = (audioBuffer) => {
  const numberOfChannels = audioBuffer.numberOfChannels;
  const sampleRate = audioBuffer.sampleRate;
  const samples = audioBuffer.length;
  const bytesPerSample = 2;
  const blockAlign = numberOfChannels * bytesPerSample;
  const buffer = new ArrayBuffer(44 + samples * blockAlign);
  const view = new DataView(buffer);

  const writeString = (offset, value) => {
    for (let index = 0; index < value.length; index += 1) {
      view.setUint8(offset + index, value.charCodeAt(index));
    }
  };

  writeString(0, "RIFF");
  view.setUint32(4, 36 + samples * blockAlign, true);
  writeString(8, "WAVE");
  writeString(12, "fmt ");
  view.setUint32(16, 16, true);
  view.setUint16(20, 1, true);
  view.setUint16(22, numberOfChannels, true);
  view.setUint32(24, sampleRate, true);
  view.setUint32(28, sampleRate * blockAlign, true);
  view.setUint16(32, blockAlign, true);
  view.setUint16(34, 16, true);
  writeString(36, "data");
  view.setUint32(40, samples * blockAlign, true);

  let offset = 44;
  for (let sampleIndex = 0; sampleIndex < samples; sampleIndex += 1) {
    for (let channelIndex = 0; channelIndex < numberOfChannels; channelIndex += 1) {
      const channelData = audioBuffer.getChannelData(channelIndex);
      const sample = Math.max(-1, Math.min(1, channelData[sampleIndex]));
      view.setInt16(offset, sample < 0 ? sample * 0x8000 : sample * 0x7fff, true);
      offset += bytesPerSample;
    }
  }

  return new Blob([buffer], { type: "audio/wav" });
};

const convertAudioBlobToWav = async (blob) => {
  if (typeof window === "undefined") {
    return blob;
  }

  const AudioContextClass = window.AudioContext || window.webkitAudioContext;
  if (!AudioContextClass) {
    return blob;
  }

  const context = new AudioContextClass();

  try {
    const arrayBuffer = await blob.arrayBuffer();
    const audioBuffer = await context.decodeAudioData(arrayBuffer.slice(0));
    return encodeWav(audioBuffer);
  } finally {
    await context.close();
  }
};

const formatMetric = (value, digits = 2) => {
  if (typeof value !== "number" || Number.isNaN(value)) {
    return "--";
  }

  return Number(value).toFixed(digits);
};

const formatDuration = (value) => {
  if (typeof value !== "number" || Number.isNaN(value)) {
    return "--";
  }

  return `${value.toFixed(1)}s`;
};

const getScoreMeta = (score) => {
  if (typeof score !== "number") {
    return { tone: "neutral", label: "Awaiting analysis" };
  }

  if (score > 70) {
    return { tone: "success", label: "Strong delivery" };
  }

  if (score >= 40) {
    return { tone: "warning", label: "Needs refinement" };
  }

  return { tone: "danger", label: "Practice required" };
};

const getConfidenceMeta = (confidence) => {
  if (typeof confidence !== "number" || Number.isNaN(confidence)) {
    return { tone: "neutral", glow: "none" };
  }

  if (confidence > 70) {
    return { tone: "success", glow: "0 12px 24px rgba(16, 185, 129, 0.16)" };
  }

  if (confidence >= 40) {
    return { tone: "warning", glow: "0 10px 20px rgba(245, 158, 11, 0.14)" };
  }

  return { tone: "danger", glow: "0 10px 20px rgba(239, 68, 68, 0.14)" };
};

const normalizeConfidence = (value) => {
  if (typeof value !== "number" || Number.isNaN(value)) {
    return null;
  }

  return Math.max(0, Math.min(100, value));
};

export default function VoiceCommandsModule() {
  const [query, setQuery] = useState("");
  const [typeFilter, setTypeFilter] = useState("All");
  const [learnedOnly, setLearnedOnly] = useState(false);
  const [expanded, setExpanded] = useState({});
  const [learned, setLearned] = useState(() => safeReadLearned());
  const [nowPlaying, setNowPlaying] = useState({ id: null, speed: 1 });
  const [isRecording, setIsRecording] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [result, setResult] = useState(null);
  const [error, setError] = useState("");
  const [audioBlob, setAudioBlob] = useState(null);
  const [audioUrl, setAudioUrl] = useState("");
  const [recordingStartedAt, setRecordingStartedAt] = useState(null);
  const [recordingElapsed, setRecordingElapsed] = useState(0);
  const [isWavePlaying, setIsWavePlaying] = useState(false);
  const [isConfidenceHovered, setIsConfidenceHovered] = useState(false);

  const audioRefs = useRef({});
  const activeAudioRef = useRef(null);
  const mediaRecorderRef = useRef(null);
  const recordedChunksRef = useRef([]);
  const streamRef = useRef(null);
  const waveformContainerRef = useRef(null);
  const waveSurferRef = useRef(null);

  useEffect(() => {
    localStorage.setItem(LEARNED_STORAGE_KEY, JSON.stringify(learned));
  }, [learned]);

  useEffect(() => {
    return () => {
      if (activeAudioRef.current) {
        activeAudioRef.current.pause();
        activeAudioRef.current.currentTime = 0;
      }

      const recorder = mediaRecorderRef.current;
      if (recorder && recorder.state !== "inactive") {
        recorder.stop();
      }

      if (streamRef.current) {
        streamRef.current.getTracks().forEach((track) => track.stop());
      }

      if (waveSurferRef.current) {
        waveSurferRef.current.destroy();
        waveSurferRef.current = null;
      }
    };
  }, []);

  useEffect(() => {
    if (!isRecording || !recordingStartedAt) {
      return undefined;
    }

    const intervalId = window.setInterval(() => {
      setRecordingElapsed(Math.floor((Date.now() - recordingStartedAt) / 1000));
    }, 250);

    return () => window.clearInterval(intervalId);
  }, [isRecording, recordingStartedAt]);

  useEffect(() => {
    return () => {
      if (audioUrl) {
        URL.revokeObjectURL(audioUrl);
      }
    };
  }, [audioUrl]);

  useEffect(() => {
    if (waveSurferRef.current) {
      waveSurferRef.current.destroy();
      waveSurferRef.current = null;
    }

    setIsWavePlaying(false);

    if (!audioBlob || !waveformContainerRef.current) {
      return undefined;
    }

    const waveSurfer = WaveSurfer.create({
      container: waveformContainerRef.current,
      waveColor: "#cfd6f6",
      progressColor: "#5c6bc0",
      cursorColor: "#1a237e",
      barWidth: 3,
      barGap: 2,
      barRadius: 6,
      height: 72,
      normalize: true,
    });

    waveSurferRef.current = waveSurfer;

    waveSurfer.on("play", () => setIsWavePlaying(true));
    waveSurfer.on("pause", () => setIsWavePlaying(false));
    waveSurfer.on("finish", () => setIsWavePlaying(false));

    if (typeof waveSurfer.loadBlob === "function") {
      waveSurfer.loadBlob(audioBlob);
    } else {
      waveSurfer.load(audioUrl);
    }

    return () => {
      waveSurfer.destroy();
      if (waveSurferRef.current === waveSurfer) {
        waveSurferRef.current = null;
      }
    };
  }, [audioBlob, audioUrl]);

  const filteredCommands = useMemo(() => {
    const normalizedQuery = query.trim().toLowerCase();

    return VOICE_COMMANDS.filter((command) => {
      if (typeFilter !== "All" && command.type !== typeFilter) {
        return false;
      }

      if (learnedOnly && !learned[command.id]) {
        return false;
      }

      if (!normalizedQuery) {
        return true;
      }

      return (
        command.name.toLowerCase().includes(normalizedQuery) ||
        command.type.toLowerCase().includes(normalizedQuery) ||
        command.hindi.toLowerCase().includes(normalizedQuery)
      );
    });
  }, [query, typeFilter, learnedOnly, learned]);

  const scoreMeta = useMemo(() => getScoreMeta(result?.score), [result]);
  const scoreValue = typeof result?.score === "number" ? Math.max(0, Math.min(100, result.score)) : 0;
  const confidenceValue = normalizeConfidence(result?.ai_confidence);
  const confidenceMeta = useMemo(() => getConfidenceMeta(confidenceValue), [confidenceValue]);

  const registerAudioRef = (id, node) => {
    if (!node) {
      delete audioRefs.current[id];
      return;
    }

    audioRefs.current[id] = node;

    node.onended = () => {
      setNowPlaying((current) => (current.id === id ? { id: null, speed: 1 } : current));
    };
  };

  const playCommandAudio = async (id, speed = 1) => {
    const audio = audioRefs.current[id];
    if (!audio) return;

    if (activeAudioRef.current && activeAudioRef.current !== audio) {
      activeAudioRef.current.pause();
      activeAudioRef.current.currentTime = 0;
    }

    audio.pause();
    audio.currentTime = 0;
    audio.playbackRate = speed;

    try {
      await audio.play();
      activeAudioRef.current = audio;
      setNowPlaying({ id, speed });
    } catch (_error) {
      setNowPlaying({ id: null, speed: 1 });
    }
  };

  const toggleExpanded = (id) => {
    setExpanded((prev) => ({
      ...prev,
      [id]: !prev[id],
    }));
  };

  const toggleLearned = (id) => {
    setLearned((prev) => ({
      ...prev,
      [id]: !prev[id],
    }));
  };

  const clearRecorderState = () => {
    if (audioUrl) {
      URL.revokeObjectURL(audioUrl);
    }

    if (waveSurferRef.current) {
      waveSurferRef.current.destroy();
      waveSurferRef.current = null;
    }

    setIsWavePlaying(false);
    setAudioBlob(null);
    setAudioUrl("");
    setResult(null);
    setError("");
  };

  const analyzeAudio = async (blob) => {
    const formData = new FormData();
    const extension = blob.type === "audio/wav" ? "wav" : blob.type.includes("mp4") ? "m4a" : "webm";
    formData.append("audio", blob, `voice-command.${extension}`);

    setIsLoading(true);
    setError("");

    try {
      const response = await fetch(VOICE_ANALYZE_URL, {
        method: "POST",
        body: formData,
      });

      const data = await response.json().catch(() => null);
      if (!response.ok) {
        throw new Error(data?.message || "Voice analysis failed.");
      }

      setResult(data);
    } catch (analysisError) {
      setResult(null);
      setError(analysisError.message || "Unable to analyze the recorded audio.");
    } finally {
      setIsLoading(false);
    }
  };

  const stopStreamTracks = () => {
    if (streamRef.current) {
      streamRef.current.getTracks().forEach((track) => track.stop());
      streamRef.current = null;
    }
  };

  const startRecording = async () => {
    if (isLoading) return;

    if (!navigator.mediaDevices?.getUserMedia || typeof window === "undefined" || !window.MediaRecorder) {
      setError("This browser does not support voice recording.");
      return;
    }

    clearRecorderState();

    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      const mimeType = getSupportedMimeType();
      const recorder = mimeType ? new MediaRecorder(stream, { mimeType }) : new MediaRecorder(stream);

      streamRef.current = stream;
      mediaRecorderRef.current = recorder;
      recordedChunksRef.current = [];

      recorder.ondataavailable = (event) => {
        if (event.data && event.data.size > 0) {
          recordedChunksRef.current.push(event.data);
        }
      };

      recorder.onerror = () => {
        setError("Recording failed. Please try again.");
        setIsRecording(false);
        setRecordingStartedAt(null);
        setRecordingElapsed(0);
        stopStreamTracks();
      };

      recorder.onstop = async () => {
        const nextMimeType = recorder.mimeType || mimeType || "audio/webm";
        const recordedBlob = new Blob(recordedChunksRef.current, { type: nextMimeType });

        setIsRecording(false);
        setRecordingStartedAt(null);
        setRecordingElapsed(0);
        stopStreamTracks();

        if (!recordedBlob.size) {
          setAudioBlob(null);
          setAudioUrl("");
          setResult(null);
          setError("No audio was recorded. Please try again.");
          return;
        }

        try {
          const uploadBlob = await convertAudioBlobToWav(recordedBlob);

          if (audioUrl) {
            URL.revokeObjectURL(audioUrl);
          }

          const nextAudioUrl = URL.createObjectURL(uploadBlob);
          setAudioBlob(uploadBlob);
          setAudioUrl(nextAudioUrl);
          setResult(null);
          await analyzeAudio(uploadBlob);
        } catch (_conversionError) {
          setAudioBlob(null);
          setAudioUrl("");
          setResult(null);
          setError("Recorded audio could not be prepared for analysis. Please try again.");
        }
      };

      recorder.start();
      setIsRecording(true);
      setRecordingStartedAt(Date.now());
      setRecordingElapsed(0);
    } catch (recordError) {
      const permissionDenied =
        recordError?.name === "NotAllowedError" || recordError?.name === "PermissionDeniedError";

      setIsRecording(false);
      setRecordingStartedAt(null);
      setRecordingElapsed(0);
      setError(
        permissionDenied
          ? "Microphone permission was denied. Allow microphone access and try again."
          : "Unable to access the microphone."
      );
      stopStreamTracks();
    }
  };

  const stopRecording = () => {
    const recorder = mediaRecorderRef.current;
    if (!recorder || recorder.state === "inactive") {
      return;
    }

    recorder.stop();
  };

  const handleRecordingToggle = () => {
    if (isRecording) {
      stopRecording();
      return;
    }

    startRecording();
  };

  const handleTryAgain = () => {
    if (isRecording || isLoading) {
      return;
    }

    clearRecorderState();
    setRecordingElapsed(0);
  };

  const handleWaveToggle = () => {
    if (!waveSurferRef.current) return;
    waveSurferRef.current.playPause();
  };

  const confidenceBarColor =
    confidenceMeta.tone === "success"
      ? "linear-gradient(135deg, #10b981, #047857)"
      : confidenceMeta.tone === "warning"
        ? "linear-gradient(135deg, #f97316, #ea580c)"
        : confidenceMeta.tone === "danger"
          ? "linear-gradient(135deg, #ef4444, #b91c1c)"
          : "linear-gradient(135deg, #94a3b8, #64748b)";

  const confidenceBadgeStyles =
    confidenceMeta.tone === "success"
      ? { color: "#0f766e", background: "rgba(16, 185, 129, 0.14)" }
      : confidenceMeta.tone === "warning"
        ? { color: "#c2410c", background: "rgba(249, 115, 22, 0.16)" }
        : confidenceMeta.tone === "danger"
          ? { color: "#b91c1c", background: "rgba(239, 68, 68, 0.14)" }
          : { color: "#40508f", background: "rgba(92, 107, 192, 0.1)" };

  return (
    <div className="voice-module-shell">
      <header className="voice-module-header">
        <div className="voice-module-title-row">
          <h2>Voice Command Trainer</h2>
          <span className="voice-module-count">{filteredCommands.length} commands</span>
        </div>

        <div className="voice-module-controls">
          <div className="voice-search-wrap">
            <Search size={16} />
            <input
              type="text"
              placeholder="Search by command, type, or Hindi text"
              value={query}
              onChange={(event) => setQuery(event.target.value)}
            />
          </div>

          <div className="voice-filter-wrap">
            <Filter size={15} />
            <select value={typeFilter} onChange={(event) => setTypeFilter(event.target.value)}>
              <option value="All">All Types</option>
              {VOICE_COMMAND_TYPES.map((type) => (
                <option key={type} value={type}>
                  {type}
                </option>
              ))}
            </select>
          </div>

          <div className="voice-toggle-group" role="group" aria-label="Learned filter">
            <button
              type="button"
              className={!learnedOnly ? "active" : ""}
              onClick={() => setLearnedOnly(false)}
            >
              Show All
            </button>
            <button
              type="button"
              className={learnedOnly ? "active" : ""}
              onClick={() => setLearnedOnly(true)}
            >
              <Sparkles size={13} />
              Learned Only
            </button>
          </div>
        </div>
      </header>

      <section className={`voice-analysis-panel ${scoreMeta.tone}`} aria-live="polite">
        <div className="voice-analysis-top">
          <div>
            <p className="voice-analysis-eyebrow">Realtime voice analysis</p>
            <h3>Record your command and review AI feedback</h3>
            <p className="voice-analysis-subtitle">
              Capture your voice, upload it automatically, and compare clarity and command delivery.
            </p>
          </div>

          <div className="voice-analysis-actions">
            <button
              type="button"
              className={`voice-record-btn ${isRecording ? "recording" : ""}`}
              onClick={handleRecordingToggle}
              disabled={isLoading}
            >
              {isRecording ? <Square size={16} /> : <Mic size={16} />}
              {isRecording ? "Stop Recording" : "Start Recording"}
            </button>

            <button
              type="button"
              className="voice-secondary-btn"
              onClick={handleTryAgain}
              disabled={isRecording || isLoading}
            >
              <RotateCcw size={15} />
              Try Again
            </button>
          </div>
        </div>

        <div className="voice-analysis-status-row">
          <div className={`voice-recording-status ${isRecording ? "live" : ""}`}>
            <span className="voice-recording-dot" />
            {isRecording ? `Recording... ${recordingElapsed}s` : "Recorder ready"}
          </div>

          {isLoading ? (
            <div className="voice-loading-state">
              <LoaderCircle size={16} className="voice-spinner" />
              Analyzing your command...
            </div>
          ) : null}
        </div>

        {error ? (
          <div className="voice-message voice-message-error">
            <AlertCircle size={16} />
            <span>{error}</span>
          </div>
        ) : null}

        {!error && result ? (
          <div className="voice-message voice-message-success">
            <CheckCircle2 size={16} />
            <span>Analysis complete. Review your score and feedback below.</span>
          </div>
        ) : null}

        <div className="voice-analysis-content">
          <div className="voice-score-card">
            <div className="voice-score-value">{typeof result?.score === "number" ? Math.round(result.score) : "--"}</div>
            <div
              style={{
                marginTop: -6,
                fontSize: 12,
                fontWeight: 500,
                color: "#5d678f",
                lineHeight: 1.5,
              }}
            >
              Based on acoustic + AI analysis
            </div>
            <div className="voice-score-copy">
              <span className={`voice-score-pill ${scoreMeta.tone}`}>{scoreMeta.label}</span>
              <div className="voice-score-bar">
                <div className={`voice-score-fill ${scoreMeta.tone}`} style={{ width: `${scoreValue}%` }} />
              </div>
            </div>

            {isLoading ? (
              <div
                style={{
                  marginTop: 6,
                  borderRadius: 14,
                  padding: 14,
                  border: "1px solid rgba(92, 107, 192, 0.12)",
                  background: "#f8f9ff",
                }}
              >
                <div
                  style={{
                    width: "42%",
                    height: 12,
                    borderRadius: 999,
                    background: "linear-gradient(90deg, rgba(92,107,192,0.08), rgba(92,107,192,0.18), rgba(92,107,192,0.08))",
                    backgroundSize: "200% 100%",
                    animation: "voiceShimmer 1.2s ease-in-out infinite",
                    marginBottom: 10,
                  }}
                />
                <div
                  style={{
                    width: "100%",
                    height: 8,
                    borderRadius: 999,
                    background: "linear-gradient(90deg, rgba(92,107,192,0.08), rgba(92,107,192,0.18), rgba(92,107,192,0.08))",
                    backgroundSize: "200% 100%",
                    animation: "voiceShimmer 1.2s ease-in-out infinite",
                    marginBottom: 10,
                  }}
                />
                <div
                  style={{
                    width: "72%",
                    height: 10,
                    borderRadius: 999,
                    background: "linear-gradient(90deg, rgba(92,107,192,0.08), rgba(92,107,192,0.18), rgba(92,107,192,0.08))",
                    backgroundSize: "200% 100%",
                    animation: "voiceShimmer 1.2s ease-in-out infinite",
                  }}
                />
              </div>
            ) : null}

            {confidenceValue !== null ? (
              <div
                title="AI evaluates voice clarity and command strength using deep learning"
                onMouseEnter={() => setIsConfidenceHovered(true)}
                onMouseLeave={() => setIsConfidenceHovered(false)}
                style={{
                  marginTop: 6,
                  borderRadius: 14,
                  padding: 14,
                  border: "1px solid rgba(92, 107, 192, 0.12)",
                  background: "#f8f9ff",
                  boxShadow: confidenceMeta.glow,
                  transform: isConfidenceHovered ? "translateY(-2px)" : "translateY(0)",
                  transition: "box-shadow 0.35s ease, transform 0.35s ease, border-color 0.35s ease",
                  borderColor:
                    confidenceMeta.tone === "success"
                      ? "rgba(16, 185, 129, 0.2)"
                      : confidenceMeta.tone === "warning"
                        ? "rgba(249, 115, 22, 0.2)"
                        : confidenceMeta.tone === "danger"
                          ? "rgba(239, 68, 68, 0.18)"
                          : "rgba(92, 107, 192, 0.12)",
                }}
              >
                <div
                  style={{
                    display: "flex",
                    justifyContent: "space-between",
                    alignItems: "flex-start",
                    gap: 10,
                    marginBottom: 10,
                  }}
                >
                  <div>
                    <div style={{ fontSize: 13, fontWeight: 700, color: "#24315c", marginBottom: 4 }}>
                      AI Confidence
                    </div>
                    <div
                      style={{
                        display: "inline-flex",
                        alignItems: "center",
                        gap: 6,
                        fontSize: 11,
                        fontWeight: 700,
                        color: "#40508f",
                        background: "rgba(92, 107, 192, 0.08)",
                        borderRadius: 999,
                        padding: "4px 8px",
                        marginBottom: 6,
                      }}
                    >
                      <span aria-hidden="true">🧠</span>
                      AI Analysis Enabled
                    </div>
                    <div style={{ fontSize: 11, lineHeight: 1.5, color: "#5d678f" }}>
                      AI evaluates voice clarity and command strength
                    </div>
                  </div>

                  <span
                    style={{
                      fontSize: 12,
                      fontWeight: 700,
                      borderRadius: 999,
                      padding: "5px 9px",
                      ...confidenceBadgeStyles,
                    }}
                  >
                    {Math.round(confidenceValue)}%
                  </span>
                </div>

                <div
                  style={{
                    height: 8,
                    borderRadius: 999,
                    background: "rgba(92, 107, 192, 0.12)",
                    overflow: "hidden",
                  }}
                >
                  <div
                    style={{
                      width: `${confidenceValue}%`,
                      height: "100%",
                      borderRadius: "inherit",
                      background: confidenceBarColor,
                      transition: "width 0.6s ease, box-shadow 0.35s ease",
                      boxShadow:
                        confidenceMeta.tone === "success"
                          ? "0 0 12px rgba(16, 185, 129, 0.28)"
                          : confidenceMeta.tone === "warning"
                            ? "0 0 10px rgba(249, 115, 22, 0.18)"
                            : "none",
                    }}
                  />
                </div>
              </div>
            ) : null}
          </div>

          <div className="voice-metrics-grid">
            <div className="voice-metric-card">
              <span>Pitch</span>
              <strong>{formatMetric(result?.pitch)}</strong>
            </div>
            <div className="voice-metric-card">
              <span>Amplitude</span>
              <strong>{formatMetric(result?.amplitude)}</strong>
            </div>
            <div className="voice-metric-card">
              <span>Energy</span>
              <strong>{formatMetric(result?.energy)}</strong>
            </div>
            <div className="voice-metric-card">
              <span>Duration</span>
              <strong>{formatDuration(result?.duration)}</strong>
            </div>
          </div>

          <div className="voice-feedback-card">
            <h4>Feedback</h4>
            {result?.feedback?.length ? (
              <ul className="voice-feedback-list">
                {result.feedback.map((item, index) => (
                  <li key={`${item}-${index}`}>{item}</li>
                ))}
              </ul>
            ) : (
              <p className="voice-feedback-empty">
                {isLoading ? "Preparing feedback..." : "Record a command to receive analysis feedback."}
              </p>
            )}
          </div>

          {audioUrl ? (
            <div className="voice-playback-card">
              <h4>Your recording</h4>

              <div
                ref={waveformContainerRef}
                style={{
                  width: "100%",
                  minHeight: 88,
                  borderRadius: 12,
                  background: "#ffffff",
                  border: "1px solid rgba(92, 107, 192, 0.14)",
                  padding: "8px 10px",
                  marginBottom: 12,
                }}
              />

              <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 10 }}>
                <button
                  type="button"
                  onClick={handleWaveToggle}
                  style={{
                    border: "1px solid rgba(92, 107, 192, 0.18)",
                    background: "#eff2ff",
                    color: "#30416f",
                    borderRadius: 10,
                    fontSize: 12,
                    fontWeight: 700,
                    padding: "8px 12px",
                    cursor: "pointer",
                    display: "inline-flex",
                    alignItems: "center",
                    gap: 6,
                  }}
                >
                  {isWavePlaying ? <Pause size={14} /> : <Play size={14} />}
                  {isWavePlaying ? "Pause" : "Play"}
                </button>
              </div>

              <audio controls src={audioUrl} className="voice-playback-audio">
                Your browser does not support audio playback.
              </audio>
              <p>{audioBlob ? `Recorded clip ready for replay (${Math.max(1, Math.round(audioBlob.size / 1024))} KB).` : ""}</p>
            </div>
          ) : null}
        </div>
      </section>

      <div className="voice-card-list" role="list">
        {filteredCommands.map((command) => (
          <VoiceCommandCard
            key={command.id}
            command={command}
            audioSrc={commandAudio}
            isExpanded={Boolean(expanded[command.id])}
            isLearned={Boolean(learned[command.id])}
            isPlaying={nowPlaying.id === command.id}
            playingSpeed={nowPlaying.speed}
            onToggleExpand={() => toggleExpanded(command.id)}
            onToggleLearned={() => toggleLearned(command.id)}
            onPlay={(speed) => playCommandAudio(command.id, speed)}
            onAudioRef={(node) => registerAudioRef(command.id, node)}
          />
        ))}

        {!filteredCommands.length ? (
          <div className="voice-empty-state">No commands matched your current filters.</div>
        ) : null}
      </div>
    </div>
  );
}
