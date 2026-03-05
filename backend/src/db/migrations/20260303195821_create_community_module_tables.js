// 20260305120000_create_community_module_tables.js

exports.up = async function up(knex) {


  await knex.raw(`
    DO $$
    BEGIN
      IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'community_post_type_enum') THEN
        CREATE TYPE community_post_type_enum AS ENUM ('UPDATE', 'EVENT', 'POLL', 'MEDIA');
      END IF;
    END $$;
  `);

  await knex.raw(`
    DO $$
    BEGIN
      IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'community_post_status_enum') THEN
        CREATE TYPE community_post_status_enum AS ENUM ('PENDING', 'APPROVED', 'REJECTED');
      END IF;
    END $$;
  `);

  await knex.raw(`
    DO $$
    BEGIN
      IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'community_reaction_type_enum') THEN
        CREATE TYPE community_reaction_type_enum AS ENUM ('LIKE', 'LOVE', 'FIRE');
      END IF;
    END $$;
  `);

  await knex.schema.createTable("community_posts", (t) => {
    t.increments("community_post_id").primary();

    t.integer("college_id")
      .notNullable()
      .references("college_id")
      .inTable("colleges")
      .onDelete("CASCADE");

    t.integer("created_by_user_id")
      .notNullable()
      .references("user_id")
      .inTable("users")
      .onDelete("CASCADE");

    t.specificType("post_type", "community_post_type_enum")
      .notNullable();

    t.specificType("status", "community_post_status_enum")
      .notNullable()
      .defaultTo("PENDING");

    t.string("title", 255);
    t.text("content");

    t.boolean("is_pinned")
      .notNullable()
      .defaultTo(false);

    t.timestamp("approved_at");
    t.integer("approved_by_user_id")
      .references("user_id")
      .inTable("users")
      .onDelete("SET NULL");

    t.timestamp("created_at")
      .notNullable()
      .defaultTo(knex.fn.now());

    t.timestamp("updated_at")
      .notNullable()
      .defaultTo(knex.fn.now());

    t.timestamp("deleted_at");

    t.index(["college_id", "status"], "idx_comm_posts_college_status");
    t.index(["college_id", "created_at"], "idx_comm_posts_listing");
    t.index(["deleted_at"], "idx_comm_posts_deleted");
  });


  await knex.schema.createTable("community_event_details", (t) => {
    t.increments("id").primary();

    t.integer("community_post_id")
      .unique()
      .notNullable()
      .references("community_post_id")
      .inTable("community_posts")
      .onDelete("CASCADE");

    t.timestamp("event_date").notNullable();
    t.string("location", 255);

    t.index(["event_date"], "idx_comm_event_date");
  });

  await knex.schema.createTable("community_poll_options", (t) => {
    t.increments("option_id").primary();

    t.integer("community_post_id")
      .notNullable()
      .references("community_post_id")
      .inTable("community_posts")
      .onDelete("CASCADE");

    t.string("option_text", 255).notNullable();

    t.index(["community_post_id"], "idx_comm_poll_options_post");
  });


  await knex.schema.createTable("community_poll_votes", (t) => {
    t.integer("community_post_id")
      .notNullable()
      .references("community_post_id")
      .inTable("community_posts")
      .onDelete("CASCADE");

    t.integer("option_id")
      .notNullable()
      .references("option_id")
      .inTable("community_poll_options")
      .onDelete("CASCADE");

    t.integer("user_id")
      .notNullable()
      .references("user_id")
      .inTable("users")
      .onDelete("CASCADE");

    t.timestamp("created_at")
      .notNullable()
      .defaultTo(knex.fn.now());

    t.primary(["community_post_id", "user_id"]);

    t.index(["option_id"], "idx_comm_poll_votes_option");
  });

  await knex.schema.createTable("community_reactions", (t) => {
    t.integer("community_post_id")
      .notNullable()
      .references("community_post_id")
      .inTable("community_posts")
      .onDelete("CASCADE");

    t.integer("user_id")
      .notNullable()
      .references("user_id")
      .inTable("users")
      .onDelete("CASCADE");

    t.specificType("reaction_type", "community_reaction_type_enum")
      .notNullable();

    t.timestamp("created_at")
      .notNullable()
      .defaultTo(knex.fn.now());

    t.primary(["community_post_id", "user_id"]);

    t.index(["reaction_type"], "idx_comm_reactions_type");
  });


  await knex.schema.createTable("community_comments", (t) => {
    t.increments("comment_id").primary();

    t.integer("community_post_id")
      .notNullable()
      .references("community_post_id")
      .inTable("community_posts")
      .onDelete("CASCADE");

    t.integer("user_id")
      .notNullable()
      .references("user_id")
      .inTable("users")
      .onDelete("CASCADE");

    t.text("content").notNullable();

    t.integer("parent_comment_id")
      .references("comment_id")
      .inTable("community_comments")
      .onDelete("CASCADE");

    t.timestamp("created_at")
      .notNullable()
      .defaultTo(knex.fn.now());

    t.timestamp("updated_at")
      .notNullable()
      .defaultTo(knex.fn.now());

    t.timestamp("deleted_at");

    t.index(["community_post_id", "created_at"], "idx_comm_comments_post");
    t.index(["parent_comment_id"], "idx_comm_comments_parent");
  });

  await knex.schema.createTable("community_comment_likes", (t) => {
    t.integer("comment_id")
      .notNullable()
      .references("comment_id")
      .inTable("community_comments")
      .onDelete("CASCADE");

    t.integer("user_id")
      .notNullable()
      .references("user_id")
      .inTable("users")
      .onDelete("CASCADE");

    t.timestamp("created_at")
      .notNullable()
      .defaultTo(knex.fn.now());

    t.primary(["comment_id", "user_id"]);
  });


  await knex.raw(`
    CREATE OR REPLACE FUNCTION set_updated_at_community()
    RETURNS TRIGGER AS $$
    BEGIN
      NEW.updated_at = NOW();
      RETURN NEW;
    END;
    $$ LANGUAGE plpgsql;
  `);

  await knex.raw(`
    CREATE TRIGGER trg_community_posts_updated_at
    BEFORE UPDATE ON community_posts
    FOR EACH ROW EXECUTE FUNCTION set_updated_at_community();
  `);

  await knex.raw(`
    CREATE TRIGGER trg_community_comments_updated_at
    BEFORE UPDATE ON community_comments
    FOR EACH ROW EXECUTE FUNCTION set_updated_at_community();
  `);
};

exports.down = async function down(knex) {

  await knex.raw("DROP TRIGGER IF EXISTS trg_community_comments_updated_at ON community_comments");
  await knex.raw("DROP TRIGGER IF EXISTS trg_community_posts_updated_at ON community_posts");
  await knex.raw("DROP FUNCTION IF EXISTS set_updated_at_community");

  await knex.schema.dropTableIfExists("community_comment_likes");
  await knex.schema.dropTableIfExists("community_comments");
  await knex.schema.dropTableIfExists("community_reactions");
  await knex.schema.dropTableIfExists("community_poll_votes");
  await knex.schema.dropTableIfExists("community_poll_options");
  await knex.schema.dropTableIfExists("community_event_details");
  await knex.schema.dropTableIfExists("community_posts");

  await knex.raw("DROP TYPE IF EXISTS community_reaction_type_enum");
  await knex.raw("DROP TYPE IF EXISTS community_post_status_enum");
  await knex.raw("DROP TYPE IF EXISTS community_post_type_enum");
};