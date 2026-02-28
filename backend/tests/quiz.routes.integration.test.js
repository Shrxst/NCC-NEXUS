const express = require("express");
const jwt = require("jsonwebtoken");
const request = require("supertest");

const toId = (n) => `00000000-0000-0000-0000-${String(n).padStart(12, "0")}`;
const buildQuestion = (n, difficulty = "easy") => ({
  id: toId(n),
  question_text: `Question ${n}`,
  option_a: "A",
  option_b: "B",
  option_c: "C",
  option_d: "D",
  correct_option: n % 2 === 0 ? "A" : "B",
  explanation: `Explanation ${n}`,
  difficulty,
});

jest.mock("../src/modules/quiz/repository/quiz.repository", () => {
  const practiceEasy = Array.from({ length: 40 }, (_, i) => buildQuestion(i + 1, "easy"));
  const practiceMedium = Array.from({ length: 40 }, (_, i) => buildQuestion(i + 101, "medium"));
  const practiceHard = Array.from({ length: 40 }, (_, i) => buildQuestion(i + 201, "hard"));
  const questionMap = new Map(
    [...practiceEasy, ...practiceMedium, ...practiceHard].map((q) => [q.id, q])
  );
  const mockTestId = toId(999001);
  const mockQuestions = [...practiceEasy, ...practiceMedium, ...practiceHard].slice(0, 50).map((q, i) => ({
    ...q,
    question_order: i + 1,
  }));
  const attempts = new Map();
  const attemptQuestions = new Map();
  let attemptCounter = 500000;

  const repo = {
    db: {
      transaction: async (fn) => fn({}),
    },
    getUserById: async (userId) => (userId ? { user_id: userId } : null),
    getRandomQuestionsByDifficulty: async ({ difficulty, limit }) => {
      if (difficulty === "easy") return practiceEasy.slice(0, limit).map(({ correct_option, explanation, difficulty: d, ...safe }) => safe);
      if (difficulty === "medium") return practiceMedium.slice(0, limit).map(({ correct_option, explanation, difficulty: d, ...safe }) => safe);
      return practiceHard.slice(0, limit).map(({ correct_option, explanation, difficulty: d, ...safe }) => safe);
    },
    getRandomQuestionsFallback: async ({ excludeIds, limit }) =>
      [...practiceEasy, ...practiceMedium, ...practiceHard]
        .filter((q) => !excludeIds.includes(q.id))
        .slice(0, limit)
        .map(({ correct_option, explanation, difficulty, ...safe }) => safe),
    listActiveMockTests: async () => [
      {
        id: mockTestId,
        title: "NCC Mock Test 1",
        description: "Mock",
        total_questions: 50,
        total_marks: 50,
        negative_mark: 0.25,
        duration_minutes: 30,
      },
    ],
    getActiveMockTestById: async (id) =>
      id === mockTestId
        ? {
            id: mockTestId,
            title: "NCC Mock Test 1",
            total_questions: 50,
            total_marks: 50,
            negative_mark: 0.25,
            duration_minutes: 30,
          }
        : null,
    getMockQuestionsOrdered: async () => mockQuestions.map(({ correct_option, explanation, difficulty, ...safe }) => safe),
    createAttemptTx: async ({
      userId,
      quizType,
      mockTestId: mtId,
      levelSelected,
      startedAt,
      durationSeconds,
      totalQuestions,
    }) => {
      attemptCounter += 1;
      const id = toId(attemptCounter);
      const row = {
        id,
        user_id: userId,
        quiz_type: quizType,
        mock_test_id: mtId || null,
        level_selected: levelSelected || null,
        started_at: startedAt.toISOString(),
        submitted_at: null,
        duration_seconds: durationSeconds,
        total_questions: totalQuestions,
        correct_count: null,
        incorrect_count: null,
        unattempted_count: null,
        negative_marks: null,
        final_score: null,
        accuracy_percent: null,
        status: "in_progress",
        proctor_flags: 0,
        violation_reason: null,
        created_at: startedAt.toISOString(),
      };
      attempts.set(id, row);
      return row;
    },
    insertAttemptQuestionRowsTx: async ({ attemptId, questionIds }) => {
      attemptQuestions.set(
        attemptId,
        questionIds.map((qid) => ({
          id: toId(Number(qid.slice(-6)) + 700000),
          question_id: qid,
          selected_option: null,
        }))
      );
    },
    getAttemptForUser: async ({ attemptId, userId }) => {
      const row = attempts.get(attemptId);
      if (!row || row.user_id !== userId) return null;
      return row;
    },
    getAttemptQuestionKeyWithAnswersTx: async ({ attemptId }) => {
      const rows = attemptQuestions.get(attemptId) || [];
      return rows.map((r) => ({
        id: r.id,
        question_id: r.question_id,
        selected_option: r.selected_option,
        correct_option: questionMap.get(r.question_id).correct_option,
        explanation: questionMap.get(r.question_id).explanation,
        question_text: questionMap.get(r.question_id).question_text,
        option_a: questionMap.get(r.question_id).option_a,
        option_b: questionMap.get(r.question_id).option_b,
        option_c: questionMap.get(r.question_id).option_c,
        option_d: questionMap.get(r.question_id).option_d,
      }));
    },
    updateAttemptAnswerRowsTx: async ({ rows }) => {
      if (!rows.length) return;
      const attemptId = rows[0].attempt_id;
      const existing = attemptQuestions.get(attemptId) || [];
      const byQuestion = new Map(existing.map((r) => [r.question_id, r]));
      rows.forEach((row) => byQuestion.set(row.question_id, { ...row }));
      attemptQuestions.set(attemptId, [...byQuestion.values()]);
    },
    updateAttemptSubmissionTx: async ({
      attemptId,
      submittedAt,
      status,
      correctCount,
      incorrectCount,
      unattemptedCount,
      negativeMarks,
      finalScore,
      accuracyPercent,
      proctorFlags,
      violationReason,
    }) => {
      const row = attempts.get(attemptId);
      if (!row) return 0;
      Object.assign(row, {
        submitted_at: submittedAt.toISOString(),
        status,
        correct_count: correctCount,
        incorrect_count: incorrectCount,
        unattempted_count: unattemptedCount,
        negative_marks: negativeMarks,
        final_score: finalScore,
        accuracy_percent: accuracyPercent,
        proctor_flags: proctorFlags,
        violation_reason: violationReason || null,
      });
      attempts.set(attemptId, row);
      return 1;
    },
    listAttemptsByUser: async (userId) =>
      [...attempts.values()].filter((row) => row.user_id === userId),
    getAttemptReviewRows: async ({ attemptId, userId }) => {
      const attempt = attempts.get(attemptId);
      if (!attempt || attempt.user_id !== userId) return [];
      const rows = attemptQuestions.get(attemptId) || [];
      return rows.map((row, idx) => {
        const q = questionMap.get(row.question_id);
        const isCorrect = row.selected_option ? row.selected_option === q.correct_option : null;
        const marksAwarded = row.selected_option ? (isCorrect ? 1 : -0.25) : 0;
        return {
          attempt_id: attempt.id,
          quiz_type: attempt.quiz_type,
          mock_test_id: attempt.mock_test_id,
          level_selected: attempt.level_selected,
          started_at: attempt.started_at,
          submitted_at: attempt.submitted_at,
          duration_seconds: attempt.duration_seconds,
          total_questions: attempt.total_questions,
          correct_count: attempt.correct_count,
          incorrect_count: attempt.incorrect_count,
          unattempted_count: attempt.unattempted_count,
          negative_marks: attempt.negative_marks,
          final_score: attempt.final_score,
          accuracy_percent: attempt.accuracy_percent,
          status: attempt.status,
          proctor_flags: attempt.proctor_flags,
          violation_reason: attempt.violation_reason,
          question_id: q.id,
          question_text: q.question_text,
          option_a: q.option_a,
          option_b: q.option_b,
          option_c: q.option_c,
          option_d: q.option_d,
          correct_option: q.correct_option,
          explanation: q.explanation,
          selected_option: row.selected_option || null,
          is_correct: isCorrect,
          marks_awarded: marksAwarded,
          question_order: idx + 1,
        };
      });
    },
  };

  return repo;
});

