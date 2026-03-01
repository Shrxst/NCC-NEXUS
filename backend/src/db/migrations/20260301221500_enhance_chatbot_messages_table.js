exports.up = async function up(knex) {
  const hasUserId = await knex.schema.hasColumn("chat_messages", "user_id");
  if (!hasUserId) {
    await knex.schema.alterTable("chat_messages", (t) => {
      t
        .integer("user_id")
        .references("user_id")
        .inTable("users")
        .onDelete("SET NULL");
    });
  }

  const hasRole = await knex.schema.hasColumn("chat_messages", "role");
  if (!hasRole) {
    await knex.schema.alterTable("chat_messages", (t) => {
      t.string("role", 16);
    });
  }

  const hasProvider = await knex.schema.hasColumn("chat_messages", "provider");
  if (!hasProvider) {
    await knex.schema.alterTable("chat_messages", (t) => {
      t.string("provider", 32).defaultTo("huggingface");
    });
  }

  const hasModel = await knex.schema.hasColumn("chat_messages", "model");
  if (!hasModel) {
    await knex.schema.alterTable("chat_messages", (t) => {
      t.string("model", 128);
    });
  }

  await knex.raw(`
    CREATE INDEX IF NOT EXISTS idx_chat_messages_user_created
    ON chat_messages (user_id, created_at DESC);
  `);

  await knex.raw(`
    CREATE INDEX IF NOT EXISTS idx_chat_messages_sender_created
    ON chat_messages (sender, created_at DESC);
  `);
};

exports.down = async function down(knex) {
  await knex.raw("DROP INDEX IF EXISTS idx_chat_messages_sender_created");
  await knex.raw("DROP INDEX IF EXISTS idx_chat_messages_user_created");

  const hasModel = await knex.schema.hasColumn("chat_messages", "model");
  if (hasModel) {
    await knex.schema.alterTable("chat_messages", (t) => {
      t.dropColumn("model");
    });
  }

  const hasProvider = await knex.schema.hasColumn("chat_messages", "provider");
  if (hasProvider) {
    await knex.schema.alterTable("chat_messages", (t) => {
      t.dropColumn("provider");
    });
  }

  const hasRole = await knex.schema.hasColumn("chat_messages", "role");
  if (hasRole) {
    await knex.schema.alterTable("chat_messages", (t) => {
      t.dropColumn("role");
    });
  }

  const hasUserId = await knex.schema.hasColumn("chat_messages", "user_id");
  if (hasUserId) {
    await knex.schema.alterTable("chat_messages", (t) => {
      t.dropColumn("user_id");
    });
  }
};
