import { useEffect, useState, useRef } from "react";
import { createPortal } from "react-dom";
import { Link, useNavigate, useParams } from "react-router-dom";
import { LogOut, Shield, X } from "lucide-react";
import { useDispatch, useSelector } from "react-redux";

import {
  joinMeeting,
  leaveMeeting,
  setConnectionStatus,
  setCurrentMeeting,
  fetchMeetingById,
  fetchParticipants,
} from "../../store/meetingSlice";

import {
  joinMeetingRoom,
  leaveMeetingRoom,
  bindMeetingSocketEvents,
} from "../../features/ui/socket";

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

import "./meetingModule.css";

const JITSI_DOMAIN = import.meta.env.VITE_JITSI_DOMAIN || "meet.jit.si";
const JITSI_APP_ID = import.meta.env.VITE_JITSI_APP_ID || "";
const JITSI_JWT = import.meta.env.VITE_JITSI_JWT || "";
const JITSI_SCRIPT_URL = `https://${JITSI_DOMAIN}/external_api.js`;
const isJaasDomain = JITSI_DOMAIN.includes("8x8.vc");

const formatTimer = (seconds) => {
  const hh = String(Math.floor(seconds / 3600)).padStart(2, "0");
  const mm = String(Math.floor((seconds % 3600) / 60)).padStart(2, "0");
  const ss = String(seconds % 60).padStart(2, "0");
  return `${hh}:${mm}:${ss}`;
};

