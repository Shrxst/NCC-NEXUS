const express = require("express");
const router = express.Router();
const upload = require("../middlewares/upload.middleware");
const { authenticate } = require("../middlewares/auth.middleware");
const postController = require("../controllers/post.controller");

router.use(authenticate);

router.post("/", upload.single("media"), postController.createPost);
router.get("/", postController.getFeed);
router.delete("/:post_id", postController.deletePost);
router.post("/:post_id/view", postController.incrementView);
router.post("/:post_id/like", postController.toggleLike);
router.post("/:post_id/comment", postController.addComment);
router.get("/:post_id/comments", postController.getPostComments);

module.exports = router;
