const db = require("../../db/knex");
const crypto = require("crypto");
const jwt = require("jsonwebtoken");

const SCHEDULED_START_GRACE_MINUTES = 60;

const addMinutes = (date, minutes) =>
  new Date(date.getTime() + minutes * 60 * 1000);

const canStartScheduledMeeting = (meeting) => {
  const scheduledAt = new Date(meeting?.scheduled_at);
  if (Number.isNaN(scheduledAt.getTime())) return false;
  return new Date() <= addMinutes(scheduledAt, SCHEDULED_START_GRACE_MINUTES);
};

const isAno = (user = {}) => String(user.role || "").toUpperCase() === "ANO";

const isSuo = (user = {}) =>
  String(user.role || "").toUpperCase() === "CADET" &&
  String(user.rank || "").trim().toLowerCase() === "senior under officer";

const isAuthorityUser = (user = {}) => isAno(user) || isSuo(user);

const isInvitedUser = (meeting = {}, user = {}) => {
  if (isAno(user)) return true;

  const inviteUserIds = Array.isArray(meeting.invite_user_ids)
    ? meeting.invite_user_ids.map((id) => Number(id))
    : [];

  return inviteUserIds.includes(Number(user.user_id));
};

const normalizePrivateKey = (value = "") =>
  String(value || "")
    .replace(/\\n/g, "\n")
    .trim();

const getJitsiEnv = () => {
  const appId = String(process.env.JITSI_APP_ID || "").trim();
  const keyId = String(process.env.JITSI_KEY_ID || "").trim();
  const privateKey = normalizePrivateKey(process.env.JITSI_PRIVATE_KEY || "");

  if (!appId || !keyId || !privateKey) {
    throw new Error(
      "Jitsi configuration missing. Set JITSI_APP_ID, JITSI_KEY_ID, and JITSI_PRIVATE_KEY in backend/.env."
    );
  }

  return { appId, keyId, privateKey };
};

const resolveMeetingRoomAccess = async (meetingId, user) => {
  const { college_id, user_id } = user;

  const meeting = await db("meetings")
    .where({
      meeting_id: meetingId,
      college_id,
    })
    .whereNull("deleted_at")
    .first();

  if (!meeting) {
    throw new Error("Meeting not found");
  }

  if (meeting.status !== "LIVE") {
    throw new Error("Meeting is not live");
  }

  if (!isInvitedUser(meeting, user)) {
    throw new Error("Forbidden");
  }

  const isHost = Number(meeting.created_by_user_id) === Number(user_id);
  if (isHost || isAuthorityUser(user)) {
    return { meeting, isHost };
  }

  const activeSession = await db("meeting_participant_sessions")
    .where({
      meeting_id: meetingId,
      user_id,
    })
    .whereNull("leave_time")
    .first();

  if (activeSession) {
    return { meeting, isHost: false };
  }

  const admitted = await db("meeting_waiting_room")
    .where({
      meeting_id: meetingId,
      user_id,
      status: "ADMITTED",
    })
    .first();

  if (!admitted) {
    throw new Error("User is not admitted to this meeting room");
  }

  return { meeting, isHost: false };
};

const generateRoomName = (collegeShortName) => {
  const timestamp = Date.now();
  const randomHex = crypto.randomBytes(2).toString("hex");

  return `${collegeShortName.toLowerCase()}-${timestamp}-${randomHex}`;
};

const createMeeting = async (data, user) => {
  const { title, description, scheduled_at } = data;
  const { user_id, college_id } = user;
  const inviteUserIds = Array.isArray(data?.invite_user_ids)
    ? data.invite_user_ids.map((id) => Number(id)).filter((id) => Number.isInteger(id) && id > 0)
    : [];
  const normalizedInviteUserIds = [...new Set([user_id, ...inviteUserIds])];

  // Get college short name
  const college = await db("colleges")
    .select("short_name")
    .where({ college_id })
    .first();

  if (!college) {
    throw new Error("College not found");
  }

  const roomName = generateRoomName(college.short_name);

  const [meeting] = await db("meetings")
    .insert({
      college_id,
      title,
      description: description || null,
      scheduled_at,
      created_by_user_id: user_id,
      jitsi_room_name: roomName,
      invite_user_ids: normalizedInviteUserIds,
    })
    .returning("*");

  return meeting;
};

