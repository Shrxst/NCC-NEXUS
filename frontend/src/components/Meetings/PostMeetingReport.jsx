import { useEffect } from "react";
import { Link, useParams } from "react-router-dom";
import { useDispatch, useSelector } from "react-redux";
import { ArrowLeft, Download, Users, UserCheck, UserX, Clock, Percent, AlertTriangle, FileText } from "lucide-react";
import { fetchMeetingById, fetchMeetingReport } from "../../store/meetingSlice";
import {
  MEETING_STATUS,
  formatMeetingDateTime,
  getCurrentRole,
  getCurrentUser,
  isAuthority,
  isInvitedToMeeting,
} from "./meetingUtils";
import "./meetingModule.css";

const PostMeetingReport = ({ embedded = false, basePath = "/meetings", meetingIdProp, onBack, onViewDetails }) => {
  const params = useParams();
  const meetingId = meetingIdProp || params.meetingId;
  const dispatch = useDispatch();
  const role = getCurrentRole();
  const currentUser = getCurrentUser();
  const authority = isAuthority(role);

  const meetings = useSelector((state) => state.meetings.meetings);
  const reports = useSelector((state) => state.meetings.reports);
  const loading = useSelector((state) => state.meetings.loading);

  const meeting = meetings.find((m) => m.id === meetingId);
  const report = reports[meetingId];

  useEffect(() => {
    dispatch(fetchMeetingById(meetingId));
    dispatch(fetchMeetingReport(meetingId));
  }, [dispatch, meetingId]);

  if (loading && !meeting) {
    return (
      <div className={embedded ? "meeting-page meeting-page-embedded" : "meeting-page"}>
        <div className="meeting-empty">Loading report...</div>
      </div>
    );
  }

  if (!meeting) {
    return (
      <div className={embedded ? "meeting-page meeting-page-embedded" : "meeting-page"}>
        <div className="meeting-empty">Meeting not found.</div>
      </div>
    );
  }

  if (
    meeting.status !== MEETING_STATUS.ENDED &&
    meeting.status !== MEETING_STATUS.COMPLETED
  ) {
    return (
      <div className={embedded ? "meeting-page meeting-page-embedded" : "meeting-page"}>
        <div className="meeting-empty">Report is available only for completed meetings.</div>
        {onBack ? (
          <button type="button" className="meeting-btn meeting-btn-secondary" onClick={onBack} style={{ marginTop: 12 }}>
            Back to Meetings
          </button>
        ) : (
          <Link className="meeting-btn meeting-btn-secondary" to={basePath} style={{ marginTop: 12 }}>
            Back to Meetings
          </Link>
        )}
      </div>
    );
  }

  const invited = isInvitedToMeeting(meeting, currentUser.id, role);
  if (!invited && !authority) {
    return (
      <div className={embedded ? "meeting-page meeting-page-embedded" : "meeting-page"}>
        <div className="meeting-empty">You do not have access to this report.</div>
      </div>
    );
  }

  if (!report) {
    return (
      <div className={embedded ? "meeting-page meeting-page-embedded" : "meeting-page"}>
        <div className="meeting-empty">Report data is not yet available for this meeting.</div>
        {onBack ? (
          <button type="button" className="meeting-btn meeting-btn-secondary" onClick={onBack} style={{ marginTop: 12 }}>
            Back to Meetings
          </button>
        ) : (
          <Link className="meeting-btn meeting-btn-secondary" to={basePath} style={{ marginTop: 12 }}>
            Back to Meetings
          </Link>
        )}
      </div>
    );
  }

  const { summary, attendance } = report;
  const visibleAttendance = authority
    ? attendance
    : attendance.filter((row) => Number(row.userId) === Number(currentUser.id));

  const exportCSV = () => {
    const headers = ["Name", "Role", "Duration", "% Attended", "Status", "Late"];
    const rows = visibleAttendance.map((row) => [
      row.name,
      row.role,
      row.duration,
      row.percentAttended,
      row.status,
      row.late ? "Yes" : "No",
    ]);

    const csv = [headers, ...rows].map((r) => r.join(",")).join("\n");
    const blob = new Blob([csv], { type: "text/csv" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `meeting-report-${meetingId}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  };

  return (
    <div className={embedded ? "meeting-page meeting-page-embedded" : "meeting-page"}>
      <div className="meeting-detail-header">
        {onBack ? (
          <button type="button" className="meeting-back-link" onClick={onBack}>
            <ArrowLeft size={18} />
            Back to Meetings
          </button>
        ) : (
          <Link className="meeting-back-link" to={basePath}>
            <ArrowLeft size={18} />
            Back to Meetings
          </Link>
        )}
      </div>

      <div className="meeting-page-head">
        <div>
          <h1>Meeting Report</h1>
          <p>{meeting.title} — {formatMeetingDateTime(meeting.dateTime)}</p>
        </div>
        <div className="meeting-report-head-actions">
          <button className="meeting-btn meeting-btn-secondary" onClick={exportCSV}>
            <Download size={14} />
            Export CSV
          </button>
        </div>
      </div>

      <section className="meeting-report-summary">
        <h3>Summary</h3>
        <div className="meeting-report-stats">
          <div className="meeting-report-stat">
            <div className="meet-icon-box meet-icon-indigo"><Users size={20} /></div>
            <span className="meeting-report-stat-value">{summary.totalInvited}</span>
            <label>Total Invited</label>
          </div>
          <div className="meeting-report-stat">
            <div className="meet-icon-box meet-icon-green"><UserCheck size={20} /></div>
            <span className="meeting-report-stat-value">{summary.totalPresent}</span>
            <label>Present</label>
          </div>
          <div className="meeting-report-stat">
            <div className="meet-icon-box meet-icon-red"><UserX size={20} /></div>
            <span className="meeting-report-stat-value">{summary.totalAbsent}</span>
            <label>Absent</label>
          </div>
          <div className="meeting-report-stat">
            <div className="meet-icon-box meet-icon-blue"><Percent size={20} /></div>
            <span className="meeting-report-stat-value">{summary.attendancePercent}%</span>
            <label>Attendance</label>
          </div>
          <div className="meeting-report-stat">
            <div className="meet-icon-box meet-icon-amber"><AlertTriangle size={20} /></div>
            <span className="meeting-report-stat-value">{summary.lateCount}</span>
            <label>Late</label>
          </div>
          <div className="meeting-report-stat">
            <div className="meet-icon-box meet-icon-navy"><Clock size={20} /></div>
            <span className="meeting-report-stat-value">{summary.avgDuration}</span>
            <label>Avg Duration</label>
          </div>
        </div>
      </section>

      <section className="meeting-report-table-section">
        <h3>Attendance Details</h3>
        <div className="meeting-report-table-wrap">
          <table className="meeting-report-table">
            <thead>
              <tr>
                <th>Name</th>
                <th>Role</th>
                <th>Duration</th>
                <th>% Attended</th>
                <th>Status</th>
                <th>Late</th>
              </tr>
            </thead>
            <tbody>
              {visibleAttendance.map((row) => (
                <tr key={row.userId}>
                  <td className="meeting-report-name">{row.name}</td>
                  <td>
                    <span className="meeting-user-role">{row.role}</span>
                  </td>
                  <td>{row.duration}</td>
                  <td>{row.percentAttended}%</td>
                  <td>
                    <span className={`meeting-report-status meeting-report-status-${row.status.toLowerCase()}`}>
                      {row.status}
                    </span>
                  </td>
                  <td>{row.late ? "Yes" : "—"}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>

      <div className="meeting-detail-footer">
        {onViewDetails ? (
          <button type="button" className="meeting-btn meeting-btn-primary meeting-btn-lg" onClick={() => onViewDetails(meetingId)}>
            <FileText size={14} />
            View Details
          </button>
        ) : (
          <Link className="meeting-btn meeting-btn-primary meeting-btn-lg" to={`${basePath}/${meetingId}`}>
            <FileText size={14} />
            View Details
          </Link>
        )}
      </div>
    </div>
  );
};

export default PostMeetingReport;
