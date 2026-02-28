exports.up = async function up(knex) {
  await knex.raw("ALTER TYPE quiz_attempt_status_enum ADD VALUE IF NOT EXISTS 'failed_due_to_violation'");
  await knex.schema.alterTable("quiz_attempts", (t) => {
    t.text("violation_reason");
  });
};

exports.down = async function down(knex) {
  await knex.schema.alterTable("quiz_attempts", (t) => {
    t.dropColumn("violation_reason");
  });
};
