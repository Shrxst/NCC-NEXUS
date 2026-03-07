const repo = require("./fine.repository");
const {
  uploadFinePaymentProof,
  createSignedFinePaymentProofUrl,
} = require("../../services/supabaseStorage.service");

const createHttpError = (status, message) => {
  const err = new Error(message);
  err.status = status;
  return err;
};

const isSuo = (user) =>
  user?.role === "CADET" && String(user?.rank || "").toLowerCase() === "senior under officer";

const isAno = (user) => user?.role === "ANO";
const isCadet = (user) => user?.role === "CADET";
const MAX_FILE_SIZE_BYTES = 10 * 1024 * 1024;
const ALLOWED_PROOF_MIME_TYPES = new Set([
  "image/jpeg",
  "image/png",
  "image/webp",
  "application/pdf",
]);

const assertPaymentProof = (file) => {
  if (!file) return;
  if (!ALLOWED_PROOF_MIME_TYPES.has(file.mimetype)) {
    throw createHttpError(400, "Unsupported payment proof file type.");
  }
  if (Number(file.size || 0) > MAX_FILE_SIZE_BYTES) {
    throw createHttpError(413, "Payment proof exceeds 10MB size limit.");
  }
};

const normalizeFileName = (filename = "proof") =>
  String(filename)
    .normalize("NFKD")
    .replace(/[^\w.\-]+/g, "_")
    .replace(/_+/g, "_")
    .slice(0, 120);

const resolveProofUrl = async (path) => {
  if (!path) return null;
  try {
    return await createSignedFinePaymentProofUrl({ path, expiresInSeconds: 300 });
  } catch {
    return null;
  }
};

const toWorkflowStatus = (fine, latestPayment) => {
  if (fine.status === "paid") return { code: "approved", label: "Approved" };
  if (fine.status === "payment_submitted") return { code: "payment_submitted", label: "Payment Submitted" };
  if (latestPayment?.payment_status === "submitted") return { code: "payment_submitted", label: "Payment Submitted" };
  return { code: "pending", label: "Pending" };
};

const ensureCollegeScope = async (reqUser) => {
  let cadet = await repo.getCadetByUserId({ userId: reqUser.user_id });
  if (!cadet && reqUser?.regimental_no) {
    cadet = await repo.getCadetByRegimentalNo({ regimentalNo: reqUser.regimental_no });
  }
  if (isCadet(reqUser) && !cadet) throw createHttpError(404, "Cadet profile not found.");
  return {
    cadet_user_id: cadet?.user_id || null,
    regimental_no: cadet?.regimental_no || reqUser.regimental_no || null,
    college_id: reqUser.college_id || cadet?.college_id || null,
  };
};

const enrichFine = async (fine) => {
  const [events, payments, latestPayment] = await Promise.all([
    repo.listFineEventsByFineId({ fineId: fine.fine_id }),
    repo.listPaymentsByFineId({ fineId: fine.fine_id }),
    repo.getLatestPaymentByFineId({ fineId: fine.fine_id }),
  ]);

  const workflowStatus = toWorkflowStatus(fine, latestPayment);
  const latestPaymentProofUrl = await resolveProofUrl(latestPayment?.payment_proof_url || null);
  const paymentProofUrls = await Promise.all(
    payments.map((payment) => resolveProofUrl(payment.payment_proof_url || null))
  );

  return {
    ...fine,
    amount: Number(fine.amount),
    workflow_status: workflowStatus.code,
    workflow_status_label: workflowStatus.label,
    latest_payment: latestPayment
      ? {
          payment_id: Number(latestPayment.payment_id),
          amount: Number(latestPayment.amount),
          payment_method: latestPayment.payment_method,
          payment_ref: latestPayment.payment_ref,
          payment_proof_url: latestPaymentProofUrl,
          payment_status: latestPayment.payment_status,
          paid_at: latestPayment.paid_at,
          verified_by: latestPayment.verified_by,
          verified_at: latestPayment.verified_at,
        }
      : null,
    events: events.map((event) => ({
      event_id: Number(event.event_id),
      event_type: event.event_type,
      performed_by: event.performed_by,
      performed_by_name: event.performed_by_name || null,
      notes: event.notes,
      created_at: event.created_at,
    })),
    payments: payments.map((payment, idx) => ({
      payment_id: Number(payment.payment_id),
      amount: Number(payment.amount),
      payment_method: payment.payment_method,
      payment_ref: payment.payment_ref,
      payment_proof_url: paymentProofUrls[idx],
      payment_status: payment.payment_status,
      paid_at: payment.paid_at,
      verified_by: payment.verified_by,
      verified_by_name: payment.verified_by_name || null,
      verified_at: payment.verified_at,
    })),
  };
};

