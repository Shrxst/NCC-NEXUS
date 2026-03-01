const db = require("../../db/knex");

const listRecentByUser = async ({ userId, limit = 100 }) =>
  db("chat_messages")
    .where("user_id", userId)
    .orderBy("created_at", "asc")
    .limit(limit)
    .select("id", "user_id", "role", "sender", "message", "provider", "model", "created_at");

const createMessage = async ({
  userId,
  role,
  sender,
  message,
  provider = "huggingface",
  model = null,
}) => {
  const [row] = await db("chat_messages")
    .insert({
      user_id: userId,
      role,
      sender,
      message,
      provider,
      model,
    })
    .returning(["id", "user_id", "role", "sender", "message", "provider", "model", "created_at"]);
  return row;
};

module.exports = {
  listRecentByUser,
  createMessage,
};
