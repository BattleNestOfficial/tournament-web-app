import { Pool } from "pg";
import { drizzle } from "drizzle-orm/node-postgres";
import * as schema from "@shared/schema";

const databaseUrl =
  process.env.DATABASE_URL ||
  process.env.POSTGRES_URL ||
  process.env.PGDATABASE_URL ||
  process.env.DATABASE_PUBLIC_URL;

if (!databaseUrl) {
  throw new Error("DATABASE_URL is not set in environment variables");
}

/**
 * Railway Postgres FIX
 * - SSL is mandatory
 * - rejectUnauthorized must be false
 */
const pool = new Pool({
  connectionString: databaseUrl,
  ssl: {
    rejectUnauthorized: false,
  },
  max: 10,
  idleTimeoutMillis: 30000,
  connectionTimeoutMillis: 10000,
});

pool.on("error", (err) => {
  console.error("🔥 Unexpected PG pool error", err);
  process.exit(1);
});

export async function ensureTournamentStatusEnumHasHot() {
  await pool.query(`
    DO $$
    BEGIN
      IF NOT EXISTS (
        SELECT 1
        FROM pg_type t
        JOIN pg_enum e ON t.oid = e.enumtypid
        WHERE t.typname = 'tournament_status'
          AND e.enumlabel = 'hot'
      ) THEN
        ALTER TYPE tournament_status ADD VALUE 'hot';
      END IF;
    EXCEPTION
      WHEN duplicate_object THEN
        NULL;
    END $$;
  `);
}

export async function ensureRegistrationsTeamColumn() {
  await pool.query(`
    ALTER TABLE registrations
    ADD COLUMN IF NOT EXISTS team_id integer;
  `);
}

export async function ensureUserSecurityColumns() {
  await pool.query(`
    ALTER TABLE users
    ADD COLUMN IF NOT EXISTS email_verified boolean NOT NULL DEFAULT false,
    ADD COLUMN IF NOT EXISTS email_verification_token text,
    ADD COLUMN IF NOT EXISTS email_verification_expires timestamp,
    ADD COLUMN IF NOT EXISTS email_verification_attempts integer NOT NULL DEFAULT 0,
    ADD COLUMN IF NOT EXISTS email_verification_lock_until timestamp,
    ADD COLUMN IF NOT EXISTS phone text,
    ADD COLUMN IF NOT EXISTS phone_verified boolean NOT NULL DEFAULT false,
    ADD COLUMN IF NOT EXISTS phone_verification_code text,
    ADD COLUMN IF NOT EXISTS phone_verification_expires timestamp,
    ADD COLUMN IF NOT EXISTS phone_verification_attempts integer NOT NULL DEFAULT 0,
    ADD COLUMN IF NOT EXISTS phone_verification_lock_until timestamp,
    ADD COLUMN IF NOT EXISTS password_reset_token text,
    ADD COLUMN IF NOT EXISTS password_reset_expires timestamp,
    ADD COLUMN IF NOT EXISTS password_reset_attempts integer NOT NULL DEFAULT 0,
    ADD COLUMN IF NOT EXISTS password_reset_lock_until timestamp,
    ADD COLUMN IF NOT EXISTS withdrawal_lock_until timestamp,
    ADD COLUMN IF NOT EXISTS email_changed_at timestamp,
    ADD COLUMN IF NOT EXISTS phone_changed_at timestamp;
  `);
}

