const db = require("../../db/knex");

const getUserWithCollege = async (userId) =>
  db("users as u")
    .where("u.user_id", userId)
    .select("u.user_id", "u.role", "u.college_id")
    .first();

const getCadetProfileByRegimental = async (regimentalNo) =>
  db("cadet_profiles as cp")
    .where("cp.regimental_no", regimentalNo)
    .select("cp.regimental_no", "cp.user_id", "cp.college_id", "cp.full_name")
    .first();

const getCadetProfileByUserId = async (userId) =>
  db("cadet_profiles as cp")
    .where("cp.user_id", userId)
    .select("cp.regimental_no", "cp.user_id", "cp.college_id", "cp.full_name")
    .first();

const createSession = async ({ collegeId, sessionName, createdByUserId }) => {
  const [row] = await db("attendance_sessions")
    .insert({
      college_id: collegeId,
      session_name: sessionName,
      created_by_user_id: createdByUserId,
    })
    .returning(["session_id", "college_id", "session_name", "created_by_user_id", "created_at"]);
  return row;
};

const softDeleteSession = async ({ sessionId, collegeId }) =>
  db("attendance_sessions")
    .where({ session_id: sessionId, college_id: collegeId })
    .whereNull("deleted_at")
    .update({ deleted_at: db.fn.now() });

const listSessionsByCollege = async (collegeId) =>
  db("attendance_sessions as s")
    .where("s.college_id", collegeId)
    .whereNull("s.deleted_at")
    .orderBy("s.created_at", "desc")
    .select("s.session_id", "s.session_name", "s.college_id", "s.created_at", "s.updated_at");

const getSessionById = async ({ sessionId, collegeId }) =>
  db("attendance_sessions as s")
    .where("s.session_id", sessionId)
    .where("s.college_id", collegeId)
    .whereNull("s.deleted_at")
    .select("s.session_id", "s.session_name", "s.college_id", "s.created_at", "s.updated_at")
    .first();

const createDrill = async ({ sessionId, drillName, drillDate, drillTime }) => {
  const [row] = await db("attendance_drills")
    .insert({
      session_id: sessionId,
      drill_name: drillName,
      drill_date: drillDate,
      drill_time: drillTime,
    })
    .returning(["drill_id", "session_id", "drill_name", "drill_date", "drill_time", "created_at"]);
  return row;
};

const createDrillTx = async ({ trx, sessionId, drillName, drillDate, drillTime }) => {
  const [row] = await trx("attendance_drills")
    .insert({
      session_id: sessionId,
      drill_name: drillName,
      drill_date: drillDate,
      drill_time: drillTime,
    })
    .returning(["drill_id", "session_id", "drill_name", "drill_date", "drill_time", "created_at"]);
  return row;
};

const insertDefaultAttendanceForDrillTx = async ({
  trx,
  drillId,
  collegeId,
  markedByUserId,
}) => {
  const result = await trx.raw(
    `
      INSERT INTO attendance_records (
        drill_id,
        regimental_no,
        status,
        marked_by_user_id,
        marked_at
      )
      SELECT
        ?::bigint AS drill_id,
        cp.regimental_no,
        'P' AS status,
        ?::integer AS marked_by_user_id,
        NOW() AS marked_at
      FROM cadet_profiles cp
      JOIN users u ON u.user_id = cp.user_id
      WHERE cp.college_id = ?
        AND u.role = 'CADET'
      ON CONFLICT (drill_id, regimental_no) DO NOTHING
      RETURNING record_id
    `,
    [drillId, markedByUserId, collegeId]
  );

  return Number(result?.rows?.length || 0);
};

const getAttendanceCountByDrill = async (drillId) => {
  const row = await db("attendance_records")
    .where({ drill_id: drillId })
    .count("* as cnt")
    .first();
  return Number(row?.cnt || 0);
};

const getAttendanceRegimentalsByDrill = async (drillId, limit = 5) =>
  db("attendance_records")
    .where({ drill_id: drillId })
    .orderBy("record_id", "asc")
    .limit(limit)
    .select("regimental_no");

