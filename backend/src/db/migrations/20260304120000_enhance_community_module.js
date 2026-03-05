exports.up = async function up(knex) {
  await knex.raw("ALTER TABLE community_poll_votes DROP CONSTRAINT IF EXISTS community_poll_votes_pkey");
  await knex.raw("ALTER TABLE community_poll_votes ADD PRIMARY KEY (community_post_id, user_id, option_id)");

  await knex.schema.alterTable("community_posts", (t) => {
    t.timestamp("poll_deadline");
    t.boolean("allow_multiple_choices").notNullable().defaultTo(false);
    t.text("moderation_note");
  });

  await knex.raw(`
    DO $$
    BEGIN
      IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'community_media_type_enum') THEN
        CREATE TYPE community_media_type_enum AS ENUM ('IMAGE', 'VIDEO', 'PDF');
      END IF;
    END $$;
  `);

  await knex.schema.createTable("community_post_tags", (t) => {
    t.integer("community_post_id")
      .notNullable()
      .references("community_post_id")
      .inTable("community_posts")
      .onDelete("CASCADE");

    t.string("tag", 80).notNullable();

    t.primary(["community_post_id", "tag"]);
    t.index(["tag"], "idx_comm_post_tags_tag");
  });

  await knex.schema.createTable("community_post_media", (t) => {
    t.increments("media_id").primary();

    t.integer("community_post_id")
      .notNullable()
      .references("community_post_id")
      .inTable("community_posts")
      .onDelete("CASCADE");

    t.specificType("media_type", "community_media_type_enum").notNullable();
    t.text("media_url").notNullable();
    t.string("media_name", 255);
    t.integer("sort_order").notNullable().defaultTo(0);

    t.index(["community_post_id", "media_type"], "idx_comm_post_media_lookup");
  });
};

exports.down = async function down(knex) {
  await knex.raw("ALTER TABLE community_poll_votes DROP CONSTRAINT IF EXISTS community_poll_votes_pkey");
  await knex.raw("ALTER TABLE community_poll_votes ADD PRIMARY KEY (community_post_id, user_id)");

  await knex.schema.dropTableIfExists("community_post_media");
  await knex.schema.dropTableIfExists("community_post_tags");
  await knex.raw("DROP TYPE IF EXISTS community_media_type_enum");

  await knex.schema.alterTable("community_posts", (t) => {
    t.dropColumn("poll_deadline");
    t.dropColumn("allow_multiple_choices");
    t.dropColumn("moderation_note");
  });
};