export async function ensureCouponsTables() {
  await pool.query(`
    CREATE TABLE IF NOT EXISTS coupons (
      id integer GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
      code varchar(64) NOT NULL UNIQUE,
      amount integer NOT NULL DEFAULT 0,
      coupon_type text NOT NULL DEFAULT 'bonus_credit',
      value integer NOT NULL DEFAULT 0,
      global_usage_limit integer,
      per_user_limit integer NOT NULL DEFAULT 1,
      total_usage_count integer NOT NULL DEFAULT 0,
      expires_at timestamp,
      min_entry_fee integer,
      tournament_id integer,
      fraud_hook_enabled boolean NOT NULL DEFAULT false,
      metadata jsonb,
      created_by integer,
      enabled boolean NOT NULL DEFAULT true,
      created_at timestamp NOT NULL DEFAULT now()
    );
  `);

  await pool.query(`
    ALTER TABLE coupons
    ADD COLUMN IF NOT EXISTS amount integer NOT NULL DEFAULT 0,
    ADD COLUMN IF NOT EXISTS coupon_type text NOT NULL DEFAULT 'bonus_credit',
    ADD COLUMN IF NOT EXISTS value integer NOT NULL DEFAULT 0,
    ADD COLUMN IF NOT EXISTS global_usage_limit integer,
    ADD COLUMN IF NOT EXISTS per_user_limit integer NOT NULL DEFAULT 1,
    ADD COLUMN IF NOT EXISTS total_usage_count integer NOT NULL DEFAULT 0,
    ADD COLUMN IF NOT EXISTS expires_at timestamp,
    ADD COLUMN IF NOT EXISTS min_entry_fee integer,
    ADD COLUMN IF NOT EXISTS tournament_id integer,
    ADD COLUMN IF NOT EXISTS fraud_hook_enabled boolean NOT NULL DEFAULT false,
    ADD COLUMN IF NOT EXISTS metadata jsonb,
    ADD COLUMN IF NOT EXISTS created_by integer;
  `);

  await pool.query(`
    UPDATE coupons
    SET value = COALESCE(NULLIF(value, 0), amount, 0),
        amount = COALESCE(amount, 0),
        coupon_type = COALESCE(NULLIF(coupon_type, ''), 'bonus_credit'),
        per_user_limit = CASE WHEN per_user_limit IS NULL OR per_user_limit <= 0 THEN 1 ELSE per_user_limit END,
        total_usage_count = COALESCE(total_usage_count, 0),
        fraud_hook_enabled = COALESCE(fraud_hook_enabled, false);
  `);

  await pool.query(`
    CREATE TABLE IF NOT EXISTS coupon_redemptions (
      id integer GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
      coupon_id integer NOT NULL REFERENCES coupons(id) ON DELETE CASCADE,
      user_id integer NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      context text NOT NULL DEFAULT 'wallet',
      tournament_id integer,
      coupon_type text,
      discount_amount integer NOT NULL DEFAULT 0,
      bonus_amount integer NOT NULL DEFAULT 0,
      metadata jsonb,
      created_at timestamp NOT NULL DEFAULT now()
    );
  `);

  await pool.query(`
    ALTER TABLE coupon_redemptions
    ADD COLUMN IF NOT EXISTS context text NOT NULL DEFAULT 'wallet',
    ADD COLUMN IF NOT EXISTS tournament_id integer,
    ADD COLUMN IF NOT EXISTS coupon_type text,
    ADD COLUMN IF NOT EXISTS discount_amount integer NOT NULL DEFAULT 0,
    ADD COLUMN IF NOT EXISTS bonus_amount integer NOT NULL DEFAULT 0,
    ADD COLUMN IF NOT EXISTS metadata jsonb;
  `);

  await pool.query(`
    DROP INDEX IF EXISTS coupon_redemptions_coupon_user_uq;
  `);

  await pool.query(`
    CREATE INDEX IF NOT EXISTS coupon_redemptions_coupon_user_idx
    ON coupon_redemptions (coupon_id, user_id);
  `);
}

export async function ensureWalletEngineColumns() {
  await pool.query(`
    ALTER TABLE users
    ADD COLUMN IF NOT EXISTS main_wallet_balance integer NOT NULL DEFAULT 0,
    ADD COLUMN IF NOT EXISTS bonus_wallet_balance integer NOT NULL DEFAULT 0;
  `);

  await pool.query(`
    UPDATE users
    SET
      main_wallet_balance = COALESCE(main_wallet_balance, wallet_balance, 0),
      bonus_wallet_balance = COALESCE(bonus_wallet_balance, 0)
    WHERE
      COALESCE(main_wallet_balance, 0) = 0
      AND COALESCE(bonus_wallet_balance, 0) = 0
      AND COALESCE(wallet_balance, 0) > 0;
  `);

  await pool.query(`
    UPDATE users
    SET wallet_balance = COALESCE(main_wallet_balance, 0) + COALESCE(bonus_wallet_balance, 0)
    WHERE wallet_balance IS DISTINCT FROM (COALESCE(main_wallet_balance, 0) + COALESCE(bonus_wallet_balance, 0));
  `);

  await pool.query(`
    ALTER TABLE transactions
    ADD COLUMN IF NOT EXISTS wallet_type text NOT NULL DEFAULT 'main',
    ADD COLUMN IF NOT EXISTS main_balance_before integer NOT NULL DEFAULT 0,
    ADD COLUMN IF NOT EXISTS main_balance_after integer NOT NULL DEFAULT 0,
    ADD COLUMN IF NOT EXISTS bonus_balance_before integer NOT NULL DEFAULT 0,
    ADD COLUMN IF NOT EXISTS bonus_balance_after integer NOT NULL DEFAULT 0,
    ADD COLUMN IF NOT EXISTS previous_hash text,
    ADD COLUMN IF NOT EXISTS entry_hash text NOT NULL DEFAULT '',
    ADD COLUMN IF NOT EXISTS metadata jsonb;
  `);

  await pool.query(`
    ALTER TABLE withdrawals
    ADD COLUMN IF NOT EXISTS platform_fee integer NOT NULL DEFAULT 0,
    ADD COLUMN IF NOT EXISTS net_amount integer NOT NULL DEFAULT 0,
    ADD COLUMN IF NOT EXISTS fee_percent integer NOT NULL DEFAULT 0,
    ADD COLUMN IF NOT EXISTS loyalty_tier text NOT NULL DEFAULT 'bronze';
  `);

  await pool.query(`
    UPDATE withdrawals
    SET
      platform_fee = COALESCE(platform_fee, 0),
      net_amount = CASE
        WHEN net_amount IS NULL OR net_amount <= 0 THEN GREATEST(COALESCE(amount, 0) - COALESCE(platform_fee, 0), 0)
        ELSE net_amount
      END,
      fee_percent = COALESCE(fee_percent, 0),
      loyalty_tier = COALESCE(NULLIF(loyalty_tier, ''), 'bronze');
  `);
}

