const bcrypt = require("bcrypt");

exports.seed = async function (knex) {

  const existingANO = await knex("users")
    .where({ email: "ano@ncc.com" })
    .first();

  if (existingANO) {
    console.log("Seed already exists. Skipping...");
    return;
  }

  // ======================
  // 1. Seed College
  // ======================
  const [college] = await knex("colleges")
    .insert({
      college_code: "0801",
      college_name: "Shri Govindram Seksaria Institute of Technology and Science",
      short_name: "SGSITS",
      city: "Indore",
    })
    .returning("*");

  // ======================
  // 2. Seed Cadet Ranks
  // ======================
  const ranks = [
    "Cadet",
    "Lance Corporal",
    "Corporal",
    "Sergeant",
    "Company Quarter Master Sergeant",
    "Company Sergeant Major",
    "Under Officer",
    "Senior Under Officer"
  ];

  for (const rank of ranks) {
    await knex("cadet_ranks")
      .insert({ rank_name: rank })
      .onConflict("rank_name")
      .ignore();
  }

  // ======================
  // 3. Create ANO User
  // ======================
  const password_hash = await bcrypt.hash("ANO@123", 10);

  const [user] = await knex("users")
    .insert({
      username: "ANO Admin",
      email: "ano@ncc.com",
      password_hash,
      role: "ANO",
      college_id: college.college_id,
    })
    .returning("*");

  // ======================
  // 4. Create ANO Profile
  // ======================
  await knex("anos").insert({
    user_id: user.user_id,
    designation: "Associate NCC Officer",
    appointment_date: new Date(),
  });

  console.log("Initial seed completed successfully");
};
