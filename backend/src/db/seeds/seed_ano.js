const bcrypt = require("bcrypt");

exports.seed = async function (knex) {

  /* -------------------------------
      1️⃣ Prevent duplicate seed
  --------------------------------*/
  const existingANO = await knex("users")
    .where({ email: "ano@ncc.com" })
    .first();

  if (existingANO) {
    console.log("Seed already exists. Skipping...");
    return;
  }

  /* -------------------------------
      2️⃣ Seed Colleges
  --------------------------------*/
  const [college] = await knex("colleges")
    .insert({
      college_code: "0801",
      college_name: "Shri Govindram Seksaria Institute of Technology and Science",
      short_name: "SGSITS",
      city: "Indore",
    })
    .returning("*");

  /* -------------------------------
      3️⃣ Seed Cadet Ranks
  --------------------------------*/
  const ranks = [
    "Senior Under Officer",
    "Under Officer",
    "Company Sergeant Major",
    "Company Quarter Master Sergeant",
    "Sergeant",
    "Corporal",
    "Lance Corporal",
    "Cadet",
  ];

  for (const rank of ranks) {
    await knex("cadet_ranks")
      .insert({ rank_name: rank })
      .onConflict("rank_name")
      .ignore();
  }

  /* -------------------------------
      4️⃣ Seed Cadet Designations
  --------------------------------*/
  const designations = ["Cadet", "SUO"];

  for (const role of designations) {
    await knex("cadet_designations")
      .insert({ name: role })
      .onConflict("name")
      .ignore();
  }

  /* -------------------------------
      5️⃣ Create ANO User
  --------------------------------*/
  const password = "ANO@123"; // temporary
  const password_hash = await bcrypt.hash(password, 10);

  const [user] = await knex("users")
    .insert({
      username: "ANO Admin",
      email: "ano@ncc.com",
      password_hash,
      role: "ANO",
      college_id: college.college_id,
    })
    .returning("*");

  /* -------------------------------
      6️⃣ Create ANO Profile
  --------------------------------*/
  await knex("anos").insert({
    user_id: user.user_id,
    designation: "Associate NCC Officer",
    appointment_date: new Date(),
  });

  console.log("✅ Initial seed completed successfully");
};