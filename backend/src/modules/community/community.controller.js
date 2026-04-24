const communityService = require("./community.service");
const { uploadToCloudinary } = require("../../services/cloudinary.service");

const toArray = (value) => {
  if (Array.isArray(value)) return value;
  if (value === undefined || value === null || value === "") return [];
  if (typeof value === "string") {
    try {
      const parsed = JSON.parse(value);
      return Array.isArray(parsed) ? parsed : [];
    } catch {
      return [];
    }
  }
  return [];
};

const toBoolean = (value) => {
  if (typeof value === "boolean") return value;
  if (typeof value === "string") return value.toLowerCase() === "true";
  return Boolean(value);
};

const toSafePdfPublicId = (filename = "document") => {
  const base = String(filename || "document")
    .replace(/\.pdf$/i, "")
    .toLowerCase()
    .replace(/[^a-z0-9_-]/g, "_");
  const safeBase = base || "document";
  return `${Date.now()}_${Math.random().toString(36).slice(2, 8)}_${safeBase}`;
};

const buildPayload = async (req) => {
  const payload = {
    ...req.body,
    tags: toArray(req.body?.tags),
    options: toArray(req.body?.options),
    media_urls: toArray(req.body?.media_urls),
    video_urls: toArray(req.body?.video_urls),
    pdf_urls: toArray(req.body?.pdf_urls),
    allow_multiple_choices: toBoolean(req.body?.allow_multiple_choices),
  };

  const files = req.files || {};
  const invalidPdf = (files.pdfs || []).find((file) => !String(file.mimetype || "").toLowerCase().includes("pdf"));
  if (invalidPdf) {
    throw new Error("Only PDF files are allowed in PDF upload.");
  }

  const [imageUploads, videoUploads, pdfUploads] = await Promise.all([
    Promise.all((files.images || []).map((file) => uploadToCloudinary(file.buffer, "ncc-nexus/community/images"))),
    Promise.all((files.videos || []).map((file) => uploadToCloudinary(file.buffer, "ncc-nexus/community/videos"))),
    Promise.all(
      (files.pdfs || []).map((file) =>
        uploadToCloudinary(file.buffer, "ncc-nexus/community/pdfs", {
          resource_type: "raw",
          type: "upload",
          access_mode: "public",
          format: "pdf",
          public_id: toSafePdfPublicId(file.originalname),
          use_filename: false,
          unique_filename: false,
          filename_override: file.originalname || "document.pdf",
        })
      )
    ),
  ]);

  if (imageUploads.length) {
    payload.media_urls = [...payload.media_urls, ...imageUploads.map((item) => item.secure_url)];
  }

  if (videoUploads.length) {
    payload.video_urls = [...payload.video_urls, ...videoUploads.map((item) => item.secure_url)];
  }

  if (pdfUploads.length) {
    payload.pdf_urls = [
      ...payload.pdf_urls,
      ...pdfUploads.map((item, idx) => ({
        name: files.pdfs[idx]?.originalname || "document.pdf",
        url: item.secure_url,
      })),
    ];
  }

  return payload;
};

const createPost = async (req, res) => {
  try {
    const payload = await buildPayload(req);
    const post = await communityService.createPost(payload, req.user);
    const io = req.app.get("io") || req.app.locals.io;

    if (io && req.user?.college_id) {
      io.to(`college_${req.user.college_id}`).emit("new_post", {
        postId: post?.community_post_id || post?.post_id || null,
        data: post,
      });
    }

    return res.status(201).json({
      message: "Post created successfully",
      data: post,
    });
  } catch (err) {
    console.error("Create Post Error:", err);

    const status =
      err?.name === "MulterError" && err?.code === "LIMIT_FILE_SIZE"
        ? 413
        : err?.message?.toLowerCase?.().includes("cloudinary")
          ? 500
          : 400;

    return res.status(status).json({
      message: err.message || "Failed to create post",
    });
  }
};

const updatePost = async (req, res) => {
  try {
    const payload = await buildPayload(req);
    const result = await communityService.updatePost(req.params.postId, payload, req.user);
    return res.json({
      message: "Post updated successfully",
      data: result,
    });
  } catch (err) {
    console.error("Update Post Error:", err);
    const status =
      err?.name === "MulterError" && err?.code === "LIMIT_FILE_SIZE"
        ? 413
        : err?.message?.toLowerCase?.().includes("cloudinary")
          ? 500
          : 400;

    return res.status(status).json({
      message: err.message || "Failed to update post",
    });
  }
};

const togglePin = async (req, res) => {
  try {
    const result = await communityService.togglePin(req.params.postId, req.user);
    return res.json({
      message: "Pin status updated",
      data: result,
    });
  } catch (err) {
    console.error("Pin Toggle Error:", err);
    return res.status(400).json({
      message: err.message || "Failed to update pin",
    });
  }
};

