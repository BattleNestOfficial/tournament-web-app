import { db } from "./db";
import { eq, desc, sql, and, or } from "drizzle-orm";
import {
  users, games, tournaments, registrations, transactions, withdrawals, results, teams, teamMembers,
  payments, adminLogs, notifications, banners, coupons, couponRedemptions,
  type User, type InsertUser, type Game, type InsertGame, type Tournament, type InsertTournament,
  type Registration, type Transaction, type Withdrawal, type Result, type Team, type TeamMember,
  type Payment, type AdminLog, type Notification, type Banner, type Coupon, type CouponType,
} from "@shared/schema";
import bcrypt from "bcryptjs";
import crypto from "crypto";

export interface IStorage {
  createUser(data: { username: string; email: string; password: string }): Promise<User>;
  createGoogleUser(data: { username: string; email: string; googleId: string; avatarUrl?: string }): Promise<User>;
  getUserByEmail(email: string): Promise<User | undefined>;
  getUserById(id: number): Promise<User | undefined>;
  getUserByGoogleId(googleId: string): Promise<User | undefined>;
  getUserByEmailVerificationToken(token: string): Promise<User | undefined>;
  getUserByPasswordResetToken(token: string): Promise<User | undefined>;
  updateUserProfile(id: number, data: Partial<User>): Promise<User | undefined>;
  updateWalletBalance(id: number, amount: number): Promise<User | undefined>;
  getAllUsers(): Promise<User[]>;
  banUser(id: number, banned: boolean): Promise<User | undefined>;

  getAllGames(): Promise<Game[]>;
  createGame(data: InsertGame): Promise<Game>;
  updateGame(id: number, data: Partial<Game>): Promise<Game | undefined>;
  deleteGame(id: number): Promise<void>;

  getAllTournaments(): Promise<Tournament[]>;
  getTournamentById(id: number): Promise<Tournament | undefined>;
  createTournament(data: any): Promise<Tournament>;
  updateTournament(id: number, data: Partial<Tournament>): Promise<Tournament | undefined>;
  updateTournamentStatus(id: number, status: string): Promise<Tournament | undefined>;
  deleteTournament(id: number): Promise<void>;
  incrementSlots(id: number): Promise<void>;

  createRegistration(userId: number, tournamentId: number, inGameName?: string, teamId?: number): Promise<Registration>;
  joinTournament(data: { userId: number; tournamentId: number; inGameName?: string; teamId?: number | null; couponCode?: string }): Promise<{ user: User; tournament: Tournament }>;
  getRegistrationsByUser(userId: number): Promise<Registration[]>;
  getRegistration(userId: number, tournamentId: number): Promise<Registration | undefined>;
  getRegistrationsByTournament(tournamentId: number): Promise<Registration[]>;

  createTransaction(data: {
    userId: number;
    amount: number;
    type: string;
    description?: string;
    tournamentId?: number;
    walletType?: "main" | "bonus" | "mixed";
    mainBalanceBefore?: number;
    mainBalanceAfter?: number;
    bonusBalanceBefore?: number;
    bonusBalanceAfter?: number;
    metadata?: Record<string, unknown> | null;
  }): Promise<Transaction>;
  getTransactionsByUser(userId: number): Promise<Transaction[]>;

  createWithdrawal(data: { userId: number; amount: number; upiId?: string; bankDetails?: string }): Promise<Withdrawal>;
  getUserWithdrawalTotalForDay(userId: number, dayStart: Date, dayEnd: Date): Promise<number>;
  getWithdrawalById(id: number): Promise<Withdrawal | undefined>;
  getWithdrawalsByUser(userId: number): Promise<Withdrawal[]>;
  getAllWithdrawals(): Promise<(Withdrawal & { username?: string })[]>;
  updateWithdrawal(id: number, data: Partial<Withdrawal>): Promise<Withdrawal | undefined>;

  getResultsByTournament(tournamentId: number): Promise<Result[]>;
  createResult(data: { tournamentId: number; userId: number; position: number; kills: number; prize: number }): Promise<Result>;
  deleteResultsByTournament(tournamentId: number): Promise<void>;

  createTeam(ownerId: number, name: string): Promise<Team>;
  getTeamsByUser(userId: number): Promise<(Team & { members: (TeamMember & { username?: string })[] })[]>;
  getTeamById(id: number): Promise<Team | undefined>;
  addTeamMember(teamId: number, userId: number): Promise<TeamMember>;
  removeTeamMember(teamId: number, userId: number): Promise<void>;
  getTeamMembers(teamId: number): Promise<(TeamMember & { username?: string })[]>;
  deleteTeam(id: number): Promise<void>;

  createPayment(data: { userId: number; razorpayOrderId: string; amount: number; currency?: string }): Promise<Payment>;
  getPaymentByOrderId(orderId: string): Promise<Payment | undefined>;
  updatePayment(id: number, data: Partial<Payment>): Promise<Payment | undefined>;
  markPaymentCapturedByOrderId(orderId: string, data: { razorpayPaymentId?: string; razorpaySignature?: string }): Promise<Payment | undefined>;
  getPaymentsByUser(userId: number): Promise<Payment[]>;

  createAdminLog(data: { adminId: number; action: string; targetType?: string; targetId?: number; details?: string }): Promise<AdminLog>;
  getAdminLogs(): Promise<AdminLog[]>;

  createNotification(data: { userId: number; type: string; title: string; message: string }): Promise<Notification>;
  getNotificationsByUser(userId: number): Promise<Notification[]>;
  markNotificationRead(id: number, userId: number): Promise<Notification | undefined>;
  markAllNotificationsRead(userId: number): Promise<void>;
  getUnreadNotificationCount(userId: number): Promise<number>;

  getStats(): Promise<{ totalUsers: number; totalRevenue: number; activeTournaments: number; totalPayouts: number }>;

  getAllBanners(): Promise<Banner[]>;
  getEnabledBanners(): Promise<Banner[]>;
  createBanner(data: { imageUrl: string; title?: string; linkUrl?: string; sortOrder?: number }): Promise<Banner>;
  updateBanner(id: number, data: Partial<Banner>): Promise<Banner | undefined>;
  deleteBanner(id: number): Promise<void>;
  getBannerCount(): Promise<number>;

  getAllCoupons(): Promise<Coupon[]>;
  createCoupon(data: {
    code: string;
    couponType?: CouponType;
    value?: number;
    amount?: number;
    enabled?: boolean;
    globalUsageLimit?: number | null;
    perUserLimit?: number | null;
    expiresAt?: Date | null;
    minEntryFee?: number | null;
    tournamentId?: number | null;
    fraudHookEnabled?: boolean;
    metadata?: Record<string, unknown> | null;
    createdBy?: number | null;
  }): Promise<Coupon>;
  deleteCoupon(id: number): Promise<void>;
  redeemCoupon(
    userId: number,
    code: string,
    options?: {
      context?: "wallet" | "tournament_join";
      tournamentId?: number;
      entryFee?: number;
      fraudContext?: Record<string, unknown> | null;
    },
  ): Promise<{ user: User; coupon: Coupon; amount: number; discountAmount: number; bonusAmount: number }>;
  getCouponAnalytics(): Promise<
    Array<{
      couponId: number;
      code: string;
      couponType: string;
      totalUsage: number;
      uniqueUsers: number;
      totalDiscountAmount: number;
      totalBonusAmount: number;
      lastRedeemedAt: Date | null;
    }>
  >;

