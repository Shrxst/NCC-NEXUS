exports.up = async function (knex) {

  await knex.schema.alterTable("comments", (t) => {

    // Nested replies
    t.integer("parent_comment_id")
      .references("comment_id")
      .inTable("comments")
      .onDelete("CASCADE");

    // Soft delete + edit
    t.timestamp("updated_at").defaultTo(knex.fn.now());
    t.timestamp("deleted_at");

    // Pin feature
    t.boolean("is_pinned").defaultTo(false);

    t.integer("pinned_by")
      .references("user_id")
      .inTable("users")
      .onDelete("SET NULL");

    t.timestamp("pinned_at");

    // Optional performance
    t.integer("likes_count").defaultTo(0);
  });

  // Indexes
  await knex.schema.raw(`
    CREATE INDEX idx_comments_post_created 
    ON comments (post_id, created_at);
  `);

  await knex.schema.raw(`
    CREATE INDEX idx_comments_parent_created 
    ON comments (parent_comment_id, created_at);
  `);

  await knex.schema.raw(`
    CREATE INDEX idx_comments_regimental 
    ON comments (regimental_no);
  `);

    await knex.schema.createTable("comment_likes", (t) => {
    t.integer("comment_id")
      .references("comment_id")
      .inTable("comments")
      .onDelete("CASCADE");

    t.string("regimental_no")
      .references("regimental_no")
      .inTable("cadet_profiles")
      .onDelete("CASCADE");

    t.timestamp("created_at").defaultTo(knex.fn.now());

    t.primary(["comment_id", "regimental_no"]);
  });

    await knex.schema.createTable("comment_reports", (t) => {
    t.increments("report_id").primary();

    t.integer("comment_id")
      .references("comment_id")
      .inTable("comments")
      .onDelete("CASCADE");

    t.string("reported_by_regimental_no")
      .references("regimental_no")
      .inTable("cadet_profiles")
      .onDelete("CASCADE");

    t.text("reason");

    t.enu("status", ["open", "reviewed", "resolved"])
      .defaultTo("open");

    t.timestamp("created_at").defaultTo(knex.fn.now());

    t.unique(
      ["comment_id", "reported_by_regimental_no"],
      "uq_comment_reports_unique"
    );
  });
};

exports.down = async function (knex) {

  await knex.schema.dropTableIfExists("comment_reports");
  await knex.schema.dropTableIfExists("comment_likes");

  await knex.schema.alterTable("comments", (t) => {
    t.dropColumn("parent_comment_id");
    t.dropColumn("updated_at");
    t.dropColumn("deleted_at");
    t.dropColumn("is_pinned");
    t.dropColumn("pinned_by");
    t.dropColumn("pinned_at");
    t.dropColumn("likes_count");
  });

  await knex.schema.raw("DROP INDEX IF EXISTS idx_comments_post_created");
  await knex.schema.raw("DROP INDEX IF EXISTS idx_comments_parent_created");
  await knex.schema.raw("DROP INDEX IF EXISTS idx_comments_regimental");
};