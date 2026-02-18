exports.up = async function up(knex) {
  await knex.schema.createTable("chat_rooms", (t) => {
    t.bigIncrements("room_id").primary();
    t.string("room_name", 255);
    t.string("room_type", 20).notNullable().defaultTo("direct");
    t.string("direct_key", 128);
    t.integer("created_by_user_id").references("user_id").inTable("users").onDelete("SET NULL");
    t.string("created_by_role", 20).notNullable();
    t.bigInteger("last_message_id");
    t.timestamp("last_message_at");
    t.boolean("is_archived").notNullable().defaultTo(false);
    t.timestamp("created_at").notNullable().defaultTo(knex.fn.now());
    t.timestamp("updated_at").notNullable().defaultTo(knex.fn.now());
    t.timestamp("deleted_at");

    t.index(["room_type"], "idx_chat_rooms_room_type");
    t.index(["last_message_at", "deleted_at", "is_archived"], "idx_chat_rooms_listing");
    t.index(["deleted_at"], "idx_chat_rooms_deleted_at");
  });

  await knex.schema.createTable("chat_participants", (t) => {
    t.bigIncrements("chat_participant_id").primary();
    t.bigInteger("room_id").notNullable().references("room_id").inTable("chat_rooms").onDelete("CASCADE");
    t.integer("user_id").notNullable().references("user_id").inTable("users").onDelete("CASCADE");
    t.string("participant_role", 20).notNullable();
    t.boolean("is_admin").notNullable().defaultTo(false);
    t.timestamp("joined_at").notNullable().defaultTo(knex.fn.now());
    t.timestamp("last_read_at");
    t.bigInteger("last_read_message_id");
    t.timestamp("created_at").notNullable().defaultTo(knex.fn.now());
    t.timestamp("updated_at").notNullable().defaultTo(knex.fn.now());
    t.timestamp("deleted_at");

    t.index(["user_id", "deleted_at", "room_id"], "idx_chat_participants_user_room");
    t.index(["room_id", "deleted_at", "user_id"], "idx_chat_participants_room_user");
    t.index(["participant_role"], "idx_chat_participants_role");
    t.index(["deleted_at"], "idx_chat_participants_deleted_at");
  });

  await knex.schema.createTable("messages", (t) => {
    t.bigIncrements("message_id").primary();
    t.bigInteger("room_id").notNullable().references("room_id").inTable("chat_rooms").onDelete("CASCADE");
    t.integer("sender_user_id").references("user_id").inTable("users").onDelete("SET NULL");
    t.string("sender_role", 20).notNullable();
    t.string("message_type", 20).notNullable().defaultTo("text");
    t.text("body").notNullable();
    t.jsonb("metadata");
    t.boolean("is_edited").notNullable().defaultTo(false);
    t.timestamp("edited_at");
    t.timestamp("created_at").notNullable().defaultTo(knex.fn.now());
    t.timestamp("updated_at").notNullable().defaultTo(knex.fn.now());
    t.timestamp("deleted_at");

    t.index(["room_id", "deleted_at", "message_id"], "idx_messages_room_page");
    t.index(["room_id", "sender_user_id", "deleted_at", "message_id"], "idx_messages_unread");
    t.index(["sender_user_id"], "idx_messages_sender");
    t.index(["deleted_at"], "idx_messages_deleted_at");
  });

  await knex.schema.createTable("message_read_status", (t) => {
    t.bigIncrements("message_read_status_id").primary();
    t.bigInteger("message_id").notNullable().references("message_id").inTable("messages").onDelete("CASCADE");
    t.integer("user_id").notNullable().references("user_id").inTable("users").onDelete("CASCADE");
    t.timestamp("read_at").notNullable().defaultTo(knex.fn.now());
    t.timestamp("created_at").notNullable().defaultTo(knex.fn.now());
    t.timestamp("updated_at").notNullable().defaultTo(knex.fn.now());
    t.timestamp("deleted_at");

    t.unique(["message_id", "user_id"], "uq_message_read_status_message_user");
    t.index(["user_id", "message_id", "deleted_at"], "idx_message_read_status_user_message");
    t.index(["message_id", "user_id", "deleted_at"], "idx_message_read_status_message_user");
    t.index(["deleted_at"], "idx_message_read_status_deleted_at");
  });

  await knex.raw("ALTER TABLE chat_rooms ADD CONSTRAINT chk_chat_rooms_room_type CHECK (room_type IN ('direct', 'group'))");
  await knex.raw("ALTER TABLE chat_rooms ADD CONSTRAINT chk_chat_rooms_created_by_role CHECK (created_by_role IN ('cadet', 'suo', 'ano', 'alumni'))");
  await knex.raw("ALTER TABLE chat_rooms ADD CONSTRAINT chk_chat_rooms_direct_key CHECK ((room_type = 'direct' AND direct_key IS NOT NULL) OR (room_type = 'group' AND direct_key IS NULL))");
  await knex.raw("ALTER TABLE chat_participants ADD CONSTRAINT chk_chat_participants_role CHECK (participant_role IN ('cadet', 'suo', 'ano', 'alumni'))");
  await knex.raw("ALTER TABLE messages ADD CONSTRAINT chk_messages_sender_role CHECK (sender_role IN ('cadet', 'suo', 'ano', 'alumni'))");
  await knex.raw("ALTER TABLE messages ADD CONSTRAINT chk_messages_message_type CHECK (message_type IN ('text', 'image', 'file', 'system'))");

  await knex.raw("CREATE UNIQUE INDEX uq_chat_participants_room_user_active ON chat_participants (room_id, user_id) WHERE deleted_at IS NULL");
  await knex.raw("CREATE UNIQUE INDEX uq_chat_rooms_direct_key_active ON chat_rooms (direct_key) WHERE room_type = 'direct' AND deleted_at IS NULL");

  await knex.schema.alterTable("chat_rooms", (t) => {
    t.foreign("last_message_id").references("message_id").inTable("messages").onDelete("SET NULL");
  });

  await knex.schema.alterTable("chat_participants", (t) => {
    t.foreign("last_read_message_id").references("message_id").inTable("messages").onDelete("SET NULL");
  });

  await knex.raw(`
    CREATE OR REPLACE FUNCTION set_updated_at()
    RETURNS TRIGGER AS $$
    BEGIN
      NEW.updated_at = NOW();
      RETURN NEW;
    END;
    $$ LANGUAGE plpgsql;
  `);

  await knex.raw("CREATE TRIGGER trg_chat_rooms_updated_at BEFORE UPDATE ON chat_rooms FOR EACH ROW EXECUTE FUNCTION set_updated_at();");
  await knex.raw("CREATE TRIGGER trg_chat_participants_updated_at BEFORE UPDATE ON chat_participants FOR EACH ROW EXECUTE FUNCTION set_updated_at();");
  await knex.raw("CREATE TRIGGER trg_messages_updated_at BEFORE UPDATE ON messages FOR EACH ROW EXECUTE FUNCTION set_updated_at();");
  await knex.raw("CREATE TRIGGER trg_message_read_status_updated_at BEFORE UPDATE ON message_read_status FOR EACH ROW EXECUTE FUNCTION set_updated_at();");
};

