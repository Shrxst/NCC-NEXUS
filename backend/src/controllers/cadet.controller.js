const db = require("../db/knex");
const { uploadToCloudinary } = require("../services/cloudinary.service");

const resolveUserId = async ({ user_id, regimental_no } = {}) => {
  if (user_id) return Number(user_id);
  if (!regimental_no) return null;

  const cadet = await db("cadet_profiles")
    .where({ regimental_no })
    .select("user_id")
    .first();

  return cadet?.user_id ? Number(cadet.user_id) : null;
};

const getProfile = async (req, res) => {
  try {
    const { user_id, role, regimental_no } = req.user;

    if (role === "ALUMNI") {
      const resolvedUserId = await resolveUserId({ user_id, regimental_no });
      if (!resolvedUserId) {
        return res.status(400).json({ message: "User identity missing in token" });
      }

      const alumni = await db("users as u")
        .join("alumni as a", "u.user_id", "a.user_id")
        .join("colleges as c", "u.college_id", "c.college_id")
        .where("u.user_id", resolvedUserId)
        .select(
          "u.username as name",
          "u.email",
          "u.profile_image_url",
          "c.short_name as unit",
          "c.city",
          "a.graduation_year"
        )
        .first();

      if (!alumni) {
        return res.status(404).json({ message: "Alumni not found" });
      }

      return res.json({
        ...alumni,
        role: "Alumni",
        rank: "-",
        bio: null,
      });
    }

    const cadet = await db("cadet_profiles as cp")
      .join("users as u", "cp.user_id", "u.user_id")
      .join("colleges as c", "cp.college_id", "c.college_id")
      .leftJoin("cadet_ranks as r", "cp.rank_id", "r.id")
      .where("cp.regimental_no", regimental_no)
      .select(
        "cp.regimental_no",
        "cp.full_name as name",
        "u.email",
        "cp.bio",
        "u.profile_image_url",
        "cp.profile_image_url as legacy_profile_image_url",
        "r.rank_name",
        "c.short_name as unit",
        "c.city"
      )
      .first();

    if (!cadet) {
      return res.status(404).json({ message: "Cadet not found" });
    }

    let displayRole = "Cadet";
    if (cadet.rank_name === "Senior Under Officer") {
      displayRole = "SUO";
    }

    return res.json({
      ...cadet,
      role: displayRole,
      rank: cadet.rank_name,
      profile_image_url: cadet.profile_image_url || cadet.legacy_profile_image_url || null,
    });
  } catch (err) {
    console.error("Get Profile Error:", err);
    res.status(500).json({ message: "Server Error" });
  }
};

const updateProfile = async (req, res) => {
  try {
    const io = req.app.locals.io;
    const { user_id, regimental_no, role } = req.user;
    const { bio } = req.body;

    const resolvedUserId = await resolveUserId({ user_id, regimental_no });
    if (!resolvedUserId) {
      return res.status(400).json({ message: "User identity missing in token" });
    }

    let imageUrl;
    if (req.file) {
      const result = await uploadToCloudinary(req.file.buffer, "ncc-nexus/profile-images");
      imageUrl = result.secure_url;
    }

    if (role === "ALUMNI") {
      if (!imageUrl) {
        return res.status(400).json({ message: "No profile image provided" });
      }

      const updated = await db("users")
        .where("user_id", resolvedUserId)
        .update({ profile_image_url: imageUrl });

      if (!updated) {
        return res.status(404).json({ message: "User not found" });
      }

      // 🔥 Emit avatar update for feed
const user = await db("users")
  .where("user_id", resolvedUserId)
  .select("college_id")
  .first();

if (user?.college_id) {
  io.of("/feed")
    .to(`feed:college:${user.college_id}`)
    .emit("feed:avatar_update", {
      user_id: resolvedUserId,
      profile_image_url: imageUrl,
    });
}

return res.json({
  message: "Profile updated successfully",
  profile_image_url: imageUrl,
});
    }

    const cadetUpdateData = {
      ...(bio !== undefined && { bio }),
    };

    if (Object.keys(cadetUpdateData).length > 0) {
      await db("cadet_profiles")
        .where({ regimental_no })
        .update(cadetUpdateData);
    }

    if (imageUrl) {
      const updated = await db("users")
        .where("user_id", resolvedUserId)
        .update({ profile_image_url: imageUrl });

        // 🔥 Emit avatar update for feed
const profile = await db("cadet_profiles")
  .where({ user_id: resolvedUserId })
  .select("college_id", "regimental_no")
  .first();

if (profile?.college_id) {
  io.of("/feed")
    .to(`feed:college:${profile.college_id}`)
    .emit("feed:avatar_update", {
      regimental_no: profile.regimental_no,
      profile_image_url: imageUrl,
    });
}

      if (!updated) {
        return res.status(404).json({ message: "User not found" });
      }
    }

    res.json({
      message: "Profile updated successfully",
      profile_image_url: imageUrl,
    });
  } catch (err) {
    console.error("Update Profile Error:", err);
    res.status(500).json({
      message: err.message || "Server Error",
    });
  }
};

const getRankHistory = async (req, res) => {
  try {
    const { regimental_no } = req.user;

    const history = await db("cadet_rank_history as h")
      .join("cadet_ranks as r", "h.rank_id", "r.id")
      .where("h.regimental_no", regimental_no)
      .select("r.rank_name", "h.start_date", "h.end_date")
      .orderBy("h.start_date", "desc");

    res.json(history);
  } catch (err) {
    console.error("Rank History Error:", err);
    res.status(500).json({ message: "Server Error" });
  }
};

module.exports = {
  getProfile,
  updateProfile,
  getRankHistory,
};
