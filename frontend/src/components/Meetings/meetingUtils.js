export const MEETING_STATUS = {
  SCHEDULED: "SCHEDULED",
  LIVE: "LIVE",
  ENDED: "ENDED",
  COMPLETED: "COMPLETED",
  CANCELLED: "CANCELLED",
};

export const MEETING_TYPES = ["General", "Training", "Briefing"];
export const MEETING_START_GRACE_MINUTES = 60;
export const MISSED_MEETING_DASHBOARD_WINDOW_HOURS = 24;
export const PAST_MEETING_DASHBOARD_WINDOW_DAYS = 7;

export const normalizeRole = (value = "") => {
  const role = String(value).toUpperCase();
  if (role === "SENIOR UNDER OFFICER") return "SUO";
  return role;
};

export const getCurrentRole = () => normalizeRole(localStorage.getItem("role") || "CADET");

const decodeJwtPayload = (token = "") => {
  try {
    const parts = String(token).split(".");
    if (parts.length < 2) return null;
    const base64 = parts[1].replace(/-/g, "+").replace(/_/g, "/");
    const json = decodeURIComponent(
      atob(base64)
        .split("")
        .map((c) => `%${c.charCodeAt(0).toString(16).padStart(2, "0")}`)
        .join("")
    );
    return JSON.parse(json);
  } catch {
    return null;
  }
};

export const getCurrentUser = () => {
  const stored = JSON.parse(localStorage.getItem("user") || "{}");
  const tokenPayload = decodeJwtPayload(localStorage.getItem("token") || "");
  const id = Number(stored.user_id || stored.id || tokenPayload?.user_id || 0);
  const role = getCurrentRole();
  const displayName =
    String(
      stored.name ||
      stored.full_name ||
      stored.username ||
      tokenPayload?.name ||
      tokenPayload?.username ||
      ""
    ).trim() ||
    (stored.email ? String(stored.email).split("@")[0].trim() : "") ||
    (role === "ANO" ? "ANO" : role === "SUO" ? "SUO" : role === "ALUMNI" ? "Alumni" : "Cadet");

  return {
    id,
    name: displayName,
    role,
  };
};

export const isAuthority = (role) => ["ANO", "SUO"].includes(normalizeRole(role));

export const canCreateMeeting = (role) => isAuthority(role);

export const isMeetingHost = (meeting, userId) => Number(meeting?.createdBy) === Number(userId);

export const getMeetingCreatorAuthorityRole = (meeting) => {
  const explicit = normalizeRole(meeting?.createdByAuthorityRole || "");
  if (explicit === "ANO" || explicit === "SUO") return explicit;

  const creatorRole = normalizeRole(meeting?.createdByRole || "");
  const creatorRank = String(meeting?.createdByRank || "").trim().toLowerCase();

  if (creatorRole === "ANO") return "ANO";
  if (creatorRole === "CADET" && creatorRank === "senior under officer") {
    return "SUO";
  }

  return creatorRole;
};

export const canManageMeeting = (meeting, role) => {
  const viewerRole = normalizeRole(role);
  const creatorRole = getMeetingCreatorAuthorityRole(meeting);

  if (viewerRole === "ANO") return creatorRole === "ANO" || creatorRole === "SUO";
  if (viewerRole === "SUO") return creatorRole === "SUO";
  return false;
};

export const isInvitedToMeeting = (meeting, userId, role) => {
  if (!meeting) return false;
  if (normalizeRole(role) === "ANO") return true;
  return (meeting.invitedUserIds || []).some((id) => Number(id) === Number(userId));
};

export const getVisibleMeetings = (meetings, role, userId) => {
  const normalizedRole = normalizeRole(role);

  if (normalizedRole === "ANO") {
    return meetings;
  }

  if (normalizedRole === "SUO") {
    return meetings.filter(
      (meeting) =>
        Number(meeting.createdBy) === Number(userId) ||
        (meeting.invitedUserIds || []).some((id) => Number(id) === Number(userId))
    );
  }

  return meetings.filter((meeting) =>
    (meeting.invitedUserIds || []).some((id) => Number(id) === Number(userId))
  );
};

const parseMeetingDate = (value) => {
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? null : date;
};

const addMinutes = (date, minutes) =>
  new Date(date.getTime() + minutes * 60 * 1000);

const addHours = (date, hours) =>
  new Date(date.getTime() + hours * 60 * 60 * 1000);

const addDays = (date, days) =>
  new Date(date.getTime() + days * 24 * 60 * 60 * 1000);

