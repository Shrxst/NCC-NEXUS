export const MEETING_STATUS = {
  SCHEDULED: "SCHEDULED",
  LIVE: "LIVE",
  ENDED: "ENDED",
  COMPLETED: "ENDED",
  CANCELLED: "CANCELLED",
};

export const MEETING_TYPES = ["General", "Training", "Briefing"];

export const normalizeRole = (value = "") => {
  const role = String(value).toUpperCase();
  if (role === "SENIOR UNDER OFFICER") return "SUO";
  return role;
};

export const getCurrentRole = () => normalizeRole(localStorage.getItem("role") || "CADET");

export const getCurrentUser = () => {
  const stored = JSON.parse(localStorage.getItem("user") || "{}");
  const id = Number(stored.user_id || stored.id || 0);
  const role = getCurrentRole();

  return {
    id,
    name: stored.name || stored.username || "NCC User",
    role,
  };
};

export const isAuthority = (role) => ["ANO", "SUO"].includes(normalizeRole(role));

export const canCreateMeeting = (role) => isAuthority(role);

export const isMeetingHost = (meeting, userId) => Number(meeting?.createdBy) === Number(userId);

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

export const getStatusLabel = (status) => {
  switch (status) {
    case MEETING_STATUS.LIVE:
      return "Live";
    case MEETING_STATUS.ENDED:
      return "Completed";
    case MEETING_STATUS.CANCELLED:
      return "Cancelled";
    default:
      return "Scheduled";
  }
};

export const getStatusClass = (status) => {
  switch (status) {
    case MEETING_STATUS.LIVE:
      return "meeting-status-live";
    case MEETING_STATUS.ENDED:
      return "meeting-status-completed";
    case MEETING_STATUS.CANCELLED:
      return "meeting-status-cancelled";
    default:
      return "meeting-status-scheduled";
  }
};
