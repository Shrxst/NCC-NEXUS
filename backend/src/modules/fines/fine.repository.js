const db = require("../../db/knex");

const table = (trx) => trx || db;

const getCadetByUserId = async ({ userId, trx }) =>
  table(trx)("cadet_profiles as cp")
    .join("users as u", "u.user_id", "cp.user_id")
    .where("cp.user_id", userId)
    .select("cp.user_id", "cp.regimental_no", "cp.full_name", "cp.college_id", "u.role")
    .first();

const getCadetByRegimentalNo = async ({ regimentalNo, trx }) =>
  table(trx)("cadet_profiles")
    .whereRaw("lower(regimental_no) = lower(?)", [regimentalNo])
    .select("user_id", "regimental_no", "full_name", "college_id")
    .first();

const getAttendanceRecordByCadetDrill = async ({ regimentalNo, drillId, trx }) =>
  table(trx)("attendance_records")
    .where({ regimental_no: regimentalNo, drill_id: drillId })
    .select("record_id", "status", "drill_id", "regimental_no")
    .first();

const getLeaveByCadetDrill = async ({ regimentalNo, drillId, trx }) =>
  table(trx)("leaves")
    .where({ regimental_no: regimentalNo, drill_id: drillId })
    .select("leave_id", "status", "reviewed_by", "reviewed_at")
    .first();

const getFineByCadetDrill = async ({ regimentalNo, drillId, trx }) =>
  table(trx)("fines")
    .where({ regimental_no: regimentalNo, drill_id: drillId })
    .select("fine_id", "regimental_no", "drill_id", "amount", "reason", "status", "created_by", "created_at")
    .first();

const createFine = async ({ regimentalNo, drillId, amount, reason, createdBy, trx }) => {
  const [row] = await table(trx)("fines")
    .insert({
      regimental_no: regimentalNo,
      drill_id: drillId,
      amount,
      reason,
      status: "pending",
      created_by: createdBy || null,
    })
    .returning(["fine_id", "regimental_no", "drill_id", "amount", "reason", "status", "created_by", "created_at"]);
  return row;
};

const updateFine = async ({ fineId, patch, trx }) => {
  const [row] = await table(trx)("fines")
    .where({ fine_id: fineId })
    .update(patch)
    .returning(["fine_id", "regimental_no", "drill_id", "amount", "reason", "status", "created_by", "created_at"]);
  return row;
};

const createFineEvent = async ({ fineId, eventType, performedBy, notes, trx }) =>
  table(trx)("fine_events").insert({
    fine_id: fineId,
    event_type: eventType,
    performed_by: performedBy || null,
    notes: notes || null,
  });

const createFinePayment = async ({ fineId, amount, paymentMethod, paymentRef, paymentProofUrl, trx }) => {
  const [row] = await table(trx)("fine_payments")
    .insert({
      fine_id: fineId,
      amount,
      payment_method: paymentMethod,
      payment_ref: paymentRef || null,
      payment_proof_url: paymentProofUrl || null,
      payment_status: "submitted",
      paid_at: db.fn.now(),
    })
    .returning([
      "payment_id",
      "fine_id",
      "amount",
      "payment_method",
      "payment_ref",
      "payment_proof_url",
      "payment_status",
      "paid_at",
      "verified_by",
      "verified_at",
      "created_at",
    ]);
  return row;
};

const verifyFinePayment = async ({ paymentId, verifiedBy, status, trx }) => {
  const [row] = await table(trx)("fine_payments")
    .where({ payment_id: paymentId, payment_status: "submitted" })
    .update({
      payment_status: status,
      verified_by: verifiedBy,
      verified_at: db.fn.now(),
    })
    .returning([
      "payment_id",
      "fine_id",
      "amount",
      "payment_method",
      "payment_ref",
      "payment_proof_url",
      "payment_status",
      "paid_at",
      "verified_by",
      "verified_at",
      "created_at",
    ]);
  return row;
};

const getLatestPaymentByFineId = async ({ fineId, trx }) =>
  table(trx)("fine_payments")
    .where({ fine_id: fineId })
    .orderBy("created_at", "desc")
    .first();

