const db = require("../db/knex");
const { uploadToCloudinary } = require("../services/cloudinary.service");

/* =============================
   CREATE POST
============================= */
const createPost = async (req, res) => {
  try {
    const { regimental_no } = req.user;
    const { content_text, caption } = req.body;
    const io = req.app.locals.io;

    if (!regimental_no) {
      return res.status(400).json({ message: "Regimental number missing in auth token" });
    }

    let postType = "text";
    let mediaUrl = null;

    if (req.file) {
      const isVideo = req.file.mimetype.startsWith("video");

      const result = await uploadToCloudinary(
        req.file.buffer,
        isVideo ? "ncc-nexus/posts/videos" : "ncc-nexus/posts/images"
      );

      mediaUrl = result.secure_url;
      postType = isVideo ? "video" : "image";
    }

    const normalizedCaption = (content_text ?? caption ?? "").trim();

    const [post] = await db("posts")
      .insert({
        regimental_no,
        post_type: postType,
        caption: normalizedCaption || null,
        media_url: mediaUrl,
      })
      .returning("*");

    const responsePost = {
      ...post,
      content_text: post.caption,
    };

    const user = await db("cadet_profiles")
      .where({ regimental_no })
      .select("college_id")
      .first();

    if (user?.college_id) {
      const collegeRoom = `feed:college:${user.college_id}`;
      io.of("/feed").to(collegeRoom).emit("feed:new_post", responsePost);
    }

    res.status(201).json(responsePost);
  } catch (err) {
    console.error("Create Post Error:", err);
    res.status(500).json({ message: err.message || "Server Error" });
  }
};

/* =============================
   INFINITE SCROLL FEED
============================= */
const getFeed = async (req, res) => {
  try {
    const { regimental_no, user_id } = req.user;
    const { page = 1, limit = 10 } = req.query;

    let effectiveRegimentalNo = regimental_no;

    if (!effectiveRegimentalNo && user_id) {
      const cadet = await db("cadet_profiles")
        .where({ user_id })
        .select("regimental_no")
        .first();

      effectiveRegimentalNo = cadet?.regimental_no;
    }

    if (!effectiveRegimentalNo) {
      return res.status(400).json({ message: "Cadet profile not linked to this account" });
    }

    const pageNum = Math.max(Number.parseInt(page, 10) || 1, 1);
    const limitNum = Math.max(Number.parseInt(limit, 10) || 10, 1);

    const profile = await db("cadet_profiles")
      .where({ regimental_no: effectiveRegimentalNo })
      .select("college_id")
      .first();

    if (!profile) {
      return res.status(404).json({ message: "Profile not found" });
    }

    const posts = await db("posts as p")
      .join("cadet_profiles as cp", "p.regimental_no", "cp.regimental_no")
      .leftJoin("cadet_ranks as r", "cp.rank_id", "r.id")
      .where("cp.college_id", profile.college_id)
      .select("p.*", "cp.full_name", "cp.profile_image_url", "r.rank_name")
      .orderBy("p.created_at", "desc")
      .limit(limitNum)
      .offset((pageNum - 1) * limitNum);

    const normalized = posts.map((post) => ({
      ...post,
      content_text: post.caption,
    }));

    res.json(normalized);
  } catch (err) {
    console.error("Feed Error:", err);
    res.status(500).json({ message: err.message || "Server Error" });
  }
};

/* =============================
   DELETE POST
============================= */
const deletePost = async (req, res) => {
  try {
    const { post_id } = req.params;
    const { regimental_no } = req.user;
    const io = req.app.locals.io;

    const post = await db("posts").where({ post_id, regimental_no }).first();

    if (!post) return res.status(403).json({ message: "Unauthorized" });

    await db("posts").where({ post_id }).del();

    const postData = await db("cadet_profiles")
      .where({ regimental_no })
      .select("college_id")
      .first();

    if (postData?.college_id) {
      const collegeRoom = `feed:college:${postData.college_id}`;
      io.of("/feed").to(collegeRoom).emit("feed:delete_post", { post_id });
    }

    res.json({ message: "Post deleted" });
  } catch (err) {
    console.error("Delete Post Error:", err);
    res.status(500).json({ message: "Server Error" });
  }
};

/* =============================
   VIEW COUNTER
============================= */
const incrementView = async (req, res) => {
  try {
    const { post_id } = req.params;

    const [updated] = await db("posts")
      .where({ post_id })
      .increment("views_count", 1)
      .returning("views_count");

    res.json({
      message: "View counted",
      views_count: Number(updated?.views_count ?? 0),
    });
  } catch (err) {
    res.status(500).json({ message: "Server Error" });
  }
};

