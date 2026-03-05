const db = require("../../db/knex");
const { buildSignedPdfUrl } = require("../../services/cloudinary.service");

const POST_TYPES = ["UPDATE", "EVENT", "POLL", "MEDIA"];
const REACTIONS = ["LIKE", "LOVE", "FIRE"];

const isSUO = (user) => user.role === "CADET" && user.rank === "Senior Under Officer";
const isAuthority = (user) => user.role === "ANO" || isSUO(user);
const normalize = (value) => String(value || "").trim();
const parseIsoDate = (value) => {
  if (!value) return null;
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) {
    throw new Error("Invalid poll deadline");
  }
  return parsed.toISOString();
};

const canEditPost = (post, user) => user.role === "ANO" || Number(post.created_by_user_id) === Number(user.user_id);
const canDeletePost = canEditPost;

function inferAuthorRole(row) {
  if (row.author_role === "ANO") return "ano";
  if (row.author_role === "ALUMNI") return "alumni";
  if (row.author_rank === "Senior Under Officer") return "suo";
  return "cadet";
}

async function ensurePost(postId, user, trx = db) {
  const post = await trx("community_posts")
    .where({
      community_post_id: postId,
      college_id: user.college_id,
    })
    .whereNull("deleted_at")
    .first();

  if (!post) {
    throw new Error("Post not found");
  }
  return post;
}

async function replacePostTags(trx, postId, tags = []) {
  await trx("community_post_tags").where({ community_post_id: postId }).delete();
  const uniqueTags = [...new Set((Array.isArray(tags) ? tags : []).map((tag) => normalize(tag)).filter(Boolean))];
  if (!uniqueTags.length) return;

  await trx("community_post_tags").insert(
    uniqueTags.map((tag) => ({
      community_post_id: postId,
      tag,
    }))
  );
}

async function replacePostMedia(trx, postId, mediaPayload = {}) {
  await trx("community_post_media").where({ community_post_id: postId }).delete();

  const entries = [];
  const pushItems = (items, mediaType) => {
    (Array.isArray(items) ? items : []).forEach((item, index) => {
      const isObject = item && typeof item === "object" && !Array.isArray(item);
      const mediaUrl = normalize(isObject ? item.url : item);
      const mediaName = normalize(isObject ? item.name : "");
      if (!mediaUrl) return;
      entries.push({
        community_post_id: postId,
        media_type: mediaType,
        media_url: mediaUrl,
        media_name: mediaName || null,
        sort_order: index,
      });
    });
  };

  pushItems(mediaPayload.images, "IMAGE");
  pushItems(mediaPayload.videos, "VIDEO");
  pushItems(mediaPayload.pdfs, "PDF");

  if (entries.length) {
    await trx("community_post_media").insert(entries);
  }
}

async function replaceEventDetails(trx, postId, data) {
  await trx("community_event_details").where({ community_post_id: postId }).delete();
  if (data.post_type !== "EVENT") return;

  if (!data.event_date) {
    throw new Error("Event date is required");
  }

  await trx("community_event_details").insert({
    community_post_id: postId,
    event_date: data.event_date,
    location: normalize(data.location) || null,
  });
}

async function replacePollOptions(trx, postId, data) {
  await trx("community_poll_options").where({ community_post_id: postId }).delete();
  if (data.post_type !== "POLL") return;

  const options = (Array.isArray(data.options) ? data.options : []).map((option) => normalize(option)).filter(Boolean);
  if (options.length < 2) {
    throw new Error("Poll must have at least two options");
  }

  await trx("community_poll_options").insert(
    options.map((optionText) => ({
      community_post_id: postId,
      option_text: optionText,
    }))
  );
}

function validatePollPayload(data, postType) {
  if (postType !== "POLL") return;
  const parsedDeadline = parseIsoDate(data.poll_deadline);
  if (!parsedDeadline) {
    throw new Error("Poll active till deadline is required");
  }
  if (new Date(parsedDeadline).getTime() <= Date.now()) {
    throw new Error("Poll deadline must be in the future");
  }
}

