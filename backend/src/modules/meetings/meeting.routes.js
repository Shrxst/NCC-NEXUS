const express = require("express");
const router = express.Router();

const { authenticate } = require("../../middlewares/auth.middleware");
const {
  requireMeetingAuthority,
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

// Start Meeting
router.patch(
  "/:meetingId/start",
  authenticate,
  requireMeetingAuthority,
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
  requireMeetingAuthority,
  meetingController.getWaitingList
);

// Admit User
router.patch(
  "/:meetingId/admit/:waitingId",
  authenticate,
  requireMeetingAuthority,
  meetingController.admitUser
);

// Reject User
router.patch(
  "/:meetingId/reject/:waitingId",
  authenticate,
  requireMeetingAuthority,
  meetingController.rejectUser
);

// End Meeting
router.patch(
  "/:meetingId/end",
  authenticate,
  requireMeetingAuthority,
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

module.exports = router;