const getMeetingById = async (meetingId, user) => {
  const { college_id } = user;

  const meeting = await db("meetings")
    .leftJoin("users as cu", "cu.user_id", "meetings.created_by_user_id")
    .leftJoin("cadet_profiles as ccp", "ccp.user_id", "cu.user_id")
    .leftJoin("cadet_ranks as cr", "cr.id", "ccp.rank_id")
    .where({
      "meetings.meeting_id": meetingId,
      "meetings.college_id": college_id,
    })
    .whereNull("meetings.deleted_at")
    .select(
      "meetings.*",
      "cu.username as created_by_name",
      "cu.role as created_by_role",
      "cr.rank_name as created_by_rank"
    )
    .first();

  if (!meeting) {
    throw new Error("Meeting not found");
  }

  const participants = await db("meeting_participant_sessions as s")
    .leftJoin("users as u", "u.user_id", "s.user_id")
    .leftJoin("cadet_profiles as cp", "cp.user_id", "u.user_id")
    .where("s.meeting_id", meetingId)
    .orderBy("s.join_time", "asc")
    .select(
      "s.session_id",
      "s.meeting_id",
      "s.user_id",
      "s.join_time",
      "s.leave_time",
      "cp.full_name",
      "u.username",
      "u.role"
    );

  const normalizedParticipants = participants.map((row) => ({
    ...row,
    full_name: row.full_name || row.username || `User #${row.user_id}`,
    role_label:
      Number(row.user_id) === Number(meeting.created_by_user_id)
        ? "HOST"
        : (row.role || "CADET"),
  }));

  return { meeting, participants: normalizedParticipants };
};

const listMeetings = async (user) => {
  const { college_id } = user;

  const meetings = await db("meetings")
    .leftJoin("users as cu", "cu.user_id", "meetings.created_by_user_id")
    .leftJoin("cadet_profiles as ccp", "ccp.user_id", "cu.user_id")
    .leftJoin("cadet_ranks as cr", "cr.id", "ccp.rank_id")
    .where({ "meetings.college_id": college_id })
    .whereNull("meetings.deleted_at")
    .orderBy("meetings.scheduled_at", "desc")
    .select(
      "meetings.*",
      "cu.username as created_by_name",
      "cu.role as created_by_role",
      "cr.rank_name as created_by_rank"
    );

  const now = new Date();

  const ongoing = [];
  const upcoming = [];
  const past = [];

  meetings.forEach((meeting) => {
    if (meeting.status === "LIVE") {
      ongoing.push(meeting);
    } else if (meeting.status === "SCHEDULED") {
      upcoming.push(meeting);
    } else if (meeting.status === "COMPLETED") {
      past.push(meeting);
    }
  });

  return {
    ongoing,
    upcoming,
    past,
  };
};

const startMeeting = async (meetingId, user) => {
  const { user_id, college_id } = user;

  // 1️⃣ Fetch meeting scoped to college
  const meeting = await db("meetings")
    .where({
      meeting_id: meetingId,
      college_id,
    })
    .whereNull("deleted_at")
    .first();

  if (!meeting) {
    throw new Error("Meeting not found");
  }

  if (meeting.status !== "SCHEDULED") {
    throw new Error("Only scheduled meetings can be started");
  }

  if (!canStartScheduledMeeting(meeting)) {
    throw new Error(
      `Meeting start window expired. Meetings can be started up to ${SCHEDULED_START_GRACE_MINUTES} minutes after the scheduled time.`
    );
  }

  // 2️⃣ Update status to LIVE
  const [updatedMeeting] = await db("meetings")
    .where({ meeting_id: meetingId })
    .update({
      status: "LIVE",
      actual_start_time: db.fn.now(),
    })
    .returning("*");

  // 3️⃣ Prevent duplicate host session
  const existingHostSession = await db("meeting_participant_sessions")
    .where({
      meeting_id: meetingId,
      user_id,
    })
    .whereNull("leave_time")
    .first();

  if (!existingHostSession) {
    await db("meeting_participant_sessions").insert({
      meeting_id: meetingId,
      user_id,
      join_time: db.fn.now(),
    });
  }

  return updatedMeeting;
};

const requestToJoin = async (meetingId, user) => {
  const { user_id, college_id } = user;

  // 1️⃣ Validate meeting exists and is LIVE
  const meeting = await db("meetings")
    .where({
      meeting_id: meetingId,
      college_id,
    })
    .whereNull("deleted_at")
    .first();

  if (!meeting) {
    throw new Error("Meeting not found");
  }

  if (meeting.status !== "LIVE") {
    throw new Error("Meeting is not live");
  }

  // 2️⃣ Prevent requesting if already inside meeting
  const activeSession = await db("meeting_participant_sessions")
    .where({
      meeting_id: meetingId,
      user_id,
    })
    .whereNull("leave_time")
    .first();

  if (activeSession) {
    throw new Error("Already in meeting");
  }

  // 3️⃣ Prevent duplicate WAITING request
  const existingWaiting = await db("meeting_waiting_room")
    .where({
      meeting_id: meetingId,
      user_id,
      status: "WAITING",
    })
    .first();

  if (existingWaiting) {
    throw new Error("Already waiting for approval");
  }

  // 4️⃣ Insert new waiting request
  const [waitingRequest] = await db("meeting_waiting_room").insert({
    meeting_id: meetingId,
    user_id,
    status: "WAITING",
  }).returning("*");

  return {
    message: "Join request sent. Waiting for approval.",
    waiting: waitingRequest || null,
  };
};

