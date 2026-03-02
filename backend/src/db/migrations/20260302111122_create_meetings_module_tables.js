// 20260302111122_create_meetings_module_tables.js

exports.up = async function up(knex) {

  // =========================================
  // EXTENSION
  // =========================================
  await knex.raw(`CREATE EXTENSION IF NOT EXISTS "pgcrypto";`);

  // =========================================
  // ENUM TYPES
  // =========================================

  await knex.raw(`
    DO $$
    BEGIN
      IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'meeting_status_enum') THEN
        CREATE TYPE meeting_status_enum AS ENUM ('SCHEDULED', 'LIVE', 'COMPLETED');
      END IF;
    END $$;
  `);

  await knex.raw(`
    DO $$
    BEGIN
      IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'meeting_waiting_status_enum') THEN
        CREATE TYPE meeting_waiting_status_enum AS ENUM ('WAITING', 'ADMITTED', 'REJECTED');
      END IF;
    END $$;
  `);

  await knex.raw(`
    DO $$
    BEGIN
      IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'meeting_attendance_status_enum') THEN
        CREATE TYPE meeting_attendance_status_enum AS ENUM ('PRESENT', 'ABSENT');
      END IF;
    END $$;
  `);

  // =========================================
  // 1️⃣ MEETINGS TABLE
  // =========================================

  await knex.schema.createTable("meetings", (t) => {
    t.bigIncrements("meeting_id").primary();

    t.integer("college_id")
      .notNullable()
      .references("college_id")
      .inTable("colleges")
      .onDelete("CASCADE");

    t.string("title", 255).notNullable();
    t.text("description");

    t.timestamp("scheduled_at").notNullable();
    t.timestamp("actual_start_time");
    t.timestamp("actual_end_time");

    t.specificType("status", "meeting_status_enum")
      .notNullable()
      .defaultTo("SCHEDULED");

    t.integer("created_by_user_id")
      .notNullable()
      .references("user_id")
      .inTable("users")
      .onDelete("RESTRICT");

    t.string("jitsi_room_name", 255).notNullable();

    t.timestamp("created_at").notNullable().defaultTo(knex.fn.now());
    t.timestamp("updated_at").notNullable().defaultTo(knex.fn.now());
    t.timestamp("deleted_at");

    t.index(["college_id", "status"], "idx_meetings_college_status");
    t.index(["scheduled_at"], "idx_meetings_scheduled");
    t.index(["deleted_at"], "idx_meetings_deleted");
  });

  // =========================================
  // 2️⃣ MEETING WAITING ROOM
  // =========================================

  await knex.schema.createTable("meeting_waiting_room", (t) => {
    t.bigIncrements("waiting_id").primary();

    t.bigInteger("meeting_id")
      .notNullable()
      .references("meeting_id")
      .inTable("meetings")
      .onDelete("CASCADE");

    t.integer("user_id")
      .notNullable()
      .references("user_id")
      .inTable("users")
      .onDelete("CASCADE");

    t.specificType("status", "meeting_waiting_status_enum")
      .notNullable()
      .defaultTo("WAITING");

    t.timestamp("request_time").notNullable().defaultTo(knex.fn.now());
    t.timestamp("updated_at").notNullable().defaultTo(knex.fn.now());

    t.index(["meeting_id", "status"], "idx_waiting_meeting_status");
    t.index(["user_id"], "idx_waiting_user");
  });

  // =========================================
  // 3️⃣ MEETING PARTICIPANT SESSIONS (RAW JOIN DATA)
  // =========================================

  await knex.schema.createTable("meeting_participant_sessions", (t) => {
    t.bigIncrements("session_id").primary();

    t.bigInteger("meeting_id")
      .notNullable()
      .references("meeting_id")
      .inTable("meetings")
      .onDelete("CASCADE");

    t.integer("user_id")
      .notNullable()
      .references("user_id")
      .inTable("users")
      .onDelete("CASCADE");

    t.timestamp("join_time").notNullable();
    t.timestamp("leave_time");

    t.index(["meeting_id", "user_id"], "idx_participant_meeting_user");
    t.index(["meeting_id"], "idx_participant_meeting");
  });

  // =========================================
  // 4️⃣ MEETING ATTENDANCE (FINAL PER USER)
  // =========================================

  await knex.schema.createTable("meeting_attendance", (t) => {
    t.bigIncrements("attendance_id").primary();

    t.bigInteger("meeting_id")
      .notNullable()
      .references("meeting_id")
      .inTable("meetings")
      .onDelete("CASCADE");

    t.integer("user_id")
      .notNullable()
      .references("user_id")
      .inTable("users")
      .onDelete("CASCADE");

    t.integer("total_duration_minutes").notNullable();

    t.decimal("percentage_attended", 5, 2).notNullable();

    t.specificType("attendance_status", "meeting_attendance_status_enum")
      .notNullable();

    t.boolean("was_late").notNullable().defaultTo(false);

    t.timestamp("created_at").notNullable().defaultTo(knex.fn.now());

    t.unique(["meeting_id", "user_id"], "uq_meeting_attendance_user");

    t.index(["meeting_id"], "idx_meeting_attendance_meeting");
    t.index(["user_id"], "idx_meeting_attendance_user");
  });

  // =========================================
  // 5️⃣ MEETING REPORTS (ONE PER MEETING)
  // =========================================

  await knex.schema.createTable("meeting_reports", (t) => {
    t.bigIncrements("report_id").primary();

    t.bigInteger("meeting_id")
      .unique()
      .notNullable()
      .references("meeting_id")
      .inTable("meetings")
      .onDelete("CASCADE");

    t.integer("total_invited").notNullable();
    t.integer("total_present").notNullable();
    t.integer("total_absent").notNullable();
    t.integer("late_count").notNullable();

    t.decimal("attendance_percentage", 5, 2).notNullable();
    t.decimal("average_duration_minutes", 6, 2).notNullable();

    t.timestamp("generated_at").notNullable().defaultTo(knex.fn.now());
  });

  // =========================================
  // UPDATED_AT TRIGGER (CONSISTENT WITH PROJECT)
  // =========================================

  await knex.raw(`
    CREATE OR REPLACE FUNCTION set_updated_at_meetings()
    RETURNS TRIGGER AS $$
    BEGIN
      NEW.updated_at = NOW();
      RETURN NEW;
    END;
    $$ LANGUAGE plpgsql;
  `);

  await knex.raw(`
    CREATE TRIGGER trg_meetings_updated_at
    BEFORE UPDATE ON meetings
    FOR EACH ROW EXECUTE FUNCTION set_updated_at_meetings();
  `);

  await knex.raw(`
    CREATE TRIGGER trg_waiting_room_updated_at
    BEFORE UPDATE ON meeting_waiting_room
    FOR EACH ROW EXECUTE FUNCTION set_updated_at_meetings();
  `);
};

exports.down = async function down(knex) {

  await knex.raw("DROP TRIGGER IF EXISTS trg_waiting_room_updated_at ON meeting_waiting_room");
  await knex.raw("DROP TRIGGER IF EXISTS trg_meetings_updated_at ON meetings");
  await knex.raw("DROP FUNCTION IF EXISTS set_updated_at_meetings");

  await knex.schema.dropTableIfExists("meeting_reports");
  await knex.schema.dropTableIfExists("meeting_attendance");
  await knex.schema.dropTableIfExists("meeting_participant_sessions");
  await knex.schema.dropTableIfExists("meeting_waiting_room");
  await knex.schema.dropTableIfExists("meetings");

  await knex.raw("DROP TYPE IF EXISTS meeting_attendance_status_enum");
  await knex.raw("DROP TYPE IF EXISTS meeting_waiting_status_enum");
  await knex.raw("DROP TYPE IF EXISTS meeting_status_enum");
};