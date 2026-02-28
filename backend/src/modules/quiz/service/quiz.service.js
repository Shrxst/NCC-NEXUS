const repo = require("../repository/quiz.repository");

const PRACTICE_TOTAL_QUESTIONS = 25;
const PRACTICE_DURATION_MINUTES = 10;
const CORRECT_MARK = 1;
const NEGATIVE_MARK = 0.25;

const createHttpError = (status, message) => {
  const err = new Error(message);
  err.status = status;
  return err;
};

const round2 = (value) => Number(Number(value).toFixed(2));
const FAILED_DUE_TO_VIOLATION = "failed_due_to_violation";

const sanitizeQuestion = (question) => ({
  id: question.id,
  question_text: question.question_text,
  option_a: question.option_a,
  option_b: question.option_b,
  option_c: question.option_c,
  option_d: question.option_d,
});

const ensureUser = async (userId) => {
  const user = await repo.getUserById(userId);
  if (!user) throw createHttpError(401, "Unauthorized user.");
};

const pickPracticeQuestions = async (level) => {
  if (level === "mixed") {
    const mixedTargets = [
      { difficulty: "easy", limit: 10 },
      { difficulty: "medium", limit: 10 },
      { difficulty: "hard", limit: 5 },
    ];

    const grouped = await Promise.all(
      mixedTargets.map((entry) =>
        repo.getRandomQuestionsByDifficulty({
          difficulty: entry.difficulty,
          limit: entry.limit,
        })
      )
    );

    const selected = grouped.flat();
    if (selected.length < PRACTICE_TOTAL_QUESTIONS) {
      const fill = await repo.getRandomQuestionsFallback({
        excludeIds: selected.map((row) => row.id),
        limit: PRACTICE_TOTAL_QUESTIONS - selected.length,
      });
      return [...selected, ...fill];
    }
    return selected;
  }

  const primary = await repo.getRandomQuestionsByDifficulty({
    difficulty: level,
    limit: PRACTICE_TOTAL_QUESTIONS,
  });

  if (primary.length < PRACTICE_TOTAL_QUESTIONS) {
    const fill = await repo.getRandomQuestionsFallback({
      excludeIds: primary.map((row) => row.id),
      limit: PRACTICE_TOTAL_QUESTIONS - primary.length,
    });
    return [...primary, ...fill];
  }

  return primary;
};

const startPracticeAttempt = async ({ userId, level }) => {
  await ensureUser(userId);
  const questions = await pickPracticeQuestions(level);

  if (questions.length !== PRACTICE_TOTAL_QUESTIONS) {
    throw createHttpError(500, "Insufficient active question bank to start practice quiz.");
  }

  const startedAt = new Date();
  const durationSeconds = PRACTICE_DURATION_MINUTES * 60;

  const attempt = await repo.db.transaction(async (trx) => {
    const created = await repo.createAttemptTx({
      trx,
      userId,
      quizType: "practice",
      mockTestId: null,
      levelSelected: level,
      startedAt,
      durationSeconds,
      totalQuestions: PRACTICE_TOTAL_QUESTIONS,
    });

    await repo.insertAttemptQuestionRowsTx({
      trx,
      attemptId: created.id,
      questionIds: questions.map((q) => q.id),
    });

    return created;
  });

  return {
    attempt_id: attempt.id,
    duration_minutes: PRACTICE_DURATION_MINUTES,
    questions: questions.map(sanitizeQuestion),
  };
};

const startMockAttempt = async ({ userId, mockTestId }) => {
  await ensureUser(userId);

  const mock = await repo.getActiveMockTestById(mockTestId);
  if (!mock) throw createHttpError(404, "Mock test not found.");

  const questions = await repo.getMockQuestionsOrdered(mockTestId);
  if (questions.length !== mock.total_questions) {
    throw createHttpError(500, "Mock test question set is invalid.");
  }

  const startedAt = new Date();
  const durationSeconds = Number(mock.duration_minutes) * 60;

  const attempt = await repo.db.transaction(async (trx) => {
    const created = await repo.createAttemptTx({
      trx,
      userId,
      quizType: "mock",
      mockTestId: mock.id,
      levelSelected: null,
      startedAt,
      durationSeconds,
      totalQuestions: mock.total_questions,
    });

    await repo.insertAttemptQuestionRowsTx({
      trx,
      attemptId: created.id,
      questionIds: questions.map((q) => q.id),
    });

    return created;
  });

  return {
    attempt_id: attempt.id,
    mock_test_id: mock.id,
    mock_title: mock.title,
    duration_minutes: Number(mock.duration_minutes),
    questions: questions.map(sanitizeQuestion),
  };
};