const quizRoutes = require("../src/modules/quiz/routes/quiz.routes");

describe("quiz routes integration", () => {
  let app;
  let tokenUser1;
  let tokenUser2;

  beforeAll(() => {
    process.env.JWT_SECRET = "test-secret";
    tokenUser1 = jwt.sign({ user_id: 1, role: "CADET" }, process.env.JWT_SECRET);
    tokenUser2 = jwt.sign({ user_id: 2, role: "CADET" }, process.env.JWT_SECRET);

    app = express();
    app.use(express.json());
    app.use("/api/quiz", quizRoutes);
    app.use((err, req, res, _next) => {
      res.status(err.status || 500).json({ message: err.message || "Internal Server Error" });
    });
  });

  it("starts a practice attempt and returns 25 questions without answer key", async () => {
    const response = await request(app)
      .post("/api/quiz/practice/start")
      .set("Authorization", `Bearer ${tokenUser1}`)
      .send({ level: "mixed" });

    expect(response.statusCode).toBe(201);
    expect(response.body.attempt_id).toBeTruthy();
    expect(response.body.questions).toHaveLength(25);
    expect(response.body.questions[0].correct_option).toBeUndefined();
  });

  it("starts mock, submits, and enforces user-scoped review", async () => {
    const listMock = await request(app)
      .get("/api/quiz/mock-tests")
      .set("Authorization", `Bearer ${tokenUser1}`);
    expect(listMock.statusCode).toBe(200);
    const mockTestId = listMock.body.mock_tests[0].id;

    const startMock = await request(app)
      .post(`/api/quiz/mock/${mockTestId}/start`)
      .set("Authorization", `Bearer ${tokenUser1}`)
      .send({});
    expect(startMock.statusCode).toBe(201);
    expect(startMock.body.questions).toHaveLength(50);

    const attemptId = startMock.body.attempt_id;
    const answers = startMock.body.questions.slice(0, 5).map((q, idx) => ({
      question_id: q.id,
      selected_option: idx % 2 === 0 ? "A" : "B",
    }));

    const submit = await request(app)
      .post("/api/quiz/submit")
      .set("Authorization", `Bearer ${tokenUser1}`)
      .send({ attempt_id: attemptId, answers, proctor_events: ["Tab switch"] });
    expect(submit.statusCode).toBe(200);
    expect(submit.body.summary.total_questions).toBe(50);
    expect(submit.body.summary.proctor_flags).toBe(1);

    const ownReview = await request(app)
      .get(`/api/quiz/attempt/${attemptId}`)
      .set("Authorization", `Bearer ${tokenUser1}`);
    expect(ownReview.statusCode).toBe(200);
    expect(ownReview.body.question_wise_review).toHaveLength(50);

    const otherReview = await request(app)
      .get(`/api/quiz/attempt/${attemptId}`)
      .set("Authorization", `Bearer ${tokenUser2}`);
    expect(otherReview.statusCode).toBe(404);
  });

  it("debars immediately on violation and blocks review and re-submit", async () => {
    const startPractice = await request(app)
      .post("/api/quiz/practice/start")
      .set("Authorization", `Bearer ${tokenUser1}`)
      .send({ level: "easy" });
    expect(startPractice.statusCode).toBe(201);
    const attemptId = startPractice.body.attempt_id;

    const violation = await request(app)
      .post("/api/quiz/violation")
      .set("Authorization", `Bearer ${tokenUser1}`)
      .send({
        attempt_id: attemptId,
        reason: "Tab change detected",
        proctor_events: ["Tab change detected"],
      });
    expect(violation.statusCode).toBe(200);
    expect(violation.body.summary.status).toBe("failed_due_to_violation");
    expect(violation.body.summary.final_score).toBe(0);
    expect(violation.body.summary.accuracy_percent).toBe(0);
    expect(violation.body.summary.violation_reason).toBe("Tab change detected");

    const submitAfterViolation = await request(app)
      .post("/api/quiz/submit")
      .set("Authorization", `Bearer ${tokenUser1}`)
      .send({
        attempt_id: attemptId,
        answers: [],
      });
    expect(submitAfterViolation.statusCode).toBe(409);

    const reviewAfterViolation = await request(app)
      .get(`/api/quiz/attempt/${attemptId}`)
      .set("Authorization", `Bearer ${tokenUser1}`);
    expect(reviewAfterViolation.statusCode).toBe(403);
  });
});