async function loadFormattedPosts(user, { onlyPending = false } = {}) {
  const baseQuery = db("community_posts as p")
    .leftJoin("users as u", "p.created_by_user_id", "u.user_id")
    .leftJoin("cadet_profiles as cp", "cp.user_id", "u.user_id")
    .leftJoin("cadet_ranks as r", "cp.rank_id", "r.id")
    .leftJoin("community_event_details as e", "p.community_post_id", "e.community_post_id")
    .select(
      "p.community_post_id",
      "p.created_by_user_id",
      "p.post_type",
      "p.title",
      "p.content",
      "p.status",
      "p.is_pinned",
      "p.poll_deadline",
      "p.allow_multiple_choices",
      "p.moderation_note",
      "p.created_at",
      "u.username as author_name",
      "u.profile_image_url",
      "u.role as author_role",
      "r.rank_name as author_rank",
      "e.event_date",
      "e.location"
    )
    .where("p.college_id", user.college_id)
    .whereNull("p.deleted_at");

  if (onlyPending) {
    baseQuery.andWhere("p.status", "PENDING");
  } else if (user.role !== "ANO") {
    baseQuery.andWhere("p.status", "APPROVED");
  }

  baseQuery.orderBy("p.is_pinned", "desc").orderBy("p.created_at", "desc");

  const posts = await baseQuery;
  if (!posts.length) return [];

  const postIds = posts.map((post) => post.community_post_id);

  const [reactions, comments, tags, media, pollResults, userPollVotes] = await Promise.all([
    db("community_reactions")
      .select("community_post_id", "reaction_type")
      .count("* as count")
      .whereIn("community_post_id", postIds)
      .groupBy("community_post_id", "reaction_type"),
    db("community_comments")
      .select("community_post_id")
      .count("* as count")
      .whereIn("community_post_id", postIds)
      .whereNull("deleted_at")
      .groupBy("community_post_id"),
    db("community_post_tags").select("community_post_id", "tag").whereIn("community_post_id", postIds),
    db("community_post_media")
      .select("media_id", "community_post_id", "media_type", "media_url", "media_name", "sort_order")
      .whereIn("community_post_id", postIds)
      .orderBy("sort_order", "asc"),
    db("community_poll_options as o")
      .leftJoin("community_poll_votes as v", "v.option_id", "o.option_id")
      .select("o.community_post_id", "o.option_id", "o.option_text")
      .count("v.user_id as votes")
      .whereIn("o.community_post_id", postIds)
      .groupBy("o.community_post_id", "o.option_id", "o.option_text"),
    db("community_poll_votes")
      .select("community_post_id", "option_id")
      .whereIn("community_post_id", postIds)
      .andWhere("user_id", user.user_id),
  ]);

  return posts.map((post) => {
    const postReactions = reactions.filter((item) => Number(item.community_post_id) === Number(post.community_post_id));
    const reactionSummary = { LIKE: 0, LOVE: 0, FIRE: 0 };
    postReactions.forEach((item) => {
      reactionSummary[item.reaction_type] = parseInt(item.count, 10);
    });

    const commentInfo = comments.find((item) => Number(item.community_post_id) === Number(post.community_post_id));
    const postTags = tags.filter((item) => Number(item.community_post_id) === Number(post.community_post_id)).map((item) => item.tag);
    const postMedia = media.filter((item) => Number(item.community_post_id) === Number(post.community_post_id));
    const selectedOptionIds = new Set(
      userPollVotes
        .filter((item) => Number(item.community_post_id) === Number(post.community_post_id))
        .map((item) => Number(item.option_id))
    );
    const postPoll = pollResults
      .filter((item) => Number(item.community_post_id) === Number(post.community_post_id))
      .map((item) => ({
        ...item,
        user_selected: selectedOptionIds.has(Number(item.option_id)),
      }));

    return {
      ...post,
      author_role: inferAuthorRole(post),
      can_edit: canEditPost(post, user),
      can_delete: canDeletePost(post, user),
      reactions: reactionSummary,
      comments_count: commentInfo ? parseInt(commentInfo.count, 10) : 0,
      tags: postTags,
      media: postMedia,
      poll_results: postPoll,
    };
  });
}

const createPost = async (data, user) => {
  if (!isAuthority(user)) {
    throw new Error("Not authorized to create post");
  }

  const postType = normalize(data.post_type).toUpperCase();
  if (!POST_TYPES.includes(postType)) {
    throw new Error("Invalid post type");
  }
  validatePollPayload(data, postType);
  const normalizedPollDeadline = postType === "POLL" ? parseIsoDate(data.poll_deadline) : null;

  let createdPostId = null;

  await db.transaction(async (trx) => {
    const [post] = await trx("community_posts")
      .insert({
        college_id: user.college_id,
        created_by_user_id: user.user_id,
        post_type: postType,
        title: normalize(data.title) || null,
        content: normalize(data.content) || null,
        status: user.role === "ANO" ? "APPROVED" : "PENDING",
        poll_deadline: normalizedPollDeadline,
        allow_multiple_choices: Boolean(data.allow_multiple_choices),
      })
      .returning("*");
    createdPostId = post.community_post_id;

    await replaceEventDetails(trx, post.community_post_id, { ...data, post_type: postType });
    await replacePollOptions(trx, post.community_post_id, { ...data, post_type: postType });
    await replacePostTags(trx, post.community_post_id, data.tags);
    await replacePostMedia(trx, post.community_post_id, {
      images: data.media_urls || data.images,
      videos: data.video_urls || data.videos,
      pdfs: data.pdf_urls || data.pdfs,
    });
  });

  const refreshed = await loadFormattedPosts(user);
  return refreshed.find((item) => Number(item.community_post_id) === Number(createdPostId)) || null;
};

