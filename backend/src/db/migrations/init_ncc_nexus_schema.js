exports.up = async function (knex) {

  // ======================
  // 1. COLLEGES
  // ======================
  await knex.schema.createTable("colleges", (t) => {
    t.increments("college_id").primary();
    t.string("college_code").unique().notNullable();
    t.string("college_name").notNullable();
    t.string("short_name").notNullable();
    t.string("city").notNullable();
  });

  // ======================
  // 2. USERS
  // ======================
  await knex.schema.createTable("users", (t) => {
    t.increments("user_id").primary();
    t.string("username").notNullable();
    t.string("email").unique().notNullable();
    t.string("password_hash").notNullable();
    t.enu("role", ["ANO", "CADET", "ALUMNI"]).notNullable();
    t.integer("college_id")
      .references("college_id")
      .inTable("colleges");
    t.timestamp("created_at").defaultTo(knex.fn.now());
  });

  // ======================
  // 3. ANOS
  // ======================
  await knex.schema.createTable("anos", (t) => {
    t.increments("ano_id").primary();
    t.integer("user_id")
      .unique()
      .references("user_id")
      .inTable("users")
      .onDelete("CASCADE");
    t.string("designation");
    t.date("appointment_date");
  });

  // ======================
  // 4. ALUMNI
  // ======================
  await knex.schema.createTable("alumni", (t) => {
    t.increments("alumni_id").primary();
    t.integer("user_id")
      .unique()
      .references("user_id")
      .inTable("users")
      .onDelete("CASCADE");
    t.integer("graduation_year");
    t.string("donation_badges");
  });

  // ======================
  // 5. CADET RANKS
  // ======================
  await knex.schema.createTable("cadet_ranks", (t) => {
    t.increments("id").primary();
    t.string("rank_name").unique().notNullable();
  });

  // ======================
  // 6. CADET PROFILES
  // ======================
  await knex.schema.createTable("cadet_profiles", (t) => {
  t.string("regimental_no").primary();

  t.integer("user_id")
    .unique()
    .references("user_id")
    .inTable("users")
    .onDelete("CASCADE");

  t.string("full_name").notNullable();
  t.string("email").notNullable();
  t.date("dob");
  t.integer("joining_year");

  t.integer("college_id")
    .references("college_id")
    .inTable("colleges");

  t.integer("rank_id")
    .references("id")
    .inTable("cadet_ranks");

  t.text("bio");                
  t.string("profile_image_url"); 
});

  // ======================
  // 7. CADET RANK HISTORY
  // ======================
  await knex.schema.createTable("cadet_rank_history", (t) => {
    t.increments("id").primary();

    t.string("regimental_no")
      .references("regimental_no")
      .inTable("cadet_profiles")
      .onDelete("CASCADE");

    t.integer("rank_id")
      .references("id")
      .inTable("cadet_ranks");

    t.integer("promoted_by")
      .references("user_id")
      .inTable("users");

    t.date("start_date").notNullable();
    t.date("end_date");

    t.timestamp("created_at").defaultTo(knex.fn.now());
  });

  // ======================
  // 8. POSTS
  // ======================
  await knex.schema.createTable("posts", (t) => {
    t.increments("post_id").primary();

    t.string("regimental_no")
      .notNullable()
      .references("regimental_no")
      .inTable("cadet_profiles")
      .onDelete("CASCADE");

    t.enu("post_type", ["text", "image", "video"])
      .notNullable()
      .defaultTo("text");

    t.text("content_text");
    t.string("media_url");

    t.integer("likes_count").defaultTo(0);
    t.integer("comments_count").defaultTo(0);

    t.timestamp("created_at").defaultTo(knex.fn.now());
  });

  // ======================
  // 9. COMMENTS
  // ======================
  await knex.schema.createTable("comments", (t) => {
    t.increments("comment_id").primary();

    t.integer("post_id")
      .notNullable()
      .references("post_id")
      .inTable("posts")
      .onDelete("CASCADE");

    t.string("regimental_no")
      .notNullable()
      .references("regimental_no")
      .inTable("cadet_profiles")
      .onDelete("CASCADE");

    t.text("content").notNullable();
    t.timestamp("created_at").defaultTo(knex.fn.now());
  });

  // ======================
  // 10. POST LIKES
  // ======================
  await knex.schema.createTable("post_likes", (t) => {
    t.integer("post_id")
      .references("post_id")
      .inTable("posts")
      .onDelete("CASCADE");

    t.string("regimental_no")
      .references("regimental_no")
      .inTable("cadet_profiles")
      .onDelete("CASCADE");

    t.timestamp("created_at").defaultTo(knex.fn.now());

    t.primary(["post_id", "regimental_no"]);
  });

  // ======================
  // 11. CHAT MESSAGES
  // ======================
  await knex.schema.createTable("chat_messages", (t) => {
    t.increments("id").primary();
    t.string("sender").notNullable();
    t.text("message").notNullable();
    t.timestamp("created_at").defaultTo(knex.fn.now());
  });
};

exports.down = async function (knex) {
  await knex.schema.dropTableIfExists("chat_messages");
  await knex.schema.dropTableIfExists("post_likes");
  await knex.schema.dropTableIfExists("comments");
  await knex.schema.dropTableIfExists("posts");
  await knex.schema.dropTableIfExists("cadet_rank_history");
  await knex.schema.dropTableIfExists("cadet_profiles");
  await knex.schema.dropTableIfExists("cadet_ranks");
  await knex.schema.dropTableIfExists("alumni");
  await knex.schema.dropTableIfExists("anos");
  await knex.schema.dropTableIfExists("users");
  await knex.schema.dropTableIfExists("colleges");
};
