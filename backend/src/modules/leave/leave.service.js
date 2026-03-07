const { uploadToCloudinary } = require("../../services/cloudinary.service");
const fineEligibilityService = require("../fines/fine-eligibility.service");
const repo = require("./leave.repository");

const createHttpError = (status, message) => {
  const err = new Error(message);
  err.status = status;
  return err;
};

const MAX_FILE_SIZE_BYTES = 10 * 1024 * 1024;
const ALLOWED_MIME_TYPES = new Set([
  "application/pdf",
  "image/jpeg",
  "image/png",
  "image/webp",
  "application/msword",
  "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
]);

const isSuo = (user) =>
  user?.role === "CADET" && String(user?.rank || "").toLowerCase() === "senior under officer";

const isLeaveAdmin = (user) => user?.role === "ANO" || isSuo(user);

const toIsoDate = (dateValue) => {
  if (!dateValue) return null;
  const d = new Date(dateValue);
  if (Number.isNaN(d.getTime())) return null;
  return d.toISOString();
};

const toPayload = (row) => ({
  leave_id: Number(row.leave_id),
  cadet_name: row.cadet_name || null,
  regimental_no: row.regimental_no || null,
  drill_id: Number(row.drill_id),
  session_id: Number(row.session_id),
  drill_name: row.drill_name || null,
  session_name: row.session_name || null,
  drill_date: row.drill_date || null,
  drill_time: row.drill_time ? String(row.drill_time).slice(0, 8) : null,
  reason: row.reason,
  status: row.status,
  attachment_url: row.document_url || null,
  reviewed_by_user_id: row.reviewed_by || null,
  reviewed_by_name: row.reviewed_by_name || null,
  reviewed_at: toIsoDate(row.reviewed_at),
  created_at: toIsoDate(row.applied_at || row.created_at),
  updated_at: toIsoDate(row.updated_at),
});

const assertFileValid = (file) => {
  if (!file) return;
  if (!ALLOWED_MIME_TYPES.has(file.mimetype)) {
    throw createHttpError(400, "Unsupported document type.");
  }
  if (Number(file.size || 0) > MAX_FILE_SIZE_BYTES) {
    throw createHttpError(413, "Document exceeds 10MB size limit.");
  }
};

const getCadetContext = async (reqUser) => {
  if (reqUser?.role !== "CADET") throw createHttpError(403, "Cadet access required.");
  const cadet = await repo.getCadetProfileByUserId(reqUser.user_id);
  if (!cadet) throw createHttpError(404, "Cadet profile not found.");
  return cadet;
};

const applyLeave = async ({ reqUser, payload, file }) => {
  const cadet = await getCadetContext(reqUser);
  assertFileValid(file);

  const drill = await repo.getDrillForCollege({
    drillId: payload.drill_id,
    collegeId: cadet.college_id,
  });
  if (!drill) throw createHttpError(400, "Invalid drill for your college scope.");

  let documentUrl = null;
  if (file?.buffer) {
    const uploadResult = await uploadToCloudinary(file.buffer, "ncc-nexus/leaves");
    documentUrl = uploadResult.secure_url;
  }

  return repo.db.transaction(async (trx) => {
    let created;
    try {
      created = await repo.createLeave({
        trx,
        regimentalNo: cadet.regimental_no,
        drillId: payload.drill_id,
        reason: payload.reason,
        documentUrl,
      });
    } catch (err) {
      if (err?.code === "23505" && String(err?.constraint || "") === "uq_leaves_regimental_drill") {
        throw createHttpError(409, "Leave already applied for this drill.");
      }
      throw err;
    }

    await fineEligibilityService.runForLeaveUpdate({
      trx,
      regimentalNo: cadet.regimental_no,
      drillId: payload.drill_id,
      actorUserId: reqUser.user_id,
    });

    const rows = await repo.listLeaveByRegimentalNo(cadet.regimental_no);
    const fresh = rows.find((row) => Number(row.leave_id) === Number(created.leave_id)) || created;
    return toPayload(fresh);
  });
};

const getMyLeaveRequests = async ({ reqUser }) => {
  const cadet = await getCadetContext(reqUser);
  const rows = await repo.listLeaveByRegimentalNo(cadet.regimental_no);
  return rows.map((row) => toPayload(row));
};

const getAllLeaveRequests = async ({ reqUser }) => {
  if (!isLeaveAdmin(reqUser)) throw createHttpError(403, "SUO or ANO access required.");
  if (!reqUser?.college_id) throw createHttpError(403, "College context missing.");
  const rows = await repo.listAllLeaveByCollege(reqUser.college_id);
  return rows.map((row) => toPayload(row));
};

const reviewLeaveStatus = async ({ reqUser, leaveId, status }) => {
  if (!isLeaveAdmin(reqUser)) throw createHttpError(403, "SUO or ANO access required.");
  if (!reqUser?.college_id) throw createHttpError(403, "College context missing.");

  const existing = await repo.getLeaveByIdForCollege({
    leaveId,
    collegeId: reqUser.college_id,
  });
  if (!existing) throw createHttpError(404, "Leave request not found.");
  if (existing.status !== "pending") throw createHttpError(409, "Leave request already reviewed.");

  return repo.db.transaction(async (trx) => {
    const updated = await repo.updateLeaveStatus({
      trx,
      leaveId,
      status,
      reviewedByUserId: reqUser.user_id,
    });
    if (!updated) throw createHttpError(409, "Leave request already reviewed.");

    await fineEligibilityService.runForLeaveUpdate({
      trx,
      regimentalNo: updated.regimental_no,
      drillId: updated.drill_id,
      actorUserId: reqUser.user_id,
    });

    const rows = await repo.listAllLeaveByCollege(reqUser.college_id);
    const fresh = rows.find((row) => Number(row.leave_id) === Number(updated.leave_id)) || updated;
    return toPayload(fresh);
  });
};

module.exports = {
  isSuo,
  isLeaveAdmin,
  applyLeave,
  getMyLeaveRequests,
  getAllLeaveRequests,
  reviewLeaveStatus,
};
