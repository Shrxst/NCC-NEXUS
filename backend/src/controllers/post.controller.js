const db = require("../db/knex");
const { uploadToCloudinary } = require("../services/cloudinary.service");

const resolveRegimentalNo = async (user = {}) => {
  if (user.regimental_no) return user.regimental_no;
  if (!user.user_id) return null;

  const cadet = await db("cadet_profiles")
    .where({ user_id: user.user_id })
    .select("regimental_no")
    .first();

  return cadet?.regimental_no || null;
};

const buildCommentTree = (rows, likedSet = new Set()) => {
  const byId = new Map();
  const roots = [];

  const mapped = rows.map((row) => ({
    comment_id: Number(row.comment_id),
    post_id: Number(row.post_id),
    parent_comment_id:
      row.parent_comment_id === null || row.parent_comment_id === undefined
        ? null
        : Number(row.parent_comment_id),
    regimental_no: row.regimental_no,
    full_name: row.full_name,
    content: row.content,
    created_at: row.created_at,
    updated_at: row.updated_at,
    deleted_at: row.deleted_at,
    is_pinned: Boolean(row.is_pinned),
    pinned_by: row.pinned_by,
    pinned_at: row.pinned_at,
    likes_count: Number(row.likes_count || 0),
    liked_by_me: likedSet.has(Number(row.comment_id)),
    replies: [],
  }));

  mapped.forEach((node) => byId.set(node.comment_id, node));

  mapped.forEach((node) => {
    if (node.parent_comment_id && byId.has(node.parent_comment_id)) {
      byId.get(node.parent_comment_id).replies.push(node);
      return;
    }
    roots.push(node);
  });

  const sortRepliesRecursive = (list, includePinnedSort = false) => {
    list.sort((a, b) => {
      if (includePinnedSort && a.is_pinned !== b.is_pinned) {
        return a.is_pinned ? -1 : 1;
      }
      return new Date(a.created_at).getTime() - new Date(b.created_at).getTime();
    });

    list.forEach((item) => sortRepliesRecursive(item.replies, false));
  };

  sortRepliesRecursive(roots, true);
  return roots;
};

const getCommentAndDescendantIds = async (commentId) => {
  const ids = [Number(commentId)];
  let frontier = [Number(commentId)];

  while (frontier.length > 0) {
    const children = await db("comments")
      .whereIn("parent_comment_id", frontier)
      .select("comment_id");

    const childIds = children.map((row) => Number(row.comment_id));

    if (childIds.length === 0) {
      frontier = [];
      continue;
    }

    ids.push(...childIds);
    frontier = childIds;
  }

  return ids;
};

