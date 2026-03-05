const db = require("../../db/knex");

const POLL_NOTIFY_INTERVAL_MS = Number(process.env.POLL_NOTIFY_INTERVAL_MS || 30000);
let pollNotifierTimer = null;
let running = false;

const buildResultSummary = (pollTitle, pollRows) => {
  const normalized = (pollRows || []).map((row) => ({
    option: row.option_text,
    votes: Number(row.votes || 0),
  }));
  const totalVotes = normalized.reduce((sum, row) => sum + row.votes, 0);

  if (!normalized.length) {
    return `Poll ended: ${pollTitle}. No options found.`;
  }

  const winningOption = normalized
    .slice()
    .sort((a, b) => b.votes - a.votes)[0];

  return `Poll ended: ${pollTitle}. Top option "${winningOption.option}" with ${winningOption.votes} vote(s). Total votes: ${totalVotes}.`;
};

const processExpiredPolls = async (io) => {
  if (running) return;
  running = true;
  try {
    const now = db.fn.now();
    const duePolls = await db("community_posts")
      .where("post_type", "POLL")
      .where("status", "APPROVED")
      .whereNotNull("poll_deadline")
      .where("poll_deadline", "<=", now)
      .whereNull("poll_result_notified_at")
      .whereNull("deleted_at")
      .select("community_post_id", "college_id", "title", "content");

    for (const poll of duePolls) {
      const [locked] = await db("community_posts")
        .where({ community_post_id: poll.community_post_id })
        .whereNull("poll_result_notified_at")
        .update({ poll_result_notified_at: db.fn.now() })
        .returning("community_post_id");

      if (!locked) continue;

      const options = await db("community_poll_options as o")
        .leftJoin("community_poll_votes as v", function joinVotes() {
          this.on("v.option_id", "=", "o.option_id").andOn(
            "v.community_post_id",
            "=",
            "o.community_post_id"
          );
        })
        .where("o.community_post_id", poll.community_post_id)
        .select("o.option_text")
        .count("v.user_id as votes")
        .groupBy("o.option_id", "o.option_text");

      const title = poll.title || poll.content || `Poll #${poll.community_post_id}`;
      const message = buildResultSummary(title, options);

      const recipients = await db("users")
        .where({ college_id: poll.college_id })
        .select("user_id");

      if (!recipients.length) continue;

      const notificationRows = recipients.map((user) => ({
        user_id: user.user_id,
        type: "poll_result",
        post_id: poll.community_post_id,
        message,
      }));

      const inserted = await db("notifications").insert(notificationRows).returning("*");

      inserted.forEach((notification) => {
        io.of("/notifications")
          .to(`notifications:user:${notification.user_id}`)
          .emit("notification:new", notification);
      });
    }
  } catch (error) {
    console.error("Community poll notifier error:", error);
  } finally {
    running = false;
  }
};

const startCommunityPollNotifier = (io) => {
  if (pollNotifierTimer) return pollNotifierTimer;
  processExpiredPolls(io);
  pollNotifierTimer = setInterval(() => {
    processExpiredPolls(io);
  }, POLL_NOTIFY_INTERVAL_MS);
  return pollNotifierTimer;
};

module.exports = {
  startCommunityPollNotifier,
};
