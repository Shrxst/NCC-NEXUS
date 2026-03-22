import { useEffect } from "react";
import { Link } from "react-router-dom";
import { useDispatch, useSelector } from "react-redux";
import MeetingCard from "./MeetingCard";
import { fetchMeetings } from "../../store/meetingSlice";
import {
  MEETING_STATUS,
  canCreateMeeting,
  getCurrentRole,
  getCurrentUser,
  getVisibleMeetings,
} from "./meetingUtils";
import "./meetingModule.css";

const MeetingDashboardSection = ({ sectionTitle = "Meetings", mode = "INVITED", basePath = "/meetings", onNavigate, onViewDetails, onJoinRoom, onViewReport }) => {
  const dispatch = useDispatch();
  const role = getCurrentRole();
  const user = getCurrentUser();
  const meetings = useSelector((state) => state.meetings.meetings);
  const participants = useSelector((state) => state.meetings.participants);

  useEffect(() => {
    dispatch(fetchMeetings());
  }, [dispatch]);

  const visible = getVisibleMeetings(meetings, role, user.id);
  const liveMeeting = visible.find((meeting) => meeting.status === MEETING_STATUS.LIVE);

  const listByMode = {
    UPCOMING: visible
      .filter((meeting) => meeting.status === MEETING_STATUS.SCHEDULED)
      .slice(0, 2),
    MY: visible
      .filter((meeting) => Number(meeting.createdBy) === Number(user.id))
      .slice(0, 2),
    INVITED: visible.slice(0, 2),
  };

  const cards = listByMode[mode] || [];

  return (
    <section className="meeting-dash-section">
      <div className="meeting-dash-head">
        <h2>{sectionTitle}</h2>
        <div className="meeting-dash-head-actions">
          {canCreateMeeting(role) ? (
            onNavigate ? (
              <button type="button" className="meeting-btn meeting-btn-primary" onClick={() => onNavigate("create")}>
                Create Meeting
              </button>
            ) : (
              <Link className="meeting-btn meeting-btn-primary" to={`${basePath}/create`}>
                Create Meeting
              </Link>
            )
          ) : null}
          {onNavigate ? (
            <button type="button" className="meeting-btn meeting-btn-secondary" onClick={() => onNavigate("list")}>
              View All
            </button>
          ) : (
            <Link className="meeting-btn meeting-btn-secondary" to={basePath}>
              View All
            </Link>
          )}
        </div>
      </div>

      {liveMeeting ? (
        <div className="meeting-live-alert">
          <div className="meeting-live-alert-content">
            <span className="meeting-live-dot" />
            <strong>Live Now:</strong> {liveMeeting.title}
          </div>
          {onJoinRoom ? (
            <button type="button" className="meeting-btn meeting-btn-primary" onClick={() => onJoinRoom(liveMeeting.id)}>Join Now</button>
          ) : (
            <Link to={`${basePath}/${liveMeeting.id}/room`}>Join Now</Link>
          )}
        </div>
      ) : null}

      {cards.length ? (
        <div className="meeting-dash-grid">
          {cards.map((meeting) => (
            <MeetingCard
              key={meeting.id}
              meeting={meeting}
              role={role}
              currentUser={user}
              participants={participants[meeting.id] || []}
              detailsPath={`${basePath}/${meeting.id}`}
              roomPath={`${basePath}/${meeting.id}/room`}
              reportPath={`${basePath}/${meeting.id}/report`}
              onViewDetails={onViewDetails}
              onJoinRoom={onJoinRoom}
              onViewReport={onViewReport}
            />
          ))}
        </div>
      ) : (
        <div className="meeting-empty">No meetings found.</div>
      )}
    </section>
  );
};

export default MeetingDashboardSection;
