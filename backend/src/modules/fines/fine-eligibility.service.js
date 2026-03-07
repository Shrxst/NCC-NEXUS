const repo = require("./fine.repository");

const FINE_AMOUNT = 15;
const FINE_REASON = "Absent without approved leave";

const toNumber = (value) => Number(value);

const evaluateFineEligibility = ({ attendanceStatus, leaveStatus }) => {
  if (attendanceStatus !== "A") return false;
  if (!leaveStatus) return true;
  return leaveStatus === "rejected";
};

const applyFineDecisionTx = async ({ trx, regimentalNo, drillId, actorUserId, contextNote }) => {
  const [attendance, leave, existingFine] = await Promise.all([
    repo.getAttendanceRecordByCadetDrill({ regimentalNo, drillId, trx }),
    repo.getLeaveByCadetDrill({ regimentalNo, drillId, trx }),
    repo.getFineByCadetDrill({ regimentalNo, drillId, trx }),
  ]);

  const eligible = evaluateFineEligibility({
    attendanceStatus: attendance?.status || null,
    leaveStatus: leave?.status || null,
  });

  if (eligible) {
    if (!existingFine) {
      const created = await repo.createFine({
        trx,
        regimentalNo,
        drillId,
        amount: FINE_AMOUNT,
        reason: FINE_REASON,
        createdBy: actorUserId || null,
      });
      await repo.createFineEvent({
        trx,
        fineId: created.fine_id,
        eventType: "created",
        performedBy: actorUserId || null,
        notes: contextNote || "Fine created by eligibility engine",
      });
      await repo.notifyCadet({
        trx,
        regimentalNo,
        type: "fine_created",
        message: `Fine of Rs. ${FINE_AMOUNT} created for drill ${drillId}.`,
      });
      return { action: "created", fine: created };
    }

    if (existingFine.status === "cancelled") {
      const revived = await repo.updateFine({
        trx,
        fineId: existingFine.fine_id,
        patch: { status: "pending", amount: FINE_AMOUNT, reason: FINE_REASON },
      });
      await repo.createFineEvent({
        trx,
        fineId: revived.fine_id,
        eventType: "adjusted",
        performedBy: actorUserId || null,
        notes: contextNote || "Fine re-activated by eligibility engine",
      });
      await repo.notifyCadet({
        trx,
        regimentalNo,
        type: "fine_created",
        message: `Fine of Rs. ${FINE_AMOUNT} activated for drill ${drillId}.`,
      });
      return { action: "reactivated", fine: revived };
    }

    return { action: "unchanged", fine: existingFine };
  }

  if (existingFine && existingFine.status !== "cancelled") {
    const cancelled = await repo.updateFine({
      trx,
      fineId: existingFine.fine_id,
      patch: { status: "cancelled" },
    });
    await repo.createFineEvent({
      trx,
      fineId: cancelled.fine_id,
      eventType: "reversed",
      performedBy: actorUserId || null,
      notes: contextNote || "Fine reversed by eligibility engine",
    });
    await repo.notifyCadet({
      trx,
      regimentalNo,
      type: "fine_reversed",
      message: `Fine reversed for drill ${drillId}.`,
    });
    return { action: "reversed", fine: cancelled };
  }

  return { action: "none", fine: existingFine || null };
};

const runForAttendanceUpdates = async ({ updates, actorUserId, trx }) => {
  const uniquePairs = new Map();
  updates.forEach((u) => {
    uniquePairs.set(`${u.regimental_no}:${u.drill_id}`, {
      regimentalNo: String(u.regimental_no),
      drillId: toNumber(u.drill_id),
    });
  });

  const entries = [...uniquePairs.values()];
  const results = [];
  for (const entry of entries) {
    // Intentional serial writes to preserve deterministic event order.
    // eslint-disable-next-line no-await-in-loop
    const result = await applyFineDecisionTx({
      trx,
      regimentalNo: entry.regimentalNo,
      drillId: entry.drillId,
      actorUserId,
      contextNote: "Attendance update",
    });
    results.push({ ...entry, ...result });
  }
  return results;
};

const runForLeaveUpdate = async ({ regimentalNo, drillId, actorUserId, trx }) =>
  applyFineDecisionTx({
    trx,
    regimentalNo: String(regimentalNo),
    drillId: toNumber(drillId),
    actorUserId,
    contextNote: "Leave status update",
  });

module.exports = {
  FINE_AMOUNT,
  FINE_REASON,
  evaluateFineEligibility,
  applyFineDecisionTx,
  runForAttendanceUpdates,
  runForLeaveUpdate,
};