const approvePost = async (req, res) => {
  try {
    const postId = req.params.postId;

    const result = await communityService.approvePost(postId, req.user);
    const io = req.app.get("io") || req.app.locals.io;

    if (io && req.user?.college_id) {
      io.to(`college_${req.user.college_id}`).emit("post_approved", {
        postId,
        data: result,
      });
    }

    return res.json({
      message: "Post approved successfully",
      data: result,
    });
  } catch (err) {
    console.error("Approve Post Error:", err);

    return res.status(400).json({
      message: err.message || "Failed to approve post",
    });
  }
};

const rejectPost = async (req, res) => {
  try {
    const postId = req.params.postId;
    const moderationNote = req.body?.moderation_note;

    const result = await communityService.rejectPost(postId, moderationNote, req.user);

    return res.json({
      message: "Post rejected successfully",
      data: result,
    });
  } catch (err) {
    console.error("Reject Post Error:", err);

    return res.status(400).json({
      message: err.message || "Failed to reject post",
    });
  }
};

const getPosts = async (req, res) => {
  try {
    const posts = await communityService.getPosts(req.user);

    return res.json({
      message: "Posts fetched successfully",
      data: posts,
    });
  } catch (err) {
    console.error("Get Posts Error:", err);

    return res.status(500).json({
      message: "Failed to fetch posts",
    });
  }
};

const getModerationQueue = async (req, res) => {
  try {
    const posts = await communityService.getModerationQueue(req.user);

    return res.json({
      message: "Moderation queue fetched",
      data: posts,
    });
  } catch (err) {
    console.error("Moderation Queue Error:", err);

    return res.status(403).json({
      message: err.message || "Not authorized",
    });
  }
};

const reactToPost = async (req, res) => {
  try {

    const { reaction_type } = req.body;

if (!reaction_type) {
  return res.status(400).json({
    message: "reaction_type is required"
  });
}

    const result = await communityService.reactToPost(
      req.params.postId,
      reaction_type,
      req.user
    );

    const io = req.app.get("io") || req.app.locals.io;
    if (io && req.user?.college_id) {
      io.to(`college_${req.user.college_id}`).emit("post_reacted", {
        postId: req.params.postId,
        reaction_type,
        data: result,
      });
    }

    res.json(result);

  } catch (err) {

    console.error("Reaction Error:", err);

    res.status(400).json({
      message: err.message || "Reaction failed"
    });
  }
};

const votePoll = async (req, res) => {
  try {

    const { option_id } = req.body;

if (!option_id) {
  return res.status(400).json({
    message: "option_id is required"
  });
}

    const result = await communityService.votePoll(
      req.params.postId,
      option_id,
      req.user
    );

    res.json(result);

  } catch (err) {

    console.error("Poll Vote Error:", err);

    res.status(400).json({
      message: err.message || "Voting failed"
    });

  }
};

const addComment = async (req, res) => {
  try {

    const { content, parent_comment_id } = req.body;

    const comment = await communityService.addComment(
      req.params.postId,
      content,
      parent_comment_id,
      req.user
    );

    const io = req.app.get("io") || req.app.locals.io;
    if (io && req.user?.college_id) {
      io.to(`college_${req.user.college_id}`).emit("new_comment", {
        postId: req.params.postId,
        data: comment,
      });
    }

    res.status(201).json({
      message: "Comment added",
      data: comment
    });

  } catch (err) {

    console.error("Comment Error:", err);

    res.status(400).json({
      message: err.message || "Failed to add comment"
    });

  }
};

const getComments = async (req, res) => {
  try {

    const comments = await communityService.getComments(
      req.params.postId,
      req.user
    );

    res.json({
      data: comments
    });

  } catch (err) {

    console.error("Get Comments Error:", err);

    res.status(500).json({
      message: "Failed to fetch comments"
    });

  }
};

const getMediaDownloadUrl = async (req, res) => {
  try {
    const result = await communityService.getMediaDownloadUrl(req.params.mediaId, req.user);
    return res.json({
      message: "Media download URL fetched",
      data: result,
    });
  } catch (err) {
    console.error("Get Media Download URL Error:", err);
    return res.status(400).json({
      message: err.message || "Failed to fetch media URL",
    });
  }
};

const likeComment = async (req, res) => {
  try {

    const result = await communityService.likeComment(
      req.params.commentId,
      req.user
    );

    res.json(result);

  } catch (err) {

    console.error("Like Comment Error:", err);

    res.status(400).json({
      message: err.message
    });

  }
};

const deletePost = async (req, res) => {

  try {

    const result = await communityService.deletePost(
      req.params.postId,
      req.user
    );

    const io = req.app.get("io") || req.app.locals.io;
    if (io && req.user?.college_id) {
      io.to(`college_${req.user.college_id}`).emit("post_deleted", {
        postId: req.params.postId,
        data: result,
      });
    }

    res.json(result);

  } catch (err) {

    console.error("Delete Post Error:", err);

    res.status(400).json({
      message: err.message
    });

  }

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
  likeComment
};
