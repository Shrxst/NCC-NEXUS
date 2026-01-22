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
  const { full_name, email, regimental_no, role, rank, joining_year } = req.body;

  // Basic Validation
  if (!full_name || !email || !regimental_no || !role || !rank) {
    return res.status(400).json({ message: "Missing required fields" });
  }

  try {
    const ano = await getAnoContext(req.user.user_id);

    await db.transaction(async (trx) => {
      // 1. Resolve Rank Name to ID (Frontend sends string "Sergeant", DB needs ID)
      const rankRecord = await trx("cadet_ranks").where({ rank_name: rank }).first();
      if (!rankRecord) throw new Error(`Invalid Rank: ${rank}`);

      // 2. Resolve Designation/Role Name to ID
      const designationRecord = await trx("cadet_designations").where({ name: role }).first();
      if (!designationRecord) throw new Error(`Invalid Role: ${role}`);

      // 3. Generate Credentials
      const tempPassword = crypto.randomBytes(4).toString("hex"); // e.g., "a3f1b2"
      const password_hash = await bcrypt.hash(tempPassword, 10);

      // 4. Create User Entry
      const [user] = await trx("users")
        .insert({
          username: full_name,
          email,
          password_hash,
          role: "CADET", // System role
          college_id: ano.college_id,
        })
        .returning("user_id");

      // 5. Create Cadet Profile
      await trx("cadet_profiles").insert({
        regimental_no,
        user_id: user.user_id, // Fix: access valid property
        full_name,
        email,
        joining_year: parseInt(joining_year) || new Date().getFullYear(),
        college_id: ano.college_id,
        rank_id: rankRecord.id,
      });

      // 6. Insert Initial Role History
      await trx("cadet_roles").insert({
        regimental_no,
        designation_id: designationRecord.id,
        start_date: new Date(),
      });

      // 7. Send Email (Non-blocking usually, but here we wait to ensure success)
      await sendMail({
        to: email,
        subject: "Welcome to NCC Nexus - Login Credentials",
        html: `
          <div style="font-family: Arial, sans-serif; padding: 20px; border: 1px solid #eee;">
            <h2 style="color: #1a237e;">Welcome, Cadet ${full_name}</h2>
            <p>Your account has been created by your ANO.</p>
            <p><strong>College:</strong> ${ano.college_id} (Your Unit)</p>
            <hr />
            <p><strong>Login Email:</strong> ${email} (or Regimental No: ${regimental_no})</p>
            <p><strong>Temporary Password:</strong> <span style="background: #eee; padding: 5px 10px; font-weight: bold;">${tempPassword}</span></p>
            <hr />
            <p>Please login and change your password immediately.</p>
          </div>
        `,
      });
    });

    res.json({ message: "Cadet added and email sent successfully" });

  } catch (err) {
    console.error("Add Cadet Error:", err);
    // Handle unique constraint violations
    if (err.code === '23505') {
      return res.status(409).json({ message: "Email or Regimental Number already exists" });
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

    const cadets = await db("cadet_profiles as cp")
      .join("users as u", "cp.user_id", "u.user_id")
      .join("colleges as c", "cp.college_id", "c.college_id")
      .join("cadet_ranks as r", "cp.rank_id", "r.id")
      // Left join to get CURRENT role (where end_date is null)
      .leftJoin("cadet_roles as cr", function() {
        this.on("cp.regimental_no", "=", "cr.regimental_no")
            .andOnNull("cr.end_date");
      })
      .leftJoin("cadet_designations as d", "cr.designation_id", "d.id")
      .where("cp.college_id", ano.college_id)
      .select(
        "cp.regimental_no",
        "cp.full_name as name",
        "cp.email",
        "r.rank_name as rank",
        "d.name as role",
        "c.short_name as unit"
      );

    res.json(cadets);

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
  const { name, email, role, rank } = req.body;

  try {
    const ano = await getAnoContext(req.user.user_id);

    // Verify cadet belongs to this ANO's college
    const cadet = await db("cadet_profiles").where({ regimental_no, college_id: ano.college_id }).first();
    if (!cadet) return res.status(404).json({ message: "Cadet not found in your unit" });

    await db.transaction(async (trx) => {
      // 1. Resolve IDs
      const rankRecord = await trx("cadet_ranks").where({ rank_name: rank }).first();
      const desigRecord = await trx("cadet_designations").where({ name: role }).first();

      // 2. Update Profile & User Email
      if (rankRecord) {
        await trx("cadet_profiles")
          .where({ regimental_no })
          .update({ 
            full_name: name, 
            email: email,
            rank_id: rankRecord.id 
          });
      }

      await trx("users").where({ user_id: cadet.user_id }).update({ email, username: name });

      // 3. Update Role History if role changed
      // Check current role
      const currentRole = await trx("cadet_roles")
        .where({ regimental_no })
        .whereNull("end_date")
        .first();

      if (desigRecord && (!currentRole || currentRole.designation_id !== desigRecord.id)) {
        // End previous role
        if (currentRole) {
          await trx("cadet_roles")
            .where({ role_id: currentRole.role_id })
            .update({ end_date: new Date() });
        }
        // Start new role
        await trx("cadet_roles").insert({
          regimental_no,
          designation_id: desigRecord.id,
          start_date: new Date(),
        });
      }
    });

    res.json({ message: "Cadet updated successfully" });

  } catch (err) {
    console.error("Update Error:", err);
    res.status(500).json({ message: "Server Error" });
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
      .leftJoin("cadet_roles as cr", function() {
        this.on("cp.regimental_no", "=", "cr.regimental_no").andOnNull("cr.end_date");
      })
      .leftJoin("cadet_designations as d", "cr.designation_id", "d.id")
      .where("cp.college_id", ano.college_id)
      .andWhere(function() {
        this.whereILike("cp.full_name", `%${q}%`)
          .orWhereILike("cp.email", `%${q}%`)
          .orWhereILike("cp.regimental_no", `%${q}%`);
      })
      .select(
        "cp.regimental_no",
        "cp.full_name as name",
        "cp.email",
        "r.rank_name as rank",
        "d.name as role",
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