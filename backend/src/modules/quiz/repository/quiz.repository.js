const db = require("../../../db/knex");

const getUserById = async (userId) =>
  db("users")
    .where({ user_id: userId })
    .select("user_id")
    .first();

const getRandomQuestionsByDifficulty = async ({ difficulty, limit }) =>
  db("quiz_questions as q")
    .where("q.difficulty", difficulty)
    .where("q.is_active", true)
    .orderByRaw("RANDOM()")
    .limit(limit)
    .select(
      "q.id",
      "q.question_text",
      "q.option_a",
      "q.option_b",
      "q.option_c",
      "q.option_d"
    );

const getRandomQuestionsFallback = async ({ excludeIds, limit }) => {
  const query = db("quiz_questions as q")
    .where("q.is_active", true)
    .orderByRaw("RANDOM()")
    .limit(limit)
    .select(
      "q.id",
      "q.question_text",
      "q.option_a",
      "q.option_b",
      "q.option_c",
      "q.option_d"
    );

  if (excludeIds.length) {
    query.whereNotIn("q.id", excludeIds);
  }

  return query;
};

const getActiveMockTestById = async (mockTestId) =>
  db("quiz_mock_tests as mt")
    .where("mt.id", mockTestId)
    .where("mt.is_active", true)
    .select(
      "mt.id",
      "mt.title",
      "mt.total_questions",
      "mt.total_marks",
      "mt.negative_mark",
      "mt.duration_minutes"
    )
    .first();

const listActiveMockTests = async () =>
  db("quiz_mock_tests as mt")
    .where("mt.is_active", true)
    .orderBy("mt.created_at", "asc")
    .select(
      "mt.id",
      "mt.title",
      "mt.description",
      "mt.total_questions",
      "mt.total_marks",
      "mt.negative_mark",
      "mt.duration_minutes"
    );

const getMockQuestionsOrdered = async (mockTestId) =>
  db("quiz_mock_test_questions as mtq")
    .join("quiz_questions as q", "q.id", "mtq.question_id")
    .where("mtq.mock_test_id", mockTestId)
    .where("q.is_active", true)
    .orderBy("mtq.question_order", "asc")
    .select(
      "q.id",
      "q.question_text",
      "q.option_a",
      "q.option_b",
      "q.option_c",
      "q.option_d",
      "mtq.question_order"
    );

const createAttemptTx = async ({
  trx,
  userId,
  quizType,
  mockTestId,
  levelSelected,
  startedAt,
  durationSeconds,
  totalQuestions,
}) => {
  const [row] = await trx("quiz_attempts")
    .insert({
      user_id: userId,
      quiz_type: quizType,
      mock_test_id: mockTestId || null,
      level_selected: levelSelected || null,
      started_at: startedAt,
      duration_seconds: durationSeconds,
      total_questions: totalQuestions,
      status: "in_progress",
    })
    .returning([
      "id",
      "user_id",
      "quiz_type",
      "mock_test_id",
      "level_selected",
      "started_at",
      "duration_seconds",
      "total_questions",
      "status",
      "created_at",
    ]);

  return row;
};

const insertAttemptQuestionRowsTx = async ({ trx, attemptId, questionIds }) => {
  const payload = questionIds.map((questionId) => ({
    attempt_id: attemptId,
    question_id: questionId,
    selected_option: null,
    is_correct: null,
    marks_awarded: 0,
    time_taken_seconds: null,
  }));

  await trx("quiz_attempt_answers").insert(payload);
};

const getAttemptForUser = async ({ attemptId, userId }) =>
  db("quiz_attempts as a")
    .where("a.id", attemptId)
    .where("a.user_id", userId)
    .select(
      "a.id",
      "a.user_id",
      "a.quiz_type",
      "a.mock_test_id",
      "a.level_selected",
      "a.started_at",
      "a.submitted_at",
      "a.duration_seconds",
      "a.total_questions",
      "a.correct_count",
      "a.incorrect_count",
      "a.unattempted_count",
      "a.negative_marks",
      "a.final_score",
      "a.accuracy_percent",
      "a.status",
      "a.proctor_flags",
      "a.violation_reason",
      "a.created_at"
    )
    .first();

