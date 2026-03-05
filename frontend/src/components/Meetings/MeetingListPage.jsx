import { useEffect } from "react";
import { Link } from "react-router-dom";
import { useDispatch, useSelector } from "react-redux";
import { fetchMeetings } from "../../store/meetingSlice";
import MeetingCard from "./MeetingCard";
import {
  MEETING_STATUS,
  canCreateMeeting,
  getCurrentRole,
  getCurrentUser,
  getVisibleMeetings,
} from "./meetingUtils";
import "./meetingModule.css";

const MeetingListSection = ({ title, meetings, emptyMessage, role, currentUser, participants, basePath }) => (
  <section className="meeting-list-section">
    <h3>{title}</h3>
    {meetings.length ? (
      <div className="meeting-card-grid">
        {meetings.map((meeting) => (
          <MeetingCard
            key={meeting.id}
            meeting={meeting}
            role={role}
            currentUser={currentUser}
            participants={participants[meeting.id] || []}
            detailsPath={`${basePath}/${meeting.id}`}
            roomPath={`${basePath}/${meeting.id}/room`}
            reportPath={`${basePath}/${meeting.id}/report`}
          />
        ))}
      </div>
    ) : (
      <div className="meeting-empty">{emptyMessage}</div>
    )}
  </section>
);

const MeetingListPage = ({ embedded = false, basePath = "/meetings", hideCreateLink = false }) => {
  const dispatch = useDispatch();
  const role = getCurrentRole();
  const currentUser = getCurrentUser();
  const meetings = useSelector((state) => state.meetings.meetings);
  const participants = useSelector((state) => state.meetings.participants);
  const loading = useSelector((state) => state.meetings.loading);

  useEffect(() => {
    dispatch(fetchMeetings());
  }, [dispatch]);

  const visibleMeetings = getVisibleMeetings(meetings, role, currentUser.id);

  const ongoing = visibleMeetings.filter((meeting) => meeting.status === MEETING_STATUS.LIVE);
  const upcoming = visibleMeetings.filter((meeting) => meeting.status === MEETING_STATUS.SCHEDULED);
  const past = visibleMeetings.filter((meeting) =>
    [MEETING_STATUS.ENDED, MEETING_STATUS.COMPLETED, MEETING_STATUS.CANCELLED].includes(meeting.status)
  );

  const hasAnyMeetings = ongoing.length > 0 || upcoming.length > 0 || past.length > 0;

  return (
    <div className={embedded ? "meeting-page meeting-page-embedded" : "meeting-page"}>
      <div className="meeting-page-head">
        <div>
          <h1>NCC Command Meet</h1>
          <p>Structured meeting management with role-based access control.</p>
        </div>

        {canCreateMeeting(role) && !hideCreateLink ? (
          <Link className="meeting-btn meeting-btn-primary" to={`${basePath}/create`}>
            Create Meeting
          </Link>
        ) : null}
      </div>

      {loading ? (
        <div className="meeting-empty">Loading meetings...</div>
      ) : !hasAnyMeetings ? (
        <div className="meeting-empty">No meetings found. {canCreateMeeting(role) ? "Create one to get started." : ""}</div>
      ) : (
        <>
          {ongoing.length > 0 ? (
            <MeetingListSection
              title="Ongoing Meetings"
              meetings={ongoing}
              emptyMessage=""
              role={role}
              currentUser={currentUser}
              participants={participants}
              basePath={basePath}
            />
          ) : null}

          <MeetingListSection
            title="Upcoming Meetings"
            meetings={upcoming}
            emptyMessage="No upcoming meetings scheduled."
            role={role}
            currentUser={currentUser}
            participants={participants}
            basePath={basePath}
          />

          {past.length > 0 ? (
            <MeetingListSection
              title="Past Meetings"
              meetings={past}
              emptyMessage=""
              role={role}
              currentUser={currentUser}
              participants={participants}
              basePath={basePath}
            />
          ) : null}
        </>
      )}
    </div>
  );
};

export default MeetingListPage;
