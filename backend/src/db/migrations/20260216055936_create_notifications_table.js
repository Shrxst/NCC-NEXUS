exports.up = async function (knex) {
  await knex.schema.createTable("notifications", (t) => {
    t.increments("notification_id").primary();

    t.integer("user_id")
      .notNullable()
      .references("user_id")
      .inTable("users")
      .onDelete("CASCADE");

    t.string("type", 50).notNullable(); // like, comment, announcement
    t.integer("post_id");
    t.string("message").notNullable();

    t.boolean("is_read").defaultTo(false);

    t.timestamp("created_at").defaultTo(knex.fn.now());
  });
};

exports.down = async function (knex) {
  await knex.schema.dropTableIfExists("notifications");
};
