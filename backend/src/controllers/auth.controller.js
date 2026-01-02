import db from "../db/knex.js";
import bcrypt from "bcrypt";
import { generateToken } from "../utils/jwt.js";

export const login = async (req, res) => {
  const { email, password } = req.body;

  try {
    const user = await db("users").where({ email }).first();
    if (!user) {
      return res.status(401).json({ message: "Invalid credentials" });
    }

    const isMatch = await bcrypt.compare(password, user.password_hash);
    if (!isMatch) {
      return res.status(401).json({ message: "Invalid credentials" });
    }

    const token = generateToken({
      user_id: user.user_id,
      role: user.role,
    });

    res.json({
      message: "Login successful",
      token,
      user: {
        user_id: user.user_id,
        role: user.role,
        email: user.email,
      },
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};
export const resetPasswordLoggedIn = async (req, res) => {
  const userId = req.user.user_id;
  const { currentPassword, newPassword, confirmNewPassword } = req.body;

  // 1️⃣ Validate input
  if (!currentPassword || !newPassword || !confirmNewPassword) {
    return res.status(400).json({ message: "All fields are required" });
  }

  if (newPassword !== confirmNewPassword) {
    return res.status(400).json({ message: "Passwords do not match" });
  }

  if (newPassword.length < 6) {
    return res
      .status(400)
      .json({ message: "Password must be at least 6 characters" });
  }

  try {
    // 2️⃣ Get user
    const user = await db("users").where({ user_id: userId }).first();

    if (!user) {
      return res.status(404).json({ message: "User not found" });
    }

    // 3️⃣ Verify current password
    const isMatch = await bcrypt.compare(
      currentPassword,
      user.password_hash
    );

    if (!isMatch) {
      return res.status(401).json({ message: "Current password is incorrect" });
    }

    // 4️⃣ Hash new password
    const newHash = await bcrypt.hash(newPassword, 10);

    // 5️⃣ Update password
    await db("users")
      .where({ user_id: userId })
      .update({ password_hash: newHash });

    res.json({ message: "Password updated successfully" });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};
