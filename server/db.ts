import { Pool } from "pg";
import { drizzle } from "drizzle-orm/node-postgres";
import * as schema from "@shared/schema";

/**
 * Railway REQUIRED check
 */
if (!process.env.DATABASE_URL) {
  throw new Error("❌ DATABASE_URL is not set in environment variables");
}

/**
 * Railway Postgres FIX
 * - SSL is mandatory
 * - rejectUnauthorized must be false
 */
const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
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
      amount integer NOT NULL,
      enabled boolean NOT NULL DEFAULT true,
      created_at timestamp NOT NULL DEFAULT now()
    );
  `);

  await pool.query(`
    CREATE TABLE IF NOT EXISTS coupon_redemptions (
      id integer GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
      coupon_id integer NOT NULL REFERENCES coupons(id) ON DELETE CASCADE,
      user_id integer NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      created_at timestamp NOT NULL DEFAULT now(),
      CONSTRAINT coupon_redemptions_coupon_user_uq UNIQUE (coupon_id, user_id)
    );
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
}

export const db = drizzle(pool, { schema });
