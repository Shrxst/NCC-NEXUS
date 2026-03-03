import { useEffect, useMemo, useState } from "react";
import { createPortal } from "react-dom";
import { Link, useNavigate, useParams } from "react-router-dom";
import { LogOut, MessageSquare, Users, Shield, X, Video, VideoOff, Mic, MicOff } from "lucide-react";
import { useDispatch, useSelector } from "react-redux";
import {
  joinMeeting,
  leaveMeeting,
  setConnectionStatus,
  setCurrentMeeting,
  fetchMeetingById,
  fetchParticipants,
  toggleMic,
  toggleCamera,
} from "../../store/meetingSlice";
import {
  MEETING_STATUS,
  getCurrentRole,
  getCurrentUser,
  isAuthority,
  isInvitedToMeeting,
  isMeetingHost,
} from "./meetingUtils";
import WaitingRoomScreen from "./WaitingRoomScreen";
import AuthorityControlPanel from "./AuthorityControlPanel";
import WaitingRoomPanel from "./WaitingRoomPanel";
import BriefingBanner from "./BriefingBanner";
import MeetingChat from "./MeetingChat";
import "./meetingModule.css";

const formatTimer = (seconds) => {
  const hh = String(Math.floor(seconds / 3600)).padStart(2, "0");
  const mm = String(Math.floor((seconds % 3600) / 60)).padStart(2, "0");
  const ss = String(seconds % 60).padStart(2, "0");
  return `${hh}:${mm}:${ss}`;
};

const TILE_COLORS = [
  "#1a237e", "#0d47a1", "#1565c0", "#283593",
  "#2e7d32", "#00695c", "#4527a0", "#6a1b9a",
  "#ad1457", "#c62828", "#e65100", "#37474f",
];

const getTileColor = (userId) => TILE_COLORS[Math.abs(Number(userId)) % TILE_COLORS.length];

const getInitials = (name = "") => {
  const parts = name.trim().split(/\s+/);
  if (parts.length >= 2) return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
  return name.charAt(0).toUpperCase() || "?";
};

const ParticipantTile = ({ participant, isCurrentUser, isSpeaker }) => {
  const name = participant.user?.name || `User #${participant.userId}`;
  const initials = getInitials(name);
  const color = getTileColor(participant.userId);
  const host = participant.isHost;

  return (
    <div className={`mr-tile ${isSpeaker ? "mr-tile-speaking" : ""} ${isCurrentUser ? "mr-tile-self" : ""}`}>
      <div className="mr-tile-avatar" style={{ background: color }}>
        {initials}
      </div>
      <div className="mr-tile-footer">
        <span className="mr-tile-name">
          {isCurrentUser ? "You" : name}
          {host ? <span className="mr-tile-host">Host</span> : null}
        </span>
        <div className="mr-tile-icons">
          {participant.micOn === false ? <MicOff size={14} /> : <Mic size={14} className="mr-tile-icon-on" />}
          {participant.cameraOn === false ? <VideoOff size={14} /> : <Video size={14} className="mr-tile-icon-on" />}
        </div>
      </div>
    </div>
  );
};

