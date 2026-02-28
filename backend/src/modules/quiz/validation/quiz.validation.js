const { z } = require("zod");

const uuidSchema = z.string().uuid();
const optionSchema = z.enum(["A", "B", "C", "D"]);

const startPracticeSchema = z.object({
  level: z.enum(["easy", "medium", "hard", "mixed"]),
});

const startMockParamsSchema = z.object({
  mockTestId: uuidSchema,
});

const submitQuizSchema = z.object({
  attempt_id: uuidSchema,
  answers: z
    .array(
      z.object({
        question_id: uuidSchema,
        selected_option: optionSchema,
      })
    )
    .default([]),
  proctor_events: z.array(z.string().trim().min(1).max(120)).max(500).optional(),
});

const violationQuizSchema = z.object({
  attempt_id: uuidSchema,
  reason: z.string().trim().min(3).max(160),
  proctor_events: z.array(z.string().trim().min(1).max(120)).max(500).optional(),
});

const attemptParamsSchema = z.object({
  attemptId: uuidSchema,
});

const parseOrThrow = (schema, payload) => {
  const parsed = schema.safeParse(payload);
  if (parsed.success) return parsed.data;
  const issue = parsed.error.issues[0];
  const err = new Error(issue?.message || "Validation failed");
  err.status = 400;
  err.code = "VALIDATION_ERROR";
  throw err;
};

module.exports = {
  parseOrThrow,
  startPracticeSchema,
  startMockParamsSchema,
  submitQuizSchema,
  violationQuizSchema,
  attemptParamsSchema,
};
