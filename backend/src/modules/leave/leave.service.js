const repo = require("./leave.repository");
const {
  createSignedDocumentUrl,
  uploadLeaveDocument,
} = require("../../services/supabaseStorage.service");
const { createAuthUser, isConfigured: isSupabaseAuthAdminConfigured } = require("../../services/supabaseAuthAdmin.service");

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

const normalizeFileName = (filename = "document") =>
  String(filename)
    .normalize("NFKD")
    .replace(/[^\w.\-]+/g, "_")
    .replace(/_+/g, "_")
    .slice(0, 120);

const toIsoDate = (dateValue) => {
  if (!dateValue) return null;
  const d = new Date(dateValue);
  if (Number.isNaN(d.getTime())) return null;
  return d.toISOString();
};

const toPayload = async (row) => {
  let documentUrl = null;
  if (row.document_path) {
    try {
      documentUrl = await createSignedDocumentUrl({
        path: row.document_path,
        expiresInSeconds: 300,
      });
    } catch (err) {
      documentUrl = null;
    }
  }
  return {
    leave_id: row.leave_id,
    cadet_name: row.cadet_name || null,
    regimental_no: row.cadet_regimental_no || row.applicant_regimental_no || null,
    reason: row.reason,
    status: row.status,
    attachment_path: row.document_path || null,
    attachment_url: documentUrl,
    attachment_name: row.document_path ? String(row.document_path).split("/").pop() : null,
    reviewed_by_user_id: row.reviewed_by_user_id || null,
    reviewed_by_name: row.reviewed_by_name || null,
    reviewed_at: toIsoDate(row.reviewed_at),
    created_at: toIsoDate(row.created_at),
    updated_at: toIsoDate(row.updated_at),
  };
};

const ensureCadet = async (reqUser) => {
  if (reqUser?.role !== "CADET") throw createHttpError(403, "Cadet access required.");

  let [user, cadet] = await Promise.all([
    repo.getUserById(reqUser.user_id),
    repo.getCadetProfileByUserId(reqUser.user_id),
  ]);

  if (!user) throw createHttpError(401, "User not found.");
  if (!cadet) throw createHttpError(404, "Cadet profile not found.");
  if (!user.auth_user_id) {
    const canProvisionAuthUser = isSupabaseAuthAdminConfigured();
    const resolvedAuthUserId =
      reqUser?.auth_user_id ||
      (user.email ? await repo.findAuthUserIdByEmail(user.email) : null);

    let candidateAuthUserId = resolvedAuthUserId;
    if (!candidateAuthUserId && user.email && canProvisionAuthUser) {
      // Provision auth account only when user is absent in auth.users.
      await createAuthUser({ email: user.email, role: isSuo(reqUser) ? "SUO" : reqUser?.role || user.role });
      candidateAuthUserId = await repo.findAuthUserIdByEmail(user.email);
    }

    if (candidateAuthUserId) {
      const updated = await repo.setUserAuthUserId({
        userId: user.user_id,
        authUserId: candidateAuthUserId,
      });
      if (updated?.auth_user_id) {
        user = updated;
      }
    }
  }

  if (!user.auth_user_id) {
    const hint = isSupabaseAuthAdminConfigured()
      ? "Ensure this cadet has a matching Supabase Auth account (same email) or set users.auth_user_id."
      : "Set SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY in backend env, or set users.auth_user_id manually.";
    throw createHttpError(
      409,
      `Supabase auth mapping missing. ${hint}`
    );
  }

  return { user, cadet };
};

const assertFileValid = (file) => {
  if (!file) return;
  if (!ALLOWED_MIME_TYPES.has(file.mimetype)) {
    throw createHttpError(400, "Unsupported document type.");
  }
  if (Number(file.size || 0) > MAX_FILE_SIZE_BYTES) {
    throw createHttpError(413, "Document exceeds 10MB size limit.");
  }
};

const applyLeave = async ({ reqUser, payload, file }) => {
  const { user, cadet } = await ensureCadet(reqUser);
  assertFileValid(file);

  const created = await repo.createLeaveRequest({
    applicantUserId: user.user_id,
    applicantAuthUserId: user.auth_user_id,
    applicantRegimentalNo: cadet.regimental_no,
    reason: payload.reason,
  });

  let finalRow = created;
  try {
    if (file?.buffer) {
      const safeFileName = normalizeFileName(file.originalname || "document");
      const documentPath = `${user.auth_user_id}/${created.leave_id}/${safeFileName}`;
      await uploadLeaveDocument({ path: documentPath, file });
      finalRow = await repo.updateLeaveDocumentPath({
        leaveId: created.leave_id,
        documentPath,
      });
    }
  } catch (error) {
    await repo.deleteLeaveById(created.leave_id);
    throw error;
  }

  const fetched = await repo.getLeaveById(finalRow.leave_id);
  return toPayload(fetched || finalRow);
};

const getMyLeaveRequests = async ({ reqUser }) => {
  if (reqUser?.role !== "CADET") throw createHttpError(403, "Cadet access required.");
  const rows = await repo.listLeaveByApplicantUserId(reqUser.user_id);
  return Promise.all(rows.map((row) => toPayload(row)));
};

const getAllLeaveRequests = async ({ reqUser }) => {
  if (!isLeaveAdmin(reqUser)) throw createHttpError(403, "SUO or ANO access required.");
  const rows = await repo.listAllLeaveRequests();
  return Promise.all(rows.map((row) => toPayload(row)));
};

const reviewLeaveStatus = async ({ reqUser, leaveId, status }) => {
  if (!isLeaveAdmin(reqUser)) throw createHttpError(403, "SUO or ANO access required.");

  const existing = await repo.getLeaveById(leaveId);
  if (!existing) throw createHttpError(404, "Leave request not found.");
  if (existing.status !== "pending") throw createHttpError(409, "Leave request already reviewed.");

  const updated = await repo.updateLeaveStatus({
    leaveId,
    status,
    reviewedByUserId: reqUser.user_id,
  });
  if (!updated) throw createHttpError(409, "Leave request already reviewed.");

  const fetched = await repo.getLeaveById(updated.leave_id);
  return toPayload(fetched || updated);
};

module.exports = {
  isSuo,
  isLeaveAdmin,
  applyLeave,
  getMyLeaveRequests,
  getAllLeaveRequests,
  reviewLeaveStatus,
};
