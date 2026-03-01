import React, { useEffect, useMemo, useRef, useState } from "react";
import {
  CalendarDays,
  Clock,
  FileText,
  Upload,
  X,
  ChevronDown,
  ChevronUp,
  CheckCircle2,
  XCircle,
  AlertCircle,
  Paperclip,
  Plus,
} from "lucide-react";
import "./cadetAttendene.css";
import { attendanceApi } from "../../api/attendanceApi";
import { leaveApi } from "../../api/leaveApi";

function getStatusIcon(status) {
  switch (status) {
    case "approved":
      return <CheckCircle2 size={16} />;
    case "rejected":
      return <XCircle size={16} />;
    default:
      return <AlertCircle size={16} />;
  }
}

const toDisplayDate = (isoDate) => {
  if (!isoDate) return "";
  const maybeDate = new Date(isoDate);
  if (!Number.isNaN(maybeDate.getTime())) {
    return new Intl.DateTimeFormat("en-GB", {
      day: "2-digit",
      month: "2-digit",
      year: "numeric",
    }).format(maybeDate);
  }
  const parts = String(isoDate).split("-");
  if (parts.length !== 3) return String(isoDate);
  return `${parts[2]}-${parts[1]}-${parts[0]}`;
};

const toDisplayTime = (timeValue) => {
  const raw = String(timeValue || "").slice(0, 5);
  if (!/^\d{2}:\d{2}$/.test(raw)) return String(timeValue || "");
  const [hh, mm] = raw.split(":").map(Number);
  const suffix = hh >= 12 ? "PM" : "AM";
  const hour = hh % 12 || 12;
  return `${String(hour).padStart(2, "0")}:${String(mm).padStart(2, "0")} ${suffix}`;
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

export default function CadetAttendance() {
  const [expandedSessions, setExpandedSessions] = useState({ 0: true });
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [stats, setStats] = useState({ total: 0, present: 0, absent: 0, percent: 0 });
  const [sessions, setSessions] = useState([]);
  const [leaveApplications, setLeaveApplications] = useState([]);

  const [isLeaveModalOpen, setIsLeaveModalOpen] = useState(false);
  const [leaveReason, setLeaveReason] = useState("");
  const [leaveTimestamp, setLeaveTimestamp] = useState(new Date());
  const [selectedFile, setSelectedFile] = useState(null);
  const [submitting, setSubmitting] = useState(false);
  const fileRef = useRef(null);

  const userInfo = useMemo(() => {
    try {
      return JSON.parse(localStorage.getItem("user") || "{}");
    } catch {
      return {};
    }
  }, []);

  const regimentalNo =
    userInfo.regimental_no ||
    localStorage.getItem("regimental_no") ||
    localStorage.getItem("regimentalNo") ||
    "";
  const cadetName =
    userInfo.name ||
    userInfo.full_name ||
    userInfo.fullName ||
    userInfo.user_name ||
    userInfo.username ||
    "Cadet";
  const cadetKey =
    regimentalNo ||
    String(userInfo.user_id || userInfo.id || userInfo.email || cadetName || "cadet").toLowerCase();

  const loadAttendance = async () => {
    setLoading(true);
    setError("");
    if (!regimentalNo) {
      setStats({ total: 0, present: 0, absent: 0, percent: 0 });
      setSessions([]);
      setLeaveApplications([]);
      setError("Attendance data unavailable: regimental number missing.");
      setLoading(false);
      return;
    }

    try {
      const res = await attendanceApi.getMyAttendance(regimentalNo);
      const data = res.data?.data || {};
      setStats(data.stats || { total: 0, present: 0, absent: 0, percent: 0 });
      setSessions(data.sessions || []);
    } catch (err) {
      setError(err?.response?.data?.message || "Failed to load attendance data.");
    } finally {
      setLoading(false);
    }
  };

  const loadMyLeaves = async () => {
    try {
      const res = await leaveApi.getMy();
      const rows = Array.isArray(res?.data?.data) ? res.data.data : [];
      setLeaveApplications(rows);
    } catch (err) {
      setLeaveApplications([]);
      const serverMessage = err?.response?.data?.message;
      if (serverMessage) setError(serverMessage);
    }
  };

  useEffect(() => {
    loadAttendance();
    loadMyLeaves();
  }, [regimentalNo, cadetKey]);

  useEffect(() => {
    if (!isLeaveModalOpen) return undefined;
    setLeaveTimestamp(new Date());
    const timer = setInterval(() => setLeaveTimestamp(new Date()), 1000);
    return () => clearInterval(timer);
  }, [isLeaveModalOpen]);

  const toggleSession = (idx) => {
    setExpandedSessions((prev) => ({ ...prev, [idx]: !prev[idx] }));
  };

  const openLeaveModal = () => {
    setLeaveReason("");
    setSelectedFile(null);
    if (fileRef.current) fileRef.current.value = "";
    setLeaveTimestamp(new Date());
    setIsLeaveModalOpen(true);
  };

  const closeLeaveModal = () => {
    setIsLeaveModalOpen(false);
    setLeaveReason("");
    setSelectedFile(null);
    if (fileRef.current) fileRef.current.value = "";
  };

  const handleSubmitLeave = async (e) => {
    e.preventDefault();
    if (!leaveReason.trim()) {
      window.alert("Please enter reason for leave.");
      return;
    }
    if (!cadetKey) {
      window.alert("Cadet identity is missing. Please login again.");
      return;
    }

    setSubmitting(true);
    try {
      const formData = new FormData();
      formData.append("reason", leaveReason.trim());
      if (selectedFile) formData.append("document", selectedFile);

      await leaveApi.apply(formData);
      await loadMyLeaves();
      closeLeaveModal();
    } catch (err) {
      window.alert(err?.response?.data?.message || err?.message || "Failed to submit leave.");
    } finally {
      setSubmitting(false);
    }
  };

  const attendancePercent =
    stats && stats.percent !== null && stats.percent !== undefined && stats.percent !== ""
      ? Number(stats.percent).toFixed(1)
      : "0.0";

  return (
    <div className="ca-root">
      <div className="ca-header">
        <div className="ca-header-text">
          <h1 className="ca-title">Attendance</h1>
          <p className="ca-subtitle">Track your drill attendance and manage leave applications</p>
        </div>
      </div>

      {loading ? <p>Loading...</p> : null}
      {error ? <p style={{ color: "crimson" }}>{error}</p> : null}

      <div className="ca-stats-grid ca-stats-grid--modern">
        <div className="ca-stat-card ca-stat-card--metric ca-stat-total">
          <span className="ca-stat-number">{stats.total}</span>
          <span className="ca-stat-label">Total Drills</span>
        </div>
        <div className="ca-stat-card ca-stat-card--metric ca-stat-present">
          <span className="ca-stat-number">{stats.present}</span>
          <span className="ca-stat-label">Present</span>
        </div>
        <div className="ca-stat-card ca-stat-card--metric ca-stat-absent">
          <span className="ca-stat-number">{stats.absent}</span>
          <span className="ca-stat-label">Absent</span>
        </div>
        <div className="ca-stat-card ca-stat-card--metric ca-stat-percent">
          <span className="ca-stat-number">{attendancePercent}%</span>
          <span className="ca-stat-label">Attendance</span>
        </div>
      </div>

      <div className="ca-section-card ca-section-card--attendance">
        <h2 className="ca-section-heading">Session-wise Attendance</h2>
        <div className="ca-sessions-list">
          {sessions.map((session, sIdx) => {
            const isExpanded = expandedSessions[sIdx];
            const sessionStats = {
              total: session.drills.filter((d) => d.status !== null).length,
              present: session.drills.filter((d) => d.status === "P").length,
            };
            const sessionPercent = sessionStats.total
              ? ((sessionStats.present / sessionStats.total) * 100).toFixed(0)
              : "--";

            return (
              <div key={session.session_id} className="ca-session-block">
                <button className="ca-session-header" onClick={() => toggleSession(sIdx)}>
                  <div className="ca-session-header-left">
                    <span className="ca-session-name">{session.session_name}</span>
                    <span className="ca-session-badge">
                      {sessionStats.present}/{sessionStats.total} present ({sessionPercent}%)
                    </span>
                  </div>
                  {isExpanded ? <ChevronUp size={20} /> : <ChevronDown size={20} />}
                </button>

                {isExpanded && (
                  <div className="ca-session-table-wrap">
                    <table className="ca-att-table">
                      <thead>
                        <tr className="ca-drill-header-row">
                          {session.drills.map((drill) => (
                            <th key={drill.drill_id} className="ca-drill-th">
                              <div className="ca-drill-name">{drill.name}</div>
                              <div className="ca-drill-meta">
                                <CalendarDays size={12} />
                                <span>{toDisplayDate(drill.date)}</span>
                              </div>
                              <div className="ca-drill-meta">
                                <Clock size={12} />
                                <span>{toDisplayTime(drill.time)}</span>
                              </div>
                            </th>
                          ))}
                        </tr>
                      </thead>
                      <tbody>
                        <tr>
                          {session.drills.map((drill) => (
                            <td key={drill.drill_id} className="ca-att-cell">
                              {drill.status === null ? (
                                <span className="ca-att-upcoming">--</span>
                              ) : drill.status === "P" ? (
                                <span className="ca-att-present">Present</span>
                              ) : (
                                <span className="ca-att-absent">Absent</span>
                              )}
                            </td>
                          ))}
                        </tr>
                      </tbody>
                    </table>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      </div>

      <div className="ca-section-card ca-section-card--leave-status">
        <div className="ca-leave-heading-row">
          <h2 className="ca-section-heading">Leave Application Status</h2>
          <button className="ca-apply-leave-btn" onClick={openLeaveModal} type="button">
            <Plus size={18} />
            <span>Apply Leave</span>
          </button>
        </div>

        {leaveApplications.length === 0 ? (
          <p className="ca-empty-msg">No leave applications submitted yet.</p>
        ) : (
          <div className="ca-leave-list">
            {leaveApplications.map((app) => (
              <div key={app.leave_id} className={`ca-leave-card ca-leave-${app.status}`}>
                <div className="ca-leave-card-top">
                  <div className="ca-leave-info">
                    <span className="ca-leave-drill">{app.drill_name || "Leave Request"}</span>
                    <span className="ca-leave-sep">|</span>
                    <span className="ca-leave-session-name">{app.session_name || "General Leave"}</span>
                  </div>
                  <button type="button" className={`ca-status-btn ca-status-${app.status}`} disabled>
                    {getStatusIcon(app.status)}
                    <span>{app.status.charAt(0).toUpperCase() + app.status.slice(1)}</span>
                  </button>
                </div>

                <div className="ca-leave-card-body">
                  <div className="ca-leave-detail-row">
                    <CalendarDays size={14} />
                    <span>{app.drill_date ? toDisplayDate(app.drill_date) : "Date on request"}</span>
                    <Clock size={14} />
                    <span>{app.drill_time ? toDisplayTime(app.drill_time) : "Time on request"}</span>
                  </div>
                  <div className="ca-leave-detail-row">
                    <Clock size={14} />
                    <span>Applied at: {toDisplayDateTime(app.created_at)}</span>
                  </div>
                  <p className="ca-leave-reason">
                    <FileText size={14} />
                    <span>{app.reason}</span>
                  </p>
                  {app.attachment_url && (
                    <div className="ca-leave-doc">
                      <Paperclip size={14} />
                      <a href={app.attachment_url} target="_blank" rel="noreferrer">
                        {app.attachment_name || "View Attachment"}
                      </a>
                    </div>
                  )}
                </div>

                {app.reviewed_by_name && (
                  <div className="ca-leave-card-footer">
                    Reviewed by: <strong>{app.reviewed_by_name}</strong>
                  </div>
                )}
              </div>
            ))}
          </div>
        )}
      </div>

      {isLeaveModalOpen && (
        <div className="ca-leave-modal-overlay" onClick={closeLeaveModal}>
          <div className="ca-leave-modal" onClick={(e) => e.stopPropagation()}>
            <div className="ca-leave-modal-header">
              <h3>Apply Leave</h3>
              <button type="button" className="ca-leave-modal-close" onClick={closeLeaveModal}>
                <X size={18} />
              </button>
            </div>

            <form className="ca-leave-modal-form" onSubmit={handleSubmitLeave}>
              <div className="ca-form-group ca-form-full">
                <label className="ca-form-label">Reason *</label>
                <textarea
                  className="ca-form-textarea"
                  rows={4}
                  placeholder="Write reason for leave..."
                  value={leaveReason}
                  onChange={(e) => setLeaveReason(e.target.value)}
                />
              </div>

              <div className="ca-form-group ca-form-full">
                <label className="ca-form-label">Timestamp (Auto)</label>
                <div className="ca-form-readonly">
                  <Clock size={16} />
                  <span>{toDisplayDateTime(leaveTimestamp)}</span>
                </div>
              </div>

              <div className="ca-form-group ca-form-full">
                <label className="ca-form-label">Supporting Document</label>
                <div className="ca-file-area">
                  {selectedFile ? (
                    <div className="ca-file-chosen">
                      <Paperclip size={16} />
                      <span className="ca-file-name">{selectedFile.name}</span>
                      <button
                        type="button"
                        className="ca-file-remove"
                        onClick={() => {
                          setSelectedFile(null);
                          if (fileRef.current) fileRef.current.value = "";
                        }}
                      >
                        <X size={14} />
                      </button>
                    </div>
                  ) : (
                    <button type="button" className="ca-file-upload-btn" onClick={() => fileRef.current?.click()}>
                      <Upload size={18} />
                      <span>Attach Document</span>
                    </button>
                  )}
                  <input
                    type="file"
                    ref={fileRef}
                    hidden
                    accept=".pdf,.jpg,.jpeg,.png,.doc,.docx"
                    onChange={(e) => {
                      if (e.target.files[0]) setSelectedFile(e.target.files[0]);
                    }}
                  />
                </div>
              </div>

              <button type="submit" className="ca-submit-btn" disabled={submitting}>
                <span>{submitting ? "Applying..." : "Apply Leave"}</span>
              </button>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
