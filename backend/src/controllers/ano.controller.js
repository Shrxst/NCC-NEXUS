const db = require("../db/knex");
const bcrypt = require("bcrypt");
const crypto = require("crypto");
const { sendMail } = require("../services/mail.service");

// Helper to get ANO's college ID securely
const getAnoContext = async (userId) => {
  const user = await db("users").where({ user_id: userId, role: "ANO" }).first();
  if (!user) throw new Error("Unauthorized: User is not an ANO");
  return user;
};

/**
 * GET /ano/dashboard/stats
 * Returns summary for the dashboard
 */
const getDashboardStats = async (req, res) => {
  try {
    const ano = await getAnoContext(req.user.user_id);

    // 1. Total Cadets
    const [cadetCount] = await db("cadet_profiles")
      .where({ college_id: ano.college_id })
      .count("regimental_no as count");

    // 2. Total Posts by Cadets of this college
    // Join posts -> cadet_profiles -> filter by college
    const [postCount] = await db("posts")
      .join("cadet_profiles", "posts.regimental_no", "cadet_profiles.regimental_no")
      .where("cadet_profiles.college_id", ano.college_id)
      .count("posts.post_id as count");

    // 3. Pending verification (Since schema has no is_verified, we assume all are active)
    // We return 0 for pending to keep frontend happy
    
    res.json({
      total_cadets: parseInt(cadetCount.count),
      verified_cadets: parseInt(cadetCount.count), 
      pending_cadets: 0, 
      total_posts: parseInt(postCount.count),
    });

  } catch (err) {
    console.error("Dashboard Stats Error:", err);
    res.status(500).json({ message: "Server Error" });
  }
};

/**
 * POST /ano/cadets
 * Adds a new cadet, creates user, profile, role history, and sends email.
 */
const addCadet = async (req, res) => {
  const { full_name, email, regimental_no, rank, role, joining_year } = req.body;

  if (!full_name || !email || !regimental_no) {
    return res.status(400).json({ message: "Missing required fields" });
  }

  try {
    const ano = await getAnoContext(req.user.user_id);

    await db.transaction(async (trx) => {

      const tempPassword = crypto.randomBytes(4).toString("hex");
      const password_hash = await bcrypt.hash(tempPassword, 10);

      const systemRole = role === "Alumni" ? "ALUMNI" : "CADET";

      // 1️⃣ Create User
      const [user] = await trx("users")
        .insert({
          username: full_name,
          email,
          password_hash,
          role: systemRole,
          college_id: ano.college_id,
        })
        .returning("user_id");

      // 2️⃣ Resolve rank (default to Cadet if not provided)
     let resolvedRank = rank;

// If rank is empty OR "None" OR Alumni → default to Cadet
if (!resolvedRank || resolvedRank === "None" || role === "Alumni") {
  resolvedRank = "Cadet";
}

const rankRecord = await trx("cadet_ranks")
  .where({ rank_name: resolvedRank })
  .first();

if (!rankRecord)
  throw new Error(`Invalid Rank: ${resolvedRank}`);

      // 3️⃣ ALWAYS create cadet_profile
      await trx("cadet_profiles").insert({
        regimental_no,
        user_id: user.user_id,
        full_name,
        email,
        joining_year: parseInt(joining_year) || new Date().getFullYear(),
        college_id: ano.college_id,
        rank_id: rankRecord.id,
      });

      // 4️⃣ Insert rank history (even for Alumni — historical record)
      await trx("cadet_rank_history").insert({
        regimental_no,
        rank_id: rankRecord.id,
        promoted_by: ano.user_id,
        start_date: new Date(),
      });

      // 5️⃣ If Alumni → insert extra metadata
      if (role === "Alumni") {
        await trx("alumni").insert({
          user_id: user.user_id,
          graduation_year: joining_year || new Date().getFullYear(),
        });
      }

      // 6️⃣ Send email
      await sendMail({
        to: email,
        subject: "Welcome to NCC Nexus - Login Credentials",
        html: `
          <h2>Welcome, ${full_name}</h2>
          <p><strong>Regimental No:</strong> ${regimental_no}</p>
          <p><strong>Temporary Password:</strong> ${tempPassword}</p>
          <p>Please login and change your password.</p>
        `,
      });

    });

    res.json({ message: "User added successfully" });

  } catch (err) {
    console.error("Add Cadet Error:", err);

    if (err.code === "23505") {
      return res.status(409).json({
        message: "Email or Regimental Number already exists",
      });
    }

    res.status(500).json({ message: err.message });
  }
};

/**
 * GET /ano/cadets
 * Get all cadets for the logged-in ANO's college
 */
