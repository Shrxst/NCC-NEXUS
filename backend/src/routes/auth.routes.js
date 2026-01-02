import express from "express";
import { login } from "../controllers/auth.controller.js";
import { resetPasswordLoggedIn } from "../controllers/auth.controller.js";
import { authenticate } from "../middlewares/auth.middleware.js";

const router = express.Router();

router.post("/login", login);

router.get("/me", authenticate, (req, res) => {
  res.json({ user: req.user });
});
router.post("/reset-password", authenticate, resetPasswordLoggedIn);

export default router;