const getMyFines = async ({ reqUser, query }) => {
  if (!isCadet(reqUser)) throw createHttpError(403, "Cadet access required.");
  const scope = await ensureCollegeScope(reqUser);
  if (!scope.regimental_no) throw createHttpError(403, "Cadet regimental number missing in token context.");
  const rows = await repo.listFines({
    regimentalNo: scope.regimental_no,
    status: query.status || null,
  });
  return Promise.all(rows.map((fine) => enrichFine(fine)));
};

const getAllFines = async ({ reqUser, query }) => {
  if (!isSuo(reqUser) && !isAno(reqUser)) throw createHttpError(403, "SUO or ANO access required.");
  const scope = await ensureCollegeScope(reqUser);
  if (!scope.college_id) throw createHttpError(403, "College context missing.");
  const rows = await repo.listFines({
    collegeId: scope.college_id,
    status: query.status || null,
  });
  return Promise.all(rows.map((fine) => enrichFine(fine)));
};

const payFine = async ({ reqUser, fineId, payload, file }) => {
  if (!isCadet(reqUser)) throw createHttpError(403, "Cadet access required.");
  assertPaymentProof(file);
  const scope = await ensureCollegeScope(reqUser);
  if (!scope.regimental_no) throw createHttpError(403, "Cadet regimental number missing in token context.");
  let fine = null;
  const mine = await repo.listFines({
    regimentalNo: scope.regimental_no,
  });
  fine = mine.find((item) => Number(item.fine_id) === Number(fineId)) || null;

  if (!fine && scope.cadet_user_id) {
    fine = await repo.getFineByIdForCadetUserId({
      fineId,
      cadetUserId: scope.cadet_user_id,
    });
  }
  if (!fine) {
    fine = await repo.getFineByIdForRegimentalNo({
      fineId,
      regimentalNo: scope.regimental_no,
    });
  }
  if (!fine) {
    const byId = await repo.getFineById({ fineId });
    if (!byId) throw createHttpError(404, "Fine not found.");
    if (process.env.NODE_ENV !== "production") {
      console.warn(
        `[fines][pay] ownership_mismatch fine_id=${fineId} requester_user_id=${reqUser.user_id} requester_regimental=${scope.regimental_no} owner_regimental=${byId.regimental_no}`
      );
    }
    throw createHttpError(403, "You can pay only your own fine.");
  }
  if (fine.status !== "pending") throw createHttpError(409, "Only pending fines can be paid.");

  const paymentRef = String(payload.payment_ref || "").trim();
  if (!paymentRef && !file) {
    throw createHttpError(400, "Provide UPI reference ID or payment screenshot.");
  }

  let paymentProofUrl = null;
  if (file?.buffer) {
    const safeFileName = normalizeFileName(file.originalname || "proof");
    const proofPath = `${scope.regimental_no}/${fine.fine_id}/${Date.now()}_${safeFileName}`;
    await uploadFinePaymentProof({ path: proofPath, file });
    paymentProofUrl = proofPath;
  }

  return repo.db.transaction(async (trx) => {
    const amount = payload.amount ? Number(payload.amount) : Number(fine.amount);
    const payment = await repo.createFinePayment({
      trx,
      fineId: fine.fine_id,
      amount,
      paymentMethod: payload.payment_method,
      paymentRef,
      paymentProofUrl,
    });

    await repo.updateFine({
      trx,
      fineId: fine.fine_id,
      patch: { status: "payment_submitted" },
    });

    await repo.createFineEvent({
      trx,
      fineId: fine.fine_id,
      eventType: "adjusted",
      performedBy: reqUser.user_id,
      notes: paymentRef
        ? `Payment submitted (UPI ref: ${paymentRef})`
        : "Payment submitted with screenshot proof",
    });

    await repo.notifyCadet({
      trx,
      regimentalNo: fine.regimental_no,
      type: "fine_paid",
      message: `Payment submitted for fine #${fine.fine_id}. Awaiting verification.`,
    });

    return {
      fine_id: Number(fine.fine_id),
      payment_id: Number(payment.payment_id),
      payment_status: payment.payment_status,
      payment_ref: payment.payment_ref,
      payment_proof_url: await resolveProofUrl(payment.payment_proof_url || null),
      paid_at: payment.paid_at,
    };
  });
};

