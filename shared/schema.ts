import { sql } from "drizzle-orm";
import { pgTable, text, varchar, integer, boolean, timestamp, pgEnum, jsonb } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod";

export const roleEnum = pgEnum("role", ["user", "admin"]);
export const tournamentStatusEnum = pgEnum("tournament_status", ["upcoming", "live", "completed", "cancelled"]);
export const matchTypeEnum = pgEnum("match_type", ["solo", "duo", "squad"]);
export const transactionTypeEnum = pgEnum("transaction_type", ["deposit", "withdrawal", "entry_fee", "winning", "admin_credit", "admin_debit"]);
export const withdrawalStatusEnum = pgEnum("withdrawal_status", ["pending", "approved", "rejected", "paid"]);

export const users = pgTable("users", {
  id: integer("id").primaryKey().generatedAlwaysAsIdentity(),
  username: text("username").notNull().unique(),
  email: text("email").notNull().unique(),
  password: text("password").notNull(),
  role: roleEnum("role").notNull().default("user"),
  walletBalance: integer("wallet_balance").notNull().default(0),
  bgmiId: text("bgmi_id"),
  freeFireId: text("free_fire_id"),
  codMobileId: text("cod_mobile_id"),
  valorantId: text("valorant_id"),
  cs2Id: text("cs2_id"),
  pubgId: text("pubg_id"),
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
  prizeDistribution: jsonb("prize_distribution"),
  createdAt: timestamp("created_at").notNull().defaultNow(),
});

export const registrations = pgTable("registrations", {
  id: integer("id").primaryKey().generatedAlwaysAsIdentity(),
  userId: integer("user_id").notNull(),
  tournamentId: integer("tournament_id").notNull(),
  createdAt: timestamp("created_at").notNull().defaultNow(),
});

export const transactions = pgTable("transactions", {
  id: integer("id").primaryKey().generatedAlwaysAsIdentity(),
  userId: integer("user_id").notNull(),
  amount: integer("amount").notNull(),
  type: transactionTypeEnum("type").notNull(),
  description: text("description"),
  tournamentId: integer("tournament_id"),
  createdAt: timestamp("created_at").notNull().defaultNow(),
});

export const withdrawals = pgTable("withdrawals", {
  id: integer("id").primaryKey().generatedAlwaysAsIdentity(),
  userId: integer("user_id").notNull(),
  amount: integer("amount").notNull(),
  upiId: text("upi_id"),
  bankDetails: text("bank_details"),
  status: withdrawalStatusEnum("status").notNull().default("pending"),
  adminNote: text("admin_note"),
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

export const insertUserSchema = createInsertSchema(users).omit({ id: true, createdAt: true, walletBalance: true, role: true, banned: true });
export const loginSchema = z.object({ email: z.string().min(1), password: z.string().min(1) });
export const signupSchema = z.object({ username: z.string().min(3).max(30), email: z.string().email(), password: z.string().min(6) });

export const insertGameSchema = createInsertSchema(games).omit({ id: true, createdAt: true });
export const insertTournamentSchema = createInsertSchema(tournaments).omit({ id: true, createdAt: true, filledSlots: true, status: true });
export const insertWithdrawalSchema = z.object({ amount: z.number().min(50), upiId: z.string().optional(), bankDetails: z.string().optional() });
export const insertResultSchema = createInsertSchema(results).omit({ id: true, createdAt: true });

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