  seedData(): Promise<void>;
}

export class DatabaseStorage implements IStorage {
  private getSafeBalance(value: number | null | undefined): number {
    return Number(value || 0);
  }

  private isSupportedCouponType(value: unknown): value is CouponType {
    const raw = String(value || "").toLowerCase().trim();
    return raw === "flat_discount" || raw === "free_entry" || raw === "bonus_credit";
  }

  private normalizeCouponType(value: unknown): CouponType {
    const raw = String(value || "").toLowerCase().trim();
    const allowed: CouponType[] = [
      "flat_discount",
      "free_entry",
      "bonus_credit",
    ];
    return allowed.includes(raw as CouponType) ? (raw as CouponType) : "bonus_credit";
  }

  private isWalletCouponType(type: CouponType): boolean {
    return type === "bonus_credit";
  }

  private isTournamentCouponType(type: CouponType): boolean {
    return type === "flat_discount" || type === "free_entry";
  }

  private computeTournamentCouponDiscount(coupon: Coupon, entryFee: number): number {
    if (!Number.isFinite(entryFee) || entryFee <= 0) return 0;
    const type = this.normalizeCouponType(coupon.couponType);
    const value = Math.max(0, Math.round(Number(coupon.value ?? coupon.amount ?? 0)));
    if (type === "free_entry") {
      return entryFee;
    }
    if (type === "flat_discount") {
      if (value <= 0) return 0;
      return Math.min(entryFee, value);
    }
    return 0;
  }

  private async runCouponFraudHook(payload: {
    couponCode: string;
    couponType: string;
    context: "wallet" | "tournament_join";
    userId: number;
    tournamentId?: number | null;
    entryFee?: number;
    amount?: number;
    metadata?: Record<string, unknown> | null;
    enabled: boolean;
  }) {
    if (!payload.enabled) {
      return { allowed: true as const };
    }
    const hookUrl = process.env.COUPON_FRAUD_HOOK_URL;
    if (!hookUrl) {
      return { allowed: true as const };
    }

    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 2500);
    try {
      const response = await fetch(hookUrl, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
        signal: controller.signal,
      });

      if (!response.ok) {
        return { allowed: true as const };
      }