const verifyFinePayment = async ({ reqUser, fineId, payload }) => {
  if (!isSuo(reqUser) && !isAno(reqUser)) throw createHttpError(403, "SUO or ANO access required.");
  const scope = await ensureCollegeScope(reqUser);
  if (!scope.college_id) throw createHttpError(403, "College context missing.");

  const fine = await repo.getFineByIdForScope({ fineId, collegeId: scope.college_id });
  const resolvedFine =
    fine ||
    (await repo.getFineByPaymentIdForScope({
      paymentId: payload.payment_id,
      collegeId: scope.college_id,
    }));
  if (!resolvedFine) throw createHttpError(404, "Fine not found.");

  return repo.db.transaction(async (trx) => {
    const payment = await repo.verifyFinePayment({
      trx,
      paymentId: payload.payment_id,
      verifiedBy: reqUser.user_id,
      status: payload.status,
    });
    if (!payment || Number(payment.fine_id) !== Number(resolvedFine.fine_id)) {
      throw createHttpError(404, "Payment not found for this fine.");
    }

    let updatedFine = resolvedFine;
    if (payload.status === "verified") {
      updatedFine = await repo.updateFine({
        trx,
        fineId: resolvedFine.fine_id,
        patch: { status: "paid" },
      });
      await repo.createFineEvent({
        trx,
        fineId: resolvedFine.fine_id,
        eventType: "paid",
        performedBy: reqUser.user_id,
        notes: payload.notes || `Payment verified (payment_id: ${payload.payment_id})`,
      });
      await repo.notifyCadet({
        trx,
        regimentalNo: resolvedFine.regimental_no,
        type: "fine_paid",
        message: `Payment verified for fine #${resolvedFine.fine_id}.`,
      });
    } else {
      updatedFine = await repo.updateFine({
        trx,
        fineId: resolvedFine.fine_id,
        patch: { status: "pending" },
      });
      await repo.createFineEvent({
        trx,
        fineId: resolvedFine.fine_id,
        eventType: "adjusted",
        performedBy: reqUser.user_id,
        notes: payload.notes || `Payment rejected (payment_id: ${payload.payment_id})`,
      });
    }

    return {
      fine_id: Number(updatedFine.fine_id),
      status: updatedFine.status,
      payment: {
        payment_id: Number(payment.payment_id),
        payment_status: payment.payment_status,
        verified_at: payment.verified_at,
      },
    };
  });
};

const getFineReport = async ({ reqUser, query }) => {
  if (!isSuo(reqUser) && !isAno(reqUser)) throw createHttpError(403, "SUO or ANO access required.");
  const scope = await ensureCollegeScope(reqUser);
  if (!scope.college_id) throw createHttpError(403, "College context missing.");

  const rows = await repo.listFines({ collegeId: scope.college_id, status: query.status || null });
  const normalized = rows.map((row) => ({
    ...row,
    amount: Number(row.amount),
  }));

  const summary = normalized.reduce(
    (acc, fine) => {
      acc.total_count += 1;
      acc.total_amount += fine.amount;
      acc.by_status[fine.status] = (acc.by_status[fine.status] || 0) + 1;
      return acc;
    },
    { total_count: 0, total_amount: 0, by_status: { pending: 0, payment_submitted: 0, paid: 0, cancelled: 0 } }
  );

  return {
    generated_at: new Date().toISOString(),
    summary,
    fines: normalized,
  };
};

module.exports = {
  isSuo,
  getMyFines,
  getAllFines,
  payFine,
  verifyFinePayment,
  getFineReport,
};