const getPendingSubmittedPaymentByFineId = async ({ fineId, trx }) =>
  table(trx)("fine_payments")
    .where({ fine_id: fineId, payment_status: "submitted" })
    .orderBy("created_at", "desc")
    .first();

const getFineByIdForScope = async ({ fineId, collegeId, regimentalNo, trx }) => {
  const query = table(trx)("fines as f")
    .join("cadet_profiles as cp", "cp.regimental_no", "f.regimental_no")
    .join("attendance_drills as d", "d.drill_id", "f.drill_id")
    .join("attendance_sessions as s", "s.session_id", "d.session_id")
    .leftJoin("users as u", "u.user_id", "f.created_by")
    .leftJoin("cadet_profiles as ccp", "ccp.user_id", "cp.user_id")
    .where("f.fine_id", fineId)
    .select(
      "f.fine_id",
      "f.regimental_no",
      "f.drill_id",
      "f.amount",
      "f.reason",
      "f.status",
      "f.created_by",
      "f.created_at",
      "cp.full_name as cadet_name",
      "cp.college_id",
      "d.drill_name",
      "d.drill_date",
      "d.drill_time",
      "s.session_id",
      "s.session_name"
    )
    .first();

  if (!query) return null;
  if (collegeId && Number(query.college_id) !== Number(collegeId)) return null;
  if (
    regimentalNo &&
    String(query.regimental_no || "").trim().toLowerCase() !== String(regimentalNo || "").trim().toLowerCase()
  ) {
    return null;
  }
  return query;
};

const getFineByPaymentIdForScope = async ({ paymentId, collegeId, trx }) => {
  const row = await table(trx)("fine_payments as fp")
    .join("fines as f", "f.fine_id", "fp.fine_id")
    .join("cadet_profiles as cp", "cp.regimental_no", "f.regimental_no")
    .join("attendance_drills as d", "d.drill_id", "f.drill_id")
    .join("attendance_sessions as s", "s.session_id", "d.session_id")
    .where("fp.payment_id", paymentId)
    .select(
      "f.fine_id",
      "f.regimental_no",
      "f.drill_id",
      "f.amount",
      "f.reason",
      "f.status",
      "f.created_by",
      "f.created_at",
      "cp.full_name as cadet_name",
      "cp.college_id",
      "d.drill_name",
      "d.drill_date",
      "d.drill_time",
      "s.session_id",
      "s.session_name"
    )
    .first();

  if (!row) return null;
  if (collegeId && Number(row.college_id) !== Number(collegeId)) return null;
  return row;
};

const getFineById = async ({ fineId, trx }) =>
  table(trx)("fines as f")
    .join("cadet_profiles as cp", "cp.regimental_no", "f.regimental_no")
    .join("attendance_drills as d", "d.drill_id", "f.drill_id")
    .join("attendance_sessions as s", "s.session_id", "d.session_id")
    .where("f.fine_id", fineId)
    .select(
      "f.fine_id",
      "f.regimental_no",
      "f.drill_id",
      "f.amount",
      "f.reason",
      "f.status",
      "f.created_by",
      "f.created_at",
      "cp.full_name as cadet_name",
      "cp.college_id",
      "d.drill_name",
      "d.drill_date",
      "d.drill_time",
      "s.session_id",
      "s.session_name"
    )
    .first();

const getFineByIdForCadetUserId = async ({ fineId, cadetUserId, trx }) =>
  table(trx)("fines as f")
    .join("cadet_profiles as cp", "cp.regimental_no", "f.regimental_no")
    .join("attendance_drills as d", "d.drill_id", "f.drill_id")
    .join("attendance_sessions as s", "s.session_id", "d.session_id")
    .where("f.fine_id", fineId)
    .where("cp.user_id", cadetUserId)
    .select(
      "f.fine_id",
      "f.regimental_no",
      "f.drill_id",
      "f.amount",
      "f.reason",
      "f.status",
      "f.created_by",
      "f.created_at",
      "cp.full_name as cadet_name",
      "cp.college_id",
      "d.drill_name",
      "d.drill_date",
      "d.drill_time",
      "s.session_id",
      "s.session_name"
    )
    .first();