const getWaitingList = async (meetingId, user) => {
  const { college_id } = user;

  const meeting = await db("meetings")
    .where({ meeting_id: meetingId, college_id })
    .first();

  if (!meeting) {
    throw new Error("Meeting not found");
  }

  const waitingUsers = await db("meeting_waiting_room as wr")
    .join("users as u", "wr.user_id", "u.user_id")
    .leftJoin("cadet_profiles as cp", "cp.user_id", "u.user_id")
    .leftJoin("cadet_ranks as r", "cp.rank_id", "r.id")
    .where("wr.meeting_id", meetingId)
    .andWhere("wr.status", "WAITING")
    .select(
      "wr.waiting_id",
      "wr.request_time",
      "u.user_id",
      "cp.full_name",
      "r.rank_name"
    );

  return waitingUsers;
};

const admitUser = async (meetingId, waitingId, user) => {
  const { college_id } = user;

  // 1️⃣ Validate meeting exists and is LIVE
  const meeting = await db("meetings")
    .where({ meeting_id: meetingId, college_id })
    .first();

  if (!meeting || meeting.status !== "LIVE") {
    throw new Error("Meeting not live or not found");
  }

  // 2️⃣ Validate waiting entry
  const waitingEntry = await db("meeting_waiting_room")
    .where({ waiting_id: waitingId, meeting_id: meetingId })
    .first();

  if (!waitingEntry || waitingEntry.status !== "WAITING") {
    throw new Error("Invalid waiting request");
  }

  // 3️⃣ Update waiting status to ADMITTED
  await db("meeting_waiting_room")
    .where({ waiting_id: waitingId })
    .update({
      status: "ADMITTED",
      updated_at: db.fn.now(),
    });

  // 4️⃣ Prevent duplicate active session (race condition protection)
  const existingSession = await db("meeting_participant_sessions")
    .where({
      meeting_id: meetingId,
      user_id: waitingEntry.user_id,
    })
    .whereNull("leave_time")
    .first();

  if (!existingSession) {
    await db("meeting_participant_sessions").insert({
      meeting_id: meetingId,
      user_id: waitingEntry.user_id,
      join_time: db.fn.now(),
    });
  }

  return {
    message: "User admitted successfully",
    waitingId: Number(waitingId),
    userId: Number(waitingEntry.user_id),
  };
};

const rejectUser = async (meetingId, waitingId, user) => {
  const { college_id } = user;

  const meeting = await db("meetings")
    .where({ meeting_id: meetingId, college_id })
    .first();

  if (!meeting) {
    throw new Error("Meeting not found");
  }

  const waitingEntry = await db("meeting_waiting_room")
    .where({ waiting_id: waitingId, meeting_id: meetingId })
    .first();

  if (!waitingEntry || waitingEntry.status !== "WAITING") {
    throw new Error("Invalid waiting request");
  }

  await db("meeting_waiting_room")
    .where({ waiting_id: waitingId })
    .update({
      status: "REJECTED",
      updated_at: db.fn.now(),
    });

  return {
    message: "User rejected successfully",
    waitingId: Number(waitingId),
    userId: Number(waitingEntry.user_id),
  };
};

