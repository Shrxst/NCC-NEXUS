// 20260303124005_create_donation_module_tables.js

exports.up = async function up(knex) {

  await knex.raw(`CREATE EXTENSION IF NOT EXISTS "pgcrypto";`);


  await knex.raw(`
    DO $$
    BEGIN
      IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'donation_campaign_type_enum') THEN
        CREATE TYPE donation_campaign_type_enum AS ENUM ('EVENT', 'DEFAULT');
      END IF;
    END $$;
  `);

  await knex.raw(`
    DO $$
    BEGIN
      IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'donation_campaign_status_enum') THEN
        CREATE TYPE donation_campaign_status_enum AS ENUM ('ACTIVE', 'CLOSED');
      END IF;
    END $$;
  `);

  await knex.raw(`
    DO $$
    BEGIN
      IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'donation_payment_status_enum') THEN
        CREATE TYPE donation_payment_status_enum AS ENUM ('PENDING', 'SUCCESS', 'FAILED');
      END IF;
    END $$;
  `);


  await knex.schema.createTable("donation_campaigns", (t) => {
    t.bigIncrements("campaign_id").primary();

    t.integer("college_id")
      .notNullable()
      .references("college_id")
      .inTable("colleges")
      .onDelete("CASCADE");

    t.string("title", 255).notNullable();
    t.text("description");

    t.decimal("minimum_amount", 12, 2)
      .notNullable()
      .defaultTo(0);

    t.decimal("target_amount", 12, 2);

    t.decimal("collected_amount", 12, 2)
      .notNullable()
      .defaultTo(0);

    t.specificType("campaign_type", "donation_campaign_type_enum")
      .notNullable();

    t.specificType("status", "donation_campaign_status_enum")
      .notNullable()
      .defaultTo("ACTIVE");

    t.integer("created_by_user_id")
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

    t.index(["college_id", "status"], "idx_donation_campaigns_college_status");
    t.index(["campaign_type"], "idx_donation_campaigns_type");
  });

  // 🔥 Only ONE ACTIVE DEFAULT campaign per college
  await knex.raw(`
    CREATE UNIQUE INDEX uq_default_campaign_per_college
    ON donation_campaigns (college_id)
    WHERE campaign_type = 'DEFAULT' AND status = 'ACTIVE' AND deleted_at IS NULL;
  `);



  await knex.schema.createTable("donations", (t) => {
    t.bigIncrements("donation_id").primary();

    t.bigInteger("campaign_id")
      .notNullable()
      .references("campaign_id")
      .inTable("donation_campaigns")
      .onDelete("CASCADE");

    t.integer("alumni_user_id")
      .notNullable()
      .references("user_id")
      .inTable("users")
      .onDelete("CASCADE");

    t.decimal("amount", 12, 2)
      .notNullable();

    t.boolean("is_anonymous")
      .notNullable()
      .defaultTo(false);

    // 🔥 Razorpay Fields
    t.string("payment_order_id");
    t.string("payment_id");
    t.string("payment_signature");

    t.specificType("payment_status", "donation_payment_status_enum")
      .notNullable()
      .defaultTo("PENDING");

    t.timestamp("created_at")
      .notNullable()
      .defaultTo(knex.fn.now());

    t.timestamp("updated_at")
      .notNullable()
      .defaultTo(knex.fn.now());

    t.index(["campaign_id"], "idx_donations_campaign");
    t.index(["alumni_user_id"], "idx_donations_alumni");
    t.index(["payment_status"], "idx_donations_status");
  });



  await knex.raw(`
    CREATE OR REPLACE FUNCTION set_updated_at_donations()
    RETURNS TRIGGER AS $$
    BEGIN
      NEW.updated_at = NOW();
      RETURN NEW;
    END;
    $$ LANGUAGE plpgsql;
  `);

  await knex.raw(`
    CREATE TRIGGER trg_donation_campaigns_updated_at
    BEFORE UPDATE ON donation_campaigns
    FOR EACH ROW EXECUTE FUNCTION set_updated_at_donations();
  `);

  await knex.raw(`
    CREATE TRIGGER trg_donations_updated_at
    BEFORE UPDATE ON donations
    FOR EACH ROW EXECUTE FUNCTION set_updated_at_donations();
  `);
    // =========================================
  // AUTO CREATE DEFAULT CAMPAIGN FOR EXISTING COLLEGES
  // =========================================

  const colleges = await knex("colleges").select("college_id");

  for (const college of colleges) {
    await knex("donation_campaigns").insert({
      college_id: college.college_id,
      title: "Support Your NCC Unit",
      description: "Contribute anytime to strengthen your NCC unit.",
      minimum_amount: 0,
      target_amount: null,
      campaign_type: "DEFAULT",
      status: "ACTIVE",
      created_by_user_id: null
    });
  }
};


exports.down = async function down(knex) {

  await knex.raw("DROP TRIGGER IF EXISTS trg_donations_updated_at ON donations");
  await knex.raw("DROP TRIGGER IF EXISTS trg_donation_campaigns_updated_at ON donation_campaigns");
  await knex.raw("DROP FUNCTION IF EXISTS set_updated_at_donations");

  await knex.schema.dropTableIfExists("donations");
  await knex.schema.dropTableIfExists("donation_campaigns");

  await knex.raw("DROP TYPE IF EXISTS donation_payment_status_enum");
  await knex.raw("DROP TYPE IF EXISTS donation_campaign_status_enum");
  await knex.raw("DROP TYPE IF EXISTS donation_campaign_type_enum");
};