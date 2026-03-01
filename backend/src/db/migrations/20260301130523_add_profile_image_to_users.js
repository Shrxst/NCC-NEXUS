exports.up = async function (knex) {
  const hasColumn = await knex.schema.hasColumn("users", "profile_image_url");

  if (!hasColumn) {
    await knex.schema.alterTable("users", (t) => {
      t.string("profile_image_url");
    });
  }
};

exports.down = async function (knex) {
  const hasColumn = await knex.schema.hasColumn("users", "profile_image_url");

  if (hasColumn) {
    await knex.schema.alterTable("users", (t) => {
      t.dropColumn("profile_image_url");
    });
  }
};