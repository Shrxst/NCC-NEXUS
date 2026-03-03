import { useEffect, useMemo, useState } from "react";
import { Link, useNavigate, useParams } from "react-router-dom";
import { useDispatch, useSelector } from "react-redux";
import { Trash2, CalendarDays, Tag, FileText, Users, ArrowLeft, Play, Edit3, XCircle } from "lucide-react";
import { deleteMeeting, editMeeting, setCurrentMeeting, updateMeetingStatus, fetchMeetingById, fetchParticipants } from "../../store/meetingSlice";
import { API_BASE_URL } from "../../api/config";
import {
  MEETING_STATUS,
  formatMeetingDateTime,
  getCurrentRole,
  getCurrentUser,
  getStatusClass,
  getStatusLabel,
  isAuthority,
  isInvitedToMeeting,
  isMeetingHost,
} from "./meetingUtils";
import AuthorityControlPanel from "./AuthorityControlPanel";
import WaitingRoomPanel from "./WaitingRoomPanel";
import "./meetingModule.css";

const MeetingDetailsPage = ({ embedded = false, basePath = "/meetings" }) => {
  const { meetingId } = useParams();
  const dispatch = useDispatch();
  const navigate = useNavigate();
  const role = getCurrentRole();
  const currentUser = getCurrentUser();
  const authority = isAuthority(role);

  const meetings = useSelector((state) => state.meetings.meetings);
  const participantsMap = useSelector((state) => state.meetings.participants);

  const meeting = meetings.find((item) => item.id === meetingId);
  const participants = participantsMap[meetingId] || [];

  const [editMode, setEditMode] = useState(false);
  const [draft, setDraft] = useState({
    title: meeting?.title || "",
    description: meeting?.description || "",
    dateTime: meeting?.dateTime || "",
    meetingType: meeting?.meetingType || "General",
  });
  const [cadets, setCadets] = useState([]);

  useEffect(() => {
    dispatch(fetchMeetingById(meetingId));
    dispatch(fetchParticipants(meetingId));
  }, [dispatch, meetingId]);

  useEffect(() => {
    const token = localStorage.getItem("token");

    const tryAnoCadets = async () => {
      const res = await fetch(`${API_BASE_URL}/api/ano/cadets`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (!res.ok) return null;
      const data = await res.json();
      return Array.isArray(data) ? data : null;
    };

    const tryChatUsers = async () => {
      const res = await fetch(`${API_BASE_URL}/api/chat/users/${currentUser.id}`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (!res.ok) return null;
      const data = await res.json();
      const users = data?.data?.users || data?.users || [];
      if (!Array.isArray(users)) return null;
      return users.map((contact) => ({
        regimental_no: contact.peer_user_id,
        name: contact.room_name || contact.participants?.[0]?.name || `User #${contact.peer_user_id}`,
        role: contact.peer_role || "",
      }));
    };

    (async () => {
      try {
        const result = (await tryAnoCadets()) || (await tryChatUsers()) || [];
        setCadets(result);
      } catch {
        setCadets([]);
      }
    })();
  }, [currentUser.id]);

  const invitedUsers = useMemo(() => {
    if (!meeting) return [];
    const ids = meeting.invitedUserIds || [];
    return ids.map((id) => {
      const cadet = cadets.find((c) => Number(c.regimental_no || c.peer_user_id) === Number(id));
      return cadet
        ? { id, name: cadet.name || "Unknown", role: (cadet.role || "").toUpperCase() }
        : { id, name: `User #${id}`, role: "" };
    });
  }, [meeting, cadets]);

  if (!meeting) {
    return (
      <div className={embedded ? "meeting-page meeting-page-embedded" : "meeting-page"}>
        <div className="meeting-empty">Meeting not found.</div>
      </div>
    );
  }

  const invited = isInvitedToMeeting(meeting, currentUser.id, role);
  const host = isMeetingHost(meeting, currentUser.id);

  if (!invited && !authority) {
    return (
      <div className={embedded ? "meeting-page meeting-page-embedded" : "meeting-page"}>
        <div className="meeting-empty">You are not invited to this meeting.</div>
      </div>
    );
  }

  const isLive = meeting.status === MEETING_STATUS.LIVE;
  const isScheduled = meeting.status === MEETING_STATUS.SCHEDULED;
  const isCompleted = meeting.status === MEETING_STATUS.ENDED;

  const saveEdit = () => {
    dispatch(editMeeting({ meetingId: meeting.id, updates: draft }));
    setEditMode(false);
  };

  const startMeeting = () => {
    dispatch(updateMeetingStatus({ meetingId: meeting.id, status: MEETING_STATUS.LIVE }));
    dispatch(setCurrentMeeting({ meetingId: meeting.id, userId: currentUser.id }));
    navigate(`${basePath}/${meeting.id}/room`);
  };

  const cancelMeeting = () => {
    dispatch(updateMeetingStatus({ meetingId: meeting.id, status: MEETING_STATUS.CANCELLED }));
  };

  const handleDelete = () => {
    dispatch(deleteMeeting({ meetingId: meeting.id }));
    navigate(basePath);
  };

  return (
    <div className={embedded ? "meeting-page meeting-page-embedded" : "meeting-page"}>
      {/* Header with back button */}
      <div className="meeting-detail-header">
        <Link className="meeting-back-link" to={basePath}>
          <ArrowLeft size={18} />
          Back to Meetings
        </Link>
      </div>

      {/* Title section */}
      <div className="meeting-detail-title-row">
        <div>
          <h1>{meeting.title}</h1>
          {host ? <span className="meeting-host-chip">You are the host</span> : null}
        </div>
        <span className={`meeting-status-badge ${getStatusClass(meeting.status)}`}>
          {getStatusLabel(meeting.status)}
        </span>
      </div>

      {/* Info card */}
      <div className="meeting-detail-info-card">
        <div className="meeting-detail-info-grid">
          <div className="meeting-detail-info-row">
            <CalendarDays size={18} />
            <div>
              <label>Date & Time</label>
              <p>{formatMeetingDateTime(meeting.dateTime)}</p>
            </div>
          </div>
          <div className="meeting-detail-info-row">
            <Tag size={18} />
            <div>
              <label>Meeting Type</label>
              <p>{meeting.meetingType}</p>
            </div>
          </div>
          <div className="meeting-detail-info-row">
            <Users size={18} />
            <div>
              <label>Participants</label>
              <p>{participants.length} joined &middot; {(meeting.invitedUserIds || []).length} invited</p>
            </div>
          </div>
          <div className="meeting-detail-info-row meeting-detail-info-full">
            <FileText size={18} />
            <div>
              <label>Description</label>
              <p>{meeting.description || "No description provided."}</p>
            </div>
          </div>
        </div>
      </div>

      {/* Invited users section */}
      {invitedUsers.length > 0 ? (
        <div className="meeting-detail-invited-card">
          <h3>Invited Participants ({invitedUsers.length})</h3>
          <div className="meeting-detail-invited-list">
            {invitedUsers.map((user) => (
              <div key={user.id} className="meeting-detail-invited-item">
                <div className="meeting-avatar-sm">{user.name.charAt(0).toUpperCase()}</div>
                <span className="meeting-detail-invited-name">{user.name}</span>
                {user.role ? <span className="meeting-user-role">{user.role}</span> : null}
              </div>
            ))}
          </div>
        </div>
      ) : null}

      {/* Authority controls for SCHEDULED meetings */}
      {authority && isScheduled ? (
        <div className="meeting-detail-actions-card">
          <h3>Meeting Actions</h3>
          <div className="meeting-detail-action-buttons">
            <button className="meeting-btn meeting-btn-primary" onClick={startMeeting}>
              <Play size={14} />
              Start Meeting
            </button>
            <button className="meeting-btn meeting-btn-secondary" onClick={() => setEditMode((prev) => !prev)}>
              <Edit3 size={14} />
              {editMode ? "Close Edit" : "Edit"}
            </button>
            <button className="meeting-btn meeting-btn-secondary" onClick={cancelMeeting}>
              <XCircle size={14} />
              Cancel
            </button>
            <button className="meeting-btn meeting-btn-danger" onClick={handleDelete}>
              <Trash2 size={14} />
              Delete
            </button>
          </div>
        </div>
      ) : null}

      {/* Edit panel */}
      {authority && editMode ? (
        <div className="meeting-detail-edit-card">
          <h3>Edit Meeting</h3>
          <div className="meeting-create-fields">
            <label className="meeting-form-field">
              <span>Title</span>
              <input
                value={draft.title}
                onChange={(event) => setDraft((prev) => ({ ...prev, title: event.target.value }))}
              />
            </label>
            <label className="meeting-form-field">
              <span>Date & Time</span>
              <input
                type="datetime-local"
                value={draft.dateTime}
                onChange={(event) => setDraft((prev) => ({ ...prev, dateTime: event.target.value }))}
              />
            </label>
            <label className="meeting-form-field meeting-form-field-full">
              <span>Description</span>
              <textarea
                rows={3}
                value={draft.description}
                onChange={(event) => setDraft((prev) => ({ ...prev, description: event.target.value }))}
              />
            </label>
            <label className="meeting-form-field">
              <span>Meeting Type</span>
              <select
                value={draft.meetingType}
                onChange={(event) => setDraft((prev) => ({ ...prev, meetingType: event.target.value }))}
              >
                <option value="General">General</option>
                <option value="Training">Training</option>
                <option value="Briefing">Briefing</option>
              </select>
            </label>
          </div>
          <button className="meeting-btn meeting-btn-primary" onClick={saveEdit} style={{ marginTop: 16 }}>
            Save Changes
          </button>
        </div>
      ) : null}

      {/* Authority controls for LIVE meetings */}
      {authority && isLive ? (
        <div className="meeting-detail-live-section">
          <AuthorityControlPanel meeting={meeting} basePath={basePath} />
          <WaitingRoomPanel meetingId={meeting.id} />
        </div>
      ) : null}

      {/* Bottom actions */}
      <div className="meeting-detail-footer">
        {!authority && isLive ? (
          <Link className="meeting-btn meeting-btn-primary meeting-btn-lg" to={`${basePath}/${meeting.id}/room`}>
            Join Meeting
          </Link>
        ) : null}

        {authority && isLive ? (
          <Link className="meeting-btn meeting-btn-primary meeting-btn-lg" to={`${basePath}/${meeting.id}/room`}>
            Open Room
          </Link>
        ) : null}

        {isCompleted ? (
          <Link className="meeting-btn meeting-btn-completed meeting-btn-lg" to={`${basePath}/${meeting.id}/report`}>
            {authority ? "View Full Report" : "View Summary"}
          </Link>
        ) : null}
      </div>
    </div>
  );
};

export default MeetingDetailsPage;