const endMeeting = async (meetingId, user) => {
  const { college_id } = user;

  return await db.transaction(async (trx) => {
    const meeting = await trx("meetings")
      .where({ meeting_id: meetingId, college_id })
      .first();

    if (!meeting || meeting.status !== "LIVE") {
      throw new Error("Meeting not live or not found");
    }

    // 🔒 Prevent double-ending
    const existingReport = await trx("meeting_reports")
      .where({ meeting_id: meetingId })
      .first();

    if (existingReport) {
      throw new Error("Meeting already ended");
    }

    if (!meeting.actual_start_time) {
      throw new Error("Meeting start time missing");
    }

    const endTime = new Date();
    const startTime = new Date(meeting.actual_start_time);

    if (endTime <= startTime) {
      throw new Error("Invalid meeting duration");
    }

    const totalMeetingDuration =
      (endTime - startTime) / (1000 * 60);

    // Close open sessions
    await trx("meeting_participant_sessions")
      .where({ meeting_id: meetingId })
      .whereNull("leave_time")
      .update({
        leave_time: endTime,
      });

    // Update meeting status
    await trx("meetings")
      .where({ meeting_id: meetingId })
      .update({
        status: "COMPLETED",
        actual_end_time: endTime,
      });

    const sessions = await trx("meeting_participant_sessions")
      .where({ meeting_id: meetingId });

    const userMap = {};

    sessions.forEach((session) => {
      const uid = session.user_id;

      if (!userMap[uid]) {
        userMap[uid] = {
          totalMinutes: 0,
          firstJoin: session.join_time,
        };
      }

      const joinTime = new Date(session.join_time);
      const leaveTime = new Date(session.leave_time);

      if (!leaveTime || leaveTime <= joinTime) return;

      const duration = (leaveTime - joinTime) / (1000 * 60);
      userMap[uid].totalMinutes += duration;

      if (joinTime < new Date(userMap[uid].firstJoin)) {
        userMap[uid].firstJoin = joinTime;
      }
    });

    const hostUserId = Number(meeting.created_by_user_id);
    const invitedUserIds = Array.isArray(meeting.invite_user_ids)
      ? meeting.invite_user_ids.map((id) => Number(id)).filter((id) => Number.isInteger(id) && id > 0)
      : [];
    const nonHostSessionUserIds = Object.keys(userMap)
      .map((id) => Number(id))
      .filter((id) => Number.isInteger(id) && id > 0 && id !== hostUserId);

    const nonHostInvitedUserIds =
      invitedUserIds.length > 0
        ? [...new Set(invitedUserIds.filter((id) => id !== hostUserId))]
        : [...new Set(nonHostSessionUserIds)];
    const hostStats = userMap[String(hostUserId)] || null;

    let totalPresent = 0;
    let lateCount = 0;
    let totalDurationSum = 0;

    for (const invitedUserId of nonHostInvitedUserIds) {
      const stats = userMap[String(invitedUserId)] || {
        totalMinutes: 0,
        firstJoin: null,
      };

      const percentage =
        totalMeetingDuration > 0
          ? (stats.totalMinutes / totalMeetingDuration) * 100
          : 0;

      const isPresent = percentage >= 60;
      const wasLate = stats.firstJoin
        ? (new Date(stats.firstJoin) - startTime) / (1000 * 60) > 10
        : false;

      if (isPresent) totalPresent++;
      if (wasLate) lateCount++;

      totalDurationSum += stats.totalMinutes;

      await trx("meeting_attendance").insert({
        meeting_id: meetingId,
        user_id: invitedUserId,
        total_duration_minutes: Math.round(stats.totalMinutes),
        percentage_attended: percentage.toFixed(2),
        attendance_status: isPresent ? "PRESENT" : "ABSENT",
        was_late: wasLate,
      });
    }

    // Keep host in attendance details, but do not count host in invite attendance percentage.
    if (hostStats) {
      const hostPercentage =
        totalMeetingDuration > 0
          ? (hostStats.totalMinutes / totalMeetingDuration) * 100
          : 0;
      const hostWasLate =
        (new Date(hostStats.firstJoin) - startTime) / (1000 * 60) > 10;

      await trx("meeting_attendance").insert({
        meeting_id: meetingId,
        user_id: hostUserId,
        total_duration_minutes: Math.round(hostStats.totalMinutes),
        percentage_attended: hostPercentage.toFixed(2),
        attendance_status: hostPercentage >= 60 ? "PRESENT" : "ABSENT",
        was_late: hostWasLate,
      });
    }

    const totalParticipants = nonHostInvitedUserIds.length;
    const totalAbsent = Math.max(0, totalParticipants - totalPresent);

    const attendancePercentage =
      totalParticipants > 0
        ? (totalPresent / totalParticipants) * 100
        : 0;

    const avgDuration =
      totalParticipants > 0
        ? totalDurationSum / totalParticipants
        : 0;

    await trx("meeting_reports").insert({
      meeting_id: meetingId,
      total_invited: totalParticipants,
      total_present: totalPresent,
      total_absent: totalAbsent,
      late_count: lateCount,
      attendance_percentage:
        attendancePercentage.toFixed(2),
      average_duration_minutes:
        avgDuration.toFixed(2),
    });

    return {
      message:
        "Meeting ended and report generated successfully",
    };
  });
};