const getAttemptQuestionKeyWithAnswersTx = async ({ trx, attemptId }) =>
  trx("quiz_attempt_answers as aa")
    .join("quiz_questions as q", "q.id", "aa.question_id")
    .where("aa.attempt_id", attemptId)
    .select(
      "aa.id",
      "aa.question_id",
      "aa.selected_option",
      "q.correct_option",
      "q.explanation",
      "q.question_text",
      "q.option_a",
      "q.option_b",
      "q.option_c",
      "q.option_d"
    );

const updateAttemptAnswerRowsTx = async ({ trx, rows }) => {
  if (!rows.length) return;

  await trx("quiz_attempt_answers")
    .insert(rows)
    .onConflict(["attempt_id", "question_id"])
    .merge({
      selected_option: trx.raw("EXCLUDED.selected_option"),
      is_correct: trx.raw("EXCLUDED.is_correct"),
      marks_awarded: trx.raw("EXCLUDED.marks_awarded"),
      time_taken_seconds: trx.raw("EXCLUDED.time_taken_seconds"),
    });
};

const updateAttemptSubmissionTx = async ({
  trx,
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
  violationReason = null,
}) =>
  trx("quiz_attempts")
    .where("id", attemptId)
    .update({
      submitted_at: submittedAt,
      status,
      correct_count: correctCount,
      incorrect_count: incorrectCount,
      unattempted_count: unattemptedCount,
      negative_marks: negativeMarks,
      final_score: finalScore,
      accuracy_percent: accuracyPercent,
      proctor_flags: proctorFlags,
      violation_reason: violationReason,
    });

const listAttemptsByUser = async (userId) =>
  db("quiz_attempts as a")
    .leftJoin("quiz_mock_tests as mt", "mt.id", "a.mock_test_id")
    .where("a.user_id", userId)
    .orderBy("a.created_at", "desc")
    .select(
      "a.id",
      "a.quiz_type",
      "a.mock_test_id",
      "a.level_selected",
      "a.started_at",
      "a.submitted_at",
      "a.duration_seconds",
      "a.total_questions",
      "a.correct_count",
      "a.incorrect_count",
      "a.unattempted_count",
      "a.negative_marks",
      "a.final_score",
      "a.accuracy_percent",
      "a.status",
      "a.proctor_flags",
      "a.violation_reason",
      "a.created_at",
      "mt.title as mock_test_title"
    );

const getAttemptReviewRows = async ({ attemptId, userId }) =>
  db("quiz_attempts as a")
    .join("quiz_attempt_answers as aa", "aa.attempt_id", "a.id")
    .join("quiz_questions as q", "q.id", "aa.question_id")
    .leftJoin("quiz_mock_test_questions as mtq", function joinMockOrder() {
      this.on("mtq.question_id", "=", "q.id").andOn("mtq.mock_test_id", "=", "a.mock_test_id");
    })
    .where("a.id", attemptId)
    .where("a.user_id", userId)
    .select(
      "a.id as attempt_id",
      "a.quiz_type",
      "a.mock_test_id",
      "a.level_selected",
      "a.started_at",
      "a.submitted_at",
      "a.duration_seconds",
      "a.total_questions",
      "a.correct_count",
      "a.incorrect_count",
      "a.unattempted_count",
      "a.negative_marks",
      "a.final_score",
      "a.accuracy_percent",
      "a.status",
      "a.proctor_flags",
      "a.violation_reason",
      "q.id as question_id",
      "q.question_text",
      "q.option_a",
      "q.option_b",
      "q.option_c",
      "q.option_d",
      "q.correct_option",
      "q.explanation",
      "aa.selected_option",
      "aa.is_correct",
      "aa.marks_awarded",
      "mtq.question_order"
    )
    .orderByRaw("COALESCE(mtq.question_order, 99999), q.created_at, q.id");

module.exports = {
  db,
  getUserById,
  getRandomQuestionsByDifficulty,
  getRandomQuestionsFallback,
  getActiveMockTestById,
  listActiveMockTests,
  getMockQuestionsOrdered,
  createAttemptTx,
  insertAttemptQuestionRowsTx,
  getAttemptForUser,
  getAttemptQuestionKeyWithAnswersTx,
  updateAttemptAnswerRowsTx,
  updateAttemptSubmissionTx,
  listAttemptsByUser,
  getAttemptReviewRows,
};
