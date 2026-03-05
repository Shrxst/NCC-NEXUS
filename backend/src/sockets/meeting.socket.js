const db = require("../db/knex");

const HOST_GRACE_MS = 60 * 1000;
const hostSocketPresence = new Map(); // meetingId -> Set(socketId)
const hostDisconnectedState = new Map(); // meetingId -> boolean

const toMeetingId = (value) => Number(value);
const meetingRoomKey = (meetingId) => `meeting_${meetingId}`;
const isPositiveInt = (value) => Number.isInteger(value) && value > 0;

async function getMeeting(meetingId) {
  return db("meetings")
    .select("meeting_id", "status", "created_by_user_id")
    .where({ meeting_id: meetingId })
    .whereNull("deleted_at")
    .first();
}

function addHostSocketPresence(meetingId, socketId) {
  const key = String(meetingId);
  if (!hostSocketPresence.has(key)) {
    hostSocketPresence.set(key, new Set());
  }
  hostSocketPresence.get(key).add(socketId);
}

function removeHostSocketPresence(meetingId, socketId) {
  const key = String(meetingId);
  const set = hostSocketPresence.get(key);
  if (!set) return 0;

  set.delete(socketId);
  if (!set.size) {
    hostSocketPresence.delete(key);
    return 0;
  }

  return set.size;
}

function emitHostDisconnected(io, meeting) {
  const meetingId = Number(meeting.meeting_id);
  const key = String(meetingId);

  if (hostDisconnectedState.get(key)) return;

  hostDisconnectedState.set(key, true);

  io.to(meetingRoomKey(meetingId)).emit("meeting:host_disconnected", {
    meetingId,
    hostUserId: Number(meeting.created_by_user_id),
    graceSeconds: Math.floor(HOST_GRACE_MS / 1000),
    deadlineAt: Date.now() + HOST_GRACE_MS,
  });
}

function emitHostReconnected(io, meetingId, hostUserId) {
  const key = String(meetingId);
  if (!hostDisconnectedState.get(key)) return;

  hostDisconnectedState.set(key, false);

  io.to(meetingRoomKey(meetingId)).emit("meeting:host_reconnected", {
    meetingId: Number(meetingId),
    hostUserId: Number(hostUserId),
  });
}

const initMeetingSocket = (io) => {
  io.on("connection", (socket) => {
    socket.data.meetingRooms = socket.data.meetingRooms || new Set();

    socket.on("meeting:joinRoom", async ({ meetingId }) => {
      const id = toMeetingId(meetingId);
      if (!isPositiveInt(id)) return;

      socket.join(meetingRoomKey(id));
      socket.data.meetingRooms.add(id);

      const userId = Number(socket.data?.chatUser?.userId || 0);
      if (!isPositiveInt(userId)) return;

      try {
        const meeting = await getMeeting(id);
        if (!meeting || meeting.status !== "LIVE") return;
        if (Number(meeting.created_by_user_id) !== userId) return;

        addHostSocketPresence(id, socket.id);
        emitHostReconnected(io, id, userId);
      } catch (error) {
        console.error("meeting:joinRoom handler failed:", error);
      }
    });

    socket.on("meeting:leaveRoom", async ({ meetingId }) => {
      const id = toMeetingId(meetingId);
      if (!isPositiveInt(id)) return;

      socket.leave(meetingRoomKey(id));
      socket.data.meetingRooms.delete(id);

      const userId = Number(socket.data?.chatUser?.userId || 0);
      if (!isPositiveInt(userId)) return;

      try {
        const meeting = await getMeeting(id);
        if (!meeting || meeting.status !== "LIVE") return;
        if (Number(meeting.created_by_user_id) !== userId) return;

        const remainingHostSockets = removeHostSocketPresence(id, socket.id);
        if (remainingHostSockets === 0) {
          emitHostDisconnected(io, meeting);
        }
      } catch (error) {
        console.error("meeting:leaveRoom handler failed:", error);
      }
    });

    socket.on("disconnect", async () => {
      try {
        const joinedMeetingRooms = Array.from(socket.data.meetingRooms || []);
        const userId = Number(socket.data?.chatUser?.userId || 0);

        if (!isPositiveInt(userId)) return;

        for (const id of joinedMeetingRooms) {
          const meeting = await getMeeting(id);
          if (!meeting || meeting.status !== "LIVE") continue;
          if (Number(meeting.created_by_user_id) !== userId) continue;

          const remainingHostSockets = removeHostSocketPresence(id, socket.id);
          if (remainingHostSockets === 0) {
            emitHostDisconnected(io, meeting);
          }
        }
      } catch (error) {
        console.error("Meeting socket disconnect handler failed:", error);
      }
    });
  });
};

module.exports = { initMeetingSocket };
