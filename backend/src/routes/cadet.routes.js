const express = require("express");
const router = express.Router();

const cadetController = require("../controllers/cadet.controller");
const { authenticate } = require("../middlewares/auth.middleware");
const { authorizeRole } = require("../middlewares/authorize.middleware");
const upload = require("../middlewares/upload.middleware");

router.use(authenticate);
router.use(authorizeRole("CADET", "ALUMNI"));

router.get("/profile", cadetController.getProfile);

router.put(
  "/profile",
  upload.single("profile_image"),
  cadetController.updateProfile
);

router.get("/rank-history", cadetController.getRankHistory);

module.exports = router;