const getCadets = async (req, res) => {
  try {
    const ano = await getAnoContext(req.user.user_id);

    const users = await db("cadet_profiles as cp")
      .join("users as u", "cp.user_id", "u.user_id")
      .join("colleges as c", "cp.college_id", "c.college_id")
      .leftJoin("cadet_ranks as r", "cp.rank_id", "r.id")
      .where("cp.college_id", ano.college_id)
      .select(
        "cp.regimental_no",
        "u.username as name",
        "u.email",
        "u.role as system_role",
        "r.rank_name",
        "c.short_name as unit"
      );

    const formatted = users.map(user => {

      let roleLabel = "Cadet";

      if (user.system_role === "ALUMNI") {
        roleLabel = "Alumni";
      } else if (user.rank_name === "Senior Under Officer") {
        roleLabel = "SUO";
      }

      return {
        regimental_no: user.regimental_no,
        name: user.name,
        email: user.email,
        unit: user.unit,
        rank: user.rank_name || "-",
        role: roleLabel,
      };
    });

    res.json(formatted);

  } catch (err) {
    console.error("Get Cadets Error:", err);
    res.status(500).json({ message: "Server Error" });
  }
};

/**
 * PUT /ano/cadets/:regimental_no
 * Update cadet details
 */
const updateCadet = async (req, res) => {
  const { regimental_no } = req.params;
  const { name, email, rank, role } = req.body;

  try {
    const ano = await getAnoContext(req.user.user_id);

    const cadet = await db("cadet_profiles")
      .where({ regimental_no, college_id: ano.college_id })
      .first();

    if (!cadet)
      return res.status(404).json({ message: "Cadet not found in your unit" });

    await db.transaction(async (trx) => {

      // Update basic info
      await trx("cadet_profiles")
        .where({ regimental_no })
        .update({ full_name: name, email });

      await trx("users")
        .where({ user_id: cadet.user_id })
        .update({ username: name, email });

      // Handle Alumni conversion
      if (role === "Alumni") {

  await trx("users")
    .where({ user_id: cadet.user_id })
    .update({ role: "ALUMNI" });

  const existingAlumni = await trx("alumni")
    .where({ user_id: cadet.user_id })
    .first();

  if (!existingAlumni) {
    await trx("alumni").insert({
      user_id: cadet.user_id,
      graduation_year: new Date().getFullYear(),
    });
  }

  return;
}

      // Handle Rank promotion
      if (rank) {
        const rankRecord = await trx("cadet_ranks")
          .where({ rank_name: rank })
          .first();

        if (!rankRecord)
          throw new Error(`Invalid Rank: ${rank}`);

        if (cadet.rank_id !== rankRecord.id) {

          await trx("cadet_rank_history")
            .where({ regimental_no })
            .whereNull("end_date")
            .update({ end_date: new Date() });

          await trx("cadet_rank_history").insert({
            regimental_no,
            rank_id: rankRecord.id,
            promoted_by: ano.user_id,
            start_date: new Date(),
          });

          await trx("cadet_profiles")
            .where({ regimental_no })
            .update({ rank_id: rankRecord.id });
        }
      }
    });

    res.json({ message: "Updated successfully" });

  } catch (err) {
    console.error("Update Error:", err);
    res.status(500).json({ message: err.message });
  }
};

/**
 * DELETE /ano/cadets/:regimental_no
 */
const deleteCadet = async (req, res) => {
  const { regimental_no } = req.params;

  try {
    const ano = await getAnoContext(req.user.user_id);

    // Check ownership
    const cadet = await db("cadet_profiles")
      .where({ regimental_no, college_id: ano.college_id })
      .first();

    if (!cadet) return res.status(404).json({ message: "Cadet not found" });

    // Cascade delete handles profile, but we must delete USER manually if not cascaded in DB properly.
    // Init_schema says ON DELETE CASCADE for profile -> user? 
    // Wait, Schema says: cadet_profiles references users. 
    // So if we delete USER, profile deletes. 
    
    await db("users").where({ user_id: cadet.user_id }).del();

    res.json({ message: "Cadet deleted successfully" });
  } catch (err) {
    console.error("Delete Error:", err);
    res.status(500).json({ message: "Server Error" });
  }
};

/**
 * GET /ano/cadets/search
 */
const searchCadets = async (req, res) => {
  const { q } = req.query;
  if (!q) return res.status(400).json({ message: "Query required" });

  try {
    const ano = await getAnoContext(req.user.user_id);

    const cadets = await db("cadet_profiles as cp")
      .join("cadet_ranks as r", "cp.rank_id", "r.id")
      .join("colleges as c", "cp.college_id", "c.college_id")
      .where("cp.college_id", ano.college_id)
      .andWhere(function () {
        this.whereILike("cp.full_name", `%${q}%`)
          .orWhereILike("cp.email", `%${q}%`)
          .orWhereILike("cp.regimental_no", `%${q}%`);
      })
      .select(
        "cp.regimental_no",
        "cp.full_name as name",
        "cp.email",
        "r.rank_name as rank",
        "c.short_name as unit"
      );

    res.json(cadets);

  } catch (err) {
    console.error("Search Error:", err);
    res.status(500).json({ message: "Server Error" });
  }
};

module.exports = {
  getDashboardStats,
  addCadet,
  getCadets,
  updateCadet,
  deleteCadet,
  searchCadets
};