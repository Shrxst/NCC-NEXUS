const repo = require("./chatbot.repository");
const { generateResponse, CHATBOT_PROVIDER, CHATBOT_MODEL } = require("../../services/bot.service");

const MAX_PROMPT_LEN = 2000;
const HISTORY_LIMIT = 100;
const CONTEXT_WINDOW = 20;

const createError = (status, message) => {
  const err = new Error(message);
  err.status = status;
  return err;
};

const normalizePrompt = (value) => String(value || "").trim();

const mapRole = (role) => {
  const value = String(role || "").toLowerCase();
  if (value === "suo") return "SUO";
  if (value === "ano") return "ANO";
  if (value === "alumni") return "ALUMNI";
  return "CADET";
};

const toFrontendRow = (row) => ({
  id: row.id,
  sender: row.sender,
  message: row.message,
  created_at: row.created_at,
});

const getHistory = async ({ userId }) => {
  const rows = await repo.listRecentByUser({ userId, limit: HISTORY_LIMIT });
  return rows.map(toFrontendRow);
};

const sendMessage = async ({ userId, role, prompt }) => {
  const cleanPrompt = normalizePrompt(prompt);
  if (!cleanPrompt) throw createError(400, "Message is required.");
  if (cleanPrompt.length > MAX_PROMPT_LEN) {
    throw createError(400, `Message exceeds ${MAX_PROMPT_LEN} characters.`);
  }

  const roleLabel = mapRole(role);
  const historyRows = await repo.listRecentByUser({ userId, limit: CONTEXT_WINDOW });
  const context = historyRows.map((item) => ({
    sender: item.sender,
    message: item.message,
  }));

  const userRow = await repo.createMessage({
    userId,
    role: roleLabel,
    sender: "user",
    message: cleanPrompt,
    provider: CHATBOT_PROVIDER,
    model: CHATBOT_MODEL,
  });

  let assistantText;
  try {
    assistantText = await generateResponse({
      userPrompt: cleanPrompt,
      role: roleLabel,
      history: context,
    });
  } catch (error) {
    throw createError(502, error?.message || "Assistant is unavailable. Please retry.");
  }

  const botRow = await repo.createMessage({
    userId,
    role: roleLabel,
    sender: "bot",
    message: assistantText,
    provider: CHATBOT_PROVIDER,
    model: CHATBOT_MODEL,
  });

  return {
    user: toFrontendRow(userRow),
    bot: toFrontendRow(botRow),
  };
};

module.exports = {
  getHistory,
  sendMessage,
};
