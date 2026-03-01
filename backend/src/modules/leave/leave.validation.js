const { z } = require("zod");

const leaveApplySchema = z.object({
  reason: z.string().trim().min(5).max(2000),
});

const leaveStatusSchema = z.object({
  status: z.enum(["approved", "rejected"]),
});

const leaveParamsSchema = z.object({
  id: z.string().uuid(),
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
  leaveApplySchema,
  leaveStatusSchema,
  leaveParamsSchema,
  parseOrThrow,
};