/* =============================
   LIKE / UNLIKE
============================= */
const toggleLike = async (req, res) => {
  try {
    const { regimental_no } = req.user;
    const { post_id } = req.params;
    const io = req.app.locals.io;

    const existing = await db("post_likes").where({ post_id, regimental_no }).first();

    if (existing) {
      await db("post_likes").where({ post_id, regimental_no }).del();

      const [updated] = await db("posts")
        .where({ post_id })
        .decrement("likes_count", 1)
        .returning("likes_count");

      const user = await db("cadet_profiles")
        .where({ regimental_no })
        .select("college_id")
        .first();

      if (user?.college_id) {
        const collegeRoom = `feed:college:${user.college_id}`;
        io.of("/feed").to(collegeRoom).emit("feed:like_update", {
          post_id,
          likes_count: updated.likes_count,
        });
      }

      return res.json({ message: "Unliked", likes_count: updated.likes_count });
    }

    await db("post_likes").insert({ post_id, regimental_no });

    const [updated] = await db("posts")
      .where({ post_id })
      .increment("likes_count", 1)
      .returning("*");

    const liker = await db("cadet_profiles")
      .where({ regimental_no })
      .select("college_id", "full_name")
      .first();

    if (liker?.college_id) {
      const collegeRoom = `feed:college:${liker.college_id}`;
      io.of("/feed").to(collegeRoom).emit("feed:like_update", {
        post_id,
        likes_count: updated.likes_count,
      });
    }

    const post = await db("posts").where({ post_id }).first();

    if (post.regimental_no !== regimental_no) {
      const owner = await db("cadet_profiles")
        .where({ regimental_no: post.regimental_no })
        .select("user_id")
        .first();

      if (owner && liker) {
        const [notification] = await db("notifications")
          .insert({
            user_id: owner.user_id,
            type: "like",
            post_id,
            message: `${liker.full_name} liked your post`,
          })
          .returning("*");

        io.of("/notifications")
          .to(`notifications:user:${owner.user_id}`)
          .emit("notification:new", notification);
      }
    }

    res.json({ message: "Liked", likes_count: updated.likes_count });
  } catch (err) {
    console.error("Toggle Like Error:", err);
    res.status(500).json({ message: "Server Error" });
  }
};

/* =============================
   ADD COMMENT
============================= */
const addComment = async (req, res) => {
  try {
    const { regimental_no } = req.user;
    const { post_id } = req.params;
    const { content } = req.body;
    const io = req.app.locals.io;

    const [comment] = await db("comments")
      .insert({
        post_id,
        regimental_no,
        content,
      })
      .returning("*");

    const [updated] = await db("posts")
      .where({ post_id })
      .increment("comments_count", 1)
      .returning("*");

    const commenter = await db("cadet_profiles")
      .where({ regimental_no })
      .select("college_id", "full_name")
      .first();

    if (commenter?.college_id) {
      const collegeRoom = `feed:college:${commenter.college_id}`;
      io.of("/feed").to(collegeRoom).emit("feed:comment_update", {
        post_id,
        comments_count: updated.comments_count,
      });
    }

    const post = await db("posts").where({ post_id }).first();

    if (post.regimental_no !== regimental_no) {
      const owner = await db("cadet_profiles")
        .where({ regimental_no: post.regimental_no })
        .select("user_id")
        .first();

      if (owner && commenter) {
        const [notification] = await db("notifications")
          .insert({
            user_id: owner.user_id,
            type: "comment",
            post_id,
            message: `${commenter.full_name} commented on your post`,
          })
          .returning("*");

        io.of("/notifications")
          .to(`notifications:user:${owner.user_id}`)
          .emit("notification:new", notification);
      }
    }

    res.status(201).json(comment);
  } catch (err) {
    console.error("Add Comment Error:", err);
    res.status(500).json({ message: "Server Error" });
  }
};

/* =============================
   GET POST COMMENTS
============================= */
const getPostComments = async (req, res) => {
  try {
    const { post_id } = req.params;

    const comments = await db("comments as c")
      .join("cadet_profiles as cp", "c.regimental_no", "cp.regimental_no")
      .where("c.post_id", post_id)
      .select("c.comment_id", "c.content", "c.created_at", "cp.full_name")
      .orderBy("c.created_at", "asc");

    res.json(comments);
  } catch (err) {
    console.error("Get Post Comments Error:", err);
    res.status(500).json({ message: "Server Error" });
  }
};

module.exports = {
  createPost,
  getFeed,
  deletePost,
  incrementView,
  toggleLike,
  addComment,
  getPostComments,
};


