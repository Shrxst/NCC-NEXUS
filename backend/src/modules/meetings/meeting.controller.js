const meetingService = require("./meeting.service");
const {
  validateCreateMeeting,
} = require("./meeting.validation");

const createMeeting = async (req, res) => {
  try {
    const errors = validateCreateMeeting(req.body);

    if (errors.length > 0) {
      return res.status(400).json({
        message: "Validation failed",
        errors,
      });
    }

    const meeting = await meetingService.createMeeting(
      req.body,
      req.user
    );

    return res.status(201).json({
      message: "Meeting created successfully",
      meeting,
    });
  } catch (err) {
    console.error("Create Meeting Error:", err);
    return res.status(500).json({
      message: "Failed to create meeting",
      error: err.message,
    });
  }
};

const getMeetingById = async (req, res) => {
  try {
    const { meetingId } = req.params;
    const data = await meetingService.getMeetingById(meetingId, req.user);

    return res.json({
      message: "Meeting fetched successfully",
      ...data,
    });
  } catch (err) {
    if (err.message === "Meeting not found") {
      return res.status(404).json({ message: err.message });
    }
    return res.status(500).json({
      message: "Failed to fetch meeting",
      error: err.message,
    });
  }
};

const getJitsiToken = async (req, res) => {
  try {
    const { meetingId } = req.params;
    const data = await meetingService.generateJitsiToken(meetingId, req.user);

    return res.json({
      message: "Jitsi token generated successfully",
      ...data,
    });
  } catch (err) {
    if (
      err.message === "Meeting not found" ||
      err.message === "Meeting is not live" ||
      err.message === "Forbidden" ||
      err.message === "User is not admitted to this meeting room"
    ) {
      return res.status(403).json({ message: err.message });
    }

    if (err.message.includes("Jitsi configuration missing")) {
      return res.status(500).json({ message: err.message });
    }

    return res.status(500).json({
      message: "Failed to generate Jitsi token",
      error: err.message,
    });
  }
};

const listMeetings = async (req, res) => {
  try {
    const data = await meetingService.listMeetings(req.user);

    return res.json({
      message: "Meetings fetched successfully",
      ...data,
    });
  } catch (err) {
    console.error("List Meetings Error:", err);
    return res.status(500).json({
      message: "Failed to fetch meetings",
      error: err.message,
    });
  }
};

const startMeeting = async (req, res) => {
  try {
    const { meetingId } = req.params;

    const meeting = await meetingService.startMeeting(
      meetingId,
      req.user
    );

    const io = req.app.locals.io;

    if (io) {
      io.to(`meeting_${meetingId}`).emit("meeting:started", {
        meetingId,
        meeting,
        startedBy: req.user.user_id,
      });
    }

    return res.json({
      message: "Meeting started successfully",
      meeting,
    });
  } catch (err) {
    console.error("Start Meeting Error:", err);

    if (err.message === "Meeting not found") {
      return res.status(404).json({ message: err.message });
    }

    if (err.message.includes("scheduled")) {
      return res.status(400).json({ message: err.message });
    }

    if (err.message.includes("start window expired")) {
      return res.status(400).json({ message: err.message });
    }

    return res.status(500).json({
      message: "Failed to start meeting",
      error: err.message,
    });
  }
};

const requestToJoin = async (req, res) => {
  try {
    const { meetingId } = req.params;

    const result = await meetingService.requestToJoin(
      meetingId,
      req.user
    );

    const io = req.app.locals.io;

    if (io) {
      io.to(`meeting_${meetingId}`).emit("meeting:waiting_request", {
        meetingId,
        userId: req.user.user_id,
        requestedAt: new Date(),
      });
    }

    return res.json(result);
  } catch (err) {
    console.error("Join Request Error:", err);

    if (
      err.message === "Meeting not found" ||
      err.message === "Meeting is not live"
    ) {
      return res.status(400).json({ message: err.message });
    }

    return res.status(500).json({
      message: "Failed to send join request",
      error: err.message,
    });
  }
};