const getMeetingReport = async (meetingId, user) => {
  const { college_id, user_id } = user;

  const meeting = await db("meetings")
    .where({ meeting_id: meetingId, college_id })
    .first();

  if (!meeting || meeting.status !== "COMPLETED") {
    throw new Error("Meeting report not available");
  }

  const invitedUserIds = Array.isArray(meeting.invite_user_ids)
    ? meeting.invite_user_ids.map((id) => Number(id))
    : [];

  const isHost = Number(meeting.created_by_user_id) === Number(user_id);
  const isInvited = invitedUserIds.includes(Number(user_id));

  if (!isHost && !isInvited) {
    throw new Error("Forbidden");
  }

  const report = await db("meeting_reports")
    .where({ meeting_id: meetingId })
    .first();

  const attendance = await db("meeting_attendance as ma")
    .join("users as u", "ma.user_id", "u.user_id")
    .leftJoin("cadet_profiles as cp", "cp.user_id", "u.user_id")
    .leftJoin("cadet_ranks as r", "cp.rank_id", "r.id")
    .where("ma.meeting_id", meetingId)
    .select(
      "ma.user_id",
      "u.username",
      "u.role",
      "cp.full_name",
      "r.rank_name",
      "ma.total_duration_minutes",
      "ma.percentage_attended",
      "ma.attendance_status",
      "ma.was_late"
    );

  const normalizedAttendance = attendance.map((row) => {
    const isHost = Number(row.user_id) === Number(meeting.created_by_user_id);
    return {
      ...row,
      full_name: row.full_name || row.username || `User #${row.user_id}`,
      rank_name: isHost ? "HOST" : (row.rank_name || row.role || "CADET"),
    };
  });

  return {
    meeting,
    report,
    attendance: normalizedAttendance,
  };
};

const leaveMeeting = async (meetingId, user) => {
  const { user_id, college_id } = user;

  // 1️⃣ Validate meeting
  const meeting = await db("meetings")
    .where({ meeting_id: meetingId, college_id })
    .first();

  if (!meeting || meeting.status !== "LIVE") {
    throw new Error("Meeting not live or not found");
  }

  // 2️⃣ Find active session (leave_time is NULL)
  const activeSession = await db("meeting_participant_sessions")
    .where({
      meeting_id: meetingId,
      user_id,
    })
    .whereNull("leave_time")
    .orderBy("join_time", "desc")
    .first();

  if (!activeSession) {
    throw new Error("No active session found");
  }

  // 3️⃣ Update leave_time
  await db("meeting_participant_sessions")
    .where({ session_id: activeSession.session_id })
    .update({
      leave_time: db.fn.now(),
    });

  return { message: "Left meeting successfully" };
};

const deleteMeeting = async (meetingId, user) => {
  const { college_id } = user;

  const meeting = await db("meetings")
    .where({ meeting_id: meetingId, college_id })
    .whereNull("deleted_at")
    .first();

  if (!meeting) {
    throw new Error("Meeting not found");
  }

  if (meeting.status === "LIVE") {
    throw new Error("Live meetings cannot be deleted");
  }

  const [deletedMeeting] = await db("meetings")
    .where({ meeting_id: meetingId, college_id })
    .whereNull("deleted_at")
    .update({
      deleted_at: db.fn.now(),
      updated_at: db.fn.now(),
    })
    .returning("*");

  return deletedMeeting || meeting;
};

const generateJitsiToken = async (meetingId, user) => {
  const { appId, keyId, privateKey } = getJitsiEnv();
  const { meeting, isHost } = await resolveMeetingRoomAccess(meetingId, user);

  const now = Math.floor(Date.now() / 1000);
  const expiresAt = now + 60 * 15;
  const moderator = isHost || isAuthorityUser(user);
  const userName =
    String(user.name || user.username || "").trim() ||
    `User ${user.user_id}`;

  const token = jwt.sign(
    {
      aud: "jitsi",
      iss: "chat",
      sub: appId,
      room: "*",
      nbf: now - 5,
      exp: expiresAt,
      context: {
        user: {
          id: String(user.user_id),
          name: userName,
          moderator,
        },
        features: {
          livestreaming: true,
          recording: true,
          transcription: true,
          "outbound-call": true,
        },
      },
    },
    privateKey,
    {
      algorithm: "RS256",
      header: {
        kid: `${appId}/${keyId}`,
        typ: "JWT",
      },
    }
  );

  return {
    token,
    roomName: meeting.jitsi_room_name,
    appId,
    expiresAt,
  };
};

module.exports = {
  createMeeting,
  getMeetingById,
  listMeetings,
  startMeeting,
  requestToJoin,
  getWaitingList,
  admitUser,
  rejectUser,
  leaveMeeting,
  deleteMeeting,
  endMeeting,
  getMeetingReport,
  generateJitsiToken,
};