/* =============================
   CREATE POST
============================= */
const createPost = async (req, res) => {
  try {
    const regimental_no = await resolveRegimentalNo(req.user);
    const { content_text, caption } = req.body;
    const io = req.app.locals.io;

    if (!regimental_no) {
      return res.status(400).json({ message: "Cadet profile not linked to this account" });
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
      .join("users as u", "cp.user_id", "u.user_id")
      .leftJoin("cadet_ranks as r", "cp.rank_id", "r.id")
      .where("cp.college_id", profile.college_id)
      .select("p.*", "cp.full_name", "u.profile_image_url", "r.rank_name")
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
    const regimental_no = await resolveRegimentalNo(req.user);
    const io = req.app.locals.io;

    if (!regimental_no) {
      return res.status(400).json({ message: "Cadet profile not linked to this account" });
    }

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
   UPDATE POST
============================= */
const updatePost = async (req, res) => {
  try {
    const { post_id } = req.params;
    const regimental_no = await resolveRegimentalNo(req.user);
    const { content_text, caption } = req.body;
    const io = req.app.locals.io;

    if (!regimental_no) {
      return res.status(400).json({ message: "Cadet profile not linked to this account" });
    }

    const post = await db("posts").where({ post_id, regimental_no }).first();
    if (!post) return res.status(403).json({ message: "Unauthorized" });

    const nextCaption = String(content_text ?? caption ?? "").trim();
    if (!nextCaption) {
      return res.status(400).json({ message: "Post content is required" });
    }

    const [updated] = await db("posts")
      .where({ post_id })
      .update({ caption: nextCaption })
      .returning("*");

    const author = await db("cadet_profiles")
      .where({ regimental_no })
      .select("college_id")
      .first();

    const responsePost = {
      ...updated,
      content_text: updated.caption,
    };

    if (author?.college_id) {
      const collegeRoom = `feed:college:${author.college_id}`;
      io.of("/feed").to(collegeRoom).emit("feed:update_post", responsePost);
    }

    res.json(responsePost);
  } catch (err) {
    console.error("Update Post Error:", err);
    res.status(500).json({ message: "Server Error" });
  }
};

/* =============================
   UPDATE COMMENT
============================= */
const updateComment = async (req, res) => {
  try {
    const { post_id, comment_id } = req.params;
    const regimental_no = await resolveRegimentalNo(req.user);
    const { content } = req.body;

    if (!regimental_no) {
      return res.status(400).json({ message: "Cadet profile not linked to this account" });
    }

    const nextContent = String(content ?? "").trim();
    if (!nextContent) {
      return res.status(400).json({ message: "Comment content is required" });
    }

    const existing = await db("comments")
      .where({ comment_id, post_id, regimental_no })
      .first();

    if (!existing) {
      return res.status(403).json({ message: "Unauthorized" });
    }

    const [updated] = await db("comments")
      .where({ comment_id })
      .update({
        content: nextContent,
        updated_at: db.fn.now(),
      })
      .returning("*");

    res.json(updated);
  } catch (err) {
    console.error("Update Comment Error:", err);
    res.status(500).json({ message: "Server Error" });
  }
};

/* =============================
   DELETE COMMENT
============================= */
const deleteComment = async (req, res) => {
  try {
    const { post_id, comment_id } = req.params;
    const regimental_no = await resolveRegimentalNo(req.user);
    const io = req.app.locals.io;

    if (!regimental_no) {
      return res.status(400).json({ message: "Cadet profile not linked to this account" });
    }

    const existing = await db("comments")
      .where({ comment_id, post_id, regimental_no })
      .first();

    if (!existing) {
      return res.status(403).json({ message: "Unauthorized" });
    }

    const toDeleteIds = await getCommentAndDescendantIds(comment_id);
    const deletedCount = toDeleteIds.length;

    await db("comments")
      .whereIn("comment_id", toDeleteIds)
      .del();

    await db("posts")
      .where({ post_id })
      .decrement("comments_count", deletedCount);

    const post = await db("posts")
      .where({ post_id })
      .select("comments_count")
      .first();

    if (Number(post?.comments_count || 0) < 0) {
      await db("posts")
        .where({ post_id })
        .update({ comments_count: 0 });
    }

    const author = await db("cadet_profiles")
      .where({ regimental_no })
      .select("college_id")
      .first();

    const nextCount = Math.max(Number(post?.comments_count ?? 0), 0);

    if (author?.college_id) {
      const collegeRoom = `feed:college:${author.college_id}`;
      io.of("/feed").to(collegeRoom).emit("feed:comment_update", {
        post_id,
        comments_count: nextCount,
      });
    }

    res.json({
      message: "Comment deleted",
      comments_count: nextCount,
    });
  } catch (err) {
    console.error("Delete Comment Error:", err);
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
    const regimental_no = await resolveRegimentalNo(req.user);
    const { post_id } = req.params;
    const io = req.app.locals.io;

    if (!regimental_no) {
      return res.status(400).json({ message: "Cadet profile not linked to this account" });
    }

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
   ADD COMMENT / REPLY
============================= */
const addComment = async (req, res) => {
  try {
    const regimental_no = await resolveRegimentalNo(req.user);
    const { post_id } = req.params;
    const { content, parent_comment_id } = req.body;
    const io = req.app.locals.io;

    if (!regimental_no) {
      return res.status(400).json({ message: "Cadet profile not linked to this account" });
    }

    const normalizedContent = String(content ?? "").trim();
    if (!normalizedContent) {
      return res.status(400).json({ message: "Comment content is required" });
    }

    const normalizedParentId =
      parent_comment_id === null || parent_comment_id === undefined || parent_comment_id === ""
        ? null
        : Number(parent_comment_id);

    if (normalizedParentId !== null) {
      const parent = await db("comments")
        .where({
          comment_id: normalizedParentId,
          post_id,
        })
        .first();

      if (!parent) {
        return res.status(404).json({ message: "Parent comment not found" });
      }
    }

    const [comment] = await db("comments")
      .insert({
        post_id,
        regimental_no,
        content: normalizedContent,
        parent_comment_id: normalizedParentId,
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
   GET POST COMMENTS (TREE)
============================= */
const getPostComments = async (req, res) => {
  try {
    const { post_id } = req.params;
    const regimental_no = await resolveRegimentalNo(req.user);

    const comments = await db("comments as c")
      .join("cadet_profiles as cp", "c.regimental_no", "cp.regimental_no")
      .where("c.post_id", post_id)
      .select(
        "c.comment_id",
        "c.post_id",
        "c.parent_comment_id",
        "c.regimental_no",
        "c.content",
        "c.created_at",
        "c.updated_at",
        "c.deleted_at",
        "c.is_pinned",
        "c.pinned_by",
        "c.pinned_at",
        "c.likes_count",
        "cp.full_name"
      );

    const commentIds = comments.map((row) => Number(row.comment_id));
    let likedSet = new Set();

    if (regimental_no && commentIds.length > 0) {
      const likedRows = await db("comment_likes")
        .where({ regimental_no })
        .whereIn("comment_id", commentIds)
        .select("comment_id");

      likedSet = new Set(likedRows.map((row) => Number(row.comment_id)));
    }

    const tree = buildCommentTree(comments, likedSet);
    res.json(tree);
  } catch (err) {
    console.error("Get Post Comments Error:", err);
    res.status(500).json({ message: "Server Error" });
  }
};

/* =============================
   TOGGLE COMMENT LIKE
============================= */
const toggleCommentLike = async (req, res) => {
  try {
    const regimental_no = await resolveRegimentalNo(req.user);
    const { post_id, comment_id } = req.params;

    if (!regimental_no) {
      return res.status(400).json({ message: "Cadet profile not linked to this account" });
    }

    const comment = await db("comments")
      .where({ comment_id, post_id })
      .first();

    if (!comment) {
      return res.status(404).json({ message: "Comment not found" });
    }

    const existing = await db("comment_likes")
      .where({ comment_id, regimental_no })
      .first();

    if (existing) {
      await db("comment_likes")
        .where({ comment_id, regimental_no })
        .del();

      const [updated] = await db("comments")
        .where({ comment_id })
        .decrement("likes_count", 1)
        .returning("likes_count");

      return res.json({
        message: "Comment unliked",
        liked: false,
        likes_count: Math.max(Number(updated?.likes_count ?? 0), 0),
      });
    }

    await db("comment_likes").insert({ comment_id, regimental_no });

    const [updated] = await db("comments")
      .where({ comment_id })
      .increment("likes_count", 1)
      .returning("likes_count");

    return res.json({
      message: "Comment liked",
      liked: true,
      likes_count: Number(updated?.likes_count ?? 0),
    });
  } catch (err) {
    console.error("Toggle Comment Like Error:", err);
    res.status(500).json({ message: "Server Error" });
  }
};

/* =============================
   TOGGLE PIN COMMENT
============================= */
const togglePinComment = async (req, res) => {
  try {
    const regimental_no = await resolveRegimentalNo(req.user);
    const { user_id } = req.user;
    const { post_id, comment_id } = req.params;

    const post = await db("posts")
      .where({ post_id })
      .select("post_id", "regimental_no")
      .first();

    if (!post) {
      return res.status(404).json({ message: "Post not found" });
    }

    if (!regimental_no || post.regimental_no !== regimental_no) {
      return res.status(403).json({ message: "Only post owner can pin comments" });
    }

    const comment = await db("comments")
      .where({ comment_id, post_id })
      .first();

    if (!comment) {
      return res.status(404).json({ message: "Comment not found" });
    }

    if (comment.is_pinned) {
      const [updated] = await db("comments")
        .where({ comment_id })
        .update({
          is_pinned: false,
          pinned_by: null,
          pinned_at: null,
        })
        .returning("*");

      return res.json({
        comment_id: Number(updated.comment_id),
        is_pinned: false,
      });
    }

    await db("comments")
      .where({ post_id })
      .update({
        is_pinned: false,
        pinned_by: null,
        pinned_at: null,
      });

    const [updated] = await db("comments")
      .where({ comment_id })
      .update({
        is_pinned: true,
        pinned_by: user_id || null,
        pinned_at: db.fn.now(),
      })
      .returning("*");

    return res.json({
      comment_id: Number(updated.comment_id),
      is_pinned: true,
    });
  } catch (err) {
    console.error("Toggle Pin Comment Error:", err);
    res.status(500).json({ message: "Server Error" });
  }
};

/* =============================
   REPORT COMMENT
============================= */
const reportComment = async (req, res) => {
  try {
    const regimental_no = await resolveRegimentalNo(req.user);
    const { post_id, comment_id } = req.params;
    const reason = String(req.body?.reason ?? "").trim();

    if (!regimental_no) {
      return res.status(400).json({ message: "Cadet profile not linked to this account" });
    }

    const comment = await db("comments")
      .where({ comment_id, post_id })
      .first();

    if (!comment) {
      return res.status(404).json({ message: "Comment not found" });
    }

    const inserted = await db("comment_reports")
      .insert({
        comment_id,
        reported_by_regimental_no: regimental_no,
        reason: reason || null,
      })
      .onConflict(["comment_id", "reported_by_regimental_no"])
      .ignore()
      .returning("*");

    if (!inserted || inserted.length === 0) {
      return res.status(409).json({ message: "Comment already reported by you" });
    }

    return res.status(201).json({
      message: "Comment reported",
      report_id: inserted[0].report_id,
    });
  } catch (err) {
    console.error("Report Comment Error:", err);
    res.status(500).json({ message: "Server Error" });
  }
};

module.exports = {
  createPost,
  getFeed,
  deletePost,
  updatePost,
  incrementView,
  toggleLike,
  addComment,
  updateComment,
  deleteComment,
  getPostComments,
  toggleCommentLike,
  togglePinComment,
  reportComment,
};





