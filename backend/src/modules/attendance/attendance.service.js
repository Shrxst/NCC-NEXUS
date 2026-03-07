const { uploadToCloudinary } = require("../../services/cloudinary.service");
const repo = require("./attendance.repository");
const fineEligibilityService = require("../fines/fine-eligibility.service");

const createHttpError = (status, message) => {
  const err = new Error(message);
  err.status = status;
  return err;
};

const isSuo = (user) =>
  user?.role === "CADET" && String(user?.rank || "").toLowerCase() === "senior under officer";

const isAno = (user) => user?.role === "ANO";
const isCadetOnly = (user) => user?.role === "CADET" && !isSuo(user);

const ensureUserCollegeContext = async (reqUser) => {
  const row = await repo.getUserWithCollege(reqUser.user_id);
  if (!row) throw createHttpError(401, "User not found.");
  if (!row.college_id) throw createHttpError(403, "User is not linked to a college.");
  return row;
};

const normalizeDrill = (drill) => ({
  drill_id: Number(drill.drill_id),
  drill_name: drill.drill_name,
  drill_date: drill.drill_date,
  drill_time: String(drill.drill_time).slice(0, 8),
});

const toIsoDate = (dateValue) => {
  if (!dateValue) return null;
  const d = new Date(dateValue);
  if (Number.isNaN(d.getTime())) return null;
  return d.toISOString();
};

const resolveSessionStatus = (drills) => {
  if (!Array.isArray(drills) || drills.length === 0) return "upcoming";
  const now = new Date();
  let past = 0;
  let future = 0;
  drills.forEach((drill) => {
    const datePart = drill.drill_date || drill.date;
    const timePart = drill.drill_time || drill.time;
    const dt = new Date(`${datePart}T${String(timePart).slice(0, 8)}`);
    if (Number.isNaN(dt.getTime())) return;
    if (dt < now) past += 1;
    else future += 1;
  });
  if (past === drills.length) return "completed";
  if (future === drills.length) return "upcoming";
  return "current";
};

const buildSessionDetail = ({ session, drills, cadets, records }) => {
  const drillIds = drills.map((d) => Number(d.drill_id));
  const recordMap = new Map(records.map((r) => [`${r.drill_id}:${r.regimental_no}`, r.status]));

  const cadetRows = cadets.map((cadet) => {
    const attendance = drillIds.map((drillId) => recordMap.get(`${drillId}:${cadet.regimental_no}`) || "P");
    const attended = attendance.filter((a) => a === "P").length;
    const total = attendance.length;
    const percent = total ? Number(((attended / total) * 100).toFixed(1)) : 0;
    return {
      regimental_no: cadet.regimental_no,
      name: cadet.full_name,
      rank: cadet.rank_name || null,
      attendance,
      summary: { attended, total, percent },
    };
  });

  return {
    session_id: Number(session.session_id),
    session_name: session.session_name,
    drills: drills.map(normalizeDrill),
    cadets: cadetRows,
  };
};

const buildCadetAttendancePayload = ({ sessions, cadetRegimentalNo, leaveApplications }) => {
  const allSessions = [];
  let total = 0;
  let present = 0;

  sessions.forEach(({ session, drills, records }) => {
    const rows = drills.map((drill) => {
      const status = records.find(
        (r) => Number(r.drill_id) === Number(drill.drill_id) && r.regimental_no === cadetRegimentalNo
      )?.status;
      if (status === "P" || status === "A") {
        total += 1;
        if (status === "P") present += 1;
      }
      return {
        drill_id: Number(drill.drill_id),
        name: drill.drill_name,
        date: drill.drill_date,
        time: String(drill.drill_time).slice(0, 8),
        status: status || null,
      };
    });

    allSessions.push({
      session_id: Number(session.session_id),
      session_name: session.session_name,
      status: resolveSessionStatus(rows),
      drills: rows,
    });
  });

  return {
    regimental_no: cadetRegimentalNo,
    stats: {
      total,
      present,
      absent: total - present,
      percent: total ? Number(((present / total) * 100).toFixed(1)) : 0,
    },
    sessions: allSessions,
    leave_applications: leaveApplications.map((item) => ({
      leave_id: Number(item.leave_id),
      session_id: Number(item.session_id),
      drill_id: Number(item.drill_id),
      session_name: item.session_name,
      drill_name: item.drill_name,
      drill_date: item.drill_date,
      drill_time: item.drill_time ? String(item.drill_time).slice(0, 8) : null,
      reason: item.reason,
      attachment_url: item.document_url,
      status: item.status,
      reviewed_by_user_id: item.reviewed_by || null,
      reviewed_by_name: item.reviewed_by_name || null,
      reviewed_at: toIsoDate(item.reviewed_at),
      created_at: toIsoDate(item.applied_at || item.created_at),
    })),
  };
};

