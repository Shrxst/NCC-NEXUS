const express = require("express");
const chatController = require("../controllers/chat.controller");
const chatbotController = require("../modules/chatbot/chatbot.controller");
const { chatAuth } = require("../middlewares/chatAuth.middleware");

const router = express.Router();

router.use(chatAuth);

// Personal assistant chatbot (Cadet/SUO)
router.get("/", chatbotController.getChatHistory);
router.post("/", chatbotController.sendChatMessage);

// Real-time room chat module
router.get("/users/:userId", chatController.getCollegeUsers);
router.post("/room", chatController.createChatRoom);
router.get("/list/:userId", chatController.getUserChatList);
router.get("/messages/:roomId", chatController.getRoomMessages);
router.post("/message", chatController.sendMessage);
router.patch("/read", chatController.markMessageAsRead);
router.delete("/message/:messageId", chatController.deleteMessage);

module.exports = router;
