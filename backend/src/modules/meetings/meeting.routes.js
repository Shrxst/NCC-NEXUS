const express = require("express");
const router = express.Router();

const { authenticate } = require("../../middlewares/auth.middleware");
const {
  requireMeetingAuthority,
  requireMeetingManager,
} = require("../../middlewares/meetingAuth.middleware");

const meetingController = require("./meeting.controller");

// Create Meeting
router.post(
  "/",
  authenticate,
  requireMeetingAuthority,
  meetingController.createMeeting
);

// List Meetings (college scoped)
router.get(
  "/",
  authenticate,
  meetingController.listMeetings
);

// Get Meeting Details + Participants
router.get(
  "/:meetingId",
  authenticate,
  meetingController.getMeetingById
);

router.get(
  "/:meetingId/jitsi-token",
  authenticate,
  meetingController.getJitsiToken
);

// Start Meeting
router.patch(
  "/:meetingId/start",
  authenticate,
  requireMeetingManager,
  meetingController.startMeeting
);

// Join Meeting (Request Entry)
router.post(
  "/:meetingId/join",
  authenticate,
  meetingController.requestToJoin
);

// Get Waiting List (Host view)
router.get(
  "/:meetingId/waiting",
  authenticate,
  requireMeetingManager,
  meetingController.getWaitingList
);

// Admit User
router.patch(
  "/:meetingId/admit/:waitingId",
  authenticate,
  requireMeetingManager,
  meetingController.admitUser
);

// Reject User
router.patch(
  "/:meetingId/reject/:waitingId",
  authenticate,
  requireMeetingManager,
  meetingController.rejectUser
);

// End Meeting
router.patch(
  "/:meetingId/end",
  authenticate,
  requireMeetingManager,
  meetingController.endMeeting
);

// Get Meeting Report
router.get(
  "/:meetingId/report",
  authenticate,
  meetingController.getMeetingReport
);

// Leave Meeting
router.patch(
  "/:meetingId/leave",
  authenticate,
  meetingController.leaveMeeting
);

// Delete Meeting
router.delete(
  "/:meetingId",
  authenticate,
  requireMeetingManager,
  meetingController.deleteMeeting
);

module.exports = router;