const updatePost = async (postId, data, user) => {
  const current = await ensurePost(postId, user);
  if (!canEditPost(current, user)) {
    throw new Error("Not authorized to edit this post");
  }

  const postType = normalize(data.post_type || current.post_type).toUpperCase();
  if (!POST_TYPES.includes(postType)) {
    throw new Error("Invalid post type");
  }
  validatePollPayload(data, postType);
  const normalizedPollDeadline = postType === "POLL" ? parseIsoDate(data.poll_deadline) : null;

  await db.transaction(async (trx) => {
    await trx("community_posts")
      .where({ community_post_id: postId })
      .update({
        post_type: postType,
        title: normalize(data.title) || null,
        content: normalize(data.content) || null,
        poll_deadline: normalizedPollDeadline,
        allow_multiple_choices: Boolean(data.allow_multiple_choices),
        status: user.role === "ANO" ? current.status : "PENDING",
        moderation_note: null,
      });

    await replaceEventDetails(trx, postId, { ...data, post_type: postType });
    await replacePollOptions(trx, postId, { ...data, post_type: postType });
    await replacePostTags(trx, postId, data.tags);
    await replacePostMedia(trx, postId, {
      images: data.media_urls || data.images,
      videos: data.video_urls || data.videos,
      pdfs: data.pdf_urls || data.pdfs,
    });
  });

  const posts = await loadFormattedPosts(user);
  return posts.find((item) => Number(item.community_post_id) === Number(postId)) || null;
};

const togglePin = async (postId, user) => {
  if (!isAuthority(user)) {
    throw new Error("Not authorized to pin posts");
  }

  const post = await ensurePost(postId, user);
  const [updated] = await db("community_posts")
    .where({ community_post_id: postId })
    .update({ is_pinned: !post.is_pinned })
    .returning("*");

  return updated;
};

const approvePost = async (postId, user) => {
  if (user.role !== "ANO") {
    throw new Error("Only ANO can approve posts");
  }

  await ensurePost(postId, user);

  return db("community_posts")
    .where({ community_post_id: postId })
    .update({
      status: "APPROVED",
      moderation_note: null,
      approved_at: db.fn.now(),
      approved_by_user_id: user.user_id,
    })
    .returning("*");
};

const rejectPost = async (postId, moderationNote, user) => {
  if (user.role !== "ANO") {
    throw new Error("Only ANO can reject posts");
  }

  await ensurePost(postId, user);

  return db("community_posts")
    .where({ community_post_id: postId })
    .update({
      status: "REJECTED",
      moderation_note: normalize(moderationNote) || null,
    })
    .returning("*");
};

const getPosts = async (user) => loadFormattedPosts(user);

const getModerationQueue = async (user) => {
  if (user.role !== "ANO") {
    throw new Error("Not authorized");
  }
  return loadFormattedPosts(user, { onlyPending: true });
};

const reactToPost = async (postId, reactionType, user) => {
  const normalizedReaction = normalize(reactionType).toUpperCase();
  if (!REACTIONS.includes(normalizedReaction)) {
    throw new Error("Invalid reaction type");
  }

  await ensurePost(postId, user);

  const existingReaction = await db("community_reactions")
    .where({
      community_post_id: postId,
      user_id: user.user_id,
    })
    .first();

  if (existingReaction) {
    if (existingReaction.reaction_type === normalizedReaction) {
      await db("community_reactions")
        .where({
          community_post_id: postId,
          user_id: user.user_id,
        })
        .delete();
      return { message: "Reaction removed" };
    }

    await db("community_reactions")
      .where({
        community_post_id: postId,
        user_id: user.user_id,
      })
      .update({
        reaction_type: normalizedReaction,
      });
    return { message: "Reaction updated" };
  }

  await db("community_reactions").insert({
    community_post_id: postId,
    user_id: user.user_id,
    reaction_type: normalizedReaction,
  });

  return { message: "Reaction added" };
};

