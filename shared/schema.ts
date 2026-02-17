import { sql } from "drizzle-orm";
import { pgTable, text, varchar, integer, boolean, timestamp, pgEnum, jsonb, uniqueIndex } from "drizzle-orm/pg-core";
import { z } from "zod";

export const roleEnum = pgEnum("role", ["user", "admin"]);
export const tournamentStatusEnum = pgEnum("tournament_status", ["hot", "upcoming", "live", "completed", "cancelled"]);
export const matchTypeEnum = pgEnum("match_type", ["solo", "duo", "squad"]);
export const transactionTypeEnum = pgEnum("transaction_type", ["deposit", "withdrawal", "entry_fee", "winning", "admin_credit", "admin_debit", "razorpay"]);
export const withdrawalStatusEnum = pgEnum("withdrawal_status", ["pending", "approved", "rejected", "paid"]);
export const paymentStatusEnum = pgEnum("payment_status", ["created", "authorized", "captured", "failed", "refunded"]);
export const notificationTypeEnum = pgEnum("notification_type", ["tournament_joined", "match_started", "results_declared", "withdrawal_update", "wallet_credit", "wallet_debit", "general"]);
export const couponTypeValues = [
  "flat_discount",
  "free_entry",
  "bonus_credit",
] as const;

export const couponContextValues = ["wallet", "tournament_join"] as const;
export const loyaltyTierValues = ["bronze", "silver", "gold", "vip"] as const;
export const disputeStatusValues = ["submitted", "in_review", "resolved", "rejected"] as const;

export const users = pgTable("users", {
  id: integer("id").primaryKey().generatedAlwaysAsIdentity(),
  username: text("username").notNull().unique(),
  email: text("email").notNull().unique(),
  password: text("password").notNull().default(""),
  emailVerified: boolean("email_verified").notNull().default(false),
  emailVerificationToken: text("email_verification_token"),
  emailVerificationExpires: timestamp("email_verification_expires"),
  emailVerificationAttempts: integer("email_verification_attempts").notNull().default(0),
  emailVerificationLockUntil: timestamp("email_verification_lock_until"),
  phone: text("phone"),
  phoneVerified: boolean("phone_verified").notNull().default(false),
  phoneVerificationCode: text("phone_verification_code"),
  phoneVerificationExpires: timestamp("phone_verification_expires"),
  phoneVerificationAttempts: integer("phone_verification_attempts").notNull().default(0),
  phoneVerificationLockUntil: timestamp("phone_verification_lock_until"),
  passwordResetToken: text("password_reset_token"),
  passwordResetExpires: timestamp("password_reset_expires"),
  passwordResetAttempts: integer("password_reset_attempts").notNull().default(0),
  passwordResetLockUntil: timestamp("password_reset_lock_until"),
  withdrawalLockUntil: timestamp("withdrawal_lock_until"),
  emailChangedAt: timestamp("email_changed_at"),
  phoneChangedAt: timestamp("phone_changed_at"),
  role: roleEnum("role").notNull().default("user"),
  mainWalletBalance: integer("main_wallet_balance").notNull().default(0),
  bonusWalletBalance: integer("bonus_wallet_balance").notNull().default(0),
  walletBalance: integer("wallet_balance").notNull().default(0),
  bgmiIgn: text("bgmi_ign"),
  freeFireIgn: text("free_fire_ign"),
  codIgn: text("cod_ign"),
  googleId: text("google_id"),
  avatarUrl: text("avatar_url"),
  banned: boolean("banned").notNull().default(false),
  createdAt: timestamp("created_at").notNull().defaultNow(),
});

export const games = pgTable("games", {
  id: integer("id").primaryKey().generatedAlwaysAsIdentity(),
  name: text("name").notNull().unique(),
  slug: text("slug").notNull().unique(),
  imageUrl: text("image_url"),
  enabled: boolean("enabled").notNull().default(true),
  createdAt: timestamp("created_at").notNull().defaultNow(),
});