const getDrillByIdForCollege = async ({ drillId, collegeId }) =>
  db("attendance_drills as d")
    .join("attendance_sessions as s", "s.session_id", "d.session_id")
    .where("d.drill_id", drillId)
    .where("s.college_id", collegeId)
    .whereNull("d.deleted_at")
    .whereNull("s.deleted_at")
    .select("d.drill_id")
    .first();

const softDeleteDrill = async ({ drillId }) =>
  db("attendance_drills")
    .where("drill_id", drillId)
    .whereNull("deleted_at")
    .update({ deleted_at: db.fn.now() });

const listDrillsBySession = async (sessionId) =>
  db("attendance_drills as d")
    .where("d.session_id", sessionId)
    .whereNull("d.deleted_at")
    .orderBy([{ column: "d.drill_date", order: "asc" }, { column: "d.drill_time", order: "asc" }])
    .select("d.drill_id", "d.session_id", "d.drill_name", "d.drill_date", "d.drill_time");

const listDrillsWithCadetAttendanceBySession = async ({ sessionId, regimentalNo }) =>
{
  const query = db("attendance_drills as d")
    .leftJoin("attendance_records as ar", function joinAttendance() {
      this.on("ar.drill_id", "=", "d.drill_id").andOn("ar.regimental_no", "=", db.raw("?", [regimentalNo]));
    })
    .where("d.session_id", sessionId)
    .whereNull("d.deleted_at")
    .orderBy([{ column: "d.drill_date", order: "asc" }, { column: "d.drill_time", order: "asc" }])
    .select(
      "d.drill_id",
      "d.session_id",
      "d.drill_name",
      "d.drill_date",
      "d.drill_time",
      "ar.record_id",
      "ar.status",
      "ar.marked_at",
      "ar.marked_by_user_id"
    );

  if (process.env.ATTENDANCE_DEBUG === "true") {
    const sql = query.toSQL();
    console.info(
      `[attendance][my] sql=${sql.sql} bindings=${JSON.stringify(sql.bindings)} regimental_no=${regimentalNo} session_id=${sessionId}`
    );
  }

  const rows = await query;

  if (process.env.ATTENDANCE_DEBUG === "true") {
    console.info(
      `[attendance][my] rows_returned=${rows.length} regimental_no=${regimentalNo} session_id=${sessionId}`
    );
  }

  return rows;
};

const listCadetsByCollege = async (collegeId) =>
  db("cadet_profiles as cp")
    .join("users as u", "u.user_id", "cp.user_id")
    .leftJoin("cadet_ranks as r", "r.id", "cp.rank_id")
    .where("cp.college_id", collegeId)
    .where("u.role", "CADET")
    .orderBy("cp.full_name", "asc")
    .select("cp.regimental_no", "cp.full_name", "r.rank_name");

const listRecordsBySession = async (sessionId) =>
  db("attendance_records as ar")
    .join("attendance_drills as d", "d.drill_id", "ar.drill_id")
    .where("d.session_id", sessionId)
    .whereNull("d.deleted_at")
    .select("ar.record_id", "ar.drill_id", "ar.regimental_no", "ar.status", "ar.marked_at", "ar.marked_by_user_id");

const getDrillsByIdsForCollege = async ({ drillIds, collegeId }) =>
  db("attendance_drills as d")
    .join("attendance_sessions as s", "s.session_id", "d.session_id")
    .whereIn("d.drill_id", drillIds)
    .where("s.college_id", collegeId)
    .whereNull("d.deleted_at")
    .whereNull("s.deleted_at")
    .select("d.drill_id", "d.session_id");

const getCadetsByRegimentalForCollege = async ({ regimentalNos, collegeId }) =>
  db("cadet_profiles as cp")
    .whereIn("cp.regimental_no", regimentalNos)
    .where("cp.college_id", collegeId)
    .select("cp.regimental_no");

