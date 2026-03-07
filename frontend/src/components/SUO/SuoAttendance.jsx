import React, { useEffect, useMemo, useState } from "react";
import { Download, Plus, Trash2, ClipboardList, Check, X, ChevronDown, ChevronUp, CalendarDays, Clock3 } from "lucide-react";
import "./suoAttendance.css";
import { attendanceApi } from "../../api/attendanceApi";
import { leaveApi } from "../../api/leaveApi";
import { fineApi } from "../../api/fineApi";

const calculateAttendance = (attendance, totalDrills) => {
  const attended = attendance.filter((v) => v === "P").length;
  const percent = totalDrills ? ((attended / totalDrills) * 100).toFixed(1) : "0.0";
  return { attended, total: totalDrills, percent };
};

const parseDateTimeInput = (value) => {
  const normalized = String(value || "").trim();
  if (!normalized) return null;
  const [date, time] = normalized.split(/\s+/);
  if (!date || !time) return null;
  if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) return null;
  if (!/^\d{2}:\d{2}$/.test(time) && !/^\d{2}:\d{2}:\d{2}$/.test(time)) return null;
  return { drill_date: date, drill_time: time.length === 5 ? `${time}:00` : time };
};

const toDisplayDateTime = (value) => {
  if (!value) return "Not available";
  const dt = new Date(value);
  if (Number.isNaN(dt.getTime())) return String(value);
  return new Intl.DateTimeFormat("en-IN", {
    day: "2-digit",
    month: "short",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  }).format(dt);
};

const toDisplayDate = (value) => {
  const raw = String(value || "").trim();
  if (!raw) return "--";

  const parsed = new Date(raw);
  if (!Number.isNaN(parsed.getTime())) {
    return new Intl.DateTimeFormat("en-GB", {
      day: "2-digit",
      month: "2-digit",
      year: "numeric",
    }).format(parsed);
  }

  const dateOnly = raw.includes("T") ? raw.split("T")[0] : raw;
  if (/^\d{4}-\d{2}-\d{2}$/.test(dateOnly)) {
    const [yyyy, mm, dd] = dateOnly.split("-");
    return `${dd}-${mm}-${yyyy}`;
  }

  return dateOnly;
};

const toDisplayTime = (timeValue, fallbackDateValue) => {
  const fallbackRaw = String(fallbackDateValue || "");
  const raw = String(timeValue || "").trim() || (fallbackRaw.includes("T") ? fallbackRaw.split("T")[1] || "" : "");
  if (!raw) return "--";

  const matched = raw.match(/(\d{2}):(\d{2})/);
  if (!matched) return raw.slice(0, 5);

  const hh = Number(matched[1]);
  const mm = matched[2];
  const suffix = hh >= 12 ? "PM" : "AM";
  const hour = hh % 12 || 12;
  return `${String(hour).padStart(2, "0")}:${mm} ${suffix}`;
};

const getDrillSortValue = (drill = {}) => {
  const createdAt = new Date(drill.created_at || "").getTime();
  if (!Number.isNaN(createdAt) && createdAt > 0) return createdAt;

  const drillId = Number(drill.drill_id);
  if (!Number.isNaN(drillId) && drillId > 0) return drillId;

  const datePart = String(drill.drill_date || "").trim();
  const timePart = String(drill.drill_time || "00:00:00").trim();
  const normalizedTime = /^\d{2}:\d{2}$/.test(timePart) ? `${timePart}:00` : timePart;
  const scheduledAt = new Date(`${datePart}T${normalizedTime}`).getTime();
  return Number.isNaN(scheduledAt) ? 0 : scheduledAt;
};

const getLeaveStatusForCadetDrill = (leaveRequests, cadetRegimentalNo, drillId) => {
  const normalizedCadetRegNo = String(cadetRegimentalNo || "");
  const normalizedDrillId = String(drillId || "");
  const found = leaveRequests.find((leave) => {
    const leaveCadetRegNo = String(leave?.regimental_no || leave?.cadet_key || "");
    const leaveDrillId = String(leave?.drill_id || "");
    if (!leaveCadetRegNo || !leaveDrillId) return false;
    return leaveCadetRegNo === normalizedCadetRegNo && leaveDrillId === normalizedDrillId;
  });
  return String(found?.status || "").toLowerCase();
};