const MeetingRoomPage = ({ embedded = false, basePath = "/meetings" }) => {
  const { meetingId } = useParams();
  const role = getCurrentRole();
  const currentUser = getCurrentUser();
  const navigate = useNavigate();
  const dispatch = useDispatch();
  const authority = isAuthority(role);

  const meetings = useSelector((state) => state.meetings.meetings);
  const participantsMap = useSelector((state) => state.meetings.participants);
  const admittedUsers = useSelector((state) => state.meetings.admittedUsers[meetingId] || []);
  const isBriefing = useSelector((state) => state.meetings.briefingMode[meetingId] || false);
  const waitingRoom = useSelector((state) => state.meetings.waitingRoom[meetingId] || []);

  const meeting = meetings.find((item) => item.id === meetingId);
  const participants = participantsMap[meetingId] || [];

  const [seconds, setSeconds] = useState(0);
  const [activePanel, setActivePanel] = useState(null);

  const isAdmitted = admittedUsers.includes(Number(currentUser.id));
  const host = meeting ? isMeetingHost(meeting, currentUser.id) : false;
  const canEnterDirectly = authority || host;

  useEffect(() => {
    if (meetingId) {
      dispatch(fetchMeetingById(meetingId));
      dispatch(fetchParticipants(meetingId));
    }
  }, [dispatch, meetingId]);

  const participantViews = useMemo(() => {
    return participants.map((participant) => {
      const user = participant.user || {
        name: `User #${participant.userId}`,
        role: participant.roleAtJoin || "",
      };
      return {
        ...participant,
        user,
        isHost: meeting ? Number(meeting.createdBy) === Number(participant.userId) : false,
      };
    });
  }, [participants, meeting]);

  useEffect(() => {
    if (!meeting) return;
    if (!isInvitedToMeeting(meeting, currentUser.id, role)) return;
    if (!canEnterDirectly && !isAdmitted) return;

    dispatch(setCurrentMeeting({ meetingId: meeting.id, userId: currentUser.id }));
    dispatch(joinMeeting({ meetingId: meeting.id, userId: currentUser.id }));
    dispatch(setConnectionStatus("CONNECTED"));

    return () => {
      dispatch(leaveMeeting({ meetingId: meeting.id, userId: currentUser.id }));
      dispatch(setConnectionStatus("DISCONNECTED"));
    };
  }, [meeting, currentUser.id, role, dispatch, canEnterDirectly, isAdmitted]);

  useEffect(() => {
    if (!meeting || meeting.status !== MEETING_STATUS.LIVE) return undefined;

    const timer = setInterval(() => {
      setSeconds((value) => value + 1);
    }, 1000);

    return () => clearInterval(timer);
  }, [meeting]);

  if (!meeting) {
    return (
      <div className={embedded ? "meeting-page meeting-page-embedded" : "meeting-page"}>
        <div className="meeting-empty">Meeting room not found.</div>
      </div>
    );
  }

  const invited = isInvitedToMeeting(meeting, currentUser.id, role);

  if (!invited) {
    return (
      <div className={embedded ? "meeting-page meeting-page-embedded" : "meeting-page"}>
        <div className="meeting-empty">You are not invited to this meeting room.</div>
      </div>
    );
  }

  if (meeting.status !== MEETING_STATUS.LIVE) {
    return (
      <div className={embedded ? "meeting-page meeting-page-embedded" : "meeting-page"}>
        <div className="meeting-empty">Join is enabled only when the meeting is LIVE.</div>
        <Link className="meeting-btn meeting-btn-secondary" to={`${basePath}/${meeting.id}`} style={{ marginTop: 16 }}>
          Back to Details
        </Link>
      </div>
    );
  }

  if (!canEnterDirectly && !isAdmitted) {
    return <WaitingRoomScreen meeting={meeting} basePath={basePath} />;
  }

  const leaveRoom = () => {
    dispatch(leaveMeeting({ meetingId: meeting.id, userId: currentUser.id }));
    dispatch(setConnectionStatus("DISCONNECTED"));
    navigate(`${basePath}/${meeting.id}`);
  };

  const togglePanel = (panel) => {
    setActivePanel((prev) => (prev === panel ? null : panel));
  };

  // Current user's mic/camera state
  const selfParticipant = participants.find((p) => Number(p.userId) === Number(currentUser.id));
  const micOn = selfParticipant?.micOn !== false;
  const cameraOn = selfParticipant?.cameraOn !== false;

  const handleToggleMic = () => {
    dispatch(toggleMic({ meetingId: meeting.id, userId: currentUser.id }));
  };

  const handleToggleCamera = () => {
    dispatch(toggleCamera({ meetingId: meeting.id, userId: currentUser.id }));
  };

  // Grid class based on participant count
  const tileCount = participantViews.length;
  let gridClass = "mr-grid-1";
  if (tileCount === 2) gridClass = "mr-grid-2";
  else if (tileCount >= 3 && tileCount <= 4) gridClass = "mr-grid-4";
  else if (tileCount >= 5 && tileCount <= 6) gridClass = "mr-grid-6";
  else if (tileCount >= 7) gridClass = "mr-grid-many";

  const roomUI = (
    <div className="mr-fullscreen">
      {/* Briefing banner */}
      {isBriefing ? <BriefingBanner active /> : null}

      {/* Main content area */}
      <div className="mr-video-wrap">
        {/* Video / participant grid area */}
        <div className="mr-video">
          {participantViews.length === 0 ? (
            <div className="mr-empty-room">
              <div className="mr-empty-icon">
                <Video size={48} strokeWidth={1} />
              </div>
              <h3>Waiting for participants...</h3>
              <p>Share the meeting link to invite others</p>
              <div className="mr-empty-meeting-info">
                <span>{meeting.title}</span>
              </div>
            </div>
          ) : (
            <div className={`mr-tile-grid ${gridClass}`}>
              {participantViews.map((p) => (
                <ParticipantTile
                  key={p.userId}
                  participant={p}
                  isCurrentUser={Number(p.userId) === Number(currentUser.id)}
                  isSpeaker={p.isHost}
                />
              ))}
            </div>
          )}
        </div>

        {/* Slide-out drawer */}
        {activePanel ? (
          <div className="mr-drawer">
            <div className="mr-drawer-header">
              <h3>
                {activePanel === "participants" ? `Participants (${participantViews.length})` : null}
                {activePanel === "chat" ? "Chat" : null}
                {activePanel === "controls" ? "Host Controls" : null}
              </h3>
              <button className="mr-drawer-close" onClick={() => setActivePanel(null)}>
                <X size={18} />
              </button>
            </div>

            <div className="mr-drawer-body">
              {activePanel === "participants" ? (
                <div className="mr-participant-list">
                  {participantViews.length === 0 ? (
                    <div className="meeting-empty-inline" style={{ padding: 20, textAlign: "center" }}>
                      No participants yet.
                    </div>
                  ) : (
                    participantViews.map((participant) => (
                      <div key={participant.userId} className="mr-participant-item">
                        <div className="meeting-avatar-sm" style={{ background: getTileColor(participant.userId) }}>
                          {getInitials(participant.user.name)}
                        </div>
                        <div className="mr-participant-detail">
                          <strong>
                            {Number(participant.userId) === Number(currentUser.id) ? "You" : participant.user.name}
                          </strong>
                          {participant.isHost ? <span className="meeting-host-chip">Host</span> : null}
                        </div>
                        <span className="meeting-user-role">{participant.user.role}</span>
                      </div>
                    ))
                  )}
                </div>
              ) : null}

              {activePanel === "chat" ? (
                <MeetingChat />
              ) : null}

              {activePanel === "controls" ? (
                <div className="mr-controls-content">
                  <AuthorityControlPanel meeting={meeting} basePath={basePath} />
                  <WaitingRoomPanel meetingId={meeting.id} />
                </div>
              ) : null}
            </div>
          </div>
        ) : null}
      </div>

      {/* Bottom toolbar */}
      <div className="mr-toolbar">
        <div className="mr-toolbar-left">
          <span className="mr-meeting-title">{meeting.title}</span>
          <span className="mr-divider" />
          <span className="mr-timer">{formatTimer(seconds)}</span>
          <span className="meeting-status-badge meeting-status-live">LIVE</span>
          {isBriefing ? <span className="meeting-status-badge meeting-status-briefing">Briefing</span> : null}
        </div>

        <div className="mr-toolbar-center">
          <button
            className={`mr-media-btn ${!micOn ? "mr-media-off" : ""}`}
            onClick={handleToggleMic}
            title={micOn ? "Mute" : "Unmute"}
          >
            {micOn ? <Mic size={20} /> : <MicOff size={20} />}
          </button>
          <button
            className={`mr-media-btn ${!cameraOn ? "mr-media-off" : ""}`}
            onClick={handleToggleCamera}
            title={cameraOn ? "Turn off camera" : "Turn on camera"}
          >
            {cameraOn ? <Video size={20} /> : <VideoOff size={20} />}
          </button>
          <span className="mr-divider" />
          <button
            className={`mr-tool-btn ${activePanel === "participants" ? "active" : ""}`}
            onClick={() => togglePanel("participants")}
            title={`Participants (${participantViews.length})`}
          >
            <Users size={20} />
          </button>
          <button
            className={`mr-tool-btn ${activePanel === "chat" ? "active" : ""}`}
            onClick={() => togglePanel("chat")}
            title="Chat"
          >
            <MessageSquare size={20} />
          </button>
          {authority ? (
            <button
              className={`mr-tool-btn ${activePanel === "controls" ? "active" : ""}`}
              onClick={() => togglePanel("controls")}
              title="Host Controls"
            >
              <Shield size={20} />
              {waitingRoom.length > 0 ? (
                <span className="mr-tool-badge">{waitingRoom.length}</span>
              ) : null}
            </button>
          ) : null}
        </div>

        <div className="mr-toolbar-right">
          <button className="mr-leave-btn" onClick={leaveRoom}>
            <LogOut size={18} />
            <span>Leave</span>
          </button>
        </div>
      </div>
    </div>
  );

  // Portal to document.body so the room escapes any parent layout
  // (sidebar, max-width constraints, position:relative overrides)
  return createPortal(roomUI, document.body);
};

export default MeetingRoomPage;