const ensureSuoOrThrow = (reqUser) => {
  if (!isSuo(reqUser)) throw createHttpError(403, "SUO access required.");
};

const ensureAnoOrSuoOrThrow = (reqUser) => {
  if (!isAno(reqUser) && !isSuo(reqUser)) throw createHttpError(403, "ANO or SUO access required.");
};

const resolveDrillNameForSession = async ({ sessionId, desiredName }) => {
  const trimmed = String(desiredName || "").trim();
  if (!trimmed) throw createHttpError(400, "Drill name is required.");

  const drills = await repo.listDrillsBySession(sessionId);
  const existing = new Set(drills.map((d) => String(d.drill_name || "").trim().toLowerCase()));
  if (!existing.has(trimmed.toLowerCase())) return trimmed;

  const autoPattern = /^drill\s+(\d+)$/i.exec(trimmed);
  if (!autoPattern) {
    throw createHttpError(409, "Drill name already exists in this session.");
  }

  let next = Number(autoPattern[1]);
  while (existing.has(`drill ${next}`.toLowerCase())) {
    next += 1;
  }
  return `Drill ${next}`;
};

const createSession = async ({ reqUser, sessionName }) => {
  ensureSuoOrThrow(reqUser);
  const context = await ensureUserCollegeContext(reqUser);
  return repo.createSession({
    collegeId: context.college_id,
    sessionName,
    createdByUserId: reqUser.user_id,
  });
};

const deleteSession = async ({ reqUser, sessionId }) => {
  ensureSuoOrThrow(reqUser);
  const context = await ensureUserCollegeContext(reqUser);
  const affected = await repo.softDeleteSession({ sessionId, collegeId: context.college_id });
  if (!affected) throw createHttpError(404, "Session not found.");
};

const createDrill = async ({ reqUser, payload }) => {
  ensureSuoOrThrow(reqUser);
  const context = await ensureUserCollegeContext(reqUser);
  const session = await repo.getSessionById({ sessionId: payload.session_id, collegeId: context.college_id });
  if (!session) throw createHttpError(404, "Session not found.");

  const existingDrills = await repo.listDrillsBySession(payload.session_id);
  const canonicalName = `Drill ${existingDrills.length + 1}`;
  const drillName = await resolveDrillNameForSession({
    sessionId: payload.session_id,
    desiredName: canonicalName,
  });

  let txResult;
  try {
    txResult = await repo.db.transaction(async (trx) => {
      const drill = await repo.createDrillTx({
        trx,
        sessionId: payload.session_id,
        drillName,
        drillDate: payload.drill_date,
        drillTime: payload.drill_time,
      });

      const recordsCreated = await repo.insertDefaultAttendanceForDrillTx({
        trx,
        drillId: drill.drill_id,
        collegeId: context.college_id,
        markedByUserId: reqUser.user_id,
      });

      return { drill, recordsCreated };
    });
  } catch (err) {
    if (
      err?.code === "23505" &&
      String(err?.constraint || "") === "uq_attendance_drills_session_name_active"
    ) {
      throw createHttpError(409, "Drill name already exists in this session.");
    }
    throw err;
  }

  console.info(
    `[attendance] drill_created drill_id=${txResult.drill.drill_id} session_id=${payload.session_id} college_id=${context.college_id} seeded_records=${txResult.recordsCreated} marked_by_user_id=${reqUser.user_id}`
  );

  if (process.env.ATTENDANCE_DEBUG === "true") {
    const seededCount = await repo.getAttendanceCountByDrill(txResult.drill.drill_id);
    const firstFive = await repo.getAttendanceRegimentalsByDrill(txResult.drill.drill_id, 5);
    console.info(
      `[attendance][seed-verify] drill_id=${txResult.drill.drill_id} seeded_count=${seededCount} first5_regimental_no=${JSON.stringify(
        firstFive.map((r) => r.regimental_no)
      )}`
    );
  }

  return {
    ...txResult.drill,
    attendance_records_created: txResult.recordsCreated,
  };
};

