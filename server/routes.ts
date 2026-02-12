import type { Express } from "express";
import { createServer, type Server } from "http";
import { storage } from "./storage";
import { generateToken, authMiddleware, adminMiddleware } from "./auth";
import { loginSchema, signupSchema } from "@shared/schema";
import bcrypt from "bcryptjs";

export async function registerRoutes(
  httpServer: Server,
  app: Express
): Promise<Server> {

  // Auth routes
  app.post("/api/auth/signup", async (req, res) => {
    try {
      const parsed = signupSchema.safeParse(req.body);
      if (!parsed.success) {
        return res.status(400).json({ message: parsed.error.errors[0]?.message || "Invalid input" });
      }

      const existing = await storage.getUserByEmail(parsed.data.email);
      if (existing) return res.status(400).json({ message: "Email already registered" });

      const user = await storage.createUser(parsed.data);
      const token = generateToken(user.id, user.role);
      const { password, ...safeUser } = user;
      res.json({ token, user: safeUser });
    } catch (err: any) {
      if (err.code === "23505") return res.status(400).json({ message: "Username or email already taken" });
      res.status(500).json({ message: err.message || "Server error" });
    }
  });

  app.post("/api/auth/login", async (req, res) => {
    try {
      const parsed = loginSchema.safeParse(req.body);
      if (!parsed.success) {
        return res.status(400).json({ message: parsed.error.errors[0]?.message || "Invalid input" });
      }

      const user = await storage.getUserByEmail(parsed.data.email);
      if (!user) return res.status(401).json({ message: "Invalid email or password" });

      const valid = await bcrypt.compare(parsed.data.password, user.password);
      if (!valid) return res.status(401).json({ message: "Invalid email or password" });

      if (user.banned) return res.status(403).json({ message: "Account is banned" });

      const token = generateToken(user.id, user.role);
      const { password, ...safeUser } = user;
      res.json({ token, user: safeUser });
    } catch (err: any) {
      res.status(500).json({ message: err.message || "Server error" });
    }
  });

  // Games (public)
  app.get("/api/games", async (_req, res) => {
    try {
      const allGames = await storage.getAllGames();
      res.json(allGames);
    } catch (err: any) {
      res.status(500).json({ message: err.message });
    }
  });

  // Tournaments (public)
  app.get("/api/tournaments", async (_req, res) => {
    try {
      const all = await storage.getAllTournaments();
      res.json(all);
    } catch (err: any) {
      res.status(500).json({ message: err.message });
    }
  });

  app.get("/api/tournaments/:id", async (req, res) => {
    try {
      const t = await storage.getTournamentById(Number(req.params.id));
      if (!t) return res.status(404).json({ message: "Tournament not found" });
      res.json(t);
    } catch (err: any) {
      res.status(500).json({ message: err.message });
    }
  });

  app.get("/api/tournaments/:id/results", async (req, res) => {
    try {
      const r = await storage.getResultsByTournament(Number(req.params.id));
      res.json(r);
    } catch (err: any) {
      res.status(500).json({ message: err.message });
    }
  });

  // Protected routes
  app.post("/api/tournaments/:id/join", authMiddleware, async (req, res) => {
    try {
      const userId = (req as any).userId;
      const tournamentId = Number(req.params.id);

      const tournament = await storage.getTournamentById(tournamentId);
      if (!tournament) return res.status(404).json({ message: "Tournament not found" });
      if (tournament.status !== "upcoming") return res.status(400).json({ message: "Tournament is not open for registration" });
      if (tournament.filledSlots >= tournament.maxSlots) return res.status(400).json({ message: "Tournament is full" });

      const existing = await storage.getRegistration(userId, tournamentId);
      if (existing) return res.status(400).json({ message: "Already registered" });

      const user = await storage.getUserById(userId);
      if (!user) return res.status(404).json({ message: "User not found" });
      if (user.banned) return res.status(403).json({ message: "Account is banned" });

      if (tournament.entryFee > 0) {
        if (user.walletBalance < tournament.entryFee) {
          return res.status(400).json({ message: "Insufficient wallet balance" });
        }
        await storage.updateWalletBalance(userId, -tournament.entryFee);
        await storage.createTransaction({
          userId,
          amount: tournament.entryFee,
          type: "entry_fee",
          description: `Entry fee for ${tournament.title}`,
          tournamentId,
        });
      }

      await storage.createRegistration(userId, tournamentId);
      await storage.incrementSlots(tournamentId);

      const updatedUser = await storage.getUserById(userId);
      const { password, ...safeUser } = updatedUser!;
      res.json({ message: "Joined successfully", user: safeUser });
    } catch (err: any) {
      res.status(500).json({ message: err.message });
    }
  });

  app.get("/api/registrations/my", authMiddleware, async (req, res) => {
    try {
      const regs = await storage.getRegistrationsByUser((req as any).userId);
      res.json(regs);
    } catch (err: any) {
      res.status(500).json({ message: err.message });
    }
  });

  // User profile
  app.patch("/api/users/profile", authMiddleware, async (req, res) => {
    try {
      const userId = (req as any).userId;
      const { bgmiId, freeFireId, codMobileId, valorantId, cs2Id, pubgId, inGameName } = req.body;
      const updated = await storage.updateUserProfile(userId, { bgmiId, freeFireId, codMobileId, valorantId, cs2Id, pubgId, inGameName });
      if (!updated) return res.status(404).json({ message: "User not found" });
      const { password, ...safeUser } = updated;
      res.json({ user: safeUser });
    } catch (err: any) {
      res.status(500).json({ message: err.message });
    }
  });

  // Wallet
  app.post("/api/wallet/add", authMiddleware, async (req, res) => {
    try {
      const userId = (req as any).userId;
      const { amount } = req.body;
      if (!amount || typeof amount !== "number" || amount <= 0 || amount > 10000000) {
        return res.status(400).json({ message: "Invalid amount. Must be a positive number." });
      }

      await storage.updateWalletBalance(userId, amount);
      await storage.createTransaction({
        userId,
        amount,
        type: "deposit",
        description: "Wallet deposit",
      });

      const user = await storage.getUserById(userId);
      const { password, ...safeUser } = user!;
      res.json({ user: safeUser, message: "Money added successfully" });
    } catch (err: any) {
      res.status(500).json({ message: err.message });
    }
  });

  app.get("/api/transactions/my", authMiddleware, async (req, res) => {
    try {
      const txs = await storage.getTransactionsByUser((req as any).userId);
      res.json(txs);
    } catch (err: any) {
      res.status(500).json({ message: err.message });
    }
  });

  // Withdrawals
  app.post("/api/withdrawals", authMiddleware, async (req, res) => {
    try {
      const userId = (req as any).userId;
      const { amount, upiId, bankDetails } = req.body;
      if (!amount || typeof amount !== "number" || amount < 5000) return res.status(400).json({ message: "Minimum withdrawal is \u20B950" });

      const user = await storage.getUserById(userId);
      if (!user) return res.status(404).json({ message: "User not found" });
      if (user.walletBalance < amount) return res.status(400).json({ message: "Insufficient balance" });

      await storage.updateWalletBalance(userId, -amount);
      await storage.createTransaction({
        userId,
        amount,
        type: "withdrawal",
        description: "Withdrawal request",
      });

      const wd = await storage.createWithdrawal({ userId, amount, upiId, bankDetails });
      res.json(wd);
    } catch (err: any) {
      res.status(500).json({ message: err.message });
    }
  });

  app.get("/api/withdrawals/my", authMiddleware, async (req, res) => {
    try {
      const wds = await storage.getWithdrawalsByUser((req as any).userId);
      res.json(wds);
    } catch (err: any) {
      res.status(500).json({ message: err.message });
    }
  });

  // Teams
  app.get("/api/teams/my", authMiddleware, async (req, res) => {
    try {
      const teams = await storage.getTeamsByUser((req as any).userId);
      res.json(teams);
    } catch (err: any) {
      res.status(500).json({ message: err.message });
    }
  });

  app.post("/api/teams", authMiddleware, async (req, res) => {
    try {
      const { name } = req.body;
      if (!name || name.length < 2) return res.status(400).json({ message: "Team name must be at least 2 characters" });
      const team = await storage.createTeam((req as any).userId, name);
      res.json(team);
    } catch (err: any) {
      res.status(500).json({ message: err.message });
    }
  });

  app.post("/api/teams/:id/members", authMiddleware, async (req, res) => {
    try {
      const teamId = Number(req.params.id);
      const team = await storage.getTeamById(teamId);
      if (!team) return res.status(404).json({ message: "Team not found" });
      if (team.ownerId !== (req as any).userId) return res.status(403).json({ message: "Only team owner can add members" });

      const { username } = req.body;
      if (!username) return res.status(400).json({ message: "Username is required" });

      const allUsers = await storage.getAllUsers();
      const targetUser = allUsers.find(u => u.username === username);
      if (!targetUser) return res.status(404).json({ message: "User not found" });

      const members = await storage.getTeamMembers(teamId);
      if (members.some(m => m.userId === targetUser.id)) return res.status(400).json({ message: "User is already a member" });

      const member = await storage.addTeamMember(teamId, targetUser.id);
      res.json(member);
    } catch (err: any) {
      res.status(500).json({ message: err.message });
    }
  });

  app.delete("/api/teams/:id/members/:userId", authMiddleware, async (req, res) => {
    try {
      const teamId = Number(req.params.id);
      const userId = Number(req.params.userId);
      const team = await storage.getTeamById(teamId);
      if (!team) return res.status(404).json({ message: "Team not found" });
      if (team.ownerId !== (req as any).userId) return res.status(403).json({ message: "Only team owner can remove members" });
      if (userId === team.ownerId) return res.status(400).json({ message: "Cannot remove team owner" });

      await storage.removeTeamMember(teamId, userId);
      res.json({ success: true });
    } catch (err: any) {
      res.status(500).json({ message: err.message });
    }
  });

  app.delete("/api/teams/:id", authMiddleware, async (req, res) => {
    try {
      const teamId = Number(req.params.id);
      const team = await storage.getTeamById(teamId);
      if (!team) return res.status(404).json({ message: "Team not found" });
      if (team.ownerId !== (req as any).userId) return res.status(403).json({ message: "Only team owner can delete team" });

      await storage.deleteTeam(teamId);
      res.json({ success: true });
    } catch (err: any) {
      res.status(500).json({ message: err.message });
    }
  });

  // Admin routes
  app.get("/api/admin/stats", authMiddleware, adminMiddleware, async (_req, res) => {
    try {
      const stats = await storage.getStats();
      res.json(stats);
    } catch (err: any) {
      res.status(500).json({ message: err.message });
    }
  });

  app.get("/api/admin/users", authMiddleware, adminMiddleware, async (_req, res) => {
    try {
      const all = await storage.getAllUsers();
      const safe = all.map(({ password, ...rest }) => rest);
      res.json(safe);
    } catch (err: any) {
      res.status(500).json({ message: err.message });
    }
  });

  app.patch("/api/admin/users/:id/ban", authMiddleware, adminMiddleware, async (req, res) => {
    try {
      const { banned } = req.body;
      const user = await storage.banUser(Number(req.params.id), banned);
      if (!user) return res.status(404).json({ message: "User not found" });
      const { password, ...safeUser } = user;
      res.json(safeUser);
    } catch (err: any) {
      res.status(500).json({ message: err.message });
    }
  });

  // Admin Games
  app.post("/api/admin/games", authMiddleware, adminMiddleware, async (req, res) => {
    try {
      const game = await storage.createGame(req.body);
      res.json(game);
    } catch (err: any) {
      if (err.code === "23505") return res.status(400).json({ message: "Game already exists" });
      res.status(500).json({ message: err.message });
    }
  });

  app.patch("/api/admin/games/:id", authMiddleware, adminMiddleware, async (req, res) => {
    try {
      const game = await storage.updateGame(Number(req.params.id), req.body);
      if (!game) return res.status(404).json({ message: "Game not found" });
      res.json(game);
    } catch (err: any) {
      res.status(500).json({ message: err.message });
    }
  });

  // Admin Tournaments
  app.post("/api/admin/tournaments", authMiddleware, adminMiddleware, async (req, res) => {
    try {
      const t = await storage.createTournament(req.body);
      res.json(t);
    } catch (err: any) {
      res.status(500).json({ message: err.message });
    }
  });

  app.patch("/api/admin/tournaments/:id", authMiddleware, adminMiddleware, async (req, res) => {
    try {
      const t = await storage.updateTournament(Number(req.params.id), req.body);
      if (!t) return res.status(404).json({ message: "Tournament not found" });
      res.json(t);
    } catch (err: any) {
      res.status(500).json({ message: err.message });
    }
  });

  app.patch("/api/admin/tournaments/:id/status", authMiddleware, adminMiddleware, async (req, res) => {
    try {
      const { status } = req.body;
      const t = await storage.updateTournamentStatus(Number(req.params.id), status);
      if (!t) return res.status(404).json({ message: "Tournament not found" });
      res.json(t);
    } catch (err: any) {
      res.status(500).json({ message: err.message });
    }
  });

  // Admin Withdrawals
  app.get("/api/admin/withdrawals", authMiddleware, adminMiddleware, async (_req, res) => {
    try {
      const wds = await storage.getAllWithdrawals();
      res.json(wds);
    } catch (err: any) {
      res.status(500).json({ message: err.message });
    }
  });

  app.patch("/api/admin/withdrawals/:id", authMiddleware, adminMiddleware, async (req, res) => {
    try {
      const { status, adminNote } = req.body;
      const wd = await storage.updateWithdrawal(Number(req.params.id), { status: status as any, adminNote });
      if (!wd) return res.status(404).json({ message: "Withdrawal not found" });

      if (status === "rejected") {
        await storage.updateWalletBalance(wd.userId, wd.amount);
        await storage.createTransaction({
          userId: wd.userId,
          amount: wd.amount,
          type: "admin_credit",
          description: "Withdrawal rejected - refund",
        });
      }

      res.json(wd);
    } catch (err: any) {
      res.status(500).json({ message: err.message });
    }
  });

  // Seed and push DB schema on startup
  try {
    const { execSync } = await import("child_process");
    execSync("npx drizzle-kit push --force", { stdio: "pipe" });
    console.log("Database schema pushed successfully");
    await storage.seedData();
    console.log("Seed data initialized");
  } catch (err: any) {
    console.error("DB setup error:", err.message);
  }

  return httpServer;
}
