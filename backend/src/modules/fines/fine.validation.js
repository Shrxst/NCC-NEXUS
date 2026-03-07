const { z } = require("zod");

const fineStatusSchema = z.enum(["pending", "payment_submitted", "paid", "cancelled"]).optional();

const fineListQuerySchema = z.object({
  status: fineStatusSchema,
});

const paramsFineIdSchema = z.object({
  id: z.coerce.number().int().positive(),
});

const payFineSchema = z.object({
  payment_method: z.enum(["UPI"]).default("UPI"),
  payment_ref: z.string().trim().min(3).max(255).optional(),
  amount: z.coerce.number().positive().optional(),
});

const verifyFineSchema = z.object({
  payment_id: z.coerce.number().int().positive(),
  status: z.enum(["verified", "rejected"]),
  notes: z.string().trim().max(1000).optional(),
});

const reportQuerySchema = z.object({
  format: z.enum(["json", "csv"]).optional(),
  status: fineStatusSchema,
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
  fineListQuerySchema,
  paramsFineIdSchema,
  payFineSchema,
  verifyFineSchema,
  reportQuerySchema,
  parseOrThrow,
};
