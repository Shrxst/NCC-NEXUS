exports.up = async function up(knex) {
  await knex.schema.alterTable("community_posts", (t) => {
    t.timestamp("poll_result_notified_at").nullable();
  });
};

exports.down = async function down(knex) {
  await knex.schema.alterTable("community_posts", (t) => {
    t.dropColumn("poll_result_notified_at");
  });
};

