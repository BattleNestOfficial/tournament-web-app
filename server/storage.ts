import { db } from "./db";
import { eq, desc, sql, and } from "drizzle-orm";
import {
  users, games, tournaments, registrations, transactions, withdrawals, results, teams, teamMembers,
  type User, type InsertUser, type Game, type InsertGame, type Tournament, type InsertTournament,
  type Registration, type Transaction, type Withdrawal, type Result, type Team, type TeamMember,
} from "@shared/schema";
import bcrypt from "bcryptjs";

export interface IStorage {
  createUser(data: { username: string; email: string; password: string }): Promise<User>;
  getUserByEmail(email: string): Promise<User | undefined>;
  getUserById(id: number): Promise<User | undefined>;
  updateUserProfile(id: number, data: Partial<User>): Promise<User | undefined>;
  updateWalletBalance(id: number, amount: number): Promise<User | undefined>;
  getAllUsers(): Promise<User[]>;
  banUser(id: number, banned: boolean): Promise<User | undefined>;

  getAllGames(): Promise<Game[]>;
  createGame(data: InsertGame): Promise<Game>;
  updateGame(id: number, data: Partial<Game>): Promise<Game | undefined>;

  getAllTournaments(): Promise<Tournament[]>;
  getTournamentById(id: number): Promise<Tournament | undefined>;
  createTournament(data: any): Promise<Tournament>;
  updateTournament(id: number, data: Partial<Tournament>): Promise<Tournament | undefined>;
  updateTournamentStatus(id: number, status: string): Promise<Tournament | undefined>;
  incrementSlots(id: number): Promise<void>;

  createRegistration(userId: number, tournamentId: number): Promise<Registration>;
  getRegistrationsByUser(userId: number): Promise<Registration[]>;
  getRegistration(userId: number, tournamentId: number): Promise<Registration | undefined>;

  createTransaction(data: { userId: number; amount: number; type: string; description?: string; tournamentId?: number }): Promise<Transaction>;
  getTransactionsByUser(userId: number): Promise<Transaction[]>;

  createWithdrawal(data: { userId: number; amount: number; upiId?: string; bankDetails?: string }): Promise<Withdrawal>;
  getWithdrawalsByUser(userId: number): Promise<Withdrawal[]>;
  getAllWithdrawals(): Promise<(Withdrawal & { username?: string })[]>;
  updateWithdrawal(id: number, data: Partial<Withdrawal>): Promise<Withdrawal | undefined>;

  getResultsByTournament(tournamentId: number): Promise<Result[]>;
  createResult(data: { tournamentId: number; userId: number; position: number; kills: number; prize: number }): Promise<Result>;

  createTeam(ownerId: number, name: string): Promise<Team>;
  getTeamsByUser(userId: number): Promise<(Team & { members: (TeamMember & { username?: string })[] })[]>;
  getTeamById(id: number): Promise<Team | undefined>;
  addTeamMember(teamId: number, userId: number): Promise<TeamMember>;
  removeTeamMember(teamId: number, userId: number): Promise<void>;
  getTeamMembers(teamId: number): Promise<(TeamMember & { username?: string })[]>;
  deleteTeam(id: number): Promise<void>;

  getStats(): Promise<{ totalUsers: number; totalRevenue: number; activeTournaments: number; totalPayouts: number }>;

  seedData(): Promise<void>;
}

export class DatabaseStorage implements IStorage {
  async createUser(data: { username: string; email: string; password: string }): Promise<User> {
    const hashedPassword = await bcrypt.hash(data.password, 10);
    const [user] = await db.insert(users).values({
      username: data.username,
      email: data.email,
      password: hashedPassword,
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

  async updateUserProfile(id: number, data: Partial<User>): Promise<User | undefined> {
    const [user] = await db.update(users).set(data).where(eq(users.id, id)).returning();
    return user;
  }

  async updateWalletBalance(id: number, amount: number): Promise<User | undefined> {
    const [user] = await db.update(users)
      .set({ walletBalance: sql`${users.walletBalance} + ${amount}` })
      .where(eq(users.id, id))
      .returning();
    return user;
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

  async incrementSlots(id: number): Promise<void> {
    await db.update(tournaments)
      .set({ filledSlots: sql`${tournaments.filledSlots} + 1` })
      .where(eq(tournaments.id, id));
  }

  async createRegistration(userId: number, tournamentId: number): Promise<Registration> {
    const [reg] = await db.insert(registrations).values({ userId, tournamentId }).returning();
    return reg;
  }

  async getRegistrationsByUser(userId: number): Promise<Registration[]> {
    return db.select().from(registrations).where(eq(registrations.userId, userId)).orderBy(desc(registrations.createdAt));
  }

  async getRegistration(userId: number, tournamentId: number): Promise<Registration | undefined> {
    const [reg] = await db.select().from(registrations)
      .where(and(eq(registrations.userId, userId), eq(registrations.tournamentId, tournamentId)));
    return reg;
  }

  async createTransaction(data: { userId: number; amount: number; type: string; description?: string; tournamentId?: number }): Promise<Transaction> {
    const [tx] = await db.insert(transactions).values({
      userId: data.userId,
      amount: data.amount,
      type: data.type as any,
      description: data.description || null,
      tournamentId: data.tournamentId || null,
    }).returning();
    return tx;
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

  async getStats(): Promise<{ totalUsers: number; totalRevenue: number; activeTournaments: number; totalPayouts: number }> {
    const [userCount] = await db.select({ count: sql<number>`count(*)` }).from(users);
    const [revenue] = await db.select({ sum: sql<number>`coalesce(sum(amount), 0)` }).from(transactions).where(eq(transactions.type, "deposit"));
    const [active] = await db.select({ count: sql<number>`count(*)` }).from(tournaments).where(eq(tournaments.status, "upcoming"));
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
}

export const storage = new DatabaseStorage();