const getWaitingList = async (req, res) => {
  try {
    const { meetingId } = req.params;

    const users = await meetingService.getWaitingList(
      meetingId,
      req.user
    );

    return res.json({ waiting: users });
  } catch (err) {
    return res.status(400).json({ message: err.message });
  }
};

const admitUser = async (req, res) => {
  try {
    const { meetingId, waitingId } = req.params;

    const result = await meetingService.admitUser(
      meetingId,
      waitingId,
      req.user
    );

    const io = req.app.locals.io;

    if (io) {
      io.to(`meeting_${meetingId}`).emit("meeting:user_admitted", {
        meetingId,
        waitingId: result.waitingId || Number(waitingId),
        userId: result.userId,
        admittedBy: req.user.user_id,
      });
    }

    return res.json(result);
  } catch (err) {
    return res.status(400).json({ message: err.message });
  }
};

const rejectUser = async (req, res) => {
  try {
    const { meetingId, waitingId } = req.params;

    const result = await meetingService.rejectUser(
      meetingId,
      waitingId,
      req.user
    );

    const io = req.app.locals.io;

    if (io) {
      io.to(`meeting_${meetingId}`).emit("meeting:user_rejected", {
        meetingId,
        waitingId: result.waitingId || Number(waitingId),
        userId: result.userId,
        rejectedBy: req.user.user_id,
      });
    }

    return res.json(result);
  } catch (err) {
    return res.status(400).json({ message: err.message });
  }
};

const endMeeting = async (req, res) => {
  try {
    const { meetingId } = req.params;

    const result = await meetingService.endMeeting(
      meetingId,
      req.user
    );

    const io = req.app.locals.io;

    if (io) {
      io.to(`meeting_${meetingId}`).emit("meeting:ended", {
        meetingId,
        endedBy: req.user.user_id,
      });
    }

    return res.json(result);
  } catch (err) {
    console.error("End Meeting Error:", err);

    return res.status(400).json({
      message: err.message,
    });
  }
};

const getMeetingReport = async (req, res) => {
  try {
    const { meetingId } = req.params;

    const data = await meetingService.getMeetingReport(
      meetingId,
      req.user
    );

    return res.json(data);
  } catch (err) {
    if (err.message === "Forbidden") {
      return res.status(403).json({ message: err.message });
    }
    if (err.message === "Meeting report not available") {
      return res.status(404).json({ message: err.message });
    }
    return res.status(400).json({
      message: err.message,
    });
  }
};

const leaveMeeting = async (req, res) => {
  try {
    const { meetingId } = req.params;

    const result = await meetingService.leaveMeeting(
      meetingId,
      req.user
    );

    const io = req.app.locals.io;

    if (io) {
      io.to(`meeting_${meetingId}`).emit("meeting:user_left", {
        meetingId,
        userId: req.user.user_id,
      });
    }

    return res.json(result);
  } catch (err) {
    return res.status(400).json({
      message: err.message,
    });
  }
};

const deleteMeeting = async (req, res) => {
  try {
    const { meetingId } = req.params;

    const meeting = await meetingService.deleteMeeting(
      meetingId,
      req.user
    );

    const io = req.app.locals.io;

    if (io) {
      io.to(`meeting_${meetingId}`).emit("meeting:deleted", {
        meetingId,
        deletedBy: req.user.user_id,
      });
    }

    return res.json({
      message: "Meeting deleted successfully",
      meeting,
    });
  } catch (err) {
    console.error("Delete Meeting Error:", err);

    if (err.message === "Meeting not found") {
      return res.status(404).json({ message: err.message });
    }

    if (err.message === "Live meetings cannot be deleted") {
      return res.status(400).json({ message: err.message });
    }

    return res.status(500).json({
      message: "Failed to delete meeting",
      error: err.message,
    });
  }
};

module.exports = {
  createMeeting,
  getMeetingById,
  getJitsiToken,
  listMeetings,
  startMeeting,
  requestToJoin,
  getWaitingList,
  admitUser,
  rejectUser,
  endMeeting,
  getMeetingReport,
  leaveMeeting,
  deleteMeeting,
};