export const tournaments = pgTable("tournaments", {
  id: integer("id").primaryKey().generatedAlwaysAsIdentity(),
  title: text("title").notNull(),
  gameId: integer("game_id").notNull(),
  entryFee: integer("entry_fee").notNull().default(0),
  prizePool: integer("prize_pool").notNull().default(0),
  maxSlots: integer("max_slots").notNull().default(100),
  filledSlots: integer("filled_slots").notNull().default(0),
  matchType: matchTypeEnum("match_type").notNull().default("solo"),
  status: tournamentStatusEnum("status").notNull().default("upcoming"),
  startTime: timestamp("start_time").notNull(),
  roomId: text("room_id"),
  roomPassword: text("room_password"),
  rules: text("rules"),
  mapName: text("map_name"),
  imageUrl: text("image_url"),
  description: text("description"),
  prizeDistribution: jsonb("prize_distribution"),
  createdAt: timestamp("created_at").notNull().defaultNow(),
});

export const registrations = pgTable(
  "registrations",
  {
    id: integer("id").primaryKey().generatedAlwaysAsIdentity(),
    userId: integer("user_id").notNull(),
    tournamentId: integer("tournament_id").notNull(),
    teamId: integer("team_id"),
    inGameName: text("in_game_name"),
    createdAt: timestamp("created_at").notNull().defaultNow(),
  },
  (table) => ({
    registrationsUserTournamentUnique: uniqueIndex("registrations_user_tournament_uq").on(
      table.userId,
      table.tournamentId,
    ),
  }),
);

export const transactions = pgTable("transactions", {
  id: integer("id").primaryKey().generatedAlwaysAsIdentity(),
  userId: integer("user_id").notNull(),
  amount: integer("amount").notNull(),
  type: transactionTypeEnum("type").notNull(),
  walletType: text("wallet_type").notNull().default("main"),
  mainBalanceBefore: integer("main_balance_before").notNull().default(0),
  mainBalanceAfter: integer("main_balance_after").notNull().default(0),
  bonusBalanceBefore: integer("bonus_balance_before").notNull().default(0),
  bonusBalanceAfter: integer("bonus_balance_after").notNull().default(0),
  previousHash: text("previous_hash"),
  entryHash: text("entry_hash").notNull().default(""),
  metadata: jsonb("metadata"),
  description: text("description"),
  tournamentId: integer("tournament_id"),
  createdAt: timestamp("created_at").notNull().defaultNow(),
});

export const withdrawals = pgTable("withdrawals", {
  id: integer("id").primaryKey().generatedAlwaysAsIdentity(),
  userId: integer("user_id").notNull(),
  amount: integer("amount").notNull(),
  platformFee: integer("platform_fee").notNull().default(0),
  netAmount: integer("net_amount").notNull().default(0),
  feePercent: integer("fee_percent").notNull().default(0),
  loyaltyTier: text("loyalty_tier").notNull().default("bronze"),
  upiId: text("upi_id"),
  bankDetails: text("bank_details"),
  status: withdrawalStatusEnum("status").notNull().default("pending"),
  adminNote: text("admin_note"),
  createdAt: timestamp("created_at").notNull().defaultNow(),
});

export const teams = pgTable("teams", {
  id: integer("id").primaryKey().generatedAlwaysAsIdentity(),
  name: text("name").notNull(),
  ownerId: integer("owner_id").notNull(),
  createdAt: timestamp("created_at").notNull().defaultNow(),
});

export const teamMembers = pgTable("team_members", {
  id: integer("id").primaryKey().generatedAlwaysAsIdentity(),
  teamId: integer("team_id").notNull(),
  userId: integer("user_id").notNull(),
  createdAt: timestamp("created_at").notNull().defaultNow(),
});

export const results = pgTable("results", {
  id: integer("id").primaryKey().generatedAlwaysAsIdentity(),
  tournamentId: integer("tournament_id").notNull(),
  userId: integer("user_id").notNull(),
  position: integer("position").notNull(),
  kills: integer("kills").notNull().default(0),
  prize: integer("prize").notNull().default(0),
  createdAt: timestamp("created_at").notNull().defaultNow(),
});

export const payments = pgTable("payments", {
  id: integer("id").primaryKey().generatedAlwaysAsIdentity(),
  userId: integer("user_id").notNull(),
  razorpayOrderId: text("razorpay_order_id").notNull(),
  razorpayPaymentId: text("razorpay_payment_id"),
  razorpaySignature: text("razorpay_signature"),
  amount: integer("amount").notNull(),
  currency: text("currency").notNull().default("INR"),
  status: paymentStatusEnum("status").notNull().default("created"),
  createdAt: timestamp("created_at").notNull().defaultNow(),
});

