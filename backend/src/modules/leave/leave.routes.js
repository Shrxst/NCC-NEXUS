const express = require("express");
const upload = require("../../middlewares/upload.middleware");
const controller = require("./leave.controller");
const { isSuo } = require("./leave.service");
const { authenticateLeaveUser } = require("./leave.auth");

const router = express.Router();

const allowLeaveRoles = (...roles) => (req, res, next) => {
  const suo = isSuo(req.user);
  const effectiveRole = suo ? "SUO" : req.user?.role;
  const isCadet = req.user?.role === "CADET";
  if (!roles.includes(effectiveRole) && !(roles.includes("CADET") && isCadet)) {
    return res.status(403).json({ message: "Access denied" });
  }
  return next();
};

router.use(authenticateLeaveUser);

router.post("/apply", allowLeaveRoles("CADET"), upload.single("document"), controller.applyLeave);
router.get("/my", allowLeaveRoles("CADET"), controller.getMyLeaveRequests);
router.get("/all", allowLeaveRoles("ANO", "SUO"), controller.getAllLeaveRequests);
router.patch("/:id/status", allowLeaveRoles("ANO", "SUO"), controller.reviewLeaveStatus);

module.exports = router;
