const jwt = require("jsonwebtoken");
const db = require("../db/knex");

const authenticate = async (req, res, next) => {
  const authHeader = req.headers.authorization;

  if (!authHeader) {
    return res.status(401).json({ message: "Authorization header missing" });
  }

  if (!authHeader.startsWith("Bearer ")) {
    return res.status(401).json({ message: "Invalid authorization format" });
  }

  const token = authHeader.split(" ")[1];

  try {
    const decoded = jwt.verify(token, process.env.JWT_SECRET);

    // 🔥 Fetch college_id for multi-tenant isolation
    const userRecord = await db("users")
      .select("college_id")
      .where({ user_id: decoded.user_id })
      .first();

    if (!userRecord) {
      return res.status(401).json({ message: "User not found" });
    }

    req.user = {
      ...decoded,
      college_id: userRecord.college_id,
    };

    next();
  } catch (err) {
    return res.status(401).json({ message: "Invalid or expired token" });
  }
};

module.exports = { authenticate };