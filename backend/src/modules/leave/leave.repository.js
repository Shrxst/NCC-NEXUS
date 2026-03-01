const db = require("../../db/knex");

const getUserById = async (userId) =>
  db("users")
    .where({ user_id: userId })
    .select("user_id", "role", "email", "auth_user_id")
    .first();

const getCadetProfileByUserId = async (userId) =>
  db("cadet_profiles as cp")
    .where("cp.user_id", userId)
    .select("cp.regimental_no", "cp.full_name", "cp.user_id")
    .first();

const getUserAuthContextBySupabaseIdentity = async ({ authUserId, email }) =>
  db("users as u")
    .leftJoin("cadet_profiles as cp", "cp.user_id", "u.user_id")
    .leftJoin("cadet_ranks as r", "r.id", "cp.rank_id")
    .modify((query) => {
      if (authUserId && email) {
        query.where((qb) => qb.where("u.auth_user_id", authUserId).orWhereRaw("lower(u.email) = lower(?)", [email]));
        return;
      }
      if (authUserId) {
        query.where("u.auth_user_id", authUserId);
        return;
      }
      if (email) {
        query.whereRaw("lower(u.email) = lower(?)", [email]);
        return;
      }
      query.whereRaw("1=0");
    })
    .select(
      "u.user_id",
      "u.role",
      "u.auth_user_id",
      "cp.regimental_no",
      "cp.full_name",
      "r.rank_name"
    )
    .first();

const findAuthUserIdByEmail = async (email) => {
  if (!email) return null;
  const result = await db.raw(
    `
      SELECT id
      FROM auth.users
      WHERE lower(email) = lower(?)
      LIMIT 1
    `,
    [email]
  );
  return result?.rows?.[0]?.id || null;
};

const setUserAuthUserId = async ({ userId, authUserId }) => {
  if (!userId || !authUserId) return null;
  const [row] = await db("users")
    .where("user_id", userId)
    .update({ auth_user_id: authUserId })
    .returning(["user_id", "role", "email", "auth_user_id"]);
  return row || null;
};

const createLeaveRequest = async ({
  applicantUserId,
  applicantAuthUserId,
  applicantRegimentalNo,
  reason,
}) => {
  const [row] = await db("leave_requests")
    .insert({
      applicant_user_id: applicantUserId,
      applicant_auth_user_id: applicantAuthUserId,
      applicant_regimental_no: applicantRegimentalNo || null,
      reason,
    })
    .returning([
      "leave_id",
      "applicant_user_id",
      "applicant_auth_user_id",
      "applicant_regimental_no",
      "reason",
      "document_path",
      "status",
      "reviewed_by_user_id",
      "reviewed_at",
      "created_at",
      "updated_at",
    ]);
  return row;
};

const updateLeaveDocumentPath = async ({ leaveId, documentPath }) => {
  const [row] = await db("leave_requests")
    .where("leave_id", leaveId)
    .update({ document_path: documentPath })
    .returning([
      "leave_id",
      "applicant_user_id",
      "applicant_auth_user_id",
      "applicant_regimental_no",
      "reason",
      "document_path",
      "status",
      "reviewed_by_user_id",
      "reviewed_at",
      "created_at",
      "updated_at",
    ]);
  return row;
};

const deleteLeaveById = async (leaveId) =>
  db("leave_requests").where("leave_id", leaveId).del();

const getLeaveById = async (leaveId) =>
  db("leave_requests as l")
    .leftJoin("cadet_profiles as cp", "cp.user_id", "l.applicant_user_id")
    .leftJoin("users as ru", "ru.user_id", "l.reviewed_by_user_id")
    .leftJoin("cadet_profiles as rcp", "rcp.user_id", "ru.user_id")
    .where("l.leave_id", leaveId)
    .select(
      "l.leave_id",
      "l.applicant_user_id",
      "l.applicant_auth_user_id",
      "l.applicant_regimental_no",
      "l.reason",
      "l.document_path",
      "l.status",
      "l.reviewed_by_user_id",
      "l.reviewed_at",
      "l.created_at",
      "l.updated_at",
      "cp.full_name as cadet_name",
      "cp.regimental_no as cadet_regimental_no",
      "rcp.full_name as reviewed_by_name"
    )
    .first();

const listLeaveByApplicantUserId = async (userId) =>
  db("leave_requests as l")
    .leftJoin("cadet_profiles as cp", "cp.user_id", "l.applicant_user_id")
    .leftJoin("users as ru", "ru.user_id", "l.reviewed_by_user_id")
    .leftJoin("cadet_profiles as rcp", "rcp.user_id", "ru.user_id")
    .where("l.applicant_user_id", userId)
    .orderBy("l.created_at", "desc")
    .select(
      "l.leave_id",
      "l.applicant_user_id",
      "l.applicant_auth_user_id",
      "l.applicant_regimental_no",
      "l.reason",
      "l.document_path",
      "l.status",
      "l.reviewed_by_user_id",
      "l.reviewed_at",
      "l.created_at",
      "l.updated_at",
      "cp.full_name as cadet_name",
      "cp.regimental_no as cadet_regimental_no",
      "rcp.full_name as reviewed_by_name"
    );

const listAllLeaveRequests = async () =>
  db("leave_requests as l")
    .leftJoin("cadet_profiles as cp", "cp.user_id", "l.applicant_user_id")
    .leftJoin("users as ru", "ru.user_id", "l.reviewed_by_user_id")
    .leftJoin("cadet_profiles as rcp", "rcp.user_id", "ru.user_id")
    .orderBy("l.created_at", "desc")
    .select(
      "l.leave_id",
      "l.applicant_user_id",
      "l.applicant_auth_user_id",
      "l.applicant_regimental_no",
      "l.reason",
      "l.document_path",
      "l.status",
      "l.reviewed_by_user_id",
      "l.reviewed_at",
      "l.created_at",
      "l.updated_at",
      "cp.full_name as cadet_name",
      "cp.regimental_no as cadet_regimental_no",
      "rcp.full_name as reviewed_by_name"
    );

const updateLeaveStatus = async ({ leaveId, status, reviewedByUserId }) => {
  const [row] = await db("leave_requests")
    .where("leave_id", leaveId)
    .where("status", "pending")
    .update({
      status,
      reviewed_by_user_id: reviewedByUserId,
      reviewed_at: db.fn.now(),
    })
    .returning([
      "leave_id",
      "applicant_user_id",
      "applicant_auth_user_id",
      "applicant_regimental_no",
      "reason",
      "document_path",
      "status",
      "reviewed_by_user_id",
      "reviewed_at",
      "created_at",
      "updated_at",
    ]);
  return row;
};

module.exports = {
  db,
  getUserById,
  getCadetProfileByUserId,
  getUserAuthContextBySupabaseIdentity,
  findAuthUserIdByEmail,
  setUserAuthUserId,
  createLeaveRequest,
  updateLeaveDocumentPath,
  deleteLeaveById,
  getLeaveById,
  listLeaveByApplicantUserId,
  listAllLeaveRequests,
  updateLeaveStatus,
};