const deleteDrill = async ({ reqUser, drillId }) => {
  ensureSuoOrThrow(reqUser);
  const context = await ensureUserCollegeContext(reqUser);
  const drill = await repo.getDrillByIdForCollege({ drillId, collegeId: context.college_id });
  if (!drill) throw createHttpError(404, "Drill not found.");
  await repo.softDeleteDrill({ drillId });
};

const patchAttendanceRecords = async ({ reqUser, updates }) => {
  ensureSuoOrThrow(reqUser);
  const context = await ensureUserCollegeContext(reqUser);

  const drillIds = [...new Set(updates.map((u) => Number(u.drill_id)))];
  const regimentalNos = [...new Set(updates.map((u) => u.regimental_no))];

  const validDrills = await repo.getDrillsByIdsForCollege({
    drillIds,
    collegeId: context.college_id,
  });
  if (validDrills.length !== drillIds.length) {
    throw createHttpError(403, "One or more drills are outside your college scope.");
  }

  const validCadets = await repo.getCadetsByRegimentalForCollege({
    regimentalNos,
    collegeId: context.college_id,
  });
  if (validCadets.length !== regimentalNos.length) {
    throw createHttpError(403, "One or more cadets are outside your college scope.");
  }

  await repo.db.transaction(async (trx) => {
    await repo.upsertAttendanceRecords({
      trx,
      updates,
      markedByUserId: reqUser.user_id,
    });
    await fineEligibilityService.runForAttendanceUpdates({
      trx,
      updates,
      actorUserId: reqUser.user_id,
    });
  });
};

const listSessions = async ({ reqUser }) => {
  ensureAnoOrSuoOrThrow(reqUser);
  const context = await ensureUserCollegeContext(reqUser);
  return repo.listSessionsByCollege(context.college_id);
};

const getSessionDetail = async ({ reqUser, sessionId }) => {
  ensureAnoOrSuoOrThrow(reqUser);
  const context = await ensureUserCollegeContext(reqUser);

  const session = await repo.getSessionById({ sessionId, collegeId: context.college_id });
  if (!session) throw createHttpError(404, "Session not found.");

  const [drills, cadets, records] = await Promise.all([
    repo.listDrillsBySession(sessionId),
    repo.listCadetsByCollege(context.college_id),
    repo.listRecordsBySession(sessionId),
  ]);

  return buildSessionDetail({ session, drills, cadets, records });
};

const exportSessionCsv = async ({ reqUser, sessionId }) => {
  ensureAnoOrSuoOrThrow(reqUser);
  const detail = await getSessionDetail({ reqUser, sessionId });

  let csv = "Cadet Name,Regimental No,";
  detail.drills.forEach((drill) => {
    csv += `${drill.drill_name} (${drill.drill_date} ${drill.drill_time}),`;
  });
  csv += "Total Drills,Total Attendance,Percentage\n";

  detail.cadets.forEach((cadet) => {
    csv += `${cadet.name},${cadet.regimental_no},`;
    cadet.attendance.forEach((status) => {
      csv += `${status},`;
    });
    csv += `${cadet.summary.total},${cadet.summary.attended},${cadet.summary.percent}%\n`;
  });

  return { csv, sessionName: detail.session_name };
};