export const adminLogs = pgTable("admin_logs", {
  id: integer("id").primaryKey().generatedAlwaysAsIdentity(),
  adminId: integer("admin_id").notNull(),
  action: text("action").notNull(),
  targetType: text("target_type"),
  targetId: integer("target_id"),
  details: text("details"),
  createdAt: timestamp("created_at").notNull().defaultNow(),
});

export const notifications = pgTable("notifications", {
  id: integer("id").primaryKey().generatedAlwaysAsIdentity(),
  userId: integer("user_id").notNull(),
  type: notificationTypeEnum("type").notNull().default("general"),
  title: text("title").notNull(),
  message: text("message").notNull(),
  read: boolean("read").notNull().default(false),
  createdAt: timestamp("created_at").notNull().defaultNow(),
});

export const banners = pgTable("banners", {
  id: integer("id").primaryKey().generatedAlwaysAsIdentity(),
  imageUrl: text("image_url").notNull(),
  title: text("title"),
  linkUrl: text("link_url"),
  sortOrder: integer("sort_order").notNull().default(0),
  enabled: boolean("enabled").notNull().default(true),
  createdAt: timestamp("created_at").notNull().defaultNow(),
});

export const coupons = pgTable("coupons", {
  id: integer("id").primaryKey().generatedAlwaysAsIdentity(),
  code: varchar("code", { length: 64 }).notNull().unique(),
  amount: integer("amount").notNull().default(0),
  couponType: text("coupon_type").notNull().default("bonus_credit"),
  value: integer("value").notNull().default(0),
  globalUsageLimit: integer("global_usage_limit"),
  perUserLimit: integer("per_user_limit").notNull().default(1),
  totalUsageCount: integer("total_usage_count").notNull().default(0),
  expiresAt: timestamp("expires_at"),
  minEntryFee: integer("min_entry_fee"),
  tournamentId: integer("tournament_id"),
  fraudHookEnabled: boolean("fraud_hook_enabled").notNull().default(false),
  metadata: jsonb("metadata"),
  createdBy: integer("created_by"),
  enabled: boolean("enabled").notNull().default(true),
  createdAt: timestamp("created_at").notNull().defaultNow(),
});

export const couponRedemptions = pgTable(
  "coupon_redemptions",
  {
    id: integer("id").primaryKey().generatedAlwaysAsIdentity(),
    couponId: integer("coupon_id").notNull(),
    userId: integer("user_id").notNull(),
    context: text("context").notNull().default("wallet"),
    tournamentId: integer("tournament_id"),
    couponType: text("coupon_type"),
    discountAmount: integer("discount_amount").notNull().default(0),
    bonusAmount: integer("bonus_amount").notNull().default(0),
    metadata: jsonb("metadata"),
    createdAt: timestamp("created_at").notNull().defaultNow(),
  },
);

export const disputes = pgTable("disputes", {
  id: integer("id").primaryKey().generatedAlwaysAsIdentity(),
  userId: integer("user_id").notNull(),
  reportType: text("report_type").notNull().default("hacker"),
  accusedUsername: text("accused_username"),
  tournamentId: integer("tournament_id"),
  description: text("description").notNull(),
  screenshotUrl: text("screenshot_url"),
  status: text("status").notNull().default("submitted"),
  resolutionNote: text("resolution_note"),
  priorityLevel: text("priority_level").notNull().default("standard"),
  resolvedBy: integer("resolved_by"),
  resolvedAt: timestamp("resolved_at"),
  createdAt: timestamp("created_at").notNull().defaultNow(),
  updatedAt: timestamp("updated_at").notNull().defaultNow(),
});

export const disputeLogs = pgTable("dispute_logs", {
  id: integer("id").primaryKey().generatedAlwaysAsIdentity(),
  disputeId: integer("dispute_id").notNull(),
  actorUserId: integer("actor_user_id"),
  actorRole: text("actor_role").notNull().default("system"),
  action: text("action").notNull(),
  note: text("note"),
  createdAt: timestamp("created_at").notNull().defaultNow(),
});

export const insertUserSchema = z.object({
  username: z.string().min(3).max(30),
  email: z.string().email(),
  password: z.string().min(6),
});
export const loginSchema = z.object({ email: z.string().email(), password: z.string().min(6) });
export const signupSchema = z.object({ username: z.string().min(3).max(30), email: z.string().email(), password: z.string().min(6) });

