const express = require("express");
const router = express.Router();
const upload = require("../middlewares/upload.middleware");
const { authenticate } = require("../middlewares/auth.middleware");
const postController = require("../controllers/post.controller");

router.use(authenticate);

router.post("/", upload.single("media"), postController.createPost);
router.get("/", postController.getFeed);
router.delete("/:post_id", postController.deletePost);
router.patch("/:post_id", postController.updatePost);
router.post("/:post_id/view", postController.incrementView);
router.post("/:post_id/like", postController.toggleLike);
router.post("/:post_id/comment", postController.addComment);
router.patch("/:post_id/comment/:comment_id", postController.updateComment);
router.delete("/:post_id/comment/:comment_id", postController.deleteComment);
router.post("/:post_id/comment/:comment_id/like", postController.toggleCommentLike);
router.post("/:post_id/comment/:comment_id/pin", postController.togglePinComment);
router.post("/:post_id/comment/:comment_id/report", postController.reportComment);
router.get("/:post_id/comments", postController.getPostComments);

module.exports = router;
