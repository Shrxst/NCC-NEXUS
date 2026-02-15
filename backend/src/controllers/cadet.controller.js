const db = require("../db/knex");

const getProfile = async (req, res) => {
  try {
    const { user_id, role, regimental_no } = req.user;

    if (role === "ALUMNI") {
      const alumni = await db("users as u")
        .join("alumni as a", "u.user_id", "a.user_id")
        .join("colleges as c", "u.college_id", "c.college_id")
        .where("u.user_id", user_id)
        .select(
          "u.username as name",
          "u.email",
          "c.short_name as unit",
          "c.city",
          "a.graduation_year"
        )
        .first();

      if (!alumni)
        return res.status(404).json({ message: "Alumni not found" });

      return res.json({
        ...alumni,
        role: "Alumni",
        rank: "-",
        bio: null,
        profile_image_url: null,
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
        "cp.profile_image_url",
        "r.rank_name",
        "c.short_name as unit",
        "c.city"
      )
      .first();

    if (!cadet)
      return res.status(404).json({ message: "Cadet not found" });

    return res.json({
      ...cadet,
      role: "Cadet",
      rank: cadet.rank_name,
    });

  } catch (err) {
    console.error("Get Profile Error:", err);
    res.status(500).json({ message: "Server Error" });
  }
};

const updateProfile = async (req, res) => {
  try {
    const { regimental_no, role } = req.user;
    const { bio, profile_image_url } = req.body;

    if (role === "ALUMNI") {
      return res.status(400).json({
        message: "Alumni profile editing not supported yet"
      });
    }

    await db("cadet_profiles")
      .where({ regimental_no })
      .update({
        bio,
        profile_image_url,
      });

    res.json({ message: "Profile updated successfully" });

  } catch (err) {
    console.error("Update Profile Error:", err);
    res.status(500).json({ message: "Server Error" });
  }
};

const getRankHistory = async (req, res) => {
  try {
    const { regimental_no } = req.user;

    const history = await db("cadet_rank_history as h")
      .join("cadet_ranks as r", "h.rank_id", "r.id")
      .where("h.regimental_no", regimental_no)
      .select(
        "r.rank_name",
        "h.start_date",
        "h.end_date"
      )
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