export const insertGameSchema = z.object({
  name: z.string().min(2).max(100),
  slug: z.string().min(2).max(100),
  imageUrl: z.string().url().optional().nullable(),
  enabled: z.boolean().optional(),
});
export const insertTournamentSchema = z.object({
  title: z.string().min(2).max(200),
  gameId: z.number().int().positive(),
  entryFee: z.number().int().nonnegative().optional(),
  prizePool: z.number().int().nonnegative().optional(),
  maxSlots: z.number().int().positive(),
  matchType: z.enum(["solo", "duo", "squad"]),
  startTime: z.union([z.string(), z.date()]),
  roomId: z.string().optional().nullable(),
  roomPassword: z.string().optional().nullable(),
  rules: z.string().optional().nullable(),
  mapName: z.string().optional().nullable(),
  imageUrl: z.string().optional().nullable(),
  description: z.string().optional().nullable(),
  prizeDistribution: z
    .array(z.object({ position: z.number().int().positive(), prize: z.number().int().nonnegative() }))
    .optional()
    .nullable(),
});
export const insertWithdrawalSchema = z.object({ amount: z.number().min(50), upiId: z.string().optional(), bankDetails: z.string().optional() });
export const insertResultSchema = z.object({
  tournamentId: z.number().int().positive(),
  userId: z.number().int().positive(),
  position: z.number().int().positive(),
  kills: z.number().int().nonnegative().optional(),
  prize: z.number().int().nonnegative().optional(),
});
export const insertTeamSchema = z.object({ name: z.string().min(2).max(50) });
export const insertBannerSchema = z.object({
  imageUrl: z.string().min(1),
  title: z.string().optional().nullable(),
  linkUrl: z.string().optional().nullable(),
  sortOrder: z.number().int().nonnegative().optional(),
  enabled: z.boolean().optional(),
});
export const insertCouponSchema = z.object({
  code: z.string().min(3).max(64),
  amount: z.number().int().nonnegative().optional(),
  couponType: z.enum(couponTypeValues).optional(),
  value: z.number().int().nonnegative().optional(),
  globalUsageLimit: z.number().int().positive().optional().nullable(),
  perUserLimit: z.number().int().positive().optional().nullable(),
  expiresAt: z.union([z.string(), z.date()]).optional().nullable(),
  minEntryFee: z.number().int().nonnegative().optional().nullable(),
  tournamentId: z.number().int().positive().optional().nullable(),
  fraudHookEnabled: z.boolean().optional(),
  metadata: z.record(z.any()).optional().nullable(),
  enabled: z.boolean().optional(),
});
export const insertDisputeSchema = z.object({
  reportType: z.string().min(2).max(50).optional(),
  accusedUsername: z.string().min(2).max(60).optional().nullable(),
  tournamentId: z.number().int().positive().optional().nullable(),
  description: z.string().min(10).max(2000),
});

export type User = typeof users.$inferSelect;
export type InsertUser = z.infer<typeof insertUserSchema>;
export type Game = typeof games.$inferSelect;
export type InsertGame = z.infer<typeof insertGameSchema>;
export type Tournament = typeof tournaments.$inferSelect;
export type InsertTournament = z.infer<typeof insertTournamentSchema>;
export type Registration = typeof registrations.$inferSelect;
export type Transaction = typeof transactions.$inferSelect;
export type Withdrawal = typeof withdrawals.$inferSelect;
export type Result = typeof results.$inferSelect;
export type Team = typeof teams.$inferSelect;
export type TeamMember = typeof teamMembers.$inferSelect;
export type Payment = typeof payments.$inferSelect;
export type AdminLog = typeof adminLogs.$inferSelect;
export type Notification = typeof notifications.$inferSelect;
export type Banner = typeof banners.$inferSelect;
export type InsertBanner = z.infer<typeof insertBannerSchema>;
export type Coupon = typeof coupons.$inferSelect;
export type CouponRedemption = typeof couponRedemptions.$inferSelect;
export type InsertCoupon = z.infer<typeof insertCouponSchema>;
export type CouponType = (typeof couponTypeValues)[number];
export type CouponContext = (typeof couponContextValues)[number];
export type LoyaltyTier = (typeof loyaltyTierValues)[number];
export type DisputeStatus = (typeof disputeStatusValues)[number];
export type Dispute = typeof disputes.$inferSelect;
export type DisputeLog = typeof disputeLogs.$inferSelect;
export type InsertDispute = z.infer<typeof insertDisputeSchema>;
