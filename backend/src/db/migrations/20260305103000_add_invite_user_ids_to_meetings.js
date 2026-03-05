exports.up = async function up(knex) {
  const hasColumn = await knex.schema.hasColumn("meetings", "invite_user_ids");
  if (!hasColumn) {
    await knex.schema.alterTable("meetings", (t) => {
      t.specificType("invite_user_ids", "integer[]").notNullable().defaultTo("{}");
    });
  }
};

exports.down = async function down(knex) {
  const hasColumn = await knex.schema.hasColumn("meetings", "invite_user_ids");
  if (hasColumn) {
    await knex.schema.alterTable("meetings", (t) => {
      t.dropColumn("invite_user_ids");
    });
  }
};
