const service = require("../service/quiz.service");
const {
  parseOrThrow,
  startPracticeSchema,
  startMockParamsSchema,
  submitQuizSchema,
  violationQuizSchema,
  attemptParamsSchema,
} = require("../validation/quiz.validation");

const asyncHandler = (fn) => (req, res, next) => {
  Promise.resolve(fn(req, res, next)).catch(next);
};

const startPractice = asyncHandler(async (req, res) => {
  const body = parseOrThrow(startPracticeSchema, req.body);
  const data = await service.startPracticeAttempt({
    userId: req.user.user_id,
    level: body.level,
  });
  res.status(201).json(data);
});

const startMock = asyncHandler(async (req, res) => {
  const params = parseOrThrow(startMockParamsSchema, req.params);
  const data = await service.startMockAttempt({
    userId: req.user.user_id,
    mockTestId: params.mockTestId,
  });
  res.status(201).json(data);
});

const submitQuiz = asyncHandler(async (req, res) => {
  const body = parseOrThrow(submitQuizSchema, req.body);
  const data = await service.submitAttempt({
    userId: req.user.user_id,
    attemptId: body.attempt_id,
    answers: body.answers,
    proctorEvents: body.proctor_events || [],
  });
  res.status(200).json(data);
});

const reportViolation = asyncHandler(async (req, res) => {
  const body = parseOrThrow(violationQuizSchema, req.body);
  const data = await service.failAttemptDueToViolation({
    userId: req.user.user_id,
    attemptId: body.attempt_id,
    reason: body.reason,
    proctorEvents: body.proctor_events || [],
  });
  res.status(200).json(data);
});

const listAttempts = asyncHandler(async (req, res) => {
  const data = await service.getUserAttempts(req.user.user_id);
  res.status(200).json({ attempts: data });
});

const listMockTests = asyncHandler(async (_req, res) => {
  const data = await service.getMockTests();
  res.status(200).json({ mock_tests: data });
});

const getAttempt = asyncHandler(async (req, res) => {
  const params = parseOrThrow(attemptParamsSchema, req.params);
  const data = await service.getAttemptReview({
    userId: req.user.user_id,
    attemptId: params.attemptId,
  });
  res.status(200).json(data);
});

module.exports = {
  startPractice,
  startMock,
  submitQuiz,
  reportViolation,
  listMockTests,
  listAttempts,
  getAttempt,
};
