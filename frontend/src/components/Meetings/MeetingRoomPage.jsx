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
  fetchWaitingList,
} from "../../store/meetingSlice";
import { meetingApi } from "../../api/meetingApi";

import {
  joinMeetingRoom,
  leaveMeetingRoom,
  bindMeetingSocketEvents,
} from "../../features/ui/socket";

import {
  MEETING_STATUS,
  getMeetingTiming,
  canManageMeeting,
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

const DEFAULT_JITSI_DOMAIN = "meet.jit.si";
const CONFIGURED_JITSI_DOMAIN =
  import.meta.env.VITE_JITSI_DOMAIN || DEFAULT_JITSI_DOMAIN;
const JITSI_APP_ID = import.meta.env.VITE_JITSI_APP_ID || "";
const STATIC_JITSI_JWT = import.meta.env.VITE_JITSI_JWT || "";

const decodeJwtPayload = (token) => {
  if (!token) return null;

  try {
    const [, payload = ""] = String(token).split(".");
    const normalized = payload.replace(/-/g, "+").replace(/_/g, "/");
    const padded = normalized.padEnd(
      normalized.length + ((4 - (normalized.length % 4)) % 4),
      "="
    );
    return JSON.parse(window.atob(padded));
  } catch {
    return null;
  }
};

const getUsableJitsiJwt = (token) => {
  if (!token) return "";

  const payload = decodeJwtPayload(token);
  const exp = Number(payload?.exp || 0);
  if (!exp) return token;

  const nowInSeconds = Math.floor(Date.now() / 1000);
  const refreshBufferSeconds = 60;
  return exp > nowInSeconds + refreshBufferSeconds ? token : "";
};

const buildJitsiConfig = (roomName, token = "") => {
  const trimmedRoomName = String(roomName || "").trim();
  const configuredDomain = String(CONFIGURED_JITSI_DOMAIN || DEFAULT_JITSI_DOMAIN).trim();
  const usableJwt = getUsableJitsiJwt(token || STATIC_JITSI_JWT);
  const isConfiguredJaas = configuredDomain.includes("8x8.vc");

  if (isConfiguredJaas && JITSI_APP_ID && usableJwt) {
    return {
      domain: configuredDomain,
      roomName: `${JITSI_APP_ID}/${trimmedRoomName}`,
      jwt: usableJwt,
      usedFallback: false,
    };
  }

  if (isConfiguredJaas && !usableJwt) {
    console.warn(
      "Jitsi JWT is missing or expired. Falling back to meet.jit.si for meeting access."
    );
  }

  return {
    domain: isConfiguredJaas ? DEFAULT_JITSI_DOMAIN : configuredDomain,
    roomName: trimmedRoomName,
    jwt: usableJwt || undefined,
    usedFallback: isConfiguredJaas,
  };
};

const buildFallbackIframeUrl = ({ roomName, displayName }) => {
  const roomPath = encodeURIComponent(String(roomName || "").trim());
  const name = encodeURIComponent(String(displayName || "Guest").trim());
  return `https://${DEFAULT_JITSI_DOMAIN}/${roomPath}#config.prejoinPageEnabled=false&userInfo.displayName="${name}"`;
};

const formatTimer = (seconds) => {
  const hh = String(Math.floor(seconds / 3600)).padStart(2, "0");
  const mm = String(Math.floor((seconds % 3600) / 60)).padStart(2, "0");
  const ss = String(seconds % 60).padStart(2, "0");
  return `${hh}:${mm}:${ss}`;
};

const MeetingRoomPage = ({ embedded = false, basePath = "/meetings", meetingIdProp, onBack, onViewDetails }) => {
  const params = useParams();
  const meetingId = String(meetingIdProp || params.meetingId || "").replace(/^:/, "");
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
  const invited = meeting ? isInvitedToMeeting(meeting, currentUser.id, role) : false;

  const [seconds, setSeconds] = useState(0);
  const [activePanel, setActivePanel] = useState(authority ? "controls" : null);
  const [isJitsiScriptReady, setIsJitsiScriptReady] = useState(
    Boolean(window.JitsiMeetExternalAPI)
  );
  const [hostDisconnectedState, setHostDisconnectedState] = useState({
    active: false,
    deadlineAt: null,
  });
  const [jitsiJwt, setJitsiJwt] = useState("");
  const [isJitsiTokenLoading, setIsJitsiTokenLoading] = useState(false);
  const [hasResolvedJitsiTokenRequest, setHasResolvedJitsiTokenRequest] = useState(false);

  const jitsiContainerRef = useRef(null);
  const jitsiApiRef = useRef(null);
  const initializedMeetingIdRef = useRef(null);
  const jitsiRuntimeConfig = buildJitsiConfig(meeting?.jitsi_room_name, jitsiJwt);
  const jitsiScriptUrl = `https://${jitsiRuntimeConfig.domain}/external_api.js`;
  const fallbackIframeUrl = buildFallbackIframeUrl({
    roomName: meeting?.jitsi_room_name,
    displayName: currentUser.name,
  });

  const isAdmitted = admittedUsers.includes(Number(currentUser.id));
  const hasActiveSession = participants.some(
    (p) => Number(p.userId) === Number(currentUser.id) && !p.leftAt
  );
  const host = meeting ? isMeetingHost(meeting, currentUser.id) : false;
  const canManage = canManageMeeting(meeting, role);
  const canEnterDirectly = authority || host || hasActiveSession;
  const timing = getMeetingTiming(meeting);
  const shouldRequestJitsiToken =
    CONFIGURED_JITSI_DOMAIN.includes("8x8.vc") &&
    Boolean(meeting?.id) &&
    Boolean(meeting?.jitsi_room_name) &&
    invited &&
    meeting?.status === MEETING_STATUS.LIVE &&
    (canEnterDirectly || isAdmitted);
  const isAwaitingSecureToken =
    shouldRequestJitsiToken && !hasResolvedJitsiTokenRequest;

  useEffect(() => {
    setActivePanel(authority && canManage ? "controls" : null);
  }, [authority, canManage]);

  useEffect(() => {
    if (jitsiRuntimeConfig.usedFallback) {
      setIsJitsiScriptReady(false);
      return undefined;
    }

    setIsJitsiScriptReady(false);

    if (window.JitsiMeetExternalAPI) {
      setIsJitsiScriptReady(true);
      return;
    }

    const existingScript = document.querySelector(
      `script[src="${jitsiScriptUrl}"]`
    );

    const markReady = () => setIsJitsiScriptReady(true);

    if (existingScript) {
      existingScript.addEventListener("load", markReady);
      return () => {
        existingScript.removeEventListener("load", markReady);
      };
    }

    const script = document.createElement("script");
    script.src = jitsiScriptUrl;
    script.async = true;
    script.addEventListener("load", markReady);
    document.body.appendChild(script);

    return () => {
      script.removeEventListener("load", markReady);
    };
  }, [jitsiRuntimeConfig.usedFallback, jitsiScriptUrl]);

  useEffect(() => {
    if (meetingId) {
      dispatch(fetchMeetingById(meetingId));
      dispatch(fetchParticipants(meetingId));
    }
  }, [dispatch, meetingId]);

  useEffect(() => {
    if (!shouldRequestJitsiToken) {
      setJitsiJwt("");
      setIsJitsiTokenLoading(false);
      setHasResolvedJitsiTokenRequest(false);
      return undefined;
    }

    let cancelled = false;
    setIsJitsiTokenLoading(true);
    setHasResolvedJitsiTokenRequest(false);

    meetingApi
      .getJitsiToken(meeting.id)
      .then((response) => {
        if (cancelled) return;
        setJitsiJwt(String(response.data?.token || ""));
      })
      .catch((error) => {
        if (cancelled) return;
        console.error("Failed to fetch Jitsi token:", error);
        setJitsiJwt("");
      })
      .finally(() => {
        if (!cancelled) {
          setIsJitsiTokenLoading(false);
          setHasResolvedJitsiTokenRequest(true);
        }
      });

    return () => {
      cancelled = true;
    };
  }, [meeting?.id, shouldRequestJitsiToken]);

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

    if (authority && canManage) {
      dispatch(fetchWaitingList(meetingId));
    }

    joinMeetingRoom(meetingId);

    bindMeetingSocketEvents({
      onWaitingRequest: (payload = {}) => {
        if (!authority || !canManage) return;
        if (String(payload.meetingId) !== String(meetingId)) return;
        dispatch(fetchWaitingList(meetingId));
      },

      onUserAdmitted: (payload = {}) => {
        if (String(payload.meetingId) !== String(meetingId)) return;
        dispatch(fetchParticipants(meetingId));
        if (authority && canManage) {
          dispatch(fetchWaitingList(meetingId));
        }
      },

      onUserRejected: (payload = {}) => {
        if (!authority || !canManage) return;
        if (String(payload.meetingId) !== String(meetingId)) return;
        dispatch(fetchWaitingList(meetingId));
      },

      onUserLeft: (payload = {}) => {
        if (String(payload.meetingId) !== String(meetingId)) return;
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

      onMeetingStarted: (payload = {}) => {
        if (String(payload.meetingId) !== String(meetingId)) return;
        dispatch(fetchMeetingById(meetingId));
      },

      onMeetingEnded: (payload = {}) => {
        if (String(payload.meetingId) !== String(meetingId)) return;
        if (onBack) { onBack(); } else { navigate(basePath); }
      },
    });

    return () => {
      leaveMeetingRoom(meetingId);
    };
  }, [authority, basePath, canManage, dispatch, meetingId, navigate]);

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
    if (jitsiRuntimeConfig.usedFallback) return undefined;
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

    const api = new window.JitsiMeetExternalAPI(jitsiRuntimeConfig.domain, {
      roomName: jitsiRuntimeConfig.roomName,
      parentNode: jitsiContainerRef.current,
      width: "100%",
      height: "100%",
      jwt: jitsiRuntimeConfig.jwt,
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
  }, [
    currentUser.id,
    currentUser.name,
    dispatch,
    isJitsiScriptReady,
    jitsiRuntimeConfig.domain,
    jitsiRuntimeConfig.jwt,
    jitsiRuntimeConfig.roomName,
    meeting?.id,
    meeting?.jitsi_room_name,
  ]);

  if (!meeting) {
    return (
      <div className="meeting-page">
        <div className="meeting-empty">Meeting room not found.</div>
      </div>
    );
  }

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
        <div className="meeting-empty">
          {timing.isMissed
            ? "This meeting was not started within the allowed start window."
            : "Join is enabled only when the meeting is LIVE."}
        </div>

        {onViewDetails ? (
          <button type="button" className="meeting-btn meeting-btn-secondary" onClick={() => onViewDetails(meeting.id)}>
            Back to Details
          </button>
        ) : (
          <Link className="meeting-btn meeting-btn-secondary" to={`${basePath}/${meeting.id}`}>
            Back to Details
          </Link>
        )}
      </div>
    );
  }

  if (isAwaitingSecureToken || (shouldRequestJitsiToken && isJitsiTokenLoading)) {
    return (
      <div className="meeting-page">
        <div className="meeting-empty">Preparing secure meeting access...</div>
      </div>
    );
  }

  if (!canEnterDirectly && !isAdmitted) {
    return <WaitingRoomScreen meeting={meeting} basePath={basePath} onBack={onBack} onJoinRoom={onBack ? () => {} : undefined} />;
  }

  const leaveRoom = () => {
    dispatch(
      leaveMeeting({
        meetingId: meeting.id,
        userId: currentUser.id,
      })
    );

    dispatch(setConnectionStatus("DISCONNECTED"));
    if (onViewDetails) { onViewDetails(meeting.id); } else { navigate(`${basePath}/${meeting.id}`); }
  };

  const togglePanel = (panel) => {
    setActivePanel((prev) => (prev === panel ? null : panel));
  };

  const roomUI = (
    <div className="mr-fullscreen">
      {isBriefing && <BriefingBanner active />}

      {jitsiRuntimeConfig.usedFallback ? (
        <div className="meeting-host-disconnected-banner">
          The configured Jitsi token is expired. Using fallback meeting access.
        </div>
      ) : null}

      {hostDisconnectedState.active ? (
        <div className="meeting-host-disconnected-banner">
          Host disconnected. Waiting for reconnection...
          {hostGraceSeconds > 0 ? ` (${hostGraceSeconds}s)` : ""}
        </div>
      ) : null}

      <div className="mr-video-wrap">
        <div className="mr-video">
          {jitsiRuntimeConfig.usedFallback ? (
            <iframe
              title={`Meeting ${meeting.id}`}
              src={fallbackIframeUrl}
              allow="camera; microphone; fullscreen; display-capture; autoplay"
              style={{
                width: "100%",
                height: "100%",
                border: 0,
                background: "#000",
              }}
            />
          ) : (
            <div
              ref={jitsiContainerRef}
              style={{
                width: "100%",
                height: "100%",
                background: "#000",
              }}
            />
          )}
        </div>

        {authority && canManage && activePanel === "controls" ? (
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
                  onViewDetails={onViewDetails}
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
          {authority && canManage ? (
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