const upsertAttendanceRecords = async ({ trx, updates, markedByUserId }) => {
  const payload = updates.map((item) => ({
    drill_id: item.drill_id,
    regimental_no: item.regimental_no,
    status: item.status,
    marked_by_user_id: markedByUserId,
    marked_at: db.fn.now(),
  }));

  await trx("attendance_records")
    .insert(payload)
    .onConflict(["drill_id", "regimental_no"])
    .merge({
      status: trx.raw("EXCLUDED.status"),
      marked_by_user_id: trx.raw("EXCLUDED.marked_by_user_id"),
      marked_at: trx.raw("EXCLUDED.marked_at"),
    });
};

const createLeaveApplication = async ({
  regimentalNo,
  drillId,
  reason,
  attachmentUrl,
}) => {
  const [row] = await db("leaves")
    .insert({
      regimental_no: regimentalNo,
      drill_id: drillId,
      reason,
      document_url: attachmentUrl || null,
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

const getSessionAndDrillForCollege = async ({ sessionId, drillId, collegeId }) =>
  db("attendance_drills as d")
    .join("attendance_sessions as s", "s.session_id", "d.session_id")
    .where("d.drill_id", drillId)
    .where("d.session_id", sessionId)
    .where("s.college_id", collegeId)
    .whereNull("s.deleted_at")
    .whereNull("d.deleted_at")
    .select("s.session_id", "s.college_id", "d.drill_id")
    .first();

const listLeaveByRegimental = async (regimentalNo) =>
  db("leaves as l")
    .leftJoin("attendance_drills as d", "d.drill_id", "l.drill_id")
    .leftJoin("attendance_sessions as s", "s.session_id", "d.session_id")
    .leftJoin("users as ru", "ru.user_id", "l.reviewed_by")
    .leftJoin("cadet_profiles as rcp", "rcp.user_id", "ru.user_id")
    .where("l.regimental_no", regimentalNo)
    .orderBy("l.applied_at", "desc")
    .select(
      "l.leave_id",
      "l.regimental_no",
      "l.drill_id",
      "l.reason",
      "l.document_url",
      "l.status",
      "l.reviewed_by",
      "l.reviewed_at",
      "l.applied_at",
      "l.created_at",
      "l.updated_at",
      "d.session_id",
      "s.session_name",
      "d.drill_name",
      "d.drill_date",
      "d.drill_time",
      "rcp.full_name as reviewed_by_name"
    );

const getLeaveByIdForCollege = async ({ leaveId, collegeId }) =>
  db("leaves as l")
    .join("attendance_drills as d", "d.drill_id", "l.drill_id")
    .join("attendance_sessions as s", "s.session_id", "d.session_id")
    .where("l.leave_id", leaveId)
    .where("s.college_id", collegeId)
    .whereNull("s.deleted_at")
    .whereNull("d.deleted_at")
    .select("l.leave_id", "l.status", "l.regimental_no", "l.drill_id")
    .first();

const updateLeaveStatus = async ({ leaveId, status, reviewedByUserId }) => {
  const [row] = await db("leaves")
    .where("leave_id", leaveId)
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
      "reviewed_by",
      "reviewed_at",
      "applied_at",
      "created_at",
      "updated_at",
    ]);
  return row;
};

module.exports = {
  db,
  getUserWithCollege,
  getCadetProfileByRegimental,
  getCadetProfileByUserId,
  createSession,
  softDeleteSession,
  listSessionsByCollege,
  getSessionById,
  createDrill,
  createDrillTx,
  insertDefaultAttendanceForDrillTx,
  getAttendanceCountByDrill,
  getAttendanceRegimentalsByDrill,
  getDrillByIdForCollege,
  softDeleteDrill,
  listDrillsBySession,
  listDrillsWithCadetAttendanceBySession,
  listCadetsByCollege,
  listRecordsBySession,
  getDrillsByIdsForCollege,
  getCadetsByRegimentalForCollege,
  upsertAttendanceRecords,
  createLeaveApplication,
  getSessionAndDrillForCollege,
  listLeaveByRegimental,
  getLeaveByIdForCollege,
  updateLeaveStatus,
};