const scoreAttempt = ({ questionRows, answersMap, durationSeconds, startedAt, submittedAt }) => {
  let correctCount = 0;
  let incorrectCount = 0;
  let unattemptedCount = 0;
  let negativeMarks = 0;

  const detailedBreakdown = questionRows.map((row, index) => {
    const selectedOption = answersMap.get(row.question_id) || null;
    const isAnswered = Boolean(selectedOption);
    const isCorrect = isAnswered && selectedOption === row.correct_option;

    let marksAwarded = 0;
    let status = "unattempted";

    if (!isAnswered) {
      unattemptedCount += 1;
      status = "unattempted";
    } else if (isCorrect) {
      correctCount += 1;
      marksAwarded = CORRECT_MARK;
      status = "correct";
    } else {
      incorrectCount += 1;
      marksAwarded = -NEGATIVE_MARK;
      negativeMarks += NEGATIVE_MARK;
      status = "incorrect";
    }

    return {
      question_no: index + 1,
      question_id: row.question_id,
      question_text: row.question_text,
      option_a: row.option_a,
      option_b: row.option_b,
      option_c: row.option_c,
      option_d: row.option_d,
      selected_option: selectedOption,
      correct_option: row.correct_option,
      explanation: row.explanation,
      status,
      marks_awarded: round2(marksAwarded),
    };
  });

  const finalScore = round2(Math.max(0, correctCount * CORRECT_MARK - negativeMarks));
  const accuracyPercent = round2(
    questionRows.length ? (correctCount / questionRows.length) * 100 : 0
  );
  const elapsedSeconds = Math.max(0, Math.floor((submittedAt.getTime() - startedAt.getTime()) / 1000));
  const timeTakenSeconds = Math.min(durationSeconds, elapsedSeconds);

  return {
    correctCount,
    incorrectCount,
    unattemptedCount,
    negativeMarks: round2(negativeMarks),
    finalScore,
    accuracyPercent,
    timeTakenSeconds,
    detailedBreakdown,
  };
};

const submitAttempt = async ({ userId, attemptId, answers, proctorEvents = [] }) => {
  const attempt = await repo.getAttemptForUser({ attemptId, userId });
  if (!attempt) throw createHttpError(404, "Attempt not found.");
  if (attempt.status !== "in_progress") throw createHttpError(409, "Attempt is not in progress.");

  const answersMap = new Map();
  answers.forEach((answer) => {
    answersMap.set(answer.question_id, answer.selected_option);
  });

  const submittedAt = new Date();
  const startedAt = new Date(attempt.started_at);

  if (Number.isNaN(startedAt.getTime())) {
    throw createHttpError(500, "Attempt has invalid start timestamp.");
  }

  const result = await repo.db.transaction(async (trx) => {
    const questionRows = await repo.getAttemptQuestionKeyWithAnswersTx({ trx, attemptId });
    if (!questionRows.length) {
      throw createHttpError(500, "Attempt question set missing.");
    }

    const scored = scoreAttempt({
      questionRows,
      answersMap,
      durationSeconds: attempt.duration_seconds,
      startedAt,
      submittedAt,
    });

    const answerRows = questionRows.map((questionRow) => {
      const selectedOption = answersMap.get(questionRow.question_id) || null;
      const isCorrect = selectedOption ? selectedOption === questionRow.correct_option : null;
      const marksAwarded = selectedOption
        ? isCorrect
          ? CORRECT_MARK
          : -NEGATIVE_MARK
        : 0;

      return {
        attempt_id: attemptId,
        question_id: questionRow.question_id,
        selected_option: selectedOption,
        is_correct: isCorrect,
        marks_awarded: round2(marksAwarded),
        time_taken_seconds: null,
      };
    });

    await repo.updateAttemptAnswerRowsTx({ trx, rows: answerRows });

    const durationMs = attempt.duration_seconds * 1000;
    const status =
      submittedAt.getTime() > startedAt.getTime() + durationMs ? "auto_submitted" : "submitted";
    const proctorFlags = Array.isArray(proctorEvents) ? proctorEvents.length : 0;

    await repo.updateAttemptSubmissionTx({
      trx,
      attemptId,
      submittedAt,
      status,
      correctCount: scored.correctCount,
      incorrectCount: scored.incorrectCount,
      unattemptedCount: scored.unattemptedCount,
      negativeMarks: scored.negativeMarks,
      finalScore: scored.finalScore,
      accuracyPercent: scored.accuracyPercent,
      proctorFlags,
    });

    return {
      summary: {
        attempt_id: attemptId,
        quiz_type: attempt.quiz_type,
        status,
        started_at: attempt.started_at,
        submitted_at: submittedAt.toISOString(),
        duration_seconds: attempt.duration_seconds,
        time_taken_seconds: scored.timeTakenSeconds,
        total_questions: attempt.total_questions,
        correct_count: scored.correctCount,
        incorrect_count: scored.incorrectCount,
        unattempted_count: scored.unattemptedCount,
        negative_marks: scored.negativeMarks,
        final_score: scored.finalScore,
        accuracy_percent: scored.accuracyPercent,
        proctor_flags: proctorFlags,
      },
      detailed_breakdown: scored.detailedBreakdown,
    };
  });

  return result;
};

