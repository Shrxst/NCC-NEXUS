const express = require("express");
const { authenticate } = require("../../../middlewares/auth.middleware");
const controller = require("../controller/quiz.controller");

const router = express.Router();

router.use(authenticate);

router.post("/practice/start", controller.startPractice);
router.post("/mock/:mockTestId/start", controller.startMock);
router.post("/submit", controller.submitQuiz);
router.post("/violation", controller.reportViolation);
router.get("/mock-tests", controller.listMockTests);
router.get("/attempts", controller.listAttempts);
router.get("/attempt/:attemptId", controller.getAttempt);

module.exports = router;
