exports.up = async function up(knex) {
  await knex.raw(`
    DO $$
    BEGIN
      IF EXISTS (SELECT 1 FROM pg_type WHERE typname = 'fine_status_enum') THEN
        IF NOT EXISTS (
          SELECT 1
          FROM pg_enum e
          JOIN pg_type t ON t.oid = e.enumtypid
          WHERE t.typname = 'fine_status_enum' AND e.enumlabel = 'payment_submitted'
        ) THEN
          ALTER TYPE fine_status_enum ADD VALUE 'payment_submitted';
        END IF;
      END IF;
    END $$;
  `);

  const hasProofColumn = await knex.schema.hasColumn('fine_payments', 'payment_proof_url');
  if (!hasProofColumn) {
    await knex.schema.alterTable('fine_payments', (t) => {
      t.text('payment_proof_url');
    });
  }

  await knex.raw(`
    ALTER TABLE fine_payments
    ALTER COLUMN payment_ref DROP NOT NULL;
  `);

  await knex.raw(`
    DO $$
    BEGIN
      IF NOT EXISTS (
        SELECT 1
        FROM pg_constraint
        WHERE conname = 'chk_fine_payments_ref_or_proof'
      ) THEN
        ALTER TABLE fine_payments
        ADD CONSTRAINT chk_fine_payments_ref_or_proof
        CHECK (payment_ref IS NOT NULL OR payment_proof_url IS NOT NULL);
      END IF;
    END $$;
  `);

  await knex.raw(`
    UPDATE fines f
    SET status = 'payment_submitted'
    WHERE f.status = 'pending'
      AND EXISTS (
        SELECT 1
        FROM fine_payments fp
        WHERE fp.fine_id = f.fine_id
          AND fp.payment_status = 'submitted'
      );
  `);
};

exports.down = async function down(knex) {
  await knex.raw(`
    ALTER TABLE fine_payments
    DROP CONSTRAINT IF EXISTS chk_fine_payments_ref_or_proof;
  `);

  const hasProofColumn = await knex.schema.hasColumn('fine_payments', 'payment_proof_url');
  if (hasProofColumn) {
    await knex.schema.alterTable('fine_payments', (t) => {
      t.dropColumn('payment_proof_url');
    });
  }

  await knex.raw(`
    ALTER TABLE fine_payments
    ALTER COLUMN payment_ref SET NOT NULL;
  `);
};

exports.config = {
  transaction: false,
};
