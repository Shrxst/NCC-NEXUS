const db = require("../../db/knex");

const getCadetProfileByUserId = async (userId) =>
  db("cadet_profiles as cp")
    .where("cp.user_id", userId)
    .select("cp.regimental_no", "cp.full_name", "cp.user_id", "cp.college_id")
    .first();

const getDrillForCollege = async ({ drillId, collegeId }) =>
  db("attendance_drills as d")
    .join("attendance_sessions as s", "s.session_id", "d.session_id")
    .where("d.drill_id", drillId)
    .whereNull("d.deleted_at")
    .whereNull("s.deleted_at")
    .where("s.college_id", collegeId)
    .select(
      "d.drill_id",
      "d.drill_name",
      "d.drill_date",
      "d.drill_time",
      "d.session_id",
      "s.session_name",
      "s.college_id"
    )
    .first();

const createLeave = async ({ regimentalNo, drillId, reason, documentUrl, trx }) => {
  const q = trx || db;
  const [row] = await q("leaves")
    .insert({
      regimental_no: regimentalNo,
      drill_id: drillId,
      reason,
      document_url: documentUrl || null,
      status: "pending",
      applied_at: db.fn.now(),
    })
    .returning([
      "leave_id",
      "regimental_no",
      "drill_id",
      "reason",
      "document_url",
      "status",
      "applied_at",
      "reviewed_by",
      "reviewed_at",
      "created_at",
      "updated_at",
    ]);
  return row;
};

const listLeaveByRegimentalNo = async (regimentalNo) =>
  db("leaves as l")
    .join("attendance_drills as d", "d.drill_id", "l.drill_id")
    .join("attendance_sessions as s", "s.session_id", "d.session_id")
    .leftJoin("cadet_profiles as reviewer_cp", "reviewer_cp.user_id", "l.reviewed_by")
    .where("l.regimental_no", regimentalNo)
    .orderBy("l.applied_at", "desc")
    .select(
      "l.leave_id",
      "l.regimental_no",
      "l.drill_id",
      "l.reason",
      "l.document_url",
      "l.status",
      "l.applied_at",
      "l.reviewed_by",
      "l.reviewed_at",
      "l.created_at",
      "l.updated_at",
      "d.session_id",
      "d.drill_name",
      "d.drill_date",
      "d.drill_time",
      "s.session_name",
      "reviewer_cp.full_name as reviewed_by_name"
    );

const listAllLeaveByCollege = async (collegeId) =>
  db("leaves as l")
    .join("attendance_drills as d", "d.drill_id", "l.drill_id")
    .join("attendance_sessions as s", "s.session_id", "d.session_id")
    .join("cadet_profiles as cp", "cp.regimental_no", "l.regimental_no")
    .leftJoin("cadet_profiles as reviewer_cp", "reviewer_cp.user_id", "l.reviewed_by")
    .where("s.college_id", collegeId)
    .whereNull("d.deleted_at")
    .whereNull("s.deleted_at")
    .orderBy("l.applied_at", "desc")
    .select(
      "l.leave_id",
      "l.regimental_no",
      "l.drill_id",
      "l.reason",
      "l.document_url",
      "l.status",
      "l.applied_at",
      "l.reviewed_by",
      "l.reviewed_at",
      "l.created_at",
      "l.updated_at",
      "cp.full_name as cadet_name",
      "d.session_id",
      "d.drill_name",
      "d.drill_date",
      "d.drill_time",
      "s.session_name",
      "reviewer_cp.full_name as reviewed_by_name"
    );

const getLeaveByIdForCollege = async ({ leaveId, collegeId }) =>
  db("leaves as l")
    .join("attendance_drills as d", "d.drill_id", "l.drill_id")
    .join("attendance_sessions as s", "s.session_id", "d.session_id")
    .join("cadet_profiles as cp", "cp.regimental_no", "l.regimental_no")
    .where("l.leave_id", leaveId)
    .where("s.college_id", collegeId)
    .whereNull("d.deleted_at")
    .whereNull("s.deleted_at")
    .select(
      "l.leave_id",
      "l.regimental_no",
      "l.drill_id",
      "l.status",
      "cp.full_name as cadet_name",
      "s.session_name",
      "d.drill_name"
    )
    .first();

const updateLeaveStatus = async ({ leaveId, status, reviewedByUserId, trx }) => {
  const q = trx || db;
  const [row] = await q("leaves")
    .where({ leave_id: leaveId })
    .where({ status: "pending" })
    .update({
      status,
      reviewed_by: reviewedByUserId,
      reviewed_at: db.fn.now(),
    })
    .returning([
      "leave_id",
      "regimental_no",
      "drill_id",
      "reason",
      "document_url",
      "status",
      "applied_at",
      "reviewed_by",
      "reviewed_at",
      "created_at",
      "updated_at",
    ]);
  return row;
};

module.exports = {
  db,
  getCadetProfileByUserId,
  getDrillForCollege,
  createLeave,
  listLeaveByRegimentalNo,
  listAllLeaveByCollege,
  getLeaveByIdForCollege,
  updateLeaveStatus,
};