exports.down = async function down(knex) {

  // Drop triggers
  await knex.raw("DROP TRIGGER IF EXISTS trg_message_read_status_updated_at ON message_read_status");
  await knex.raw("DROP TRIGGER IF EXISTS trg_messages_updated_at ON messages");
  await knex.raw("DROP TRIGGER IF EXISTS trg_chat_participants_updated_at ON chat_participants");
  await knex.raw("DROP TRIGGER IF EXISTS trg_chat_rooms_updated_at ON chat_rooms");
  await knex.raw("DROP FUNCTION IF EXISTS set_updated_at");

  // 🔥 DROP FOREIGN KEYS FIRST (break circular dependency)

  await knex.raw(`
    ALTER TABLE chat_rooms
    DROP CONSTRAINT IF EXISTS chat_rooms_last_message_id_foreign;
  `);

  await knex.raw(`
    ALTER TABLE chat_participants
    DROP CONSTRAINT IF EXISTS chat_participants_last_read_message_id_foreign;
  `);

  // Now safe to drop tables in dependency order

  await knex.schema.dropTableIfExists("message_read_status");
  await knex.schema.dropTableIfExists("messages");
  await knex.schema.dropTableIfExists("chat_participants");
  await knex.schema.dropTableIfExists("chat_rooms");
};
