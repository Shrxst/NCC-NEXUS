import React, { useEffect, useMemo, useRef, useState } from "react";
import { CheckCircle2, ClipboardCheck, Clock3, Download, Eye, Flag, ShieldAlert } from "lucide-react";
import { useLocation, useNavigate, useParams } from "react-router-dom";
import { API_BASE_URL } from "../../api/config";
import { formatAttemptDate, formatDuration, titleCase } from "./quizFormatters";
import { generateQuizReportPdf, mapAttemptToPdfData } from "./quizPdfExport";
import { useProctorGuard } from "./useProctorGuard";
import "./quiz.css";

const LEVEL_OPTIONS = ["easy", "medium", "hard", "mixed"];
const MODE_OPTIONS = [
  { key: "practice", label: "Practice Mode", description: "Randomized 25-question practice test." },
  { key: "mock", label: "Mock Test Mode", description: "Fixed-question full mock paper." },
];
const SECTION_OPTIONS = [
  { key: "start_quiz", label: "Start Quiz" },
  { key: "my_attempts", label: "My Attempts" },
];
const optionList = ["A", "B", "C", "D"];
const DEBAR_STATUS = "failed_due_to_violation";
const ATTEMPT_CONTEXT_KEY = (attemptId) => `quiz_attempt_context_${attemptId}`;

const authHeaders = () => {
  const token = localStorage.getItem("token");
  if (!token) throw new Error("Session expired. Please login again.");
  return {
    Authorization: `Bearer ${token}`,
    "Content-Type": "application/json",
  };
};

const apiCall = async (path, options = {}) => {
  const response = await fetch(`${API_BASE_URL}${path}`, {
    ...options,
    headers: {
      ...authHeaders(),
      ...(options.headers || {}),
    },
  });
  const payload = await response.json().catch(() => ({}));
  if (!response.ok) {
    throw new Error(payload?.message || "Quiz request failed.");
  }
  return payload;
};

const attemptToPdfShape = ({ summary, rows }) => ({
  date: summary.submitted_at || summary.started_at || Date.now(),
  level: summary.level_selected || "mixed",
  mode: summary.quiz_type || "practice",
  score: Number(summary.final_score || 0),
  accuracy: Number(summary.accuracy_percent || 0),
  timeTakenSeconds: Number(summary.time_taken_seconds || 0),
  negativeMarks: Number(summary.negative_marks || 0),
  correct: Number(summary.correct_count || 0),
  incorrect: Number(summary.incorrect_count || 0),
  unattempted: Number(summary.unattempted_count || 0),
  totalQuestions: Number(summary.total_questions || 0),
  questionBreakdown: rows.map((item, index) => ({
    questionNo: item.question_no || index + 1,
    questionText: item.question_text,
    options: optionList.map((id) => ({ id, text: item[`option_${id.toLowerCase()}`] || "" })),
    selectedOption: item.selected_option,
    correctOption: item.correct_option,
    explanation: item.explanation,
    marksAwarded: Number(item.marks_awarded || 0),
  })),
});

const isDebarred = (attempt) => attempt?.status === DEBAR_STATUS;
const resolveDashboardPath = () => {
  const role = localStorage.getItem("role");
  if (role === "SUO") return "/suo-dashboard";
  return "/dashboard";
};