const failAttemptDueToViolation = async ({ userId, attemptId, reason, proctorEvents = [] }) => {
  const attempt = await repo.getAttemptForUser({ attemptId, userId });
  if (!attempt) throw createHttpError(404, "Attempt not found.");
  if (attempt.status !== "in_progress") throw createHttpError(409, "Attempt is not in progress.");

  const submittedAt = new Date();
  const proctorFlags = Math.max(1, Array.isArray(proctorEvents) ? proctorEvents.length : 0);
  const violationReason = reason?.trim() || "Exam rule violation";

  await repo.db.transaction(async (trx) => {
    await repo.updateAttemptSubmissionTx({
      trx,
      attemptId,
      submittedAt,
      status: FAILED_DUE_TO_VIOLATION,
      correctCount: 0,
      incorrectCount: 0,
      unattemptedCount: attempt.total_questions,
      negativeMarks: 0,
      finalScore: 0,
      accuracyPercent: 0,
      proctorFlags,
      violationReason,
    });
  });

  return {
    summary: {
      attempt_id: attemptId,
      quiz_type: attempt.quiz_type,
      status: FAILED_DUE_TO_VIOLATION,
      started_at: attempt.started_at,
      submitted_at: submittedAt.toISOString(),
      duration_seconds: attempt.duration_seconds,
      time_taken_seconds: Math.max(
        0,
        Math.min(
          attempt.duration_seconds,
          Math.floor((submittedAt.getTime() - new Date(attempt.started_at).getTime()) / 1000)
        )
      ),
      total_questions: attempt.total_questions,
      correct_count: 0,
      incorrect_count: 0,
      unattempted_count: attempt.total_questions,
      negative_marks: 0,
      final_score: 0,
      accuracy_percent: 0,
      proctor_flags: proctorFlags,
      violation_reason: violationReason,
    },
    detailed_breakdown: [],
  };
};

const getUserAttempts = async (userId) => {
  await ensureUser(userId);
  return repo.listAttemptsByUser(userId);
};

const getMockTests = async () => repo.listActiveMockTests();

const getAttemptReview = async ({ userId, attemptId }) => {
  const rows = await repo.getAttemptReviewRows({ attemptId, userId });
  if (!rows.length) throw createHttpError(404, "Attempt not found.");
  if (rows[0].status === "in_progress") {
    throw createHttpError(409, "Attempt review available only after submission.");
  }
  if (rows[0].status === FAILED_DUE_TO_VIOLATION) {
    throw createHttpError(403, "Review unavailable for debarred attempt.");
  }

  const summary = {
    attempt_id: rows[0].attempt_id,
    quiz_type: rows[0].quiz_type,
    mock_test_id: rows[0].mock_test_id,
    level_selected: rows[0].level_selected,
    started_at: rows[0].started_at,
    submitted_at: rows[0].submitted_at,
    duration_seconds: rows[0].duration_seconds,
    total_questions: rows[0].total_questions,
    correct_count: rows[0].correct_count,
    incorrect_count: rows[0].incorrect_count,
    unattempted_count: rows[0].unattempted_count,
    negative_marks: rows[0].negative_marks,
    final_score: rows[0].final_score,
    accuracy_percent: rows[0].accuracy_percent,
    status: rows[0].status,
    proctor_flags: rows[0].proctor_flags,
    violation_reason: rows[0].violation_reason,
  };

  const question_wise_review = rows.map((row, index) => ({
    question_no: row.question_order || index + 1,
    question_id: row.question_id,
    question_text: row.question_text,
    option_a: row.option_a,
    option_b: row.option_b,
    option_c: row.option_c,
    option_d: row.option_d,
    selected_option: row.selected_option,
    correct_option: row.correct_option,
    explanation: row.explanation,
    is_correct: row.is_correct,
    marks_awarded: Number(row.marks_awarded),
  }));

  return { summary, question_wise_review };
};

module.exports = {
  PRACTICE_TOTAL_QUESTIONS,
  PRACTICE_DURATION_MINUTES,
  scoreAttempt,
  startPracticeAttempt,
  startMockAttempt,
  submitAttempt,
  failAttemptDueToViolation,
  getMockTests,
  getUserAttempts,
  getAttemptReview,
};
