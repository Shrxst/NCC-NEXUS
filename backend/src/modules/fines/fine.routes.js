const express = require("express");
const { authenticate } = require("../../middlewares/auth.middleware");
const upload = require("../../middlewares/upload.middleware");
const controller = require("./fine.controller");
const { isSuo } = require("./fine.service");

const router = express.Router();

const allowFineRoles = (...roles) => (req, res, next) => {
  const effectiveRole = isSuo(req.user) ? "SUO" : req.user?.role;
  const isCadet = req.user?.role === "CADET";
  if (!roles.includes(effectiveRole) && !(roles.includes("CADET") && isCadet)) {
    return res.status(403).json({ message: "Access denied" });
  }
  return next();
};

router.use(authenticate);

router.get("/my", allowFineRoles("CADET"), controller.getMyFines);
router.get("/", allowFineRoles("SUO", "ANO"), controller.getAllFines);
router.post("/:id/pay", allowFineRoles("CADET"), upload.single("payment_screenshot"), controller.payFine);
router.patch("/:id/verify", allowFineRoles("SUO", "ANO"), controller.verifyFinePayment);
router.get("/report", allowFineRoles("SUO", "ANO"), controller.getFineReport);

module.exports = router;