const getMyAttendance = async ({ reqUser, regimentalNo }) => {
  if (!isCadetOnly(reqUser)) throw createHttpError(403, "Cadet access required.");
  if (reqUser.regimental_no !== regimentalNo) {
    throw createHttpError(403, "You can access only your own attendance.");
  }

  const cadet = await repo.getCadetProfileByRegimental(regimentalNo);
  if (!cadet) throw createHttpError(404, "Cadet profile not found.");

  if (process.env.ATTENDANCE_DEBUG === "true") {
    console.info(
      `[attendance][my] regimental_no=${regimentalNo} token_regimental_no=${reqUser.regimental_no} cadet_college_id=${cadet.college_id}`
    );
  }

  const sessions = await repo.listSessionsByCollege(cadet.college_id);
  const details = await Promise.all(
    sessions.map(async (session) => {
      const rows = await repo.listDrillsWithCadetAttendanceBySession({
        sessionId: session.session_id,
        regimentalNo,
      });
      const drills = rows.map((row) => ({
        drill_id: row.drill_id,
        drill_name: row.drill_name,
        drill_date: row.drill_date,
        drill_time: row.drill_time,
      }));
      const records = rows
        .filter((row) => row.record_id)
        .map((row) => ({
          record_id: row.record_id,
          drill_id: row.drill_id,
          regimental_no: regimentalNo,
          status: row.status,
          marked_at: row.marked_at,
          marked_by_user_id: row.marked_by_user_id,
        }));
      return { session, drills, records };
    })
  );

  const leaveApplications = await repo.listLeaveByRegimental(regimentalNo);
  return buildCadetAttendancePayload({
    sessions: details,
    cadetRegimentalNo: regimentalNo,
    leaveApplications,
  });
};

const submitLeave = async ({ reqUser, payload, file }) => {
  if (!isCadetOnly(reqUser)) throw createHttpError(403, "Cadet access required.");
  if (reqUser.regimental_no !== payload.regimental_no) {
    throw createHttpError(403, "You can submit leave only for your own regimental number.");
  }

  const cadet = await repo.getCadetProfileByRegimental(payload.regimental_no);
  if (!cadet) throw createHttpError(404, "Cadet profile not found.");

  const relation = await repo.getSessionAndDrillForCollege({
    sessionId: payload.session_id,
    drillId: payload.drill_id,
    collegeId: cadet.college_id,
  });
  if (!relation) throw createHttpError(400, "Session/Drill mismatch or out of scope.");

  let attachmentUrl = null;
  if (file?.buffer) {
    const result = await uploadToCloudinary(file.buffer, "ncc-nexus/attendance-leaves");
    attachmentUrl = result.secure_url;
  }

  return repo.db.transaction(async (trx) => {
    let leave;
    try {
      leave = await trx("leaves")
        .insert({
          regimental_no: payload.regimental_no,
          drill_id: payload.drill_id,
          reason: payload.reason,
          document_url: attachmentUrl || null,
          status: "pending",
          applied_at: repo.db.fn.now(),
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
        ])
        .then((rows) => rows[0]);
    } catch (err) {
      if (err?.code === "23505" && String(err?.constraint || "") === "uq_leaves_regimental_drill") {
        throw createHttpError(409, "Leave application already exists for this drill.");
      }
      throw err;
    }

    await fineEligibilityService.runForLeaveUpdate({
      trx,
      regimentalNo: payload.regimental_no,
      drillId: payload.drill_id,
      actorUserId: reqUser.user_id,
    });

    return leave;
  });
};

const reviewLeave = async ({ reqUser, leaveId, status }) => {
  ensureAnoOrSuoOrThrow(reqUser);
  const context = await ensureUserCollegeContext(reqUser);
  const leave = await repo.getLeaveByIdForCollege({ leaveId, collegeId: context.college_id });
  if (!leave) throw createHttpError(404, "Leave application not found.");
  if (leave.status !== "pending") throw createHttpError(409, "Leave application already reviewed.");
  return repo.db.transaction(async (trx) => {
    const updated = await trx("leaves")
      .where("leave_id", leaveId)
      .update({
        status,
        reviewed_by: reqUser.user_id,
        reviewed_at: repo.db.fn.now(),
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
      ])
      .then((rows) => rows[0]);

    await fineEligibilityService.runForLeaveUpdate({
      trx,
      regimentalNo: updated.regimental_no,
      drillId: updated.drill_id,
      actorUserId: reqUser.user_id,
    });

    return updated;
  });
};

module.exports = {
  createSession,
  deleteSession,
  createDrill,
  deleteDrill,
  patchAttendanceRecords,
  listSessions,
  getSessionDetail,
  exportSessionCsv,
  getMyAttendance,
  submitLeave,
  reviewLeave,
};
