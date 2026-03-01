import React, { useEffect, useMemo, useState } from "react";
import { Download, Plus, Trash2, ClipboardList, Check, X, ChevronDown, ChevronUp } from "lucide-react";
import "./suoAttendance.css";
import { attendanceApi } from "../../api/attendanceApi";
import { leaveApi } from "../../api/leaveApi";

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

  const nextDrillDate = useMemo(() => {
    const today = new Date();
    const yyyy = today.getFullYear();
    const mm = String(today.getMonth() + 1).padStart(2, "0");
    const dd = String(today.getDate()).padStart(2, "0");
    return `${yyyy}-${mm}-${dd} 09:00`;
  }, []);

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

  const toggleAttendance = async (cadetRegimentalNo, drillId, currentStatus) => {
    const nextStatus = currentStatus === "P" ? "A" : "P";
    const prev = sessionDetail;
    const optimistic = {
      ...sessionDetail,
      cadets: sessionDetail.cadets.map((cadet) =>
        cadet.regimental_no !== cadetRegimentalNo
          ? cadet
          : {
              ...cadet,
              attendance: sessionDetail.drills.map((drill, idx) =>
                Number(drill.drill_id) === Number(drillId) ? nextStatus : cadet.attendance[idx]
              ),
            }
      ),
    };

    setSessionDetail(optimistic);
    try {
      await attendanceApi.patchRecords({
        updates: [{ drill_id: drillId, regimental_no: cadetRegimentalNo, status: nextStatus }],
      });
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
    } catch (err) {
      window.alert(err?.response?.data?.message || "Unable to update leave status.");
    }
  };

  const drills = sessionDetail?.drills || [];
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
          </>
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
                    {drills.map((drill, drillIdx) => (
                      <th key={drill.drill_id} className="col-drill">
                        <div className="drill-head">
                          <span>{drill.drill_name || `Drill ${drillIdx + 1}`}</span>
                          <button
                            className="drill-delete"
                            onClick={() => removeDrill(drill.drill_id)}
                            title="Remove Drill"
                            aria-label={`Remove ${drill.drill_name || `Drill ${drillIdx + 1}`}`}
                          >
                            <Trash2 size={14} />
                          </button>
                        </div>
                        <div className="drill-date">{`${drill.drill_date} ${String(drill.drill_time).slice(0, 5)}`}</div>
                      </th>
                    ))}
                    <th>Total Drills</th>
                    <th>Total Attendance</th>
                    <th>Percentage</th>
                  </tr>
                </thead>
                <tbody>
                  {cadets.map((cadet) => {
                    const { attended, total, percent } = calculateAttendance(cadet.attendance || [], drills.length);
                    return (
                      <tr key={cadet.regimental_no}>
                        <td className="cadet-name-cell">{cadet.name}</td>
                        {drills.map((drill, drillIdx) => {
                          const status = cadet.attendance?.[drillIdx] ?? null;
                          return (
                            <td key={`${cadet.regimental_no}-${drill.drill_id}`}>
                              {status ? (
                                <button
                                  className={`attendance-pill ${status === "P" ? "present" : "absent"}`}
                                  onClick={() => toggleAttendance(cadet.regimental_no, drill.drill_id, status)}
                                >
                                  {status}
                                </button>
                              ) : (
                                <span className="attendance-pill">--</span>
                              )}
                            </td>
                          );
                        })}
                        <td className="total-cell">{total}</td>
                        <td className="total-cell">{attended}</td>
                        <td className="total-cell">{percent}%</td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            ) : null}
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
