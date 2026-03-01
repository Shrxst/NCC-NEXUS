const service = require("./leave.service");
const {
  leaveApplySchema,
  leaveParamsSchema,
  leaveStatusSchema,
  parseOrThrow,
} = require("./leave.validation");

const asyncHandler = (fn) => (req, res, next) => {
  Promise.resolve(fn(req, res, next)).catch(next);
};

const applyLeave = asyncHandler(async (req, res) => {
  const body = parseOrThrow(leaveApplySchema, req.body || {});
  const data = await service.applyLeave({
    reqUser: req.user,
    payload: body,
    file: req.file || null,
  });
  res.status(201).json({
    message: "Leave request submitted.",
    data,
  });
});

const getMyLeaveRequests = asyncHandler(async (req, res) => {
  const data = await service.getMyLeaveRequests({ reqUser: req.user });
  res.status(200).json({ data });
});

const getAllLeaveRequests = asyncHandler(async (req, res) => {
  const data = await service.getAllLeaveRequests({ reqUser: req.user });
  res.status(200).json({ data });
});

const reviewLeaveStatus = asyncHandler(async (req, res) => {
  const params = parseOrThrow(leaveParamsSchema, req.params || {});
  const body = parseOrThrow(leaveStatusSchema, req.body || {});
  const data = await service.reviewLeaveStatus({
    reqUser: req.user,
    leaveId: params.id,
    status: body.status,
  });
  res.status(200).json({
    message: "Leave request status updated.",
    data,
  });
});

module.exports = {
  applyLeave,
  getMyLeaveRequests,
  getAllLeaveRequests,
  reviewLeaveStatus,
};