const votePoll = async (postId, optionId, user) => {
  const post = await ensurePost(postId, user);
  if (post.post_type !== "POLL") {
    throw new Error("Invalid poll");
  }

  if (post.poll_deadline && new Date(post.poll_deadline).getTime() < Date.now()) {
    throw new Error("Poll has expired");
  }

  const option = await db("community_poll_options")
    .where({
      option_id: optionId,
      community_post_id: postId,
    })
    .first();

  if (!option) {
    throw new Error("Invalid poll option");
  }

  const existingVote = await db("community_poll_votes")
    .where({
      community_post_id: postId,
      user_id: user.user_id,
    })
    .first();

  if (!post.allow_multiple_choices && existingVote) {
    if (Number(existingVote.option_id) === Number(optionId)) {
      return { message: "Vote unchanged", changed: false, unchanged: true };
    }

    await db("community_poll_votes")
      .where({
        community_post_id: postId,
        user_id: user.user_id,
      })
      .update({
        option_id: optionId,
      });

    return { message: "Vote updated successfully", changed: true };
  }

  if (post.allow_multiple_choices && existingVote) {
    const alreadyPicked = await db("community_poll_votes")
      .where({
        community_post_id: postId,
        user_id: user.user_id,
        option_id: optionId,
      })
      .first();

    if (alreadyPicked) {
      return { message: "Vote unchanged", changed: false, unchanged: true };
    }
  }

  await db("community_poll_votes").insert({
    community_post_id: postId,
    option_id: optionId,
    user_id: user.user_id,
  });

  return { message: "Vote submitted successfully", changed: true };
};

const addComment = async (postId, content, parentCommentId, user) => {
  if (!normalize(content)) {
    throw new Error("Comment cannot be empty");
  }

  await ensurePost(postId, user);

  if (parentCommentId) {
    const parent = await db("community_comments")
      .where({
        comment_id: parentCommentId,
        community_post_id: postId,
      })
      .whereNull("deleted_at")
      .first();
    if (!parent) throw new Error("Parent comment not found");
  }

  const [comment] = await db("community_comments")
    .insert({
      community_post_id: postId,
      user_id: user.user_id,
      content: normalize(content),
      parent_comment_id: parentCommentId || null,
    })
    .returning("*");

  return comment;
};

const getComments = async (postId, user) =>
  db("community_comments as c")
    .join("community_posts as p", "c.community_post_id", "p.community_post_id")
    .leftJoin("users as u", "c.user_id", "u.user_id")
    .leftJoin("cadet_profiles as cp", "cp.user_id", "u.user_id")
    .leftJoin("cadet_ranks as r", "cp.rank_id", "r.id")
    .select(
      "c.comment_id",
      "c.content",
      "c.parent_comment_id",
      "c.created_at",
      "u.username",
      "u.profile_image_url",
      "u.role as user_role",
      "r.rank_name as rank_name"
    )
    .where("c.community_post_id", postId)
    .where("p.college_id", user.college_id)
    .whereNull("c.deleted_at")
    .orderBy("c.created_at", "asc");

const getMediaDownloadUrl = async (mediaId, user) => {
  const media = await db("community_post_media as m")
    .join("community_posts as p", "m.community_post_id", "p.community_post_id")
    .where({
      "m.media_id": mediaId,
      "p.college_id": user.college_id,
    })
    .whereNull("p.deleted_at")
    .select("m.media_id", "m.media_type", "m.media_url", "m.media_name")
    .first();

  if (!media) {
    throw new Error("Media not found");
  }

  const fallbackName =
    media.media_type === "PDF"
      ? "document.pdf"
      : media.media_type === "VIDEO"
        ? "video-file"
        : "image-file";

  const filename = media.media_name || fallbackName;
  const url = media.media_type === "PDF" ? await buildSignedPdfUrl(media.media_url, filename) : media.media_url;

  return {
    media_id: media.media_id,
    filename,
    url,
  };
};

const likeComment = async (commentId, user) => {
  const comment = await db("community_comments as c")
    .join("community_posts as p", "c.community_post_id", "p.community_post_id")
    .where({
      "c.comment_id": commentId,
      "p.college_id": user.college_id,
    })
    .first();

  if (!comment) {
    throw new Error("Comment not found");
  }

  const existing = await db("community_comment_likes")
    .where({
      comment_id: commentId,
      user_id: user.user_id,
    })
    .first();

  if (existing) {
    await db("community_comment_likes")
      .where({
        comment_id: commentId,
        user_id: user.user_id,
      })
      .delete();
    return { message: "Like removed" };
  }

  await db("community_comment_likes").insert({
    comment_id: commentId,
    user_id: user.user_id,
  });

  return { message: "Comment liked" };
};

const deletePost = async (postId, user) => {
  const post = await ensurePost(postId, user);
  if (!canDeletePost(post, user)) {
    throw new Error("Not authorized to delete this post");
  }

  await db("community_posts")
    .where({ community_post_id: postId })
    .update({ deleted_at: db.fn.now() });

  return { message: "Post deleted successfully" };
};

module.exports = {
  createPost,
  updatePost,
  togglePin,
  approvePost,
  rejectPost,
  deletePost,
  getPosts,
  getModerationQueue,
  reactToPost,
  votePoll,
  addComment,
  getComments,
  getMediaDownloadUrl,
  likeComment,
};
