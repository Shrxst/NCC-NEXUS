import { Link } from "react-router-dom";
import { CalendarDays, Users, Clock } from "lucide-react";
import {
  MEETING_STATUS,
  formatMeetingDateTime,
  getStatusClass,
  getStatusLabel,
  getTimeUntil,
  isAuthority,
  isInvitedToMeeting,
  isMeetingHost,
} from "./meetingUtils";

const MeetingCard = ({ meeting, role, currentUser, participants = [], detailsPath, roomPath, reportPath }) => {
  const invited = isInvitedToMeeting(meeting, currentUser.id, role);
  const isHost = isMeetingHost(meeting, currentUser.id);
  const authority = isAuthority(role);
  const isLive = meeting.status === MEETING_STATUS.LIVE;
  const isScheduled = meeting.status === MEETING_STATUS.SCHEDULED;
  const isCompleted =
    meeting.status === MEETING_STATUS.ENDED ||
    meeting.status === MEETING_STATUS.COMPLETED;
  const canJoin = invited && isLive;
  const timeUntil = isScheduled ? getTimeUntil(meeting.dateTime) : "";

  return (
    <article className="meeting-card">
      <div className="meeting-card-head">
        <div>
          <h3>{meeting.title}</h3>
          <div className="meeting-card-footer">
            <span className="meeting-type-chip">{meeting.meetingType}</span>
            {isHost ? <span className="meeting-host-chip">Host</span> : null}
          </div>
        </div>
        <span className={`meeting-status-badge ${getStatusClass(meeting.status)}`}>
          {getStatusLabel(meeting.status)}
        </span>
      </div>

      {meeting.description ? (
        <p className="meeting-card-description">{meeting.description}</p>
      ) : null}

      <div className="meeting-card-meta">
        <span>
          <CalendarDays size={14} />
          {formatMeetingDateTime(meeting.dateTime)}
        </span>
        <span>
          <Users size={14} />
          {(meeting.invitedUserIds || []).length} invited
        </span>
        {timeUntil ? (
          <span className="meeting-time-until">
            <Clock size={14} />
            {timeUntil}
          </span>
        ) : null}
      </div>

      <div className="meeting-card-actions">
        <Link className="meeting-btn meeting-btn-secondary" to={detailsPath}>
          Details
        </Link>

        {/* Cadet actions */}
        {!authority && isLive && canJoin ? (
          <Link className="meeting-btn meeting-btn-primary" to={roomPath}>
            Join Meeting
          </Link>
        ) : null}

        {!authority && isScheduled ? (
          <span className="meeting-btn meeting-btn-primary meeting-btn-disabled" aria-disabled="true">
            Join Meeting
          </span>
        ) : null}

        {!authority && isCompleted ? (
          <Link className="meeting-btn meeting-btn-completed" to={reportPath || `${detailsPath}/report`}>
            View Summary
          </Link>
        ) : null}

        {/* Authority actions */}
        {authority && isLive ? (
          <Link className="meeting-btn meeting-btn-primary" to={roomPath}>
            Open Room
          </Link>
        ) : null}

        {authority && isCompleted ? (
          <Link className="meeting-btn meeting-btn-completed" to={reportPath || `${detailsPath}/report`}>
            View Report
          </Link>
        ) : null}
      </div>
    </article>
  );
};

export default MeetingCard;