export const getMeetingTiming = (meeting, now = new Date()) => {
  const scheduledAt = parseMeetingDate(meeting?.dateTime);
  const startedAt = parseMeetingDate(meeting?.startedAt);
  const endedAt = parseMeetingDate(meeting?.endedAt);
  const normalizedStatus = String(meeting?.status || "").toUpperCase();

  const startDeadline =
    normalizedStatus === MEETING_STATUS.SCHEDULED && scheduledAt
      ? addMinutes(scheduledAt, MEETING_START_GRACE_MINUTES)
      : null;

  const isMissed =
    normalizedStatus === MEETING_STATUS.SCHEDULED &&
    Boolean(startDeadline) &&
    now > startDeadline;

  const isPast =
    isMissed ||
    [MEETING_STATUS.ENDED, MEETING_STATUS.COMPLETED, MEETING_STATUS.CANCELLED].includes(
      normalizedStatus
    );

  const pastReference = endedAt || startDeadline || scheduledAt;

  return {
    scheduledAt,
    startedAt,
    endedAt,
    startDeadline,
    isMissed,
    isUpcoming: normalizedStatus === MEETING_STATUS.SCHEDULED && !isMissed,
    isLive: normalizedStatus === MEETING_STATUS.LIVE,
    isPast,
    showOnDashboard:
      normalizedStatus === MEETING_STATUS.LIVE ||
      (normalizedStatus === MEETING_STATUS.SCHEDULED &&
        (!isMissed || (startDeadline && now <= addHours(startDeadline, MISSED_MEETING_DASHBOARD_WINDOW_HOURS)))) ||
      (isPast &&
        pastReference &&
        now <= addDays(pastReference, PAST_MEETING_DASHBOARD_WINDOW_DAYS)),
  };
};

export const canStartScheduledMeeting = (meeting, now = new Date()) => {
  const timing = getMeetingTiming(meeting, now);
  return timing.isUpcoming;
};

export const getDashboardVisibleMeetings = (meetings = [], role, userId, now = new Date()) =>
  getVisibleMeetings(meetings, role, userId).filter((meeting) =>
    getMeetingTiming(meeting, now).showOnDashboard
  );

export const formatMeetingDateTime = (dateTime) => {
  if (!dateTime) return "-";

  const date = new Date(dateTime);
  if (Number.isNaN(date.getTime())) return "-";

  return new Intl.DateTimeFormat("en-US", {
    dateStyle: "medium",
    timeStyle: "short",
  }).format(date);
};

export const getTimeUntil = (dateTime) => {
  if (!dateTime) return "";
  const now = new Date();
  const target = new Date(dateTime);
  const diff = target - now;
  if (diff <= 0) return "";
  const minutes = Math.floor(diff / 60000);
  if (minutes < 60) return `Starts in ${minutes}m`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `Starts in ${hours}h ${minutes % 60}m`;
  const days = Math.floor(hours / 24);
  return `Starts in ${days}d`;
};

export const getMeetingRelativeTimingLabel = (meeting, now = new Date()) => {
  const timing = getMeetingTiming(meeting, now);

  if (timing.isMissed && timing.startDeadline) {
    const overdueMinutes = Math.max(
      1,
      Math.floor((now - timing.startDeadline) / 60000)
    );
    if (overdueMinutes < 60) return `Start window missed by ${overdueMinutes}m`;
    const hours = Math.floor(overdueMinutes / 60);
    return `Start window missed by ${hours}h`;
  }

  return getTimeUntil(meeting?.dateTime);
};

export const getStatusLabel = (status, meeting = null) => {
  const timing = meeting ? getMeetingTiming(meeting) : null;
  if (timing?.isMissed) return "Missed";

  switch (status) {
    case MEETING_STATUS.LIVE:
      return "Live";
    case MEETING_STATUS.COMPLETED:
    case MEETING_STATUS.ENDED:
      return "Completed";
    case MEETING_STATUS.CANCELLED:
      return "Cancelled";
    default:
      return "Scheduled";
  }
};

export const getStatusClass = (status, meeting = null) => {
  const timing = meeting ? getMeetingTiming(meeting) : null;
  if (timing?.isMissed) return "meeting-status-cancelled";

  switch (status) {
    case MEETING_STATUS.LIVE:
      return "meeting-status-live";
    case MEETING_STATUS.COMPLETED:
    case MEETING_STATUS.ENDED:
      return "meeting-status-completed";
    case MEETING_STATUS.CANCELLED:
      return "meeting-status-cancelled";
    default:
      return "meeting-status-scheduled";
  }
};