const MeetingRoomPage = ({ embedded = false, basePath = "/meetings" }) => {
  const { meetingId: rawMeetingId } = useParams();
  const meetingId = String(rawMeetingId || "").replace(/^:/, "");
  const role = getCurrentRole();
  const currentUser = getCurrentUser();

  const dispatch = useDispatch();
  const navigate = useNavigate();

  const authority = isAuthority(role);

  const meetings = useSelector((state) => state.meetings.meetings);
  const participantsMap = useSelector((state) => state.meetings.participants);
  const admittedUsers =
    useSelector((state) => state.meetings.admittedUsers[meetingId]) || [];
  const waitingRoom =
    useSelector((state) => state.meetings.waitingRoom[meetingId]) || [];
  const isBriefing = useSelector(
    (state) => state.meetings.briefingMode[meetingId] || false
  );

  const meeting = meetings.find((item) => item.id === meetingId);
  const participants = participantsMap[meetingId] || [];

  const [seconds, setSeconds] = useState(0);
  const [activePanel, setActivePanel] = useState(authority ? "controls" : null);
  const [isJitsiScriptReady, setIsJitsiScriptReady] = useState(
    Boolean(window.JitsiMeetExternalAPI)
  );
  const [hostDisconnectedState, setHostDisconnectedState] = useState({
    active: false,
    deadlineAt: null,
  });

  const jitsiContainerRef = useRef(null);
  const jitsiApiRef = useRef(null);
  const initializedMeetingIdRef = useRef(null);

  const isAdmitted = admittedUsers.includes(Number(currentUser.id));
  const hasActiveSession = participants.some(
    (p) => Number(p.userId) === Number(currentUser.id) && !p.leftAt
  );
  const host = meeting ? isMeetingHost(meeting, currentUser.id) : false;
  const canEnterDirectly = authority || host || hasActiveSession;

  useEffect(() => {
    setActivePanel(authority ? "controls" : null);
  }, [authority]);

  useEffect(() => {
    if (window.JitsiMeetExternalAPI) {
      setIsJitsiScriptReady(true);
      return;
    }

    const existingScript = document.querySelector(
      `script[src="${JITSI_SCRIPT_URL}"]`
    );

    const markReady = () => setIsJitsiScriptReady(true);

    if (existingScript) {
      existingScript.addEventListener("load", markReady);
      return () => {
        existingScript.removeEventListener("load", markReady);
      };
    }

    const script = document.createElement("script");
    script.src = JITSI_SCRIPT_URL;
    script.async = true;
    script.addEventListener("load", markReady);
    document.body.appendChild(script);

    return () => {
      script.removeEventListener("load", markReady);
    };
  }, []);

  useEffect(() => {
    if (meetingId) {
      dispatch(fetchMeetingById(meetingId));
      dispatch(fetchParticipants(meetingId));
    }
  }, [dispatch, meetingId]);

  useEffect(() => {
    if (!meeting) return;
    if (!isInvitedToMeeting(meeting, currentUser.id, role)) return;
    if (!canEnterDirectly && !isAdmitted) return;

    dispatch(
      setCurrentMeeting({
        meetingId: meeting.id,
        userId: currentUser.id,
      })
    );

    dispatch(
      joinMeeting({
        meetingId: meeting.id,
        userId: currentUser.id,
      })
    );

    dispatch(setConnectionStatus("CONNECTED"));

    return () => {
      dispatch(
        leaveMeeting({
          meetingId: meeting.id,
          userId: currentUser.id,
        })
      );
      dispatch(setConnectionStatus("DISCONNECTED"));
    };
  }, [meeting, isAdmitted, canEnterDirectly, currentUser.id, dispatch, role]);

  useEffect(() => {
    if (!meeting || meeting.status !== MEETING_STATUS.LIVE) return;

    const timer = setInterval(() => {
      setSeconds((value) => value + 1);
    }, 1000);

    return () => clearInterval(timer);
  }, [meeting]);

  useEffect(() => {
    if (!meetingId) return;

    joinMeetingRoom(meetingId);

    bindMeetingSocketEvents({
      onUserAdmitted: () => {
        dispatch(fetchParticipants(meetingId));
      },

      onUserLeft: () => {
        dispatch(fetchParticipants(meetingId));
      },

      onHostDisconnected: (payload = {}) => {
        if (String(payload.meetingId) !== String(meetingId)) return;
        setHostDisconnectedState({
          active: true,
          deadlineAt: Number(payload.deadlineAt) || Date.now() + 60000,
        });
      },

      onHostReconnected: (payload = {}) => {
        if (String(payload.meetingId) !== String(meetingId)) return;
        setHostDisconnectedState({
          active: false,
          deadlineAt: null,
        });
      },

      onMeetingStarted: () => {
        dispatch(fetchMeetingById(meetingId));
      },

      onMeetingEnded: () => {
        navigate(basePath);
      },
    });

    return () => {
      leaveMeetingRoom(meetingId);
    };
  }, [basePath, dispatch, meetingId, navigate]);

  const hostGraceSeconds =
    hostDisconnectedState.active && hostDisconnectedState.deadlineAt
      ? Math.max(0, Math.ceil((hostDisconnectedState.deadlineAt - Date.now()) / 1000))
      : 0;

  useEffect(() => {
    if (!hostDisconnectedState.active) return undefined;
    const timer = setInterval(() => {
      setHostDisconnectedState((prev) => ({ ...prev }));
    }, 1000);
    return () => clearInterval(timer);
  }, [hostDisconnectedState.active]);

  useEffect(() => {
    if (!meeting?.id || !meeting?.jitsi_room_name || !jitsiContainerRef.current) return;
    if (!isJitsiScriptReady || !window.JitsiMeetExternalAPI) return;

    if (jitsiApiRef.current && initializedMeetingIdRef.current === meeting.id) {
      return;
    }

    if (jitsiApiRef.current) {
      jitsiApiRef.current.dispose();
      jitsiApiRef.current = null;
      initializedMeetingIdRef.current = null;
    }

    const computedRoomName =
      isJaasDomain && JITSI_APP_ID
        ? `${JITSI_APP_ID}/${meeting.jitsi_room_name}`
        : meeting.jitsi_room_name;

    const api = new window.JitsiMeetExternalAPI(JITSI_DOMAIN, {
      roomName: computedRoomName,
      parentNode: jitsiContainerRef.current,
      width: "100%",
      height: "100%",
      jwt: JITSI_JWT || undefined,
      userInfo: {
        displayName: currentUser.name,
      },
      configOverwrite: {
        prejoinPageEnabled: false,
      },
      interfaceConfigOverwrite: {
        SHOW_JITSI_WATERMARK: false,
      },
    });

    const handleJoined = () => {
      dispatch(
        joinMeeting({
          meetingId: meeting.id,
          userId: currentUser.id,
        })
      );
    };

    const handleLeft = () => {
      dispatch(
        leaveMeeting({
          meetingId: meeting.id,
          userId: currentUser.id,
        })
      );
    };

    api.addEventListener("videoConferenceJoined", handleJoined);
    api.addEventListener("videoConferenceLeft", handleLeft);

    jitsiApiRef.current = api;
    initializedMeetingIdRef.current = meeting.id;

    return () => {
      api.removeEventListener("videoConferenceJoined", handleJoined);
      api.removeEventListener("videoConferenceLeft", handleLeft);
      api.dispose();
      if (jitsiApiRef.current === api) {
        jitsiApiRef.current = null;
        initializedMeetingIdRef.current = null;
      }
    };
  }, [meeting?.id, meeting?.jitsi_room_name, currentUser.id, currentUser.name, dispatch, isJitsiScriptReady]);

  if (!meeting) {
    return (
      <div className="meeting-page">
        <div className="meeting-empty">Meeting room not found.</div>
      </div>
    );
  }

  const invited = isInvitedToMeeting(meeting, currentUser.id, role);

  if (!invited) {
    return (
      <div className="meeting-page">
        <div className="meeting-empty">You are not invited to this meeting room.</div>
      </div>
    );
  }

  if (meeting.status !== MEETING_STATUS.LIVE) {
    return (
      <div className="meeting-page">
        <div className="meeting-empty">Join is enabled only when the meeting is LIVE.</div>

        <Link className="meeting-btn meeting-btn-secondary" to={`${basePath}/${meeting.id}`}>
          Back to Details
        </Link>
      </div>
    );
  }

  if (!canEnterDirectly && !isAdmitted) {
    return <WaitingRoomScreen meeting={meeting} basePath={basePath} />;
  }

  const leaveRoom = () => {
    dispatch(
      leaveMeeting({
        meetingId: meeting.id,
        userId: currentUser.id,
      })
    );

    dispatch(setConnectionStatus("DISCONNECTED"));
    navigate(`${basePath}/${meeting.id}`);
  };

  const togglePanel = (panel) => {
    setActivePanel((prev) => (prev === panel ? null : panel));
  };

  const roomUI = (
    <div className="mr-fullscreen">
      {isBriefing && <BriefingBanner active />}

      {hostDisconnectedState.active ? (
        <div className="meeting-host-disconnected-banner">
          Host disconnected. Waiting for reconnection...
          {hostGraceSeconds > 0 ? ` (${hostGraceSeconds}s)` : ""}
        </div>
      ) : null}

      <div className="mr-video-wrap">
        <div className="mr-video">
          <div
            ref={jitsiContainerRef}
            style={{
              width: "100%",
              height: "100%",
              background: "#000",
            }}
          />
        </div>

        {authority && activePanel === "controls" ? (
          <div className="mr-drawer">
            <div className="mr-drawer-header">
              <h3>Host Controls</h3>
              <button className="mr-drawer-close" onClick={() => setActivePanel(null)}>
                <X size={18} />
              </button>
            </div>

            <div className="mr-drawer-body">
                <div className="mr-controls-content">
                <AuthorityControlPanel
                  meeting={meeting}
                  basePath={basePath}
                  canToggleBriefing={host}
                />
                <WaitingRoomPanel meetingId={meeting.id} />
              </div>
            </div>
          </div>
        ) : null}
      </div>

      <div className="mr-toolbar">
        <div className="mr-toolbar-left">
          <span className="mr-meeting-title">{meeting.title}</span>
          <span className="mr-divider" />
          <span className="mr-timer">{formatTimer(seconds)}</span>
        </div>

        <div className="mr-toolbar-center">
          {authority ? (
            <button className="mr-tool-btn" onClick={() => togglePanel("controls")} title="Host Controls">
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

  return createPortal(roomUI, document.body);
};

export default MeetingRoomPage;
