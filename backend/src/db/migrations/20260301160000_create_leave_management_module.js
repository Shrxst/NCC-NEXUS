exports.up = async function up(knex) {
  await knex.raw(`
    CREATE EXTENSION IF NOT EXISTS pgcrypto;
  `);

  await knex.raw(`
    DO $$
    BEGIN
      IF NOT EXISTS (
        SELECT 1
        FROM information_schema.columns
        WHERE table_schema = 'public'
          AND table_name = 'users'
          AND column_name = 'auth_user_id'
      ) THEN
        ALTER TABLE public.users ADD COLUMN auth_user_id uuid;
      END IF;
    END $$;
  `);

  await knex.raw(`
    DO $$
    BEGIN
      IF NOT EXISTS (
        SELECT 1
        FROM pg_constraint
        WHERE conname = 'users_auth_user_id_fk'
      ) THEN
        ALTER TABLE public.users
          ADD CONSTRAINT users_auth_user_id_fk
          FOREIGN KEY (auth_user_id)
          REFERENCES auth.users(id)
          ON DELETE SET NULL;
      END IF;
    END $$;
  `);

  await knex.raw(`
    CREATE UNIQUE INDEX IF NOT EXISTS uq_users_auth_user_id
    ON public.users (auth_user_id)
    WHERE auth_user_id IS NOT NULL;
  `);

  await knex.raw(`
    UPDATE public.users AS u
    SET auth_user_id = au.id
    FROM auth.users AS au
    WHERE u.auth_user_id IS NULL
      AND lower(u.email) = lower(au.email);
  `);

  await knex.raw(`
    DO $$
    BEGIN
      IF NOT EXISTS (
        SELECT 1
        FROM pg_type
        WHERE typname = 'leave_status'
      ) THEN
        CREATE TYPE public.leave_status AS ENUM ('pending', 'approved', 'rejected');
      END IF;
    END $$;
  `);

  await knex.raw(`
    CREATE TABLE IF NOT EXISTS public.leave_requests (
      leave_id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
      applicant_user_id integer NOT NULL REFERENCES public.users(user_id) ON DELETE CASCADE,
      applicant_auth_user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
      applicant_regimental_no varchar(64) REFERENCES public.cadet_profiles(regimental_no) ON DELETE SET NULL,
      reason text NOT NULL,
      document_path text,
      status public.leave_status NOT NULL DEFAULT 'pending',
      reviewed_by_user_id integer REFERENCES public.users(user_id) ON DELETE SET NULL,
      reviewed_at timestamptz,
      created_at timestamptz NOT NULL DEFAULT now(),
      updated_at timestamptz NOT NULL DEFAULT now()
    );
  `);

  await knex.raw(`
    CREATE INDEX IF NOT EXISTS idx_leave_requests_applicant_user_created
    ON public.leave_requests (applicant_user_id, created_at DESC);
  `);

  await knex.raw(`
    CREATE INDEX IF NOT EXISTS idx_leave_requests_status_created
    ON public.leave_requests (status, created_at DESC);
  `);

  await knex.raw(`
    CREATE INDEX IF NOT EXISTS idx_leave_requests_regimental_created
    ON public.leave_requests (applicant_regimental_no, created_at DESC);
  `);

  await knex.raw(`
    CREATE INDEX IF NOT EXISTS idx_leave_requests_reviewer
    ON public.leave_requests (reviewed_by_user_id);
  `);

  await knex.raw(`
    CREATE OR REPLACE FUNCTION public.set_leave_requests_updated_at()
    RETURNS TRIGGER AS $$
    BEGIN
      NEW.updated_at = now();
      RETURN NEW;
    END;
    $$ LANGUAGE plpgsql;
  `);

  await knex.raw(`
    DROP TRIGGER IF EXISTS trg_leave_requests_updated_at ON public.leave_requests;
    CREATE TRIGGER trg_leave_requests_updated_at
    BEFORE UPDATE ON public.leave_requests
    FOR EACH ROW EXECUTE FUNCTION public.set_leave_requests_updated_at();
  `);

  await knex.raw(`
    CREATE OR REPLACE FUNCTION public.is_leave_admin_or_suo()
    RETURNS boolean
    LANGUAGE sql
    STABLE
    AS $$
      SELECT COALESCE(
        (auth.jwt() -> 'app_metadata' ->> 'role') IN ('ADMIN', 'ANO', 'SUO'),
        false
      );
    $$;
  `);

  await knex.raw(`
    ALTER TABLE public.leave_requests ENABLE ROW LEVEL SECURITY;
    ALTER TABLE public.leave_requests FORCE ROW LEVEL SECURITY;
  `);

  await knex.raw(`
    DROP POLICY IF EXISTS leave_insert_own ON public.leave_requests;
    CREATE POLICY leave_insert_own
    ON public.leave_requests
    FOR INSERT
    TO authenticated
    WITH CHECK (auth.uid() = applicant_auth_user_id);
  `);

  await knex.raw(`
    DROP POLICY IF EXISTS leave_select_own_or_admin ON public.leave_requests;
    CREATE POLICY leave_select_own_or_admin
    ON public.leave_requests
    FOR SELECT
    TO authenticated
    USING (
      auth.uid() = applicant_auth_user_id
      OR public.is_leave_admin_or_suo()
    );
  `);

  await knex.raw(`
    DROP POLICY IF EXISTS leave_update_admin_status ON public.leave_requests;
    CREATE POLICY leave_update_admin_status
    ON public.leave_requests
    FOR UPDATE
    TO authenticated
    USING (public.is_leave_admin_or_suo())
    WITH CHECK (
      public.is_leave_admin_or_suo()
      AND status IN ('approved', 'rejected')
    );
  `);

  await knex.raw(`
    DROP POLICY IF EXISTS leave_docs_insert_own ON storage.objects;
    CREATE POLICY leave_docs_insert_own
    ON storage.objects
    FOR INSERT
    TO authenticated
    WITH CHECK (
      bucket_id = 'leave-documents'
      AND (storage.foldername(name))[1] = auth.uid()::text
    );
  `);

  await knex.raw(`
    DROP POLICY IF EXISTS leave_docs_select_own_or_admin ON storage.objects;
    CREATE POLICY leave_docs_select_own_or_admin
    ON storage.objects
    FOR SELECT
    TO authenticated
    USING (
      bucket_id = 'leave-documents'
      AND (
        (storage.foldername(name))[1] = auth.uid()::text
        OR public.is_leave_admin_or_suo()
      )
    );
  `);
};