      const data = (await response.json()) as { allow?: boolean; reason?: string };
      if (data?.allow === false) {
        return { allowed: false as const, reason: data.reason || "Coupon blocked by fraud policy" };
      }
      return { allowed: true as const };
    } catch {
      return { allowed: true as const };
    } finally {
      clearTimeout(timeout);
    }
  }

  private buildLedgerHash(data: {
    userId: number;
    amount: number;
    type: string;
    walletType: string;
    mainBalanceBefore: number;
    mainBalanceAfter: number;
    bonusBalanceBefore: number;
    bonusBalanceAfter: number;
    previousHash: string;
    description?: string | null;
    tournamentId?: number | null;
    metadata?: Record<string, unknown> | null;
  }): string {
    const payload = JSON.stringify(data);
    return crypto.createHash("sha256").update(payload).digest("hex");
  }

  private async createTransactionInTx(
    tx: any,
    data: {
      userId: number;
      amount: number;
      type: string;
      description?: string;
      tournamentId?: number;
      walletType?: "main" | "bonus" | "mixed";
      mainBalanceBefore: number;
      mainBalanceAfter: number;
      bonusBalanceBefore: number;
      bonusBalanceAfter: number;
      metadata?: Record<string, unknown> | null;
    },
  ): Promise<Transaction> {
    const [lastTx] = await tx
      .select({ hash: transactions.entryHash })
      .from(transactions)
      .where(eq(transactions.userId, data.userId))
      .orderBy(desc(transactions.id))
      .limit(1);

    const previousHash = lastTx?.hash || "";
    const entryHash = this.buildLedgerHash({
      userId: data.userId,
      amount: data.amount,
      type: data.type,
      walletType: data.walletType || "main",
      mainBalanceBefore: data.mainBalanceBefore,
      mainBalanceAfter: data.mainBalanceAfter,
      bonusBalanceBefore: data.bonusBalanceBefore,
      bonusBalanceAfter: data.bonusBalanceAfter,
      previousHash,
      description: data.description || null,
      tournamentId: data.tournamentId || null,
      metadata: data.metadata || null,
    });

    const [created] = await tx
      .insert(transactions)
      .values({
        userId: data.userId,
        amount: data.amount,
        type: data.type as any,
        walletType: data.walletType || "main",
        mainBalanceBefore: data.mainBalanceBefore,
        mainBalanceAfter: data.mainBalanceAfter,
        bonusBalanceBefore: data.bonusBalanceBefore,
        bonusBalanceAfter: data.bonusBalanceAfter,
        previousHash: previousHash || null,
        entryHash,
        metadata: data.metadata || null,
        description: data.description || null,
        tournamentId: data.tournamentId || null,
      })
      .returning();

    return created;
  }

  async createUser(data: { username: string; email: string; password: string }): Promise<User> {
    const hashedPassword = await bcrypt.hash(data.password, 10);
    const [user] = await db.insert(users).values({
      username: data.username,
      email: data.email,
      password: hashedPassword,
    }).returning();
    return user;
  }

  async createGoogleUser(data: { username: string; email: string; googleId: string; avatarUrl?: string }): Promise<User> {
    const [user] = await db.insert(users).values({
      username: data.username,
      email: data.email,
      password: "",
      emailVerified: true,
      googleId: data.googleId,
      avatarUrl: data.avatarUrl || null,
    }).returning();
    return user;
  }

  async getUserByEmail(email: string): Promise<User | undefined> {
    const [user] = await db.select().from(users).where(eq(users.email, email));
    return user;
  }

  async getUserById(id: number): Promise<User | undefined> {
    const [user] = await db.select().from(users).where(eq(users.id, id));
    return user;
  }

  async getUserByGoogleId(googleId: string): Promise<User | undefined> {
    const [user] = await db.select().from(users).where(eq(users.googleId, googleId));
    return user;
  }

  async getUserByEmailVerificationToken(token: string): Promise<User | undefined> {
    const [user] = await db.select().from(users).where(eq(users.emailVerificationToken, token));
    return user;
  }

  async getUserByPasswordResetToken(token: string): Promise<User | undefined> {
    const [user] = await db.select().from(users).where(eq(users.passwordResetToken, token));
    return user;
  }

  async updateUserProfile(id: number, data: Partial<User>): Promise<User | undefined> {
    const [user] = await db.update(users).set(data).where(eq(users.id, id)).returning();
    return user;
  }

  async updateWalletBalance(id: number, amount: number): Promise<User | undefined> {
    if (!Number.isFinite(amount) || amount === 0) {
      return this.getUserById(id);
    }

    return db.transaction(async (tx) => {
      const whereClause =
        amount < 0
          ? and(eq(users.id, id), sql`${users.mainWalletBalance} >= ${Math.abs(amount)}`)
          : eq(users.id, id);

      const [updatedUser] = await tx
        .update(users)
        .set({
          mainWalletBalance: sql`${users.mainWalletBalance} + ${amount}`,
          walletBalance: sql`${users.mainWalletBalance} + ${users.bonusWalletBalance} + ${amount}`,
        })
        .where(whereClause)
        .returning();

      return updatedUser;
    });
  }

  async getAllUsers(): Promise<User[]> {
    return db.select().from(users).orderBy(desc(users.createdAt));
  }

  async banUser(id: number, banned: boolean): Promise<User | undefined> {
    const [user] = await db.update(users).set({ banned }).where(eq(users.id, id)).returning();
    return user;
  }

  async getAllGames(): Promise<Game[]> {
    return db.select().from(games).orderBy(games.name);
  }

  async createGame(data: InsertGame): Promise<Game> {
    const [game] = await db.insert(games).values(data).returning();
    return game;
  }

  async updateGame(id: number, data: Partial<Game>): Promise<Game | undefined> {
    const [game] = await db.update(games).set(data).where(eq(games.id, id)).returning();
    return game;
  }

  async deleteGame(id: number): Promise<void> {
    await db.delete(games).where(eq(games.id, id));
  }

  async getAllTournaments(): Promise<Tournament[]> {
    return db.select().from(tournaments).orderBy(desc(tournaments.startTime));
  }

  async getTournamentById(id: number): Promise<Tournament | undefined> {
    const [t] = await db.select().from(tournaments).where(eq(tournaments.id, id));
    return t;
  }

  async createTournament(data: any): Promise<Tournament> {
    const [t] = await db.insert(tournaments).values(data).returning();
    return t;
  }

  async updateTournament(id: number, data: Partial<Tournament>): Promise<Tournament | undefined> {
    const [t] = await db.update(tournaments).set(data).where(eq(tournaments.id, id)).returning();
    return t;
  }

  async updateTournamentStatus(id: number, status: string): Promise<Tournament | undefined> {
    const [t] = await db.update(tournaments).set({ status: status as any }).where(eq(tournaments.id, id)).returning();
    return t;
  }

  async deleteTournament(id: number): Promise<void> {
    await db.delete(registrations).where(eq(registrations.tournamentId, id));
    await db.delete(results).where(eq(results.tournamentId, id));
    await db.delete(tournaments).where(eq(tournaments.id, id));
  }

  async incrementSlots(id: number): Promise<void> {
    await db.update(tournaments)
      .set({ filledSlots: sql`${tournaments.filledSlots} + 1` })
      .where(eq(tournaments.id, id));
  }

  async createRegistration(userId: number, tournamentId: number, inGameName?: string, teamId?: number): Promise<Registration> {
    const payload: { userId: number; tournamentId: number; inGameName: string | null; teamId?: number | null } = {
      userId,
      tournamentId,
      inGameName: inGameName || null,
    };

    if (teamId != null) {
      payload.teamId = teamId;
    }

    const [reg] = await db.insert(registrations).values(payload).returning();
    return reg;
  }

  async joinTournament(data: { userId: number; tournamentId: number; inGameName?: string; teamId?: number | null; couponCode?: string }): Promise<{ user: User; tournament: Tournament }> {
    return db.transaction(async (tx) => {
      const [tournament] = await tx.select().from(tournaments).where(eq(tournaments.id, data.tournamentId));
      if (!tournament) {
        const err = new Error("Tournament not found") as Error & { code?: string };
        err.code = "TOURNAMENT_NOT_FOUND";
        throw err;
      }
      if (tournament.status !== "upcoming" && tournament.status !== "hot") {
        const err = new Error("Tournament is not open for registration") as Error & { code?: string };
        err.code = "TOURNAMENT_CLOSED";
        throw err;
      }
      if (new Date(tournament.startTime).getTime() <= Date.now()) {
        await tx
          .update(tournaments)
          .set({ status: "live" as any })
          .where(eq(tournaments.id, data.tournamentId));
        const err = new Error("Tournament has already started") as Error & { code?: string };
        err.code = "TOURNAMENT_CLOSED";
        throw err;
      }

      const [existingReg] = await tx
        .select()
        .from(registrations)
        .where(and(eq(registrations.userId, data.userId), eq(registrations.tournamentId, data.tournamentId)));
      if (existingReg) {
        const err = new Error("Already registered") as Error & { code?: string };
        err.code = "ALREADY_REGISTERED";
        throw err;
      }

      await tx.execute(sql`SELECT id FROM users WHERE id = ${data.userId} FOR UPDATE`);
      const [user] = await tx.select().from(users).where(eq(users.id, data.userId));
      if (!user) {
        const err = new Error("User not found") as Error & { code?: string };
        err.code = "USER_NOT_FOUND";
        throw err;
      }
      if (user.banned) {
        const err = new Error("Account is banned") as Error & { code?: string };
        err.code = "USER_BANNED";
        throw err;
      }

      let walletBefore = {
        main: this.getSafeBalance(user.mainWalletBalance),
        bonus: this.getSafeBalance(user.bonusWalletBalance),
      };
      let walletAfter = walletBefore;
      let walletTypeUsed: "main" | "bonus" | "mixed" = "main";
      const normalizedCouponCode = typeof data.couponCode === "string" ? data.couponCode.trim().toUpperCase() : "";
      let coupon: Coupon | null = null;
      let couponDiscountAmount = 0;
      let payableEntryFee = Math.max(0, Number(tournament.entryFee || 0));

      if (normalizedCouponCode) {
        const [couponRow] = await tx
          .select()
          .from(coupons)
          .where(and(eq(coupons.code, normalizedCouponCode), eq(coupons.enabled, true)));
        if (!couponRow) {
          const err = new Error("Invalid or inactive coupon code") as Error & { code?: string };
          err.code = "INVALID_COUPON";
          throw err;
        }
        if (!this.isSupportedCouponType(couponRow.couponType)) {
          const err = new Error("Coupon type is no longer supported") as Error & { code?: string };
          err.code = "COUPON_NOT_APPLICABLE";
          throw err;
        }

        const couponType = this.normalizeCouponType(couponRow.couponType);
        if (!this.isTournamentCouponType(couponType)) {
          const err = new Error("Coupon is not valid for tournament entry") as Error & { code?: string };
          err.code = "COUPON_NOT_APPLICABLE";
          throw err;
        }
        if (couponRow.expiresAt && couponRow.expiresAt.getTime() <= Date.now()) {
          const err = new Error("Coupon has expired") as Error & { code?: string };
          err.code = "COUPON_EXPIRED";
          throw err;
        }
        if (couponRow.tournamentId && Number(couponRow.tournamentId) !== Number(data.tournamentId)) {
          const err = new Error("Coupon is not valid for this tournament") as Error & { code?: string };
          err.code = "COUPON_NOT_APPLICABLE";
          throw err;
        }
        if (couponRow.globalUsageLimit != null && couponRow.totalUsageCount >= couponRow.globalUsageLimit) {
          const err = new Error("Coupon usage limit reached") as Error & { code?: string };
          err.code = "COUPON_LIMIT_REACHED";
          throw err;
        }
        const perUserLimit = Math.max(1, Number(couponRow.perUserLimit || 1));
        const perUserRedemptions = await tx
          .select({ count: sql<number>`count(*)::int` })
          .from(couponRedemptions)
          .where(and(eq(couponRedemptions.couponId, couponRow.id), eq(couponRedemptions.userId, data.userId)));
        const usedCount = Number(perUserRedemptions?.[0]?.count || 0);
        if (usedCount >= perUserLimit) {
          const err = new Error("You have reached the per-user coupon usage limit") as Error & { code?: string };
          err.code = "COUPON_USER_LIMIT_REACHED";
          throw err;
        }
        if (couponRow.minEntryFee != null && payableEntryFee < couponRow.minEntryFee) {
          const err = new Error("Coupon min entry condition not met") as Error & { code?: string };
          err.code = "COUPON_MIN_ENTRY_NOT_MET";
          throw err;
        }

        const fraudDecision = await this.runCouponFraudHook({
          couponCode: couponRow.code,
          couponType,
          context: "tournament_join",
          userId: data.userId,
          tournamentId: data.tournamentId,
          entryFee: payableEntryFee,
          amount: Number(couponRow.value ?? couponRow.amount ?? 0),
          metadata: (couponRow.metadata as Record<string, unknown> | null) || null,
          enabled: !!couponRow.fraudHookEnabled,
        });
        if (!fraudDecision.allowed) {
          const err = new Error(fraudDecision.reason || "Coupon blocked by fraud policy") as Error & { code?: string };
          err.code = "COUPON_FRAUD_BLOCKED";
          throw err;
        }

        couponDiscountAmount = this.computeTournamentCouponDiscount(couponRow, payableEntryFee);
        payableEntryFee = Math.max(0, payableEntryFee - couponDiscountAmount);
        if (couponDiscountAmount <= 0) {
          const err = new Error("Coupon is not applicable for this entry fee") as Error & { code?: string };
          err.code = "COUPON_NOT_APPLICABLE";
          throw err;
        }
        coupon = couponRow;
      }

      if (payableEntryFee > 0) {
        const totalAvailable = walletBefore.main + walletBefore.bonus;
        if (totalAvailable < payableEntryFee) {
          const err = new Error("Insufficient wallet balance") as Error & { code?: string };
          err.code = "INSUFFICIENT_BALANCE";
          throw err;
        }

        const bonusDeduction = Math.min(walletBefore.bonus, payableEntryFee);
        const mainDeduction = payableEntryFee - bonusDeduction;

        walletTypeUsed = bonusDeduction > 0 && mainDeduction > 0 ? "mixed" : bonusDeduction > 0 ? "bonus" : "main";

        const [walletDebited] = await tx
          .update(users)
          .set({
            mainWalletBalance: sql`${users.mainWalletBalance} - ${mainDeduction}`,
            bonusWalletBalance: sql`${users.bonusWalletBalance} - ${bonusDeduction}`,
            walletBalance: sql`${users.walletBalance} - ${payableEntryFee}`,
          })
          .where(
            and(
              eq(users.id, data.userId),
              sql`${users.mainWalletBalance} >= ${mainDeduction}`,
              sql`${users.bonusWalletBalance} >= ${bonusDeduction}`,
              sql`${users.walletBalance} >= ${payableEntryFee}`,
            ),
          )
          .returning();

        if (!walletDebited) {
          const err = new Error("Insufficient wallet balance") as Error & { code?: string };
          err.code = "INSUFFICIENT_BALANCE";
          throw err;
        }

        walletAfter = {
          main: this.getSafeBalance(walletDebited.mainWalletBalance),
          bonus: this.getSafeBalance(walletDebited.bonusWalletBalance),
        };
      }

      try {
        const payload: {
          userId: number;
          tournamentId: number;
          inGameName: string | null;
          teamId?: number | null;
        } = {
          userId: data.userId,
          tournamentId: data.tournamentId,
          inGameName: data.inGameName || null,
        };

        if (data.teamId != null) {
          payload.teamId = data.teamId;
        }

        await tx.insert(registrations).values(payload);
      } catch (err: any) {
        if (err?.code === "23505") {
          const duplicate = new Error("Already registered") as Error & { code?: string };
          duplicate.code = "ALREADY_REGISTERED";
          throw duplicate;
        }
        throw err;
      }

      const [updatedTournament] = await tx
        .update(tournaments)
        .set({ filledSlots: sql`${tournaments.filledSlots} + 1` })
        .where(
          and(
            eq(tournaments.id, data.tournamentId),
            or(eq(tournaments.status, "upcoming"), eq(tournaments.status, "hot")),
            sql`${tournaments.filledSlots} < ${tournaments.maxSlots}`,
          ),
        )
        .returning();

      if (!updatedTournament) {
        const err = new Error("Tournament is full") as Error & { code?: string };
        err.code = "TOURNAMENT_FULL";
        throw err;
      }

      if (payableEntryFee > 0) {
        await this.createTransactionInTx(tx, {
          userId: data.userId,
          amount: payableEntryFee,
          type: "entry_fee",
          description: `Entry fee for ${tournament.title}`,
          tournamentId: data.tournamentId,
          walletType: walletTypeUsed,
          mainBalanceBefore: walletBefore.main,
          mainBalanceAfter: walletAfter.main,
          bonusBalanceBefore: walletBefore.bonus,
          bonusBalanceAfter: walletAfter.bonus,
          metadata: {
            source: "tournament_join",
            matchType: tournament.matchType,
            originalEntryFee: tournament.entryFee,
            discountAmount: couponDiscountAmount,
            couponCode: coupon?.code || null,
            couponType: coupon?.couponType || null,
          },
        });
      }

      if (coupon) {
        const updatedCouponRows = await tx
          .update(coupons)
          .set({
            totalUsageCount: sql`${coupons.totalUsageCount} + 1`,
          })
          .where(
            and(
              eq(coupons.id, coupon.id),
              coupon.globalUsageLimit == null
                ? sql`true`
                : sql`${coupons.totalUsageCount} < ${coupon.globalUsageLimit}`,
            ),
          )
          .returning();

        if (updatedCouponRows.length === 0) {
          const err = new Error("Coupon usage limit reached") as Error & { code?: string };
          err.code = "COUPON_LIMIT_REACHED";
          throw err;
        }

        await tx.insert(couponRedemptions).values({
          couponId: coupon.id,
          userId: data.userId,
          context: "tournament_join",
          tournamentId: data.tournamentId,
          couponType: coupon.couponType,
          discountAmount: couponDiscountAmount,
          bonusAmount: 0,
          metadata: {
            code: coupon.code,
            originalEntryFee: tournament.entryFee,
            payableEntryFee,
          },
        });
      }

      await tx.insert(notifications).values({
        userId: data.userId,
        type: "tournament_joined",
        title: "Tournament Joined",
        message: coupon
          ? `You have joined "${tournament.title}" successfully. Coupon ${coupon.code} saved Rs.${(couponDiscountAmount / 100).toFixed(2)}.`
          : `You have joined "${tournament.title}" successfully.`,
      });

      let finalTournament = updatedTournament;
      if (updatedTournament.filledSlots >= updatedTournament.maxSlots) {
        const [liveTournament] = await tx
          .update(tournaments)
          .set({ status: "live" as any })
          .where(eq(tournaments.id, data.tournamentId))
          .returning();
        if (liveTournament) {
          finalTournament = liveTournament;
        }
      }

      const [updatedUser] = await tx.select().from(users).where(eq(users.id, data.userId));
      if (!updatedUser) {
        const err = new Error("User not found") as Error & { code?: string };
        err.code = "USER_NOT_FOUND";
        throw err;
      }

      return { user: updatedUser, tournament: finalTournament };
    });
  }

  async getRegistrationsByUser(userId: number): Promise<Registration[]> {
    return db.select().from(registrations).where(eq(registrations.userId, userId)).orderBy(desc(registrations.createdAt));
  }

  async getRegistration(userId: number, tournamentId: number): Promise<Registration | undefined> {
    const [reg] = await db.select().from(registrations)
      .where(and(eq(registrations.userId, userId), eq(registrations.tournamentId, tournamentId)));
    return reg;
  }

  async getRegistrationsByTournament(tournamentId: number): Promise<Registration[]> {
    return db.select().from(registrations).where(eq(registrations.tournamentId, tournamentId));
  }

  async createTransaction(data: {
    userId: number;
    amount: number;
    type: string;
    description?: string;
    tournamentId?: number;
    walletType?: "main" | "bonus" | "mixed";
    mainBalanceBefore?: number;
    mainBalanceAfter?: number;
    bonusBalanceBefore?: number;
    bonusBalanceAfter?: number;
    metadata?: Record<string, unknown> | null;
  }): Promise<Transaction> {
    return db.transaction(async (tx) => {
      const [currentUser] = await tx.select().from(users).where(eq(users.id, data.userId));
      if (!currentUser) {
        const err = new Error("User not found") as Error & { code?: string };
        err.code = "USER_NOT_FOUND";
        throw err;
      }

      const mainNow = this.getSafeBalance(currentUser.mainWalletBalance);
      const bonusNow = this.getSafeBalance(currentUser.bonusWalletBalance);

      const mainBalanceBefore =
        data.mainBalanceBefore !== undefined ? this.getSafeBalance(data.mainBalanceBefore) : mainNow;
      const mainBalanceAfter =
        data.mainBalanceAfter !== undefined ? this.getSafeBalance(data.mainBalanceAfter) : mainNow;
      const bonusBalanceBefore =
        data.bonusBalanceBefore !== undefined ? this.getSafeBalance(data.bonusBalanceBefore) : bonusNow;
      const bonusBalanceAfter =
        data.bonusBalanceAfter !== undefined ? this.getSafeBalance(data.bonusBalanceAfter) : bonusNow;

      return this.createTransactionInTx(tx, {
        userId: data.userId,
        amount: data.amount,
        type: data.type,
        description: data.description,
        tournamentId: data.tournamentId,
        walletType: data.walletType || "main",
        mainBalanceBefore,
        mainBalanceAfter,
        bonusBalanceBefore,
        bonusBalanceAfter,
        metadata: data.metadata || null,
      });
    });
  }

  async getTransactionsByUser(userId: number): Promise<Transaction[]> {
    return db.select().from(transactions).where(eq(transactions.userId, userId)).orderBy(desc(transactions.createdAt));
  }

  async createWithdrawal(data: { userId: number; amount: number; upiId?: string; bankDetails?: string }): Promise<Withdrawal> {
    const [wd] = await db.insert(withdrawals).values({
      userId: data.userId,
      amount: data.amount,
      upiId: data.upiId || null,
      bankDetails: data.bankDetails || null,
    }).returning();
    return wd;
  }

  async getUserWithdrawalTotalForDay(userId: number, dayStart: Date, dayEnd: Date): Promise<number> {
    const [total] = await db
      .select({ sum: sql<number>`coalesce(sum(${withdrawals.amount}), 0)` })
      .from(withdrawals)
      .where(
        and(
          eq(withdrawals.userId, userId),
          sql`${withdrawals.createdAt} >= ${dayStart}`,
          sql`${withdrawals.createdAt} < ${dayEnd}`,
          sql`${withdrawals.status} <> 'rejected'`,
        ),
      );

    return Number(total?.sum || 0);
  }

  async getWithdrawalById(id: number): Promise<Withdrawal | undefined> {
    const [wd] = await db.select().from(withdrawals).where(eq(withdrawals.id, id));
    return wd;
  }

  async getWithdrawalsByUser(userId: number): Promise<Withdrawal[]> {
    return db.select().from(withdrawals).where(eq(withdrawals.userId, userId)).orderBy(desc(withdrawals.createdAt));
  }

  async getAllWithdrawals(): Promise<(Withdrawal & { username?: string })[]> {
    const wds = await db.select().from(withdrawals).orderBy(desc(withdrawals.createdAt));
    const enriched = await Promise.all(wds.map(async (wd) => {
      const user = await this.getUserById(wd.userId);
      return { ...wd, username: user?.username };
    }));
    return enriched;
  }

  async updateWithdrawal(id: number, data: Partial<Withdrawal>): Promise<Withdrawal | undefined> {
    const [wd] = await db.update(withdrawals).set(data).where(eq(withdrawals.id, id)).returning();
    return wd;
  }

  async getResultsByTournament(tournamentId: number): Promise<Result[]> {
    return db.select().from(results).where(eq(results.tournamentId, tournamentId)).orderBy(results.position);
  }

  async createResult(data: { tournamentId: number; userId: number; position: number; kills: number; prize: number }): Promise<Result> {
    const [r] = await db.insert(results).values(data).returning();
    return r;
  }

  async deleteResultsByTournament(tournamentId: number): Promise<void> {
    await db.delete(results).where(eq(results.tournamentId, tournamentId));
  }

  async createTeam(ownerId: number, name: string): Promise<Team> {
    const [team] = await db.insert(teams).values({ name, ownerId }).returning();
    await db.insert(teamMembers).values({ teamId: team.id, userId: ownerId });
    return team;
  }

  async getTeamsByUser(userId: number): Promise<(Team & { members: (TeamMember & { username?: string })[] })[]> {
    const memberRows = await db.select().from(teamMembers).where(eq(teamMembers.userId, userId));
    const teamIds = memberRows.map(m => m.teamId);
    if (teamIds.length === 0) return [];
    const teamList = await db.select().from(teams);
    const userTeams = teamList.filter(t => teamIds.includes(t.id));
    const result = await Promise.all(userTeams.map(async (team) => {
      const members = await this.getTeamMembers(team.id);
      return { ...team, members };
    }));
    return result;
  }

  async getTeamById(id: number): Promise<Team | undefined> {
    const [team] = await db.select().from(teams).where(eq(teams.id, id));
    return team;
  }

  async addTeamMember(teamId: number, userId: number): Promise<TeamMember> {
    const [member] = await db.insert(teamMembers).values({ teamId, userId }).returning();
    return member;
  }

  async removeTeamMember(teamId: number, userId: number): Promise<void> {
    await db.delete(teamMembers).where(and(eq(teamMembers.teamId, teamId), eq(teamMembers.userId, userId)));
  }

  async getTeamMembers(teamId: number): Promise<(TeamMember & { username?: string })[]> {
    const members = await db.select().from(teamMembers).where(eq(teamMembers.teamId, teamId));
    const enriched = await Promise.all(members.map(async (m) => {
      const user = await this.getUserById(m.userId);
      return { ...m, username: user?.username };
    }));
    return enriched;
  }

  async deleteTeam(id: number): Promise<void> {
    await db.delete(teamMembers).where(eq(teamMembers.teamId, id));
    await db.delete(teams).where(eq(teams.id, id));
  }

  async createPayment(data: { userId: number; razorpayOrderId: string; amount: number; currency?: string }): Promise<Payment> {
    const [p] = await db.insert(payments).values({
      userId: data.userId,
      razorpayOrderId: data.razorpayOrderId,
      amount: data.amount,
      currency: data.currency || "INR",
    }).returning();
    return p;
  }

  async getPaymentByOrderId(orderId: string): Promise<Payment | undefined> {
    const [p] = await db.select().from(payments).where(eq(payments.razorpayOrderId, orderId));
    return p;
  }

  async updatePayment(id: number, data: Partial<Payment>): Promise<Payment | undefined> {
    const [p] = await db.update(payments).set(data).where(eq(payments.id, id)).returning();
    return p;
  }

  async markPaymentCapturedByOrderId(orderId: string, data: { razorpayPaymentId?: string; razorpaySignature?: string }): Promise<Payment | undefined> {
    const [payment] = await db
      .update(payments)
      .set({
        razorpayPaymentId: data.razorpayPaymentId ?? null,
        razorpaySignature: data.razorpaySignature ?? null,
        status: "captured",
      })
      .where(and(eq(payments.razorpayOrderId, orderId), sql`${payments.status} <> 'captured'`))
      .returning();
    return payment;
  }

  async getPaymentsByUser(userId: number): Promise<Payment[]> {
    return db.select().from(payments).where(eq(payments.userId, userId)).orderBy(desc(payments.createdAt));
  }

  async createAdminLog(data: { adminId: number; action: string; targetType?: string; targetId?: number; details?: string }): Promise<AdminLog> {
    const [log] = await db.insert(adminLogs).values({
      adminId: data.adminId,
      action: data.action,
      targetType: data.targetType || null,
      targetId: data.targetId || null,
      details: data.details || null,
    }).returning();
    return log;
  }

  async getAdminLogs(): Promise<AdminLog[]> {
    return db.select().from(adminLogs).orderBy(desc(adminLogs.createdAt));
  }

  async createNotification(data: { userId: number; type: string; title: string; message: string }): Promise<Notification> {
    const [n] = await db.insert(notifications).values({
      userId: data.userId,
      type: data.type as any,
      title: data.title,
      message: data.message,
    }).returning();
    return n;
  }

  async getNotificationsByUser(userId: number): Promise<Notification[]> {
    return db.select().from(notifications).where(eq(notifications.userId, userId)).orderBy(desc(notifications.createdAt));
  }

  async markNotificationRead(id: number, userId: number): Promise<Notification | undefined> {
    const [n] = await db.update(notifications).set({ read: true })
      .where(and(eq(notifications.id, id), eq(notifications.userId, userId))).returning();
    return n;
  }

  async markAllNotificationsRead(userId: number): Promise<void> {
    await db.update(notifications).set({ read: true }).where(eq(notifications.userId, userId));
  }

  async getUnreadNotificationCount(userId: number): Promise<number> {
    const [result] = await db.select({ count: sql<number>`count(*)` })
      .from(notifications)
      .where(and(eq(notifications.userId, userId), eq(notifications.read, false)));
    return Number(result.count);
  }

  async getStats(): Promise<{ totalUsers: number; totalRevenue: number; activeTournaments: number; totalPayouts: number }> {
    const [userCount] = await db.select({ count: sql<number>`count(*)` }).from(users);
    const [revenue] = await db.select({ sum: sql<number>`coalesce(sum(amount), 0)` }).from(transactions).where(eq(transactions.type, "deposit"));
    const [active] = await db
      .select({ count: sql<number>`count(*)` })
      .from(tournaments)
      .where(or(eq(tournaments.status, "upcoming"), eq(tournaments.status, "hot")));
    const [payouts] = await db.select({ sum: sql<number>`coalesce(sum(amount), 0)` }).from(transactions).where(eq(transactions.type, "winning"));

    return {
      totalUsers: Number(userCount.count),
      totalRevenue: Number(revenue.sum),
      activeTournaments: Number(active.count),
      totalPayouts: Number(payouts.sum),
    };
  }

  async seedData(): Promise<void> {
    const existingGames = await db.select().from(games);
    if (existingGames.length > 0) return;

    const defaultGames = [
      { name: "BGMI", slug: "bgmi", enabled: true },
      { name: "Free Fire", slug: "free-fire", enabled: true },
      { name: "Call of Duty Mobile", slug: "cod-mobile", enabled: true },
      { name: "Valorant", slug: "valorant", enabled: true },
      { name: "CS2", slug: "cs2", enabled: true },
      { name: "PUBG", slug: "pubg", enabled: true },
    ];

    const insertedGames = await db.insert(games).values(defaultGames).returning();

    const hashedAdminPw = await bcrypt.hash("admin@admin", 10);
    const [adminUser] = await db.insert(users).values({
      username: "admin",
      email: "battlenestofficial@gmail.com",
      password: hashedAdminPw,
      role: "admin",
      mainWalletBalance: 100000,
      bonusWalletBalance: 0,
      walletBalance: 100000,
    }).returning();

    const now = new Date();
    const tomorrow = new Date(now.getTime() + 24 * 60 * 60 * 1000);
    const dayAfter = new Date(now.getTime() + 48 * 60 * 60 * 1000);
    const nextWeek = new Date(now.getTime() + 7 * 24 * 60 * 60 * 1000);

    const sampleTournaments = [
      {
        title: "BGMI Pro League Season 4",
        gameId: insertedGames[0].id,
        entryFee: 5000,
        prizePool: 50000,
        maxSlots: 100,
        filledSlots: 67,
        matchType: "squad" as const,
        status: "upcoming" as const,
        startTime: tomorrow,
        mapName: "Erangel",
        rules: "No hacks or exploits allowed.\nTeam must have exactly 4 members.\nMatch starts sharp on time.\nResults based on placement + kills.",
        prizeDistribution: [{ position: 1, prize: 25000 }, { position: 2, prize: 15000 }, { position: 3, prize: 10000 }],
      },
      {
        title: "Free Fire MAX Championship",
        gameId: insertedGames[1].id,
        entryFee: 3000,
        prizePool: 30000,
        maxSlots: 48,
        filledSlots: 32,
        matchType: "squad" as const,
        status: "upcoming" as const,
        startTime: dayAfter,
        mapName: "Bermuda",
        rules: "Standard competitive rules apply.\n4-member squads only.\nNo teaming with other squads.",
        prizeDistribution: [{ position: 1, prize: 15000 }, { position: 2, prize: 10000 }, { position: 3, prize: 5000 }],
      },
      {
        title: "Valorant 1v1 Showdown",
        gameId: insertedGames[3].id,
        entryFee: 2000,
        prizePool: 20000,
        maxSlots: 32,
        filledSlots: 28,
        matchType: "solo" as const,
        status: "upcoming" as const,
        startTime: nextWeek,
        mapName: "Ascent",
        rules: "Best of 3 rounds.\nNo agents banned.\nCustom game mode.",
        prizeDistribution: [{ position: 1, prize: 12000 }, { position: 2, prize: 8000 }],
      },
      {
        title: "COD Mobile Duo Blast",
        gameId: insertedGames[2].id,
        entryFee: 0,
        prizePool: 10000,
        maxSlots: 50,
        filledSlots: 50,
        matchType: "duo" as const,
        status: "live" as const,
        startTime: now,
        roomId: "BATTLENEST2024",
        roomPassword: "NEST123",
        mapName: "Isolated",
        rules: "Free entry tournament.\nDuo mode only.\nBR mode.",
        prizeDistribution: [{ position: 1, prize: 5000 }, { position: 2, prize: 3000 }, { position: 3, prize: 2000 }],
      },
      {
        title: "CS2 Weekly Cup #12",
        gameId: insertedGames[4].id,
        entryFee: 10000,
        prizePool: 100000,
        maxSlots: 16,
        filledSlots: 16,
        matchType: "squad" as const,
        status: "completed" as const,
        startTime: new Date(now.getTime() - 2 * 24 * 60 * 60 * 1000),
        mapName: "Dust 2",
        rules: "5v5 competitive format.\nKnife round for side selection.\nStandard MR12.",
        prizeDistribution: [{ position: 1, prize: 60000 }, { position: 2, prize: 30000 }, { position: 3, prize: 10000 }],
      },
    ];

    await db.insert(tournaments).values(sampleTournaments);
  }

  async getAllBanners(): Promise<Banner[]> {
    return db.select().from(banners).orderBy(banners.sortOrder);
  }

  async getEnabledBanners(): Promise<Banner[]> {
    return db.select().from(banners).where(eq(banners.enabled, true)).orderBy(banners.sortOrder);
  }

  async createBanner(data: { imageUrl: string; title?: string; linkUrl?: string; sortOrder?: number }): Promise<Banner> {
    const [banner] = await db.insert(banners).values({
      imageUrl: data.imageUrl,
      title: data.title || null,
      linkUrl: data.linkUrl || null,
      sortOrder: data.sortOrder ?? 0,
    }).returning();
    return banner;
  }

  async updateBanner(id: number, data: Partial<Banner>): Promise<Banner | undefined> {
    const [banner] = await db.update(banners).set(data).where(eq(banners.id, id)).returning();
    return banner;
  }

  async deleteBanner(id: number): Promise<void> {
    await db.delete(banners).where(eq(banners.id, id));
  }

  async getBannerCount(): Promise<number> {
    const [result] = await db.select({ count: sql<number>`count(*)::int` }).from(banners);
    return result?.count || 0;
  }

  async getAllCoupons(): Promise<Coupon[]> {
    return db.select().from(coupons).orderBy(desc(coupons.createdAt));
  }

  async createCoupon(data: {
    code: string;
    couponType?: CouponType;
    value?: number;
    amount?: number;
    enabled?: boolean;
    globalUsageLimit?: number | null;
    perUserLimit?: number | null;
    expiresAt?: Date | null;
    minEntryFee?: number | null;
    tournamentId?: number | null;
    fraudHookEnabled?: boolean;
    metadata?: Record<string, unknown> | null;
    createdBy?: number | null;
  }): Promise<Coupon> {
    const normalizedCode = data.code.trim().toUpperCase();
    const couponType = this.normalizeCouponType(data.couponType);
    const normalizedValue = Math.max(0, Math.round(Number(data.value ?? data.amount ?? 0)));
    const [coupon] = await db.insert(coupons).values({
      code: normalizedCode,
      amount: normalizedValue,
      couponType,
      value: normalizedValue,
      globalUsageLimit:
        data.globalUsageLimit == null ? null : Math.max(1, Math.round(Number(data.globalUsageLimit))),
      perUserLimit:
        data.perUserLimit == null ? 1 : Math.max(1, Math.round(Number(data.perUserLimit))),
      expiresAt: data.expiresAt ?? null,
      minEntryFee: data.minEntryFee == null ? null : Math.max(0, Math.round(Number(data.minEntryFee))),
      tournamentId: data.tournamentId == null ? null : Math.round(Number(data.tournamentId)),
      fraudHookEnabled: !!data.fraudHookEnabled,
      metadata: data.metadata || null,
      createdBy: data.createdBy ?? null,
      enabled: data.enabled ?? true,
    }).returning();
    return coupon;
  }

  async deleteCoupon(id: number): Promise<void> {
    await db.delete(coupons).where(eq(coupons.id, id));
  }

  async redeemCoupon(
    userId: number,
    code: string,
    options?: {
      context?: "wallet" | "tournament_join";
      tournamentId?: number;
      entryFee?: number;
      fraudContext?: Record<string, unknown> | null;
    },
  ): Promise<{ user: User; coupon: Coupon; amount: number; discountAmount: number; bonusAmount: number }> {
    const normalizedCode = code.trim().toUpperCase();
    const context = options?.context === "tournament_join" ? "tournament_join" : "wallet";
    if (!normalizedCode) {
      const err = new Error("Coupon code is required") as Error & { code?: string };
      err.code = "INVALID_COUPON";
      throw err;
    }

    return db.transaction(async (tx) => {
      const [coupon] = await tx.select().from(coupons).where(and(eq(coupons.code, normalizedCode), eq(coupons.enabled, true)));
      if (!coupon) {
        const err = new Error("Invalid or inactive coupon code") as Error & { code?: string };
        err.code = "INVALID_COUPON";
        throw err;
      }
      if (!this.isSupportedCouponType(coupon.couponType)) {
        const err = new Error("Coupon type is no longer supported") as Error & { code?: string };
        err.code = "COUPON_NOT_APPLICABLE";
        throw err;
      }
      const couponType = this.normalizeCouponType(coupon.couponType);
      const couponValue = Math.max(0, Math.round(Number(coupon.value ?? coupon.amount ?? 0)));
      if (coupon.expiresAt && coupon.expiresAt.getTime() <= Date.now()) {
        const err = new Error("Coupon has expired") as Error & { code?: string };
        err.code = "COUPON_EXPIRED";
        throw err;
      }

      if (coupon.globalUsageLimit != null && coupon.totalUsageCount >= coupon.globalUsageLimit) {
        const err = new Error("Coupon usage limit reached") as Error & { code?: string };
        err.code = "COUPON_LIMIT_REACHED";
        throw err;
      }

      const perUserLimit = Math.max(1, Number(coupon.perUserLimit || 1));
      const perUserRedemptions = await tx
        .select({ count: sql<number>`count(*)::int` })
        .from(couponRedemptions)
        .where(and(eq(couponRedemptions.couponId, coupon.id), eq(couponRedemptions.userId, userId)));
      const usedCount = Number(perUserRedemptions?.[0]?.count || 0);
      if (usedCount >= perUserLimit) {
        const err = new Error("Coupon usage limit reached for this user") as Error & { code?: string };
        err.code = "COUPON_USER_LIMIT_REACHED";
        throw err;
      }

      await tx.execute(sql`SELECT id FROM users WHERE id = ${userId} FOR UPDATE`);
      const [userBefore] = await tx.select().from(users).where(eq(users.id, userId));
      if (!userBefore) {
        const err = new Error("User not found") as Error & { code?: string };
        err.code = "USER_NOT_FOUND";
        throw err;
      }

      const fraudDecision = await this.runCouponFraudHook({
        couponCode: coupon.code,
        couponType,
        context,
        userId,
        tournamentId: options?.tournamentId ?? coupon.tournamentId ?? null,
        entryFee: options?.entryFee,
        amount: couponValue,
        metadata: (options?.fraudContext || (coupon.metadata as Record<string, unknown> | null)) ?? null,
        enabled: !!coupon.fraudHookEnabled,
      });
      if (!fraudDecision.allowed) {
        const err = new Error(fraudDecision.reason || "Coupon blocked by fraud policy") as Error & { code?: string };
        err.code = "COUPON_FRAUD_BLOCKED";
        throw err;
      }

      if (coupon.tournamentId != null && options?.tournamentId != null && Number(coupon.tournamentId) !== Number(options.tournamentId)) {
        const err = new Error("Coupon is not valid for this tournament") as Error & { code?: string };
        err.code = "COUPON_NOT_APPLICABLE";
        throw err;
      }

      let bonusAmount = 0;
      let discountAmount = 0;
      let updatedUser = userBefore;

      if (context === "wallet") {
        if (!this.isWalletCouponType(couponType)) {
          const err = new Error("Coupon is not valid for wallet redemption") as Error & { code?: string };
          err.code = "COUPON_NOT_APPLICABLE";
          throw err;
        }
        bonusAmount = couponValue;
        if (bonusAmount <= 0) {
          const err = new Error("Coupon has no redeemable bonus amount") as Error & { code?: string };
          err.code = "COUPON_NOT_APPLICABLE";
          throw err;
        }
        const [walletCredited] = await tx
          .update(users)
          .set({
            bonusWalletBalance: sql`${users.bonusWalletBalance} + ${bonusAmount}`,
            walletBalance: sql`${users.walletBalance} + ${bonusAmount}`,
          })
          .where(eq(users.id, userId))
          .returning();
        if (!walletCredited) {
          const err = new Error("User not found") as Error & { code?: string };
          err.code = "USER_NOT_FOUND";
          throw err;
        }
        updatedUser = walletCredited;
      } else {
        if (!this.isTournamentCouponType(couponType)) {
          const err = new Error("Coupon is not valid for tournament entry") as Error & { code?: string };
          err.code = "COUPON_NOT_APPLICABLE";
          throw err;
        }
        const entryFee = Math.max(0, Math.round(Number(options?.entryFee || 0)));
        if (coupon.minEntryFee != null && entryFee < coupon.minEntryFee) {
          const err = new Error("Coupon min entry condition not met") as Error & { code?: string };
          err.code = "COUPON_MIN_ENTRY_NOT_MET";
          throw err;
        }
        discountAmount = this.computeTournamentCouponDiscount(coupon, entryFee);
        if (discountAmount <= 0) {
          const err = new Error("Coupon is not applicable for this entry fee") as Error & { code?: string };
          err.code = "COUPON_NOT_APPLICABLE";
          throw err;
        }
      }

      const updatedCouponRows = await tx
        .update(coupons)
        .set({
          totalUsageCount: sql`${coupons.totalUsageCount} + 1`,
        })
        .where(
          and(
            eq(coupons.id, coupon.id),
            coupon.globalUsageLimit == null
              ? sql`true`
              : sql`${coupons.totalUsageCount} < ${coupon.globalUsageLimit}`,
          ),
        )
        .returning();
      if (updatedCouponRows.length === 0) {
        const err = new Error("Coupon usage limit reached") as Error & { code?: string };
        err.code = "COUPON_LIMIT_REACHED";
        throw err;
      }

      await tx.insert(couponRedemptions).values({
        couponId: coupon.id,
        userId,
        context,
        tournamentId: options?.tournamentId ?? null,
        couponType,
        discountAmount,
        bonusAmount,
        metadata: {
          code: coupon.code,
          context,
          entryFee: options?.entryFee ?? null,
        },
      });

      if (bonusAmount > 0) {
        await this.createTransactionInTx(tx, {
          userId,
          amount: bonusAmount,
          type: "deposit",
          walletType: "bonus",
          mainBalanceBefore: this.getSafeBalance(userBefore.mainWalletBalance),
          mainBalanceAfter: this.getSafeBalance(updatedUser.mainWalletBalance),
          bonusBalanceBefore: this.getSafeBalance(userBefore.bonusWalletBalance),
          bonusBalanceAfter: this.getSafeBalance(updatedUser.bonusWalletBalance),
          description: `Coupon redeemed (${coupon.code})`,
          metadata: { source: "coupon", code: coupon.code, couponType },
        });

        await tx.insert(notifications).values({
          userId,
          type: "wallet_credit",
          title: "Coupon Redeemed",
          message: `Coupon ${coupon.code} credited Rs.${(bonusAmount / 100).toFixed(2)} to your wallet.`,
        });
      }

      return {
        user: updatedUser,
        coupon,
        amount: bonusAmount > 0 ? bonusAmount : discountAmount,
        discountAmount,
        bonusAmount,
      };
    });
  }

  async getCouponAnalytics(): Promise<
    Array<{
      couponId: number;
      code: string;
      couponType: string;
      totalUsage: number;
      uniqueUsers: number;
      totalDiscountAmount: number;
      totalBonusAmount: number;
      lastRedeemedAt: Date | null;
    }>
  > {
    const [allCoupons, redemptions] = await Promise.all([
      this.getAllCoupons(),
      db.select().from(couponRedemptions),
    ]);

    const byCoupon = new Map<number, {
      couponId: number;
      code: string;
      couponType: string;
      totalUsage: number;
      uniqueUserSet: Set<number>;
      totalDiscountAmount: number;
      totalBonusAmount: number;
      lastRedeemedAt: Date | null;
    }>();

    for (const coupon of allCoupons) {
      byCoupon.set(coupon.id, {
        couponId: coupon.id,
        code: coupon.code,
        couponType: String(coupon.couponType || "bonus_credit"),
        totalUsage: 0,
        uniqueUserSet: new Set<number>(),
        totalDiscountAmount: 0,
        totalBonusAmount: 0,
        lastRedeemedAt: null,
      });
    }

    for (const row of redemptions) {
      const item = byCoupon.get(Number(row.couponId));
      if (!item) continue;
      item.totalUsage += 1;
      item.uniqueUserSet.add(Number(row.userId));
      item.totalDiscountAmount += Number(row.discountAmount || 0);
      item.totalBonusAmount += Number(row.bonusAmount || 0);
      if (!item.lastRedeemedAt || new Date(row.createdAt).getTime() > item.lastRedeemedAt.getTime()) {
        item.lastRedeemedAt = row.createdAt;
      }
    }

    return Array.from(byCoupon.values())
      .map((item) => ({
        couponId: item.couponId,
        code: item.code,
        couponType: item.couponType,
        totalUsage: item.totalUsage,
        uniqueUsers: item.uniqueUserSet.size,
        totalDiscountAmount: item.totalDiscountAmount,
        totalBonusAmount: item.totalBonusAmount,
        lastRedeemedAt: item.lastRedeemedAt,
      }))
      .sort((a, b) => {
        if (b.totalUsage !== a.totalUsage) return b.totalUsage - a.totalUsage;
        return a.code.localeCompare(b.code);
      });
  }
}

export const storage = new DatabaseStorage();
