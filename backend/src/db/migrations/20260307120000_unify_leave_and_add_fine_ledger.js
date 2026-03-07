exports.up = async function up(knex) {
  await knex.raw(`
    DO $$
    BEGIN
      IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'leave_status_enum') THEN
        CREATE TYPE leave_status_enum AS ENUM ('pending', 'approved', 'rejected');
      END IF;

      IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'fine_status_enum') THEN
        CREATE TYPE fine_status_enum AS ENUM ('pending', 'paid', 'cancelled');
      END IF;

      IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'fine_event_type_enum') THEN
        CREATE TYPE fine_event_type_enum AS ENUM ('created', 'reversed', 'paid', 'adjusted');
      END IF;

      IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'fine_payment_method_enum') THEN
        CREATE TYPE fine_payment_method_enum AS ENUM ('UPI');
      END IF;

      IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'fine_payment_status_enum') THEN
        CREATE TYPE fine_payment_status_enum AS ENUM ('submitted', 'verified', 'rejected');
      END IF;
    END $$;
  `);

  await knex.schema.createTable('leaves', (t) => {
    t.bigIncrements('leave_id').primary();
    t
      .string('regimental_no', 64)
      .notNullable()
      .references('regimental_no')
      .inTable('cadet_profiles')
      .onDelete('CASCADE');
    t
      .bigInteger('drill_id')
      .notNullable()
      .references('drill_id')
      .inTable('attendance_drills')
      .onDelete('CASCADE');
    t.text('reason').notNullable();
    t.text('document_url');
    t.specificType('status', 'leave_status_enum').notNullable().defaultTo('pending');
    t.timestamp('applied_at', { useTz: true }).notNullable().defaultTo(knex.fn.now());
    t
      .integer('reviewed_by')
      .references('user_id')
      .inTable('users')
      .onDelete('SET NULL');
    t.timestamp('reviewed_at', { useTz: true });
    t.timestamp('created_at', { useTz: true }).notNullable().defaultTo(knex.fn.now());
    t.timestamp('updated_at', { useTz: true }).notNullable().defaultTo(knex.fn.now());

    t.unique(['regimental_no', 'drill_id'], 'uq_leaves_regimental_drill');
    t.index(['regimental_no', 'status'], 'idx_leaves_regimental_status');
    t.index(['drill_id', 'status'], 'idx_leaves_drill_status');
    t.index(['applied_at'], 'idx_leaves_applied_at');
  });

  await knex.raw(`
    CREATE OR REPLACE FUNCTION set_leaves_updated_at()
    RETURNS TRIGGER AS $$
    BEGIN
      NEW.updated_at = NOW();
      RETURN NEW;
    END;
    $$ LANGUAGE plpgsql;
  `);

  await knex.raw(`
    CREATE TRIGGER trg_leaves_updated_at
    BEFORE UPDATE ON leaves
    FOR EACH ROW EXECUTE FUNCTION set_leaves_updated_at();
  `);

  await knex.schema.createTable('fines', (t) => {
    t.bigIncrements('fine_id').primary();
    t
      .string('regimental_no', 64)
      .notNullable()
      .references('regimental_no')
      .inTable('cadet_profiles')
      .onDelete('CASCADE');
    t
      .bigInteger('drill_id')
      .notNullable()
      .references('drill_id')
      .inTable('attendance_drills')
      .onDelete('CASCADE');
    t.decimal('amount', 10, 2).notNullable().defaultTo(15);
    t.text('reason').notNullable();
    t.specificType('status', 'fine_status_enum').notNullable().defaultTo('pending');
    t
      .integer('created_by')
      .references('user_id')
      .inTable('users')
      .onDelete('SET NULL');
    t.timestamp('created_at', { useTz: true }).notNullable().defaultTo(knex.fn.now());

    t.unique(['regimental_no', 'drill_id'], 'uq_fines_regimental_drill');
    t.index(['status'], 'idx_fines_status');
    t.index(['regimental_no', 'status'], 'idx_fines_regimental_status');
    t.index(['drill_id'], 'idx_fines_drill');
  });

  await knex.raw(`
    ALTER TABLE fines
    ADD CONSTRAINT chk_fines_amount_positive CHECK (amount > 0);
  `);

  await knex.schema.createTable('fine_events', (t) => {
    t.bigIncrements('event_id').primary();
    t
      .bigInteger('fine_id')
      .notNullable()
      .references('fine_id')
      .inTable('fines')
      .onDelete('CASCADE');
    t.specificType('event_type', 'fine_event_type_enum').notNullable();
    t
      .integer('performed_by')
      .references('user_id')
      .inTable('users')
      .onDelete('SET NULL');
    t.text('notes');
    t.timestamp('created_at', { useTz: true }).notNullable().defaultTo(knex.fn.now());

    t.index(['fine_id', 'created_at'], 'idx_fine_events_fine_created');
  });

  await knex.schema.createTable('fine_payments', (t) => {
    t.bigIncrements('payment_id').primary();
    t
      .bigInteger('fine_id')
      .notNullable()
      .references('fine_id')
      .inTable('fines')
      .onDelete('CASCADE');
    t.decimal('amount', 10, 2).notNullable();
    t.specificType('payment_method', 'fine_payment_method_enum').notNullable().defaultTo('UPI');
    t.string('payment_ref', 255).notNullable();
    t.specificType('payment_status', 'fine_payment_status_enum').notNullable().defaultTo('submitted');
    t.timestamp('paid_at', { useTz: true }).notNullable().defaultTo(knex.fn.now());
    t
      .integer('verified_by')
      .references('user_id')
      .inTable('users')
      .onDelete('SET NULL');
    t.timestamp('verified_at', { useTz: true });
    t.timestamp('created_at', { useTz: true }).notNullable().defaultTo(knex.fn.now());

    t.unique(['payment_ref'], 'uq_fine_payments_ref');
    t.index(['fine_id', 'payment_status'], 'idx_fine_payments_fine_status');
    t.index(['paid_at'], 'idx_fine_payments_paid_at');
  });

  await knex.raw(`
    ALTER TABLE fine_payments
    ADD CONSTRAINT chk_fine_payments_amount_positive CHECK (amount > 0);
  `);

  await knex.raw(`
    INSERT INTO leaves (
      regimental_no,
      drill_id,
      reason,
      document_url,
      status,
      applied_at,
      reviewed_by,
      reviewed_at,
      created_at,
      updated_at
    )
    SELECT
      la.regimental_no,
      la.drill_id,
      la.reason,
      la.attachment_url,
      la.status::leave_status_enum,
      la.created_at,
      la.reviewed_by_user_id,
      la.reviewed_at,
      la.created_at,
      la.updated_at
    FROM leave_applications la
    ON CONFLICT (regimental_no, drill_id) DO NOTHING;
  `);

  await knex.schema.dropTableIfExists('leave_requests');
  await knex.schema.dropTableIfExists('leave_applications');
};

exports.down = async function down(knex) {
  await knex.schema.dropTableIfExists('fine_payments');
  await knex.schema.dropTableIfExists('fine_events');
  await knex.schema.dropTableIfExists('fines');

  await knex.raw('DROP TRIGGER IF EXISTS trg_leaves_updated_at ON leaves');
  await knex.raw('DROP FUNCTION IF EXISTS set_leaves_updated_at');
  await knex.schema.dropTableIfExists('leaves');

  await knex.raw('DROP TYPE IF EXISTS fine_payment_status_enum');
  await knex.raw('DROP TYPE IF EXISTS fine_payment_method_enum');
  await knex.raw('DROP TYPE IF EXISTS fine_event_type_enum');
  await knex.raw('DROP TYPE IF EXISTS fine_status_enum');
  await knex.raw('DROP TYPE IF EXISTS leave_status_enum');
};