const getFineByIdForRegimentalNo = async ({ fineId, regimentalNo, trx }) =>
  table(trx)("fines as f")
    .join("cadet_profiles as cp", "cp.regimental_no", "f.regimental_no")
    .join("attendance_drills as d", "d.drill_id", "f.drill_id")
    .join("attendance_sessions as s", "s.session_id", "d.session_id")
    .where("f.fine_id", fineId)
    .whereRaw("lower(trim(f.regimental_no)) = lower(trim(?))", [regimentalNo])
    .select(
      "f.fine_id",
      "f.regimental_no",
      "f.drill_id",
      "f.amount",
      "f.reason",
      "f.status",
      "f.created_by",
      "f.created_at",
      "cp.full_name as cadet_name",
      "cp.college_id",
      "d.drill_name",
      "d.drill_date",
      "d.drill_time",
      "s.session_id",
      "s.session_name"
    )
    .first();

const listFines = async ({ collegeId, regimentalNo, cadetUserId, status, trx }) => {
  const query = table(trx)("fines as f")
    .join("cadet_profiles as cp", "cp.regimental_no", "f.regimental_no")
    .join("attendance_drills as d", "d.drill_id", "f.drill_id")
    .join("attendance_sessions as s", "s.session_id", "d.session_id")
    .leftJoin("users as cu", "cu.user_id", "f.created_by")
    .leftJoin("cadet_profiles as ccp", "ccp.user_id", "cp.user_id")
    .select(
      "f.fine_id",
      "f.regimental_no",
      "f.drill_id",
      "f.amount",
      "f.reason",
      "f.status",
      "f.created_by",
      "f.created_at",
      "cp.full_name as cadet_name",
      "cp.college_id",
      "d.drill_name",
      "d.drill_date",
      "d.drill_time",
      "s.session_id",
      "s.session_name"
    )
    .orderBy("f.created_at", "desc");

  if (collegeId) query.where("cp.college_id", collegeId);
  if (regimentalNo) {
    query.whereRaw("lower(trim(f.regimental_no)) = lower(trim(?))", [regimentalNo]);
  }
  if (cadetUserId) query.where("cp.user_id", cadetUserId);
  if (status) query.where("f.status", status);

  return query;
};

const listFineEventsByFineId = async ({ fineId, trx }) =>
  table(trx)("fine_events as fe")
    .leftJoin("cadet_profiles as cp", "cp.user_id", "fe.performed_by")
    .where("fe.fine_id", fineId)
    .orderBy("fe.created_at", "asc")
    .select("fe.event_id", "fe.fine_id", "fe.event_type", "fe.performed_by", "fe.notes", "fe.created_at", "cp.full_name as performed_by_name");

const listPaymentsByFineId = async ({ fineId, trx }) =>
  table(trx)("fine_payments as fp")
    .leftJoin("cadet_profiles as cp", "cp.user_id", "fp.verified_by")
    .where("fp.fine_id", fineId)
    .orderBy("fp.created_at", "desc")
    .select(
      "fp.payment_id",
      "fp.fine_id",
      "fp.amount",
      "fp.payment_method",
      "fp.payment_ref",
      "fp.payment_proof_url",
      "fp.payment_status",
      "fp.paid_at",
      "fp.verified_by",
      "fp.verified_at",
      "fp.created_at",
      "cp.full_name as verified_by_name"
    );

const notifyCadet = async ({ regimentalNo, type, message, trx }) => {
  const cadet = await table(trx)("cadet_profiles")
    .where({ regimental_no: regimentalNo })
    .select("user_id")
    .first();

  if (!cadet?.user_id) return;

  await table(trx)("notifications").insert({
    user_id: cadet.user_id,
    type,
    message,
    is_read: false,
  });
};

module.exports = {
  db,
  getCadetByUserId,
  getCadetByRegimentalNo,
  getAttendanceRecordByCadetDrill,
  getLeaveByCadetDrill,
  getFineByCadetDrill,
  createFine,
  updateFine,
  createFineEvent,
  createFinePayment,
  verifyFinePayment,
  getLatestPaymentByFineId,
  getPendingSubmittedPaymentByFineId,
  getFineByIdForScope,
  getFineByPaymentIdForScope,
  getFineById,
  getFineByIdForCadetUserId,
  getFineByIdForRegimentalNo,
  listFines,
  listFineEventsByFineId,
  listPaymentsByFineId,
  notifyCadet,
};
