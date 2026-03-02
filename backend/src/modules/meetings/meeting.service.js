const db = require("../../db/knex");
const crypto = require("crypto");

const generateRoomName = (collegeShortName) => {
  const timestamp = Date.now();
  const randomHex = crypto.randomBytes(2).toString("hex");

  return `${collegeShortName.toLowerCase()}-${timestamp}-${randomHex}`;
};

const createMeeting = async (data, user) => {
  const { title, description, scheduled_at } = data;
  const { user_id, college_id } = user;

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
    })
    .returning("*");

  return meeting;
};

const listMeetings = async (user) => {
  const { college_id } = user;

  const meetings = await db("meetings")
    .where({ college_id })
    .whereNull("deleted_at")
    .orderBy("scheduled_at", "desc");

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
  await db("meeting_waiting_room").insert({
    meeting_id: meetingId,
    user_id,
    status: "WAITING",
  });

  return {
    message: "Join request sent. Waiting for approval.",
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

  return { message: "User admitted successfully" };
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

  return { message: "User rejected successfully" };
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

    let totalPresent = 0;
    let totalAbsent = 0;
    let lateCount = 0;
    let totalDurationSum = 0;

    for (const userId in userMap) {
      const { totalMinutes, firstJoin } = userMap[userId];

      const percentage =
        totalMeetingDuration > 0
          ? (totalMinutes / totalMeetingDuration) * 100
          : 0;

      const isPresent = percentage >= 60;
      const wasLate =
        (new Date(firstJoin) - startTime) / (1000 * 60) > 10;

      if (isPresent) totalPresent++;
      else totalAbsent++;

      if (wasLate) lateCount++;

      totalDurationSum += totalMinutes;

      await trx("meeting_attendance").insert({
        meeting_id: meetingId,
        user_id: userId,
        total_duration_minutes: Math.round(totalMinutes),
        percentage_attended: percentage.toFixed(2),
        attendance_status: isPresent ? "PRESENT" : "ABSENT",
        was_late: wasLate,
      });
    }

    const totalParticipants = totalPresent + totalAbsent;

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
  const { college_id } = user;

  const meeting = await db("meetings")
    .where({ meeting_id: meetingId, college_id })
    .first();

  if (!meeting || meeting.status !== "COMPLETED") {
    throw new Error("Meeting report not available");
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
      "cp.full_name",
      "r.rank_name",
      "ma.total_duration_minutes",
      "ma.percentage_attended",
      "ma.attendance_status",
      "ma.was_late"
    );

  return {
    meeting,
    report,
    attendance,
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

module.exports = {
  createMeeting,
  listMeetings,
  startMeeting,
  requestToJoin,
  getWaitingList,
  admitUser,
  rejectUser,
  leaveMeeting,
  endMeeting,
  getMeetingReport,
};