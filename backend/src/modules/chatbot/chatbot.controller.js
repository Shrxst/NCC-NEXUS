const service = require("./chatbot.service");

const getChatHistory = async (req, res) => {
  try {
    const userId = Number(req.chatUser?.userId);
    if (!Number.isInteger(userId) || userId <= 0) {
      return res.status(401).json({ message: "Unauthorized user context." });
    }

    const rows = await service.getHistory({ userId });
    return res.status(200).json(rows);
  } catch (error) {
    const status = Number(error.status || 500);
    return res.status(status).json({
      message: status === 500 ? "Internal Server Error" : error.message,
    });
  }
};

const sendChatMessage = async (req, res) => {
  try {
    const userId = Number(req.chatUser?.userId);
    const role = req.chatUser?.role;
    if (!Number.isInteger(userId) || userId <= 0) {
      return res.status(401).json({ message: "Unauthorized user context." });
    }

    const payload = await service.sendMessage({
      userId,
      role,
      prompt: req.body?.message,
    });

    return res.status(201).json(payload);
  } catch (error) {
    const status = Number(error.status || 500);
    return res.status(status).json({
      message: status === 500 ? "Internal Server Error" : error.message,
    });
  }
};

module.exports = {
  getChatHistory,
  sendChatMessage,
};
