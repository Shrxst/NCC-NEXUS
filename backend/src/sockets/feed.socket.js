const jwt = require("jsonwebtoken");
const db = require("../db/knex");

async function parseFeedUser(socket) {
  const auth = socket.handshake.auth || {};
  const headers = socket.handshake.headers || {};

  const bearer = headers.authorization;
  const token =
    auth.token ||
    (typeof bearer === "string" && bearer.startsWith("Bearer ")
      ? bearer.slice(7)
      : null);

  if (!token) {
    throw new Error("Missing token.");
  }

  const decoded = jwt.verify(token, process.env.JWT_SECRET);

  // 🔥 Fetch college_id from DB
  const user = await db("users")
    .where({ user_id: decoded.user_id })
    .select("college_id")
    .first();

  if (!user) throw new Error("User not found.");

  return {
    userId: decoded.user_id,
    role: decoded.role,
    collegeId: user.college_id,
  };
}

function initFeedSocket(io) {
  io.of("/feed").use(async (socket, next) => {
    try {
      socket.data.user = await parseFeedUser(socket);
      next();
    } catch (err) {
      next(new Error("Feed socket auth failed."));
    }
  });

  io.of("/feed").on("connection", (socket) => {
    const user = socket.data.user;

    const collegeRoom = `feed:college:${user.collegeId}`;

    socket.join(collegeRoom);

    socket.emit("feed:connected", {
      user_id: user.userId,
      role: user.role,
      college_id: user.collegeId,
    });

    socket.on("disconnect", () => {});
  });
}

module.exports = {
  initFeedSocket,
};