export async function ensureDisputesTables() {
  await pool.query(`
    CREATE TABLE IF NOT EXISTS disputes (
      id integer GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
      user_id integer NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      report_type text NOT NULL DEFAULT 'hacker',
      accused_username text,
      tournament_id integer,
      description text NOT NULL,
      screenshot_url text,
      status text NOT NULL DEFAULT 'submitted',
      resolution_note text,
      priority_level text NOT NULL DEFAULT 'standard',
      resolved_by integer,
      resolved_at timestamp,
      created_at timestamp NOT NULL DEFAULT now(),
      updated_at timestamp NOT NULL DEFAULT now()
    );
  `);

  await pool.query(`
    ALTER TABLE disputes
    ADD COLUMN IF NOT EXISTS report_type text NOT NULL DEFAULT 'hacker',
    ADD COLUMN IF NOT EXISTS accused_username text,
    ADD COLUMN IF NOT EXISTS tournament_id integer,
    ADD COLUMN IF NOT EXISTS description text,
    ADD COLUMN IF NOT EXISTS screenshot_url text,
    ADD COLUMN IF NOT EXISTS status text NOT NULL DEFAULT 'submitted',
    ADD COLUMN IF NOT EXISTS resolution_note text,
    ADD COLUMN IF NOT EXISTS priority_level text NOT NULL DEFAULT 'standard',
    ADD COLUMN IF NOT EXISTS resolved_by integer,
    ADD COLUMN IF NOT EXISTS resolved_at timestamp,
    ADD COLUMN IF NOT EXISTS updated_at timestamp NOT NULL DEFAULT now();
  `);

  await pool.query(`
    UPDATE disputes
    SET
      report_type = COALESCE(NULLIF(report_type, ''), 'hacker'),
      status = COALESCE(NULLIF(status, ''), 'submitted'),
      priority_level = COALESCE(NULLIF(priority_level, ''), 'standard'),
      updated_at = COALESCE(updated_at, now())
    WHERE report_type IS NULL OR status IS NULL OR priority_level IS NULL OR updated_at IS NULL;
  `);

  await pool.query(`
    CREATE TABLE IF NOT EXISTS dispute_logs (
      id integer GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
      dispute_id integer NOT NULL REFERENCES disputes(id) ON DELETE CASCADE,
      actor_user_id integer,
      actor_role text NOT NULL DEFAULT 'system',
      action text NOT NULL,
      note text,
      created_at timestamp NOT NULL DEFAULT now()
    );
  `);

  await pool.query(`
    ALTER TABLE dispute_logs
    ADD COLUMN IF NOT EXISTS actor_user_id integer,
    ADD COLUMN IF NOT EXISTS actor_role text NOT NULL DEFAULT 'system',
    ADD COLUMN IF NOT EXISTS action text,
    ADD COLUMN IF NOT EXISTS note text;
  `);

  await pool.query(`
    CREATE INDEX IF NOT EXISTS disputes_user_created_idx ON disputes(user_id, created_at DESC);
  `);
  await pool.query(`
    CREATE INDEX IF NOT EXISTS disputes_status_created_idx ON disputes(status, created_at DESC);
  `);
  await pool.query(`
    CREATE INDEX IF NOT EXISTS dispute_logs_dispute_created_idx ON dispute_logs(dispute_id, created_at DESC);
  `);
}

export const db = drizzle(pool, { schema });
