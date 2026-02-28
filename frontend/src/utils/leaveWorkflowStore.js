export const LEAVE_WORKFLOW_STORAGE_KEY = "ncc.leave.requests.v1";

const safeParse = (raw) => {
  try {
    const parsed = JSON.parse(raw || "[]");
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
};

const readAll = () => safeParse(window.localStorage.getItem(LEAVE_WORKFLOW_STORAGE_KEY));

const writeAll = (items) => {
  window.localStorage.setItem(LEAVE_WORKFLOW_STORAGE_KEY, JSON.stringify(items));
};

const sortByLatest = (items) =>
  [...items].sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime());

export const listAllLeaveRequests = () => sortByLatest(readAll());

export const listLeaveRequestsByCadet = (cadetKey) =>
  sortByLatest(readAll().filter((item) => String(item.cadet_key) === String(cadetKey)));

export const createLeaveRequest = (payload) => {
  const nowIso = new Date().toISOString();
  const next = {
    leave_id: `ui-${Date.now()}-${Math.floor(Math.random() * 100000)}`,
    cadet_key: String(payload.cadet_key || "").trim(),
    regimental_no: String(payload.regimental_no || "").trim(),
    cadet_name: String(payload.cadet_name || "Cadet").trim(),
    reason: String(payload.reason || "").trim(),
    attachment_url: payload.attachment_url || null,
    attachment_name: payload.attachment_name || null,
    status: "pending",
    created_at: nowIso,
    reviewed_at: null,
    reviewed_by_name: null,
  };

  const items = readAll();
  items.push(next);
  writeAll(items);
  return next;
};

export const updateLeaveRequestStatus = ({ leaveId, status, reviewerName }) => {
  const nextStatus = status === "approved" ? "approved" : "rejected";
  const items = readAll();
  const updated = items.map((item) =>
    String(item.leave_id) !== String(leaveId)
      ? item
      : {
          ...item,
          status: nextStatus,
          reviewed_at: new Date().toISOString(),
          reviewed_by_name: reviewerName || "SUO",
        }
  );
  writeAll(updated);
  return sortByLatest(updated).find((item) => String(item.leave_id) === String(leaveId)) || null;
};
