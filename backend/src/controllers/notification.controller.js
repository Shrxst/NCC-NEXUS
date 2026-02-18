const db = require("../db/knex");

/* =============================
   GET USER NOTIFICATIONS
============================= */
const getNotifications = async (req, res) => {
  try {
    const { user_id } = req.user;

    const notifications = await db("notifications")
      .where({ user_id })
      .orderBy("created_at", "desc")
      .limit(50);

    res.json(notifications);
  } catch (err) {
    console.error("Get Notifications Error:", err);
    res.status(500).json({ message: "Server Error" });
  }
};

/* =============================
   MARK AS READ
============================= */
const markAsRead = async (req, res) => {
  try {
    const { notification_id } = req.params;
    const { user_id } = req.user;

    await db("notifications")
      .where({ notification_id, user_id })
      .update({ is_read: true });

    res.json({ message: "Marked as read" });
  } catch (err) {
    res.status(500).json({ message: "Server Error" });
  }
};

module.exports = {
  getNotifications,
  markAsRead,
};
