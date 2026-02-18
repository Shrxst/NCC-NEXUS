const express = require("express");
const router = express.Router();
const { authenticate } = require("../middlewares/auth.middleware");
const notificationController = require("../controllers/notification.controller");

router.use(authenticate);

router.get("/", notificationController.getNotifications);
router.patch("/:notification_id/read", notificationController.markAsRead);

module.exports = router;