const SuoAttendance = () => {
  const [activeView, setActiveView] = useState("attendance");
  const [sessionOptions, setSessionOptions] = useState([]);
  const [selectedSessionId, setSelectedSessionId] = useState("");
  const [sessionDetail, setSessionDetail] = useState(null);
  const [leaveRequests, setLeaveRequests] = useState([]);
  const [isAttendanceExpanded, setIsAttendanceExpanded] = useState(true);
  const [loading, setLoading] = useState(true);
  const [actionLoading, setActionLoading] = useState(false);
  const [error, setError] = useState("");
  const [fines, setFines] = useState([]);
  const [verifyingPaymentId, setVerifyingPaymentId] = useState(null);

  const nextDrillDate = useMemo(() => {
    const today = new Date();
    const yyyy = today.getFullYear();
    const mm = String(today.getMonth() + 1).padStart(2, "0");
    const dd = String(today.getDate()).padStart(2, "0");
    return `${yyyy}-${mm}-${dd} 09:00`;
  }, []);
  const pendingFineMap = useMemo(() => {
    const map = new Map();
    fines
      .filter((fine) => fine.status === "pending")
      .forEach((fine) => {
        map.set(`${fine.regimental_no}:${fine.drill_id}`, Number(fine.amount || 0));
      });
    return map;
  }, [fines]);

  const loadLeaveRequests = async () => {
    try {
      const res = await leaveApi.getAll();
      setLeaveRequests(Array.isArray(res?.data?.data) ? res.data.data : []);
    } catch (err) {
      setLeaveRequests([]);
      const serverMessage = err?.response?.data?.message;
      if (serverMessage) setError(serverMessage);
    }
  };

  const loadSessions = async (preferredSessionId = null) => {
    setLoading(true);
    setError("");
    try {
      const res = await attendanceApi.getSessions();
      const sessions = res.data?.data || [];
      setSessionOptions(sessions);

      if (!sessions.length) {
        setSelectedSessionId("");
        setSessionDetail({ session_id: null, session_name: "", drills: [], cadets: [] });
        return;
      }

      const desired =
        preferredSessionId && sessions.some((s) => String(s.session_id) === String(preferredSessionId))
          ? String(preferredSessionId)
          : String(sessions[0].session_id);
      setSelectedSessionId(desired);
    } catch (err) {
      setError(err?.response?.data?.message || "Failed to load attendance sessions.");
    } finally {
      setLoading(false);
    }
  };

  const loadFines = async () => {
    try {
      const res = await fineApi.getAll();
      setFines(Array.isArray(res?.data?.data) ? res.data.data : []);
    } catch (err) {
      setFines([]);
      const serverMessage = err?.response?.data?.message;
      if (serverMessage) setError(serverMessage);
    }
  };

  const loadSessionDetail = async (sessionId) => {
    if (!sessionId) return;
    setLoading(true);
    setError("");
    try {
      const res = await attendanceApi.getSession(sessionId);
      setSessionDetail(res.data?.data || null);
    } catch (err) {
      setError(err?.response?.data?.message || "Failed to load session details.");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadSessions();
    loadLeaveRequests();
    loadFines();
  }, []);

  useEffect(() => {
    if (selectedSessionId) loadSessionDetail(selectedSessionId);
  }, [selectedSessionId]);

  const createSession = async () => {
    const nameInput = window.prompt("Enter session name (example: RDC Camp 2026):");
    if (!nameInput) return;
    const sessionName = nameInput.trim();
    if (!sessionName) return;

    setActionLoading(true);
    setError("");
    try {
      const res = await attendanceApi.createSession({ session_name: sessionName });
      const created = res.data?.data;
      await loadSessions(created?.session_id);
    } catch (err) {
      window.alert(err?.response?.data?.message || "Unable to create session.");
    } finally {
      setActionLoading(false);
    }
  };

  const removeSession = async () => {
    if (!selectedSessionId) return;
    if (!window.confirm("Delete this session?")) return;

    setActionLoading(true);
    setError("");
    try {
      await attendanceApi.deleteSession(selectedSessionId);
      await loadSessions();
      await loadFines();
    } catch (err) {
      window.alert(err?.response?.data?.message || "Unable to delete session.");
    } finally {
      setActionLoading(false);
    }
  };

  const addDrill = async () => {
    if (!sessionDetail?.session_id) return;
    const dateInput = window.prompt("Enter drill date-time (YYYY-MM-DD HH:mm)", nextDrillDate);
    if (!dateInput) return;
    const parsed = parseDateTimeInput(dateInput);
    if (!parsed) {
      window.alert("Invalid date-time format. Use YYYY-MM-DD HH:mm");
      return;
    }

    const nextNumber = (sessionDetail.drills?.length || 0) + 1;
    setActionLoading(true);
    setError("");
    try {
      await attendanceApi.createDrill({
        session_id: sessionDetail.session_id,
        drill_name: `Drill ${nextNumber}`,
        drill_date: parsed.drill_date,
        drill_time: parsed.drill_time,
      });
      await loadSessionDetail(selectedSessionId);
    } catch (err) {
      window.alert(err?.response?.data?.message || "Unable to add drill.");
    } finally {
      setActionLoading(false);
    }
  };

  const removeDrill = async (drillId) => {
    if (!drillId) return;
    setActionLoading(true);
    setError("");
    try {
      await attendanceApi.deleteDrill(drillId);
      await loadSessionDetail(selectedSessionId);
    } catch (err) {
      window.alert(err?.response?.data?.message || "Unable to remove drill.");
    } finally {
      setActionLoading(false);
    }
  };

  const updateAttendanceStatus = async (cadetRegimentalNo, drillId, nextUiStatus) => {
    const backendStatus = nextUiStatus === "P" ? "P" : "A";
    const prev = sessionDetail;

    const optimistic = {
      ...sessionDetail,
      cadets: sessionDetail.cadets.map((cadet) =>
        cadet.regimental_no !== cadetRegimentalNo
          ? cadet
          : {
              ...cadet,
              attendance: sessionDetail.drills.map((drill, idx) =>
                Number(drill.drill_id) === Number(drillId) ? backendStatus : cadet.attendance[idx]
              ),
            }
      ),
    };

    setSessionDetail(optimistic);

    try {
      await attendanceApi.patchRecords({
        updates: [{ drill_id: drillId, regimental_no: cadetRegimentalNo, status: backendStatus }],
      });
      await loadFines();
    } catch (err) {
      setSessionDetail(prev);
      window.alert(err?.response?.data?.message || "Unable to update attendance.");
    }
  };

  const downloadCSV = async () => {
    if (!selectedSessionId) return;
    try {
      const response = await attendanceApi.exportSession(selectedSessionId);
      const blob = new Blob([response.data], { type: "text/csv;charset=utf-8;" });
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `attendance_${selectedSessionId}.csv`;
      a.click();
      URL.revokeObjectURL(url);
    } catch (err) {
      window.alert(err?.response?.data?.message || "Unable to export attendance.");
    }
  };

  const reviewLeave = async (leaveId, status) => {
    try {
      await leaveApi.reviewStatus(leaveId, { status });
      await loadLeaveRequests();
      await loadFines();
    } catch (err) {
      window.alert(err?.response?.data?.message || "Unable to update leave status.");
    }
  };

  const verifySubmittedPayment = async (fineId, paymentId, status) => {
    setVerifyingPaymentId(paymentId);
    try {
      await fineApi.verify(fineId, { payment_id: paymentId, status });
      await loadFines();
      window.alert(`Payment ${status}.`);
    } catch (err) {
      window.alert(err?.response?.data?.message || "Unable to verify payment.");
    } finally {
      setVerifyingPaymentId(null);
    }
  };

  const downloadFineReport = async () => {
    try {
      const response = await fineApi.report({ format: "csv" });
      const blob = new Blob([response.data], { type: "text/csv;charset=utf-8;" });
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = "fine_report.csv";
      a.click();
      URL.revokeObjectURL(url);
    } catch (err) {
      window.alert(err?.response?.data?.message || "Unable to download fine report.");
    }
  };

  // Keep newest drills first using created_at/drill_id/date-time; preserve original index for attendance mapping
  const rawDrills = sessionDetail?.drills || [];
  const sortedDrillEntries = rawDrills
    .map((drill, originalIndex) => ({
      drill,
      originalIndex,
      sortValue: getDrillSortValue(drill),
    }))
    .sort((a, b) => {
      const delta = Number(b.sortValue || 0) - Number(a.sortValue || 0);
      if (delta !== 0) return delta;
      return b.originalIndex - a.originalIndex;
    });
  const drills = sortedDrillEntries.map((entry) => entry.drill);
  const cadets = sessionDetail?.cadets || [];

  if (loading && !sessionDetail) {
    return (
      <div className="suo-attendance-container">
        <h2 className="attendance-title">Attendance Monitoring</h2>
        <p>Loading...</p>
      </div>
    );
  }

  return (
    <div className="suo-attendance-container">
      <h2 className="attendance-title">{activeView === "attendance" ? "Attendance Monitoring" : "View Leave"}</h2>
      {error ? <p style={{ color: "crimson" }}>{error}</p> : null}

      <div className="attendance-toolbar">
        <div className="attendance-toolbar-row">
          <button
            className={`attendance-btn ${activeView === "attendance" ? "attendance-btn-primary" : "attendance-btn-secondary"}`}
            onClick={() => setActiveView("attendance")}
            type="button"
          >
            <ClipboardList size={18} />
            <span>Attendance</span>
          </button>
          <button
            className={`attendance-btn ${activeView === "leave" ? "attendance-btn-primary" : "attendance-btn-secondary"}`}
            onClick={() => {
              setActiveView("leave");
              loadLeaveRequests();
            }}
            type="button"
          >
            <ClipboardList size={18} />
            <span>View Leave</span>
          </button>

          {activeView === "attendance" && (
            <>
              <label className="attendance-label">Session:</label>
              <select
                className="attendance-session-select"
                value={selectedSessionId}
                onChange={(e) => setSelectedSessionId(e.target.value)}
                disabled={actionLoading || loading}
              >
                {sessionOptions.map((sessionName) => (
                  <option key={sessionName.session_id} value={sessionName.session_id}>
                    {sessionName.session_name}
                  </option>
                ))}
              </select>
            </>
          )}
        </div>

        {activeView === "attendance" && (
          <div className="attendance-toolbar-row">
            <button className="attendance-btn attendance-btn-secondary" onClick={createSession} disabled={actionLoading}>
              <Plus size={18} />
              <span>Add Session</span>
            </button>

            <button className="attendance-btn attendance-btn-danger" onClick={removeSession} disabled={actionLoading}>
              <Trash2 size={18} />
              <span>Delete Session</span>
            </button>

            <button className="attendance-btn attendance-btn-secondary" onClick={addDrill} disabled={actionLoading}>
              <Plus size={18} />
              <span>Add Drill</span>
            </button>

            <button className="attendance-btn attendance-btn-primary" onClick={downloadCSV} disabled={actionLoading}>
              <Download size={18} />
              <span>Download Attendance</span>
            </button>
          </div>
        )}
      </div>

      {activeView === "attendance" ? (
        <div className="attendance-section">
          <button
            type="button"
            className="attendance-collapse-btn"
            onClick={() => setIsAttendanceExpanded((prev) => !prev)}
            aria-expanded={isAttendanceExpanded}
            aria-label={isAttendanceExpanded ? "Collapse attendance list" : "Expand attendance list"}
          >
            <span>Attendance List</span>
            {isAttendanceExpanded ? <ChevronUp size={18} /> : <ChevronDown size={18} />}
          </button>

          <div className={`attendance-table-card ${isAttendanceExpanded ? "" : "is-collapsed"}`}>
            {isAttendanceExpanded ? (
              <table className="attendance-table">
                <thead>
                  <tr>
                    <th className="col-cadet">Cadet Name</th>
                    {drills.map((drill, i) => (
                      <th key={drill.drill_id} className="col-drill">
                        <div className="drill-card">
                          <div className="drill-head">
                            <span className="drill-title">{drill.drill_name || `Drill ${sortedDrillEntries[i].originalIndex + 1}`}</span>
                            <button
                              className="drill-delete"
                              onClick={() => removeDrill(drill.drill_id)}
                              title="Remove Drill"
                              aria-label={`Remove ${drill.drill_name || `Drill ${sortedDrillEntries[i].originalIndex + 1}`}`}
                            >
                              <Trash2 size={14} />
                            </button>
                          </div>
                          <div className="drill-meta-line">
                            <CalendarDays size={12} />
                            <span className="drill-meta-item">{toDisplayDate(drill.drill_date)}</span>
                          </div>
                          <div className="drill-meta-line">
                            <Clock3 size={12} />
                            <span className="drill-meta-item">{toDisplayTime(drill.drill_time, drill.drill_date)}</span>
                          </div>
                        </div>
                      </th>
                    ))}
                    <th>Total Drills</th>
                    <th>Total Attendance</th>
                    <th>Percentage</th>
                    <th>Total Fine</th>
                  </tr>
                </thead>
                <tbody>
                  {cadets.map((cadet) => {
                    const { attended, total, percent } = calculateAttendance(cadet.attendance || [], drills.length);
                    const totalFine = drills.reduce((sum, drill) => {
                      const key = `${cadet.regimental_no}:${drill.drill_id}`;
                      return sum + Number(pendingFineMap.get(key) || 0);
                    }, 0);
                    return (
                      <tr key={cadet.regimental_no}>
                        <td className="cadet-name-cell">{cadet.name}</td>
                        {drills.map((drill, i) => {
                          const rawStatus = cadet.attendance?.[sortedDrillEntries[i].originalIndex] ?? null;
                          const leaveStatus = getLeaveStatusForCadetDrill(
                            leaveRequests,
                            cadet.regimental_no,
                            drill.drill_id
                          );
                          const uiStatus =
                            rawStatus === "P"
                              ? "P"
                              : rawStatus === "A"
                              ? "A"
                              : null;
                          const leaveHint =
                            leaveStatus === "approved"
                              ? "Leave approved"
                              : leaveStatus === "rejected"
                              ? "Leave rejected - fine may apply"
                              : "No approved leave - fine may apply";
                          return (
                            <td key={`${cadet.regimental_no}-${drill.drill_id}`}>
                              {uiStatus ? (
                                <select
                                  className={`attendance-status-select ${uiStatus === "P" ? "present" : "absent"}`}
                                  value={uiStatus}
                                  onChange={(e) =>
                                    updateAttendanceStatus(cadet.regimental_no, drill.drill_id, e.target.value)
                                  }
                                  title={leaveHint}
                                >
                                  <option value="P">P</option>
                                  <option value="A">A</option>
                                </select>
                              ) : (
                                <span className="attendance-pill">--</span>
                              )}
                            </td>
                          );
                        })}
                        <td className="total-cell">{total}</td>
                        <td className="total-cell">{attended}</td>
                        <td className="total-cell">{percent}%</td>
                        <td className="total-cell fine-cell">Rs. {totalFine.toFixed(2)}</td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            ) : null}
          </div>

          <div className="attendance-table-card leave-table-card" style={{ marginTop: 16 }}>
            <div className="leave-head" style={{ marginBottom: 10 }}>
              <span className="leave-cadet">Fine Management</span>
              <button className="attendance-btn attendance-btn-secondary" onClick={downloadFineReport} type="button">
                <Download size={16} />
                <span>Download Fine Report</span>
              </button>
            </div>
            <div className="leave-meta" style={{ marginBottom: 8 }}>
              <span>Pending: {(fines || []).filter((f) => f.status === "pending").length}</span>
              <span>Payment Submitted: {(fines || []).filter((f) => f.status === "payment_submitted").length}</span>
              <span>Approved: {(fines || []).filter((f) => f.status === "paid").length}</span>
            </div>
            {(fines || []).length === 0 ? (
              <p className="leave-empty-text">No fines found.</p>
            ) : (
              <div className="leave-list">
                {(fines || []).map((fine) => {
                const submittedPayment = (fine.payments || []).find((p) => p.payment_status === "submitted");
                return (
                  <div className="leave-row" key={fine.fine_id}>
                    <div className="leave-main">
                      <div className="leave-head">
                        <span className="leave-cadet">{fine.cadet_name}</span>
                        <span className="leave-regimental">({fine.regimental_no})</span>
                        <span className={`leave-status-badge status-${fine.status}`}>
                          {fine.workflow_status_label || fine.status}
                        </span>
                      </div>
                      <p className="leave-reason">
                        {fine.session_name} / {fine.drill_name} ({toDisplayDate(fine.drill_date)}) - Rs.{" "}
                        {Number(fine.amount || 0).toFixed(2)}
                      </p>
                      <div className="leave-meta">
                        <span>Created: {toDisplayDateTime(fine.created_at)}</span>
                        <span>
                          Payment Ref: {submittedPayment?.payment_ref || fine.latest_payment?.payment_ref || "N/A"}
                        </span>
                        {submittedPayment?.payment_proof_url || fine.latest_payment?.payment_proof_url ? (
                          <a
                            href={submittedPayment?.payment_proof_url || fine.latest_payment?.payment_proof_url}
                            target="_blank"
                            rel="noreferrer"
                          >
                            View Proof
                          </a>
                        ) : null}
                      </div>
                    </div>
                    {fine.status === "payment_submitted" && submittedPayment ? (
                      <div className="leave-actions">
                        <button
                          type="button"
                          className="leave-action-btn leave-approve"
                          disabled={verifyingPaymentId === submittedPayment.payment_id}
                          onClick={() =>
                            verifySubmittedPayment(fine.fine_id, submittedPayment.payment_id, "verified")
                          }
                        >
                          <Check size={16} />
                          <span>Approve</span>
                        </button>
                        <button
                          type="button"
                          className="leave-action-btn leave-reject"
                          disabled={verifyingPaymentId === submittedPayment.payment_id}
                          onClick={() =>
                            verifySubmittedPayment(fine.fine_id, submittedPayment.payment_id, "rejected")
                          }
                        >
                          <X size={16} />
                          <span>Reject</span>
                        </button>
                      </div>
                    ) : null}
                  </div>
                );
              })}
              </div>
            )}
          </div>
        </div>
      ) : (
        <div className="attendance-table-card leave-table-card">
          {leaveRequests.length === 0 ? (
            <p className="leave-empty-text">No leave applications yet.</p>
          ) : (
            <div className="leave-list">
              {leaveRequests.map((leave) => (
                <div className="leave-row" key={leave.leave_id}>
                  <div className="leave-main">
                    <div className="leave-head">
                      <span className="leave-cadet">{leave.cadet_name}</span>
                      <span className="leave-regimental">
                        ({leave.regimental_no || leave.cadet_key || "No ID"})
                      </span>
                      <span className={`leave-status-badge status-${leave.status}`}>{leave.status}</span>
                    </div>
                    <p className="leave-reason">{leave.reason}</p>
                    <div className="leave-meta">
                      <span>Applied: {toDisplayDateTime(leave.created_at)}</span>
                      {leave.attachment_url ? (
                        <a href={leave.attachment_url} target="_blank" rel="noreferrer">
                          {leave.attachment_name || "View Document"}
                        </a>
                      ) : (
                        <span>No document attached</span>
                      )}
                    </div>
                  </div>
                  <div className="leave-actions">
                    <button
                      type="button"
                      className="leave-action-btn leave-approve"
                      disabled={leave.status !== "pending"}
                      onClick={() => reviewLeave(leave.leave_id, "approved")}
                    >
                      <Check size={16} />
                      <span>Approve</span>
                    </button>
                    <button
                      type="button"
                      className="leave-action-btn leave-reject"
                      disabled={leave.status !== "pending"}
                      onClick={() => reviewLeave(leave.leave_id, "rejected")}
                    >
                      <X size={16} />
                      <span>Reject</span>
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
};

export default SuoAttendance;
