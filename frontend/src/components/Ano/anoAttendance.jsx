import React, { useEffect, useState } from "react";
import "./anoAttendance.css";
import { attendanceApi } from "../../api/attendanceApi";
import { fineApi } from "../../api/fineApi";

function calculateAttendance(attArr) {
  const total = attArr.length;
  const attended = attArr.filter((value) => value === "P").length;
  const percent = total ? ((attended / total) * 100).toFixed(1) : "0";
  return { attended, total, percent };
}

const AnoAttendance = () => {
  const [sessions, setSessions] = useState([]);
  const [selectedSession, setSelectedSession] = useState("");
  const [sessionDetail, setSessionDetail] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [fineSummary, setFineSummary] = useState({
    total_count: 0,
    total_amount: 0,
    by_status: { pending: 0, payment_submitted: 0, paid: 0, cancelled: 0 },
  });

  const loadSessions = async (preferredSessionId = null) => {
    setLoading(true);
    setError("");
    try {
      const res = await attendanceApi.getSessions();
      const rows = res.data?.data || [];
      setSessions(rows);
      if (!rows.length) {
        setSelectedSession("");
        setSessionDetail({ drills: [], cadets: [] });
        return;
      }
      const desired =
        preferredSessionId && rows.some((s) => String(s.session_id) === String(preferredSessionId))
          ? String(preferredSessionId)
          : String(rows[0].session_id);
      setSelectedSession(desired);
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

  const loadFineSummary = async () => {
    try {
      const res = await fineApi.getAll();
      const rows = Array.isArray(res?.data?.data) ? res.data.data : [];
      const summary = rows.reduce(
        (acc, fine) => {
          const amount = Number(fine.amount || 0);
          acc.total_count += 1;
          acc.total_amount += amount;
          acc.by_status[fine.status] = (acc.by_status[fine.status] || 0) + 1;
          return acc;
        },
        { total_count: 0, total_amount: 0, by_status: { pending: 0, payment_submitted: 0, paid: 0, cancelled: 0 } }
      );
      setFineSummary(summary);
    } catch (err) {
      const serverMessage = err?.response?.data?.message;
      if (serverMessage) setError(serverMessage);
    }
  };

  useEffect(() => {
    loadSessions();
    loadFineSummary();
  }, []);

  useEffect(() => {
    if (selectedSession) loadSessionDetail(selectedSession);
  }, [selectedSession]);

  const handleDownload = async () => {
    if (!selectedSession) return;
    try {
      const response = await attendanceApi.exportSession(selectedSession);
      const blob = new Blob([response.data], { type: "text/csv;charset=utf-8;" });
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `attendance_${selectedSession}.csv`;
      a.click();
      URL.revokeObjectURL(url);
    } catch (err) {
      window.alert(err?.response?.data?.message || "Unable to download attendance CSV.");
    }
  };

  const handleFineReportDownload = async () => {
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

  // Reverse drills so newest appears first; build index map for attendance lookup
  const rawDrills = sessionDetail?.drills || [];
  const drillOrder = rawDrills.map((_, i) => i).reverse();
  const drills = drillOrder.map((i) => rawDrills[i]);
  const cadets = sessionDetail?.cadets || [];

  return (
    <div className="ano-attendance-container">
      <h2 className="ano-attendance-title">Attendance Monitoring</h2>
      {loading ? <p>Loading...</p> : null}
      {error ? <p style={{ color: "crimson" }}>{error}</p> : null}
      <div className="ano-attendance-toolbar">
        <label className="ano-attendance-label">Session:</label>
        <select
          className="ano-attendance-session-select"
          value={selectedSession}
          onChange={(e) => setSelectedSession(e.target.value)}
        >
          {sessions.map((sessionName) => (
            <option key={sessionName.session_id} value={sessionName.session_id}>
              {sessionName.session_name}
            </option>
          ))}
        </select>
        <button className="ano-attendance-btn ano-attendance-btn-primary" onClick={handleDownload}>
          Download Attendance
        </button>
        <button className="ano-attendance-btn ano-attendance-btn-primary" onClick={handleFineReportDownload}>
          Download Fine Report
        </button>
      </div>
      <div className="ano-attendance-table-card" style={{ marginTop: 12 }}>
        <h3>Fine Summary</h3>
        <p>Total Fines: {fineSummary.total_count}</p>
        <p>Total Amount: Rs. {Number(fineSummary.total_amount || 0).toFixed(2)}</p>
        <p>Pending: {fineSummary.by_status.pending || 0}</p>
        <p>Payment Submitted: {fineSummary.by_status.payment_submitted || 0}</p>
        <p>Paid: {fineSummary.by_status.paid || 0}</p>
        <p>Cancelled: {fineSummary.by_status.cancelled || 0}</p>
      </div>
      <div className="ano-attendance-table-card">
        <table className="ano-attendance-table">
          <thead>
            <tr>
              <th className="ano-col-cadet">Cadet Name</th>
              {drills.map((drill, i) => (
                <th key={drill.drill_id} className="ano-col-drill">
                  <div className="ano-drill-head">{drill.drill_name || `Drill ${drillOrder[i] + 1}`}</div>
                  <div className="ano-drill-date">{`${drill.drill_date} ${String(drill.drill_time).slice(0, 5)}`}</div>
                </th>
              ))}
              <th>Total Drills</th>
              <th>Total Attendance</th>
              <th>Percentage</th>
            </tr>
          </thead>
          <tbody>
            {cadets.map((cadet) => {
              const { attended, total, percent } = calculateAttendance(cadet.attendance || []);
              return (
                <tr key={cadet.regimental_no}>
                  <td className="ano-cadet-name-cell">{cadet.name}</td>
                  {drills.map((drill, i) => {
                    const status = cadet.attendance?.[drillOrder[i]] ?? null;
                    return (
                      <td key={`${cadet.regimental_no}-${drill.drill_id}`}>
                        {status ? (
                          <span className={`ano-attendance-pill ${status === "P" ? "present" : "absent"}`}>
                            {status}
                          </span>
                        ) : (
                          <span className="ano-attendance-pill">--</span>
                        )}
                      </td>
                    );
                  })}
                  <td className="ano-total-cell">{total}</td>
                  <td className="ano-total-cell">{attended}</td>
                  <td className="ano-total-cell">{percent}%</td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
};

export default AnoAttendance;
