const express = require("express");
const router = express.Router();

const communityController = require("./community.controller");
const { authenticate } = require("../../middlewares/auth.middleware");
const upload = require("../../middlewares/upload.middleware");

const communityMediaUpload = upload.fields([
  { name: "images", maxCount: 10 },
  { name: "videos", maxCount: 10 },
  { name: "pdfs", maxCount: 10 },
]);

router.post(
  "/post",
  authenticate,
  communityMediaUpload,
  communityController.createPost
);

router.patch(
  "/:postId",
  authenticate,
  communityMediaUpload,
  communityController.updatePost
);

router.patch(
  "/:postId/pin",
  authenticate,
  communityController.togglePin
);

router.get(
  "/feed",
  authenticate,
  communityController.getPosts
);

router.get(
  "/moderation",
  authenticate,
  communityController.getModerationQueue
);

router.patch(
  "/:postId/approve",
  authenticate,
  communityController.approvePost
);

router.patch(
  "/:postId/reject",
  authenticate,
  communityController.rejectPost
);

router.post(
  "/:postId/react",
  authenticate,
  communityController.reactToPost
);

router.post(
  "/:postId/vote",
  authenticate,
  communityController.votePoll
);

router.post(
  "/:postId/comment",
  authenticate,
  communityController.addComment
);

router.get(
  "/:postId/comments",
  authenticate,
  communityController.getComments
);

router.get(
  "/media/:mediaId/download-url",
  authenticate,
  communityController.getMediaDownloadUrl
);

router.post(
  "/comment/:commentId/like",
  authenticate,
  communityController.likeComment
);

router.delete(
  "/:postId",
  authenticate,
  communityController.deletePost
);

module.exports = router;