export default function QuizModule({ participantName = "Cadet Participant", participantRank = "Cadet", attemptOnly = false }) {
  const navigate = useNavigate();
  const location = useLocation();
  const { attemptId: routeAttemptId } = useParams();
  const [status, setStatus] = useState("home");
  const [homeSection, setHomeSection] = useState("start_quiz");
  const [mode, setMode] = useState("practice");
  const [level, setLevel] = useState("mixed");
  const [mockTests, setMockTests] = useState([]);
  const [selectedMockTestId, setSelectedMockTestId] = useState("");
  const [rulesAccepted, setRulesAccepted] = useState(false);
  const [attemptId, setAttemptId] = useState(null);
  const [questions, setQuestions] = useState([]);
  const [currentQuestionIndex, setCurrentQuestionIndex] = useState(0);
  const [answers, setAnswers] = useState({});
  const [markedForReview, setMarkedForReview] = useState({});
  const [visited, setVisited] = useState({});
  const [endTimestamp, setEndTimestamp] = useState(null);
  const [remainingSeconds, setRemainingSeconds] = useState(0);
  const [attempts, setAttempts] = useState([]);
  const [resultSummary, setResultSummary] = useState(null);
  const [resultBreakdown, setResultBreakdown] = useState([]);
  const [reviewSummary, setReviewSummary] = useState(null);
  const [reviewRows, setReviewRows] = useState([]);
  const [selectedAttemptId, setSelectedAttemptId] = useState(null);
  const [downloadingAttemptId, setDownloadingAttemptId] = useState(null);
  const [copyBlockedNotice, setCopyBlockedNotice] = useState("");
  const [attemptContextLoaded, setAttemptContextLoaded] = useState(!attemptOnly);
  const [loading, setLoading] = useState(false);
  const [errorMessage, setErrorMessage] = useState("");

  const guardInitRef = useRef(false);
  const submitInFlightRef = useRef(false);
  const currentQuestion = questions[currentQuestionIndex];
  const isAttemptLive = status === "in_progress" && Boolean(attemptId);
  const isCurrentResultDebarred = isDebarred(resultSummary);

  useEffect(() => {
    if (!attemptOnly) return;

    const stateContext = location.state?.attemptContext;
    let storedContext = null;

    if (!stateContext && routeAttemptId) {
      const raw = sessionStorage.getItem(ATTEMPT_CONTEXT_KEY(routeAttemptId));
      if (raw) {
        try {
          storedContext = JSON.parse(raw);
        } catch (_error) {
          storedContext = null;
        }
      }
    }

    const context = stateContext || storedContext;
    const isContextValid =
      context &&
      context.attemptId === routeAttemptId &&
      Array.isArray(context.questions) &&
      context.questions.length > 0;

    if (!isContextValid) {
      setErrorMessage("Attempt context not found. Start the quiz again from dashboard.");
      setAttemptContextLoaded(false);
      if (routeAttemptId) {
        sessionStorage.removeItem(ATTEMPT_CONTEXT_KEY(routeAttemptId));
      }
      navigate(resolveDashboardPath(), { replace: true });
      return;
    }

    setAttemptId(context.attemptId);
    setMode(context.mode || "practice");
    setQuestions(Array.isArray(context.questions) ? context.questions : []);
    setCurrentQuestionIndex(0);
    setAnswers(context.answers || {});
    setMarkedForReview(context.markedForReview || {});
    setVisited(context.visited || (context.questions?.[0] ? { [context.questions[0].id]: true } : {}));
    setResultSummary(null);
    setResultBreakdown([]);
    setEndTimestamp(Number(context.endTimestamp || 0));
    setRemainingSeconds(Math.max(0, Math.ceil((Number(context.endTimestamp || 0) - Date.now()) / 1000)));
    setStatus("in_progress");
    guardInitRef.current = false;
    setAttemptContextLoaded(true);
  }, [attemptOnly, location.state, navigate, routeAttemptId]);

  const answeredCount = useMemo(
    () => questions.reduce((count, question) => (answers[question.id] ? count + 1 : count), 0),
    [answers, questions]
  );

  const loadAttempts = async () => {
    const payload = await apiCall("/api/quiz/attempts");
    setAttempts(payload.attempts || []);
  };

  const loadMockTests = async () => {
    const payload = await apiCall("/api/quiz/mock-tests");
    const items = payload.mock_tests || [];
    setMockTests(items);
    if (items.length && !selectedMockTestId) {
      setSelectedMockTestId(items[0].id);
    }
  };

  const { isGuardActive, activateGuard } = useProctorGuard({
    enabled: isAttemptLive,
    onCopyBlocked: () => {
      setCopyBlockedNotice("Copy is disabled during quiz.");
      window.setTimeout(() => setCopyBlockedNotice(""), 1800);
    },
  });

  useEffect(() => {
    const bootstrap = async () => {
      setLoading(true);
      setErrorMessage("");
      try {
        await Promise.all([loadAttempts(), loadMockTests()]);
      } catch (error) {
        setErrorMessage(error.message || "Unable to load quiz data.");
      } finally {
        setLoading(false);
      }
    };
    bootstrap();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    if (!isAttemptLive || !attemptId) return;
    const context = {
      attemptId,
      mode,
      questions,
      answers,
      markedForReview,
      visited,
      endTimestamp,
    };
    sessionStorage.setItem(ATTEMPT_CONTEXT_KEY(attemptId), JSON.stringify(context));
  }, [answers, attemptId, endTimestamp, isAttemptLive, markedForReview, mode, questions, visited]);

  useEffect(() => {
    if (!attemptOnly || !isAttemptLive || !attemptContextLoaded || isGuardActive || guardInitRef.current) {
      return;
    }

    guardInitRef.current = true;
    activateGuard(0);
    return undefined;
  }, [activateGuard, attemptContextLoaded, attemptOnly, isAttemptLive, isGuardActive]);

  useEffect(() => {
    if (status !== "in_progress" || !endTimestamp) {
      return undefined;
    }
    const tick = () => {
      const next = Math.max(0, Math.ceil((endTimestamp - Date.now()) / 1000));
      setRemainingSeconds(next);
      if (next === 0) {
        submitAttempt();
      }
    };
    tick();
    const timerId = setInterval(tick, 1000);
    return () => clearInterval(timerId);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [status, endTimestamp, attemptId]);

  const startQuizFlow = () => {
    setRulesAccepted(false);
    setErrorMessage("");
    setStatus("instructions");
  };

  const beginAttempt = async () => {
    setLoading(true);
    setErrorMessage("");
    try {
      const payload =
        mode === "practice"
          ? await apiCall("/api/quiz/practice/start", {
              method: "POST",
              body: JSON.stringify({ level }),
            })
          : await apiCall(`/api/quiz/mock/${selectedMockTestId}/start`, {
              method: "POST",
            });

      const questionList = payload.questions || [];
      const durationMinutes = Number(payload.duration_minutes || 10);
      const computedEndTimestamp = Date.now() + durationMinutes * 60 * 1000;
      const attemptContext = {
        attemptId: payload.attempt_id,
        mode,
        questions: questionList,
        answers: {},
        markedForReview: {},
        visited: questionList[0] ? { [questionList[0].id]: true } : {},
        endTimestamp: computedEndTimestamp,
      };

      sessionStorage.setItem(ATTEMPT_CONTEXT_KEY(payload.attempt_id), JSON.stringify(attemptContext));
      navigate(`/quiz/attempt/${payload.attempt_id}`, { state: { attemptContext } });
      return;
    } catch (error) {
      setErrorMessage(error.message || "Failed to start attempt.");
    } finally {
      setLoading(false);
    }
  };

  const submitAttempt = async () => {
    if (!attemptId) return;
    if (submitInFlightRef.current) return;
    submitInFlightRef.current = true;
    setLoading(true);
    setErrorMessage("");
    try {
      const answersPayload = Object.entries(answers).map(([question_id, selected_option]) => ({
        question_id,
        selected_option,
      }));
      const payload = await apiCall("/api/quiz/submit", {
        method: "POST",
        body: JSON.stringify({
          attempt_id: attemptId,
          answers: answersPayload,
          proctor_events: [],
        }),
      });
      setResultSummary(payload.summary || null);
      setResultBreakdown(payload.detailed_breakdown || []);
      setStatus("submitted");
      setEndTimestamp(null);
      setRemainingSeconds(0);
      sessionStorage.removeItem(ATTEMPT_CONTEXT_KEY(attemptId));
      await loadAttempts();
    } catch (error) {
      setErrorMessage(error.message || "Failed to submit attempt.");
    } finally {
      submitInFlightRef.current = false;
      setLoading(false);
    }
  };

  const reviewColor = (question) => {
    if (markedForReview[question.id]) return "marked";
    if (answers[question.id]) return "answered";
    if (visited[question.id]) return "visited";
    return "not-visited";
  };

  const openAttemptReview = async (id) => {
    const selected = attempts.find((item) => item.id === id);
    if (isDebarred(selected)) {
      setErrorMessage("Debarred attempts cannot be reviewed.");
      return;
    }

    setLoading(true);
    setErrorMessage("");
    try {
      const payload = await apiCall(`/api/quiz/attempt/${id}`);
      setSelectedAttemptId(id);
      setReviewSummary(payload.summary || null);
      setReviewRows(payload.question_wise_review || []);
      setStatus("attempt_review");
    } catch (error) {
      setErrorMessage(error.message || "Failed to load attempt review.");
    } finally {
      setLoading(false);
    }
  };

  const onDownloadAttempt = async ({ id, summary, rows }) => {
    if (isDebarred(summary)) {
      setErrorMessage("PDF download is disabled for debarred attempts.");
      return;
    }
    setDownloadingAttemptId(id);
    try {
      const pdfAttempt = attemptToPdfShape({ summary, rows });
      const data = mapAttemptToPdfData({
        attempt: pdfAttempt,
        cadetName: participantName,
        cadetRank: participantRank,
      });
      await generateQuizReportPdf(data);
    } finally {
      setDownloadingAttemptId(null);
    }
  };

  const downloadAttemptFromList = async (attempt) => {
    if (isDebarred(attempt)) {
      setErrorMessage("PDF download is disabled for debarred attempts.");
      return;
    }
    setDownloadingAttemptId(attempt.id);
    try {
      const payload = await apiCall(`/api/quiz/attempt/${attempt.id}`);
      await onDownloadAttempt({
        id: attempt.id,
        summary: payload.summary || {},
        rows: payload.question_wise_review || [],
      });
    } catch (error) {
      setErrorMessage(error.message || "Failed to generate PDF.");
      setDownloadingAttemptId(null);
    }
  };

  if (status === "attempt_review" && reviewSummary) {
    return (
      <div className="quiz-shell">
        <section className="quiz-result-card">
          <div className="quiz-result-header">
            <h2>Attempt Review</h2>
            <div className="quiz-inline-actions">
              <button
                className="quiz-btn-secondary"
                disabled={downloadingAttemptId === selectedAttemptId}
                onClick={() => onDownloadAttempt({ id: selectedAttemptId, summary: reviewSummary, rows: reviewRows })}
              >
                <Download size={14} /> {downloadingAttemptId === selectedAttemptId ? "Generating..." : "Download PDF"}
              </button>
              <button className="quiz-btn-primary" onClick={() => { setStatus("home"); setHomeSection("my_attempts"); }}>
                Back to Attempts
              </button>
            </div>
          </div>
          <div className="quiz-result-summary">
            <div className="quiz-metric"><span>Score</span><strong>{reviewSummary.final_score}</strong></div>
            <div className="quiz-metric"><span>Accuracy</span><strong>{reviewSummary.accuracy_percent}%</strong></div>
            <div className="quiz-metric"><span>Total Questions</span><strong>{reviewSummary.total_questions}</strong></div>
            <div className="quiz-metric"><span>Duration</span><strong>{formatDuration(reviewSummary.duration_seconds)}</strong></div>
            <div className="quiz-metric"><span>Correct</span><strong>{reviewSummary.correct_count}</strong></div>
            <div className="quiz-metric"><span>Incorrect</span><strong>{reviewSummary.incorrect_count}</strong></div>
            <div className="quiz-metric"><span>Unattempted</span><strong>{reviewSummary.unattempted_count}</strong></div>
            <div className="quiz-metric"><span>Negative Deduction</span><strong>-{reviewSummary.negative_marks}</strong></div>
          </div>
          <div className="quiz-review-list">
            {reviewRows.map((item) => (
              <details key={item.question_id} className={`quiz-review-item ${item.is_correct ? "correct" : item.selected_option ? "incorrect" : "unanswered"}`} open={item.question_no <= 2}>
                <summary>Q{item.question_no}. {item.question_text}</summary>
                <div className="quiz-review-options">
                  {optionList.map((id) => {
                    const isCorrectOption = id === item.correct_option;
                    const isWrongSelected = id === item.selected_option && item.selected_option !== item.correct_option;
                    return (
                      <p key={id} className={`quiz-review-option ${isCorrectOption ? "correct" : ""} ${isWrongSelected ? "wrong" : ""}`}>
                        {id}. {item[`option_${id.toLowerCase()}`]}
                      </p>
                    );
                  })}
                </div>
                <p><strong>Selected:</strong> {item.selected_option || "Not Attempted"}</p>
                <p><strong>Correct:</strong> {item.correct_option}</p>
                <p><strong>Marks:</strong> {Number(item.marks_awarded) > 0 ? "+1" : Number(item.marks_awarded) < 0 ? "-0.25" : "0"}</p>
                <details className="quiz-explanation">
                  <summary>Explanation</summary>
                  <p>{item.explanation}</p>
                </details>
              </details>
            ))}
          </div>
        </section>
      </div>
    );
  }

  if (status === "submitted" && resultSummary) {
    return (
      <div className="quiz-shell">
        <section className="quiz-result-card">
          <div className="quiz-result-header">
            <h2>Attempt Result</h2>
            {!isCurrentResultDebarred ? (
              <div className="quiz-inline-actions">
                <button
                  className="quiz-btn-secondary"
                  disabled={downloadingAttemptId === resultSummary.attempt_id}
                  onClick={() => onDownloadAttempt({
                    id: resultSummary.attempt_id,
                    summary: resultSummary,
                    rows: resultBreakdown,
                  })}
                >
                  <Download size={14} /> {downloadingAttemptId === resultSummary.attempt_id ? "Generating..." : "Download PDF"}
                </button>
                <button className="quiz-btn-primary" onClick={() => openAttemptReview(resultSummary.attempt_id)}>View Detailed Review</button>
                {attemptOnly ? (
                  <button className="quiz-btn-secondary" onClick={() => navigate(resolveDashboardPath(), { replace: true })}>Return to Dashboard</button>
                ) : (
                  <button className="quiz-btn-secondary" onClick={() => { setStatus("home"); setHomeSection("start_quiz"); }}>New Attempt</button>
                )}
              </div>
            ) : null}
          </div>
          {isCurrentResultDebarred ? (
            <div className="quiz-result-summary">
              <div className="quiz-metric">
                <span>Status</span>
                <strong>Debarred</strong>
              </div>
              <div className="quiz-metric">
                <span>Message</span>
                <strong>You have been debarred due to exam rule violation.</strong>
              </div>
            </div>
          ) : (
            <div className="quiz-result-summary">
              <div className="quiz-metric"><span>Correct</span><strong>{resultSummary.correct_count}</strong></div>
              <div className="quiz-metric"><span>Incorrect</span><strong>{resultSummary.incorrect_count}</strong></div>
              <div className="quiz-metric"><span>Unattempted</span><strong>{resultSummary.unattempted_count}</strong></div>
              <div className="quiz-metric"><span>Negative Deducted</span><strong>-{resultSummary.negative_marks}</strong></div>
              <div className="quiz-metric"><span>Final Score</span><strong>{resultSummary.final_score}</strong></div>
              <div className="quiz-metric"><span>Accuracy</span><strong>{resultSummary.accuracy_percent}%</strong></div>
              <div className="quiz-metric"><span>Time Taken</span><strong>{formatDuration(resultSummary.time_taken_seconds)}</strong></div>
            </div>
          )}
        </section>
      </div>
    );
  }

  if (status === "in_progress" && currentQuestion) {
    const shellClass = "quiz-shell quiz-in-progress";
    return (
      <div className={shellClass}>
        <header className="quiz-topbar">
          <div>
            <h2>NCC Examination Portal</h2>
            <p>{mode === "mock" ? "Mock Test Mode" : "Practice Mode"}</p>
          </div>
          <span className="quiz-warning-pill"><ShieldAlert size={14} /> Copy Blocked</span>
        </header>
        <div className="quiz-attempt-layout">
          <section className="quiz-question-panel">
            <p className="quiz-question-meta">Question {currentQuestionIndex + 1} of {questions.length}</p>
            <h3>{currentQuestion.question_text}</h3>
            <div className="quiz-options">
              {optionList.map((id) => (
                <label key={id} className={`quiz-option ${answers[currentQuestion.id] === id ? "active" : ""}`}>
                  <input
                    type="radio"
                    name={currentQuestion.id}
                    checked={answers[currentQuestion.id] === id}
                    onChange={() => setAnswers((prev) => ({ ...prev, [currentQuestion.id]: id }))}
                  />
                  <span>{id}. {currentQuestion[`option_${id.toLowerCase()}`]}</span>
                </label>
              ))}
            </div>
            <label className="quiz-mark">
              <input
                type="checkbox"
                checked={Boolean(markedForReview[currentQuestion.id])}
                onChange={() => setMarkedForReview((prev) => ({ ...prev, [currentQuestion.id]: !prev[currentQuestion.id] }))}
              />
              Mark for Review
            </label>
            <div className="quiz-question-actions">
              <button
                className="quiz-btn-secondary"
                disabled={currentQuestionIndex === 0}
                onClick={() => setCurrentQuestionIndex((prev) => Math.max(0, prev - 1))}
              >
                Previous
              </button>
              <button
                className="quiz-btn-primary"
                disabled={currentQuestionIndex === questions.length - 1}
                onClick={() => {
                  const next = Math.min(questions.length - 1, currentQuestionIndex + 1);
                  setCurrentQuestionIndex(next);
                  if (questions[next]) {
                    setVisited((prev) => ({ ...prev, [questions[next].id]: true }));
                  }
                }}
              >
                Next
              </button>
            </div>
          </section>
          <aside className="quiz-navigator-panel">
            <div className={`quiz-timer ${remainingSeconds < 60 ? "critical" : ""}`}>
              <Clock3 size={16} />
              <span>{formatDuration(remainingSeconds)}</span>
            </div>
            <p className="quiz-grid-title">Question Navigator</p>
            <div className="quiz-grid">
              {questions.map((question, index) => (
                <button
                  key={question.id}
                  className={`quiz-grid-item ${reviewColor(question)} ${index === currentQuestionIndex ? "current" : ""}`}
                  onClick={() => {
                    setCurrentQuestionIndex(index);
                    setVisited((prev) => ({ ...prev, [question.id]: true }));
                  }}
                >
                  {index + 1}
                </button>
              ))}
            </div>
            <div className="quiz-navigator-meta">
              <p>Answered: <strong>{answeredCount}</strong></p>
              <p>Remaining: <strong>{questions.length - answeredCount}</strong></p>
            </div>
            <button className="quiz-btn-danger" onClick={submitAttempt} disabled={loading}>
              {loading ? "Submitting..." : "Submit Attempt"}
            </button>
          </aside>
        </div>
        {copyBlockedNotice ? <div className="quiz-admin-modal-subtext">{copyBlockedNotice}</div> : null}
      </div>
    );
  }

  if (attemptOnly) {
    return (
      <div className="quiz-shell quiz-attempt-standalone">
        <section className="quiz-home-card">
          <div className="quiz-home-title">
            <ClipboardCheck size={20} />
            <h2>{attemptContextLoaded ? "Preparing Attempt..." : "Attempt Unavailable"}</h2>
          </div>
          <p className="quiz-admin-modal-subtext">
            {errorMessage || "Loading attempt..."}
          </p>
          <div className="quiz-modal-actions">
            <button className="quiz-btn-primary" onClick={() => navigate(resolveDashboardPath(), { replace: true })}>
              Back to Dashboard
            </button>
          </div>
        </section>
      </div>
    );
  }

  return (
    <div className="quiz-shell">
      <section className="quiz-home-card">
        <div className="quiz-home-title">
          <ClipboardCheck size={20} />
          <h2>Quiz & Mock Tests</h2>
        </div>
        <div className="quiz-home-tabs">
          {SECTION_OPTIONS.map((item) => (
            <button
              key={item.key}
              className={`quiz-home-tab ${homeSection === item.key ? "active" : ""}`}
              onClick={() => setHomeSection(item.key)}
            >
              {item.label}
            </button>
          ))}
        </div>
        {errorMessage ? <p className="quiz-admin-modal-subtext">{errorMessage}</p> : null}
        {loading ? <p className="quiz-admin-modal-subtext">Loading...</p> : null}
        {homeSection === "start_quiz" ? (
          <>
            <div className="quiz-selection-group">
              <p>Mode Selection</p>
              <div className="quiz-pill-row">
                {MODE_OPTIONS.map((item) => (
                  <button key={item.key} className={`quiz-pill ${mode === item.key ? "active" : ""}`} onClick={() => setMode(item.key)}>
                    <strong>{item.label}</strong>
                    <span>{item.description}</span>
                  </button>
                ))}
              </div>
            </div>
            {mode === "practice" ? (
              <div className="quiz-selection-group">
                <p>Level Selection</p>
                <div className="quiz-chip-row">
                  {LEVEL_OPTIONS.map((item) => (
                    <button key={item} className={`quiz-chip ${level === item ? "active" : ""}`} onClick={() => setLevel(item)}>
                      {item.toUpperCase()}
                    </button>
                  ))}
                </div>
              </div>
            ) : (
              <div className="quiz-selection-group">
                <p>Mock Test Selection</p>
                <div className="quiz-chip-row">
                  {mockTests.map((item) => (
                    <button
                      key={item.id}
                      className={`quiz-chip ${selectedMockTestId === item.id ? "active" : ""}`}
                      onClick={() => setSelectedMockTestId(item.id)}
                    >
                      {item.title}
                    </button>
                  ))}
                </div>
              </div>
            )}
            <div className="quiz-info-card">
              <p><CheckCircle2 size={16} /> {mode === "practice" ? "25 Questions" : "50 Questions"}</p>
              <p><Clock3 size={16} /> {mode === "practice" ? "10 Minutes" : "30 Minutes"}</p>
              <p><Flag size={16} /> Auto Submit</p>
              <p><ShieldAlert size={16} /> Copy restricted during active attempt</p>
            </div>
            <button
              className="quiz-btn-primary"
              onClick={startQuizFlow}
              disabled={mode === "mock" && !selectedMockTestId}
            >
              Start Quiz
            </button>
          </>
        ) : (
          <div className="quiz-attempts-section">
            <div className="quiz-admin-table-wrap">
              <table className="quiz-admin-table">
                <thead>
                  <tr>
                    <th>Attempt Date</th>
                    <th>Type</th>
                    <th>Level</th>
                    <th>Score</th>
                    <th>Accuracy %</th>
                    <th>Status</th>
                    <th>Download PDF</th>
                    <th>View Details</th>
                  </tr>
                </thead>
                <tbody>
                  {attempts.map((attempt) => (
                    <tr key={attempt.id}>
                      <td>{formatAttemptDate(attempt.submitted_at || attempt.created_at)}</td>
                      <td>{titleCase(attempt.quiz_type)}</td>
                      <td>{titleCase(attempt.level_selected || "-")}</td>
                      <td>{attempt.final_score ?? "-"}</td>
                      <td>{attempt.accuracy_percent ?? "-"}</td>
                      <td>{titleCase(attempt.status)}</td>
                      <td>
                        <button
                          className="quiz-view-btn"
                          disabled={downloadingAttemptId === attempt.id || isDebarred(attempt)}
                          onClick={() => downloadAttemptFromList(attempt)}
                        >
                          <Download size={14} /> {downloadingAttemptId === attempt.id ? "Generating..." : isDebarred(attempt) ? "Blocked" : "PDF"}
                        </button>
                      </td>
                      <td>
                        <button className="quiz-view-btn" disabled={isDebarred(attempt)} onClick={() => openAttemptReview(attempt.id)}>
                          <Eye size={14} /> {isDebarred(attempt) ? "Blocked" : "Details"}
                        </button>
                      </td>
                    </tr>
                  ))}
                  {!attempts.length ? (
                    <tr>
                      <td colSpan={8} className="quiz-empty">No attempts yet. Start your first quiz attempt.</td>
                    </tr>
                  ) : null}
                </tbody>
              </table>
            </div>
          </div>
        )}
      </section>

      {status === "instructions" ? (
        <div className="quiz-overlay">
          <div className="quiz-modal">
            <h3>Pre-Quiz Instructions</h3>
            <ul>
              <li>{mode === "practice" ? "Total Questions: 25" : "Total Questions: 50"}</li>
              <li>Negative Marking: -0.25 for each incorrect answer</li>
              <li>Copying is not allowed during active attempt</li>
              <li>Auto-submit on timer completion</li>
            </ul>
            <label className="quiz-mark">
              <input
                type="checkbox"
                checked={rulesAccepted}
                onChange={(event) => setRulesAccepted(event.target.checked)}
              />
              I agree to exam rules
            </label>
            <div className="quiz-modal-actions">
              <button className="quiz-btn-secondary" onClick={() => setStatus("home")}>Cancel</button>
              <button className="quiz-btn-primary" disabled={!rulesAccepted || loading} onClick={beginAttempt}>Start Attempt</button>
            </div>
          </div>
        </div>
      ) : null}
    </div>
  );
}