exports.down = async function down(knex) {
  await knex.raw(`
    DROP POLICY IF EXISTS leave_docs_select_own_or_admin ON storage.objects;
    DROP POLICY IF EXISTS leave_docs_insert_own ON storage.objects;
  `);

  await knex.raw(`
    DROP POLICY IF EXISTS leave_update_admin_status ON public.leave_requests;
    DROP POLICY IF EXISTS leave_select_own_or_admin ON public.leave_requests;
    DROP POLICY IF EXISTS leave_insert_own ON public.leave_requests;
  `);

  await knex.raw(`
    DROP FUNCTION IF EXISTS public.is_leave_admin_or_suo();
  `);

  await knex.raw(`
    DROP TRIGGER IF EXISTS trg_leave_requests_updated_at ON public.leave_requests;
    DROP FUNCTION IF EXISTS public.set_leave_requests_updated_at();
  `);

  await knex.raw(`
    DROP TABLE IF EXISTS public.leave_requests;
  `);

  await knex.raw(`
    DROP TYPE IF EXISTS public.leave_status;
  `);

  await knex.raw(`
    DROP INDEX IF EXISTS uq_users_auth_user_id;
  `);

  await knex.raw(`
    DO $$
    BEGIN
      IF EXISTS (
        SELECT 1
        FROM pg_constraint
        WHERE conname = 'users_auth_user_id_fk'
      ) THEN
        ALTER TABLE public.users DROP CONSTRAINT users_auth_user_id_fk;
      END IF;
    END $$;
  `);

  await knex.raw(`
    DO $$
    BEGIN
      IF EXISTS (
        SELECT 1
        FROM information_schema.columns
        WHERE table_schema = 'public'
          AND table_name = 'users'
          AND column_name = 'auth_user_id'
      ) THEN
        ALTER TABLE public.users DROP COLUMN auth_user_id;
      END IF;
    END $$;
  `);
};
