exports.up = async function up(knex) {
  const hasColumn = await knex.schema.hasColumn("post_likes", "reaction_emoji");
  if (!hasColumn) {
    await knex.schema.alterTable("post_likes", (t) => {
      t.string("reaction_emoji", 16).nullable();
    });
  }
};

exports.down = async function down(knex) {
  const hasColumn = await knex.schema.hasColumn("post_likes", "reaction_emoji");
  if (hasColumn) {
    await knex.schema.alterTable("post_likes", (t) => {
      t.dropColumn("reaction_emoji");
    });
  }
};
