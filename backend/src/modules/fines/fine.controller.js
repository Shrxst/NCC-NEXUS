const service = require("./fine.service");
const {
  fineListQuerySchema,
  paramsFineIdSchema,
  payFineSchema,
  verifyFineSchema,
  reportQuerySchema,
  parseOrThrow,
} = require("./fine.validation");

const asyncHandler = (fn) => (req, res, next) => {
  Promise.resolve(fn(req, res, next)).catch(next);
};

const getMyFines = asyncHandler(async (req, res) => {
  const query = parseOrThrow(fineListQuerySchema, req.query || {});
  const data = await service.getMyFines({ reqUser: req.user, query });
  res.status(200).json({ data });
});

const getAllFines = asyncHandler(async (req, res) => {
  const query = parseOrThrow(fineListQuerySchema, req.query || {});
  const data = await service.getAllFines({ reqUser: req.user, query });
  res.status(200).json({ data });
});

const payFine = asyncHandler(async (req, res) => {
  const params = parseOrThrow(paramsFineIdSchema, req.params || {});
  const body = parseOrThrow(payFineSchema, req.body || {});
  const data = await service.payFine({
    reqUser: req.user,
    fineId: params.id,
    payload: body,
    file: req.file || null,
  });
  res.status(200).json({ message: "Payment submitted.", data });
});

const verifyFinePayment = asyncHandler(async (req, res) => {
  const params = parseOrThrow(paramsFineIdSchema, req.params || {});
  const body = parseOrThrow(verifyFineSchema, req.body || {});
  const data = await service.verifyFinePayment({
    reqUser: req.user,
    fineId: params.id,
    payload: body,
  });
  res.status(200).json({ message: "Payment verification updated.", data });
});

const getFineReport = asyncHandler(async (req, res) => {
  const query = parseOrThrow(reportQuerySchema, req.query || {});
  const report = await service.getFineReport({ reqUser: req.user, query });

  if (query.format === "csv") {
    let csv = "Fine ID,Cadet Name,Regimental No,Session,Drill,Date,Amount,Status,Created At\n";
    report.fines.forEach((fine) => {
      csv += `${fine.fine_id},${fine.cadet_name || ""},${fine.regimental_no},${fine.session_name || ""},${fine.drill_name || ""},${fine.drill_date || ""},${fine.amount},${fine.status},${fine.created_at}\n`;
    });
    res.setHeader("Content-Type", "text/csv; charset=utf-8");
    res.setHeader("Content-Disposition", 'attachment; filename="fine_report.csv"');
    return res.status(200).send(csv);
  }

  return res.status(200).json({ data: report });
});

module.exports = {
  getMyFines,
  getAllFines,
  payFine,
  verifyFinePayment,
  getFineReport,
};
