import type { Express } from "express";
import { createServer, type Server } from "http";
import { storage } from "./storage";
import {
  generateToken,
  authMiddleware,
  authOptionalMiddleware,
  adminMiddleware,
} from "./auth";
import { loginSchema, signupSchema } from "@shared/schema";
import crypto from "crypto";
import bcrypt from "bcryptjs";
import rateLimit from "express-rate-limit";
import multer from "multer";
import path from "path";
import fs from "fs";

const uploadDir = path.join(process.cwd(), "uploads");
if (!fs.existsSync(uploadDir)) {
  fs.mkdirSync(uploadDir, { recursive: true });
}

const uploadStorage = multer.diskStorage({
  destination: (_req, _file, cb) => cb(null, uploadDir),
  filename: (_req, file, cb) => {
    const ext = path.extname(file.originalname);
    const name = `tournament_${Date.now()}_${Math.random().toString(36).slice(2, 8)}${ext}`;
    cb(null, name);
  },
});

const upload = multer({
  storage: uploadStorage,
  limits: { fileSize: 5 * 1024 * 1024 },
  fileFilter: (_req, file, cb) => {
    const allowed = /\.(jpg|jpeg|png|gif|webp)$/i;
    if (allowed.test(path.extname(file.originalname))) {
      cb(null, true);
    } else {
      cb(new Error("Only image files are allowed"));
    }
  },
});

const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 20,
  message: { message: "Too many requests, please try again later" },
  standardHeaders: true,
  legacyHeaders: false,
});

const apiLimiter = rateLimit({
  windowMs: 1 * 60 * 1000,
  max: 100,
  message: { message: "Too many requests, please try again later" },
  standardHeaders: true,
  legacyHeaders: false,
});

export async function registerRoutes(
  httpServer: Server,
  app: Express
): Promise<Server> {

  app.use("/api/", apiLimiter);

  const express = await import("express");
  app.use("/uploads", express.default.static(uploadDir));

  app.post("/api/admin/upload-image", authMiddleware, adminMiddleware, upload.single("image"), async (req, res) => {
    try {
      if (!req.file) return res.status(400).json({ message: "No image file provided" });
      const imageUrl = `/uploads/${req.file.filename}`;
      res.json({ imageUrl });
    } catch (err: any) {
      res.status(500).json({ message: err.message });
    }
  });

  // Auth routes
  app.post("/api/auth/signup", authLimiter, async (req, res) => {
  try {
    const parsed = signupSchema.safeParse(req.body);
    if (!parsed.success) {
      return res.status(400).json({
        message: parsed.error.errors[0]?.message || "Invalid input",
      });
    }

    const { username, email, password } = parsed.data;

    const existing = await storage.getUserByEmail(email);
    if (existing) {
      return res.status(400).json({ message: "Email already registered" });
    }

    const user = await storage.createUser({
  username,
  email,
  password, // plain password
});

    const token = generateToken(user.id, user.role);
    const { password: _pw, ...safeUser } = user;

    return res.status(201).json({
      token,
      user: safeUser,
    });
  } catch (err: any) {
    console.error("Signup error:", err);

    const code = err?.code || err?.cause?.code;
    if (code === "23505") {
      return res.status(400).json({
        message: "Username or email already taken",
      });
    }

    return res.status(500).json({
      message: "Server error during signup",
    });
  }
});

  app.post("/api/auth/login", authLimiter, async (req, res) => {
    try {
      const parsed = loginSchema.safeParse(req.body);
      if (!parsed.success) {
        return res.status(400).json({ message: parsed.error.errors[0]?.message || "Invalid input" });
      }

      const user = await storage.getUserByEmail(parsed.data.email);
      if (!user) return res.status(401).json({ message: "Invalid email or password" });

      if (!user.password) return res.status(401).json({ message: "Please use Google login for this account" });

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

  app.post("/api/auth/google", authLimiter, async (req, res) => {
    try {
      const { credential } = req.body;
      if (!credential) return res.status(400).json({ message: "Google credential is required" });

      const { OAuth2Client } = await import("google-auth-library");
      const clientId = process.env.GOOGLE_CLIENT_ID;
      if (!clientId) return res.status(500).json({ message: "Google login is not configured" });

      const client = new OAuth2Client(clientId);
      const ticket = await client.verifyIdToken({
        idToken: credential,
        audience: clientId,
      });

      const payload = ticket.getPayload();
      if (!payload || !payload.email) {
        return res.status(400).json({ message: "Invalid Google credential" });
      }

      if (!payload.email_verified) {
        return res.status(400).json({ message: "Google email is not verified" });
      }

      const { email, sub: googleId, name, picture } = payload;

      let user = await storage.getUserByGoogleId(googleId);

      if (!user) {
        user = await storage.getUserByEmail(email);
        if (user) {
          await storage.updateUserProfile(user.id, { googleId, avatarUrl: picture || null });
          user = await storage.getUserById(user.id);
        } else {
          const username = (name || email.split("@")[0]).replace(/[^a-zA-Z0-9_]/g, "").slice(0, 30) || `user_${Date.now()}`;
          let finalUsername = username;
          const existingUsername = await storage.getAllUsers();
          if (existingUsername.some(u => u.username === finalUsername)) {
            finalUsername = `${username}_${Math.floor(Math.random() * 9999)}`;
          }
          user = await storage.createGoogleUser({
            username: finalUsername,
            email,
            googleId,
            avatarUrl: picture,
          });
        }
      }

      if (!user) return res.status(500).json({ message: "Failed to create account" });
      if (user.banned) return res.status(403).json({ message: "Account is banned" });

      const token = generateToken(user.id, user.role);
      const { password, ...safeUser } = user;
      res.json({ token, user: safeUser });
    } catch (err: any) {
      console.error("Google auth error:", err);
      res.status(500).json({ message: "Google authentication failed" });
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
  // 🔓 Get all tournaments (public)
app.get(
  "/api/tournaments",
  authOptionalMiddleware,
  async (req, res) => {
    try {
      const userId = (req as any).userId ?? null;
      const userRole = (req as any).userRole ?? "user";
      const statusFilterRaw = typeof req.query.status === "string" ? req.query.status : "";
      const searchRaw = typeof req.query.search === "string" ? req.query.search.trim().toLowerCase() : "";
      const validStatuses = new Set(["upcoming", "live", "completed", "cancelled"]);
      const statusFilter = statusFilterRaw
        .split(",")
        .map((s) => s.trim().toLowerCase())
        .filter((s) => validStatuses.has(s));

      const tournaments = await storage.getAllTournaments();
      const filteredTournaments = tournaments.filter((t) => {
        const normalizedStatus = validStatuses.has(String(t.status)) ? String(t.status) : "upcoming";
        const statusMatches = statusFilter.length === 0 || statusFilter.includes(normalizedStatus);
        const searchMatches = !searchRaw || t.title.toLowerCase().includes(searchRaw);
        return statusMatches && searchMatches;
      });

      const result = await Promise.all(
        filteredTournaments.map(async (t) => {
          let isJoined = false;

          if (userId) {
            const reg = await storage.getRegistration(userId, t.id);
            isJoined = !!reg;
          }

          const normalizedStatus = validStatuses.has(String(t.status)) ? t.status : "upcoming";
          const canSeeRoom =
            userRole === "admin" ||
            (isJoined && normalizedStatus === "live");

          return {
            ...t,
            status: normalizedStatus,
            roomId: canSeeRoom ? t.roomId : null,
            roomPassword: canSeeRoom ? t.roomPassword : null,
          };
        })
      );

      res.json(result);
    } catch (err) {
      console.error("Tournament list error:", err);
      res.status(500).json({ message: "Server error" });
    }
  }
);
// 🔓 Get single tournament
// Room ID & Password ONLY for admin or joined users
app.get(
  "/api/tournaments/:id",
  authOptionalMiddleware,
  async (req, res) => {
    try {
      const tournamentId = Number(req.params.id);

      const userId = (req as any).userId ?? null;
      const userRole = (req as any).userRole ?? "user";

      const t = await storage.getTournamentById(tournamentId);
      if (!t) {
        return res.status(404).json({ message: "Tournament not found" });
      }

      let isJoined = false;
      if (userId) {
        const reg = await storage.getRegistration(userId, tournamentId);
        isJoined = !!reg;
      }

      // ✅ FINAL ACCESS RULE
      const normalizedStatus =
        ["upcoming", "live", "completed", "cancelled"].includes(String(t.status))
          ? t.status
          : "upcoming";

      const canSeeRoom =
        userRole === "admin" ||
        (isJoined && normalizedStatus === "live");

      res.json({
        ...t,
        status: normalizedStatus,
        roomId: canSeeRoom ? t.roomId : null,
        roomPassword: canSeeRoom ? t.roomPassword : null,
      });
    } catch (err) {
      console.error("Tournament fetch error:", err);
      res.status(500).json({ message: "Server error" });
    }
  }
);
// 🔓 Tournament results
app.get("/api/tournaments/:id/results", async (req, res) => {
  try {
    const r = await storage.getResultsByTournament(Number(req.params.id));
    res.json(r);
  } catch (err: any) {
    res.status(500).json({ message: err.message });
  }
});

// 🔓 Tournament participants
app.get("/api/tournaments/:id/participants", async (req, res) => {
  try {
    const regs = await storage.getRegistrationsByTournament(
      Number(req.params.id)
    );

    const enriched = await Promise.all(
      regs.map(async (r) => {
        const user = await storage.getUserById(r.userId);
        return {
          ...r,
          username: user?.username,
          displayName: r.inGameName || user?.username,
        };
      })
    );

    res.json(enriched);
  } catch (err: any) {
    res.status(500).json({ message: err.message });
  }
});

  // 🔓 Public: Total registered users (email + Google)
app.get("/api/stats/total-users", async (_req, res) => {
  try {
    const users = await storage.getAllUsers();
    res.json({ count: users.length });
  } catch (err: any) {
    res.status(500).json({ message: err.message });
  }
});
  
  // Protected routes
  app.post("/api/tournaments/:id/join", authMiddleware, async (req, res) => {
    try {
      const userId = (req as any).userId;
      const tournamentId = Number(req.params.id);
      if (!Number.isInteger(tournamentId) || tournamentId <= 0) {
        return res.status(400).json({ message: "Invalid tournament id" });
      }

      const tournament = await storage.getTournamentById(tournamentId);
      if (!tournament) return res.status(404).json({ message: "Tournament not found" });

      const inGameName = typeof req.body?.inGameName === "string" ? req.body.inGameName.trim() : undefined;
      let teamId: number | null = null;

      if (tournament.matchType !== "solo") {
        const parsedTeamId = Number(req.body?.teamId);
        if (!Number.isInteger(parsedTeamId) || parsedTeamId <= 0) {
          return res.status(400).json({ message: "Valid team is required for this match type" });
        }
        const team = await storage.getTeamById(parsedTeamId);
        if (!team) {
          return res.status(404).json({ message: "Team not found" });
        }
        const members = await storage.getTeamMembers(parsedTeamId);
        if (!members.some((member) => member.userId === userId)) {
          return res.status(403).json({ message: "You must be a member of the selected team" });
        }
        const requiredMembers = tournament.matchType === "duo" ? 2 : 4;
        if (members.length !== requiredMembers) {
          return res.status(400).json({ message: `Selected team must have exactly ${requiredMembers} members` });
        }
        teamId = parsedTeamId;
      }

      const joined = await storage.joinTournament({
        userId,
        tournamentId,
        inGameName,
        teamId,
      });

      const { password, ...safeUser } = joined.user;
      res.json({ message: "Joined successfully", user: safeUser });
    } catch (err: any) {
      if (err?.code === "TOURNAMENT_NOT_FOUND") return res.status(404).json({ message: err.message });
      if (err?.code === "TOURNAMENT_CLOSED") return res.status(400).json({ message: err.message });
      if (err?.code === "TOURNAMENT_FULL") return res.status(400).json({ message: err.message });
      if (err?.code === "ALREADY_REGISTERED") return res.status(400).json({ message: err.message });
      if (err?.code === "USER_NOT_FOUND") return res.status(404).json({ message: err.message });
      if (err?.code === "USER_BANNED") return res.status(403).json({ message: err.message });
      if (err?.code === "INSUFFICIENT_BALANCE") return res.status(400).json({ message: err.message });
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

    const {
      bgmiIgn,
      freeFireIgn,
      codIgn,
    } = req.body;

    const updates: any = {};

    // allow empty string overwrite
    if (bgmiIgn !== undefined) updates.bgmiIgn = bgmiIgn;
    if (freeFireIgn !== undefined) updates.freeFireIgn = freeFireIgn;
    if (codIgn !== undefined) updates.codIgn = codIgn;

    // if nothing to update, return current user (NO ERROR)
    if (Object.keys(updates).length === 0) {
      const user = await storage.getUserById(userId);
      if (!user) return res.status(404).json({ message: "User not found" });

      const { password, ...safeUser } = user;
      return res.json({ user: safeUser });
    }

    const updated = await storage.updateUserProfile(userId, updates);
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
      if (process.env.NODE_ENV === "production") {
        return res.status(403).json({ message: "Direct wallet top-up is disabled in production. Use payment gateway." });
      }

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

  // Razorpay payment routes
  app.post("/api/payments/create-order", authMiddleware, async (req, res) => {
    try {
      const keyId = process.env.RAZORPAY_KEY_ID;
      const keySecret = process.env.RAZORPAY_KEY_SECRET;
      if (!keyId || !keySecret) {
        return res.status(500).json({ message: "Payment gateway is not configured" });
      }

      const userId = (req as any).userId;
      const { amount } = req.body;
      if (!amount || typeof amount !== "number" || amount < 100 || amount > 10000000) {
        return res.status(400).json({ message: "Amount must be between 1 and 100000 rupees" });
      }

      const Razorpay = (await import("razorpay")).default;
      const razorpay = new Razorpay({ key_id: keyId, key_secret: keySecret });

      const order = await razorpay.orders.create({
        amount: amount,
        currency: "INR",
        receipt: `wallet_${userId}_${Date.now()}`,
      });

      await storage.createPayment({
        userId,
        razorpayOrderId: order.id,
        amount: amount,
        currency: "INR",
      });

      res.json({
        orderId: order.id,
        amount: amount,
        currency: "INR",
        keyId: keyId,
      });
    } catch (err: any) {
      console.error("Razorpay order error:", err);
      res.status(500).json({ message: "Failed to create payment order" });
    }
  });

  app.post("/api/payments/verify", authMiddleware, async (req, res) => {
    try {
      const keySecret = process.env.RAZORPAY_KEY_SECRET;
      if (!keySecret) return res.status(500).json({ message: "Payment gateway is not configured" });

      const userId = (req as any).userId;
      const { razorpay_order_id, razorpay_payment_id, razorpay_signature } = req.body;

      if (!razorpay_order_id || !razorpay_payment_id || !razorpay_signature) {
        return res.status(400).json({ message: "Missing payment verification data" });
      }

      const body = razorpay_order_id + "|" + razorpay_payment_id;
      const expectedSignature = crypto
        .createHmac("sha256", keySecret)
        .update(body)
        .digest("hex");

      if (expectedSignature !== razorpay_signature) {
        return res.status(400).json({ message: "Invalid payment signature" });
      }

      const payment = await storage.getPaymentByOrderId(razorpay_order_id);
      if (!payment) return res.status(404).json({ message: "Payment order not found" });
      if (payment.userId !== userId) return res.status(403).json({ message: "Unauthorized" });

      const capturedPayment = await storage.markPaymentCapturedByOrderId(razorpay_order_id, {
        razorpayPaymentId: razorpay_payment_id,
        razorpaySignature: razorpay_signature,
      });
      if (!capturedPayment) return res.status(400).json({ message: "Payment already processed" });

      await storage.updateWalletBalance(userId, capturedPayment.amount);
      await storage.createTransaction({
        userId,
        amount: capturedPayment.amount,
        type: "razorpay",
        description: `Razorpay payment #${razorpay_payment_id}`,
      });

      await storage.createNotification({
        userId,
        type: "wallet_credit",
        title: "Payment Successful",
        message: `Rs.${(capturedPayment.amount / 100).toFixed(2)} has been added to your wallet.`,
      });

      const user = await storage.getUserById(userId);
      const { password, ...safeUser } = user!;
      res.json({ message: "Payment verified successfully", user: safeUser });
    } catch (err: any) {
      console.error("Payment verify error:", err);
      res.status(500).json({ message: "Payment verification failed" });
    }
  });

  app.post("/api/payments/webhook", async (req, res) => {
    try {
      const webhookSecret = process.env.RAZORPAY_WEBHOOK_SECRET;
      if (!webhookSecret) return res.status(200).json({ status: "ok" });

      const signature = req.headers["x-razorpay-signature"] as string;
      if (!signature) return res.status(400).json({ message: "No signature" });

      const rawBody = Buffer.isBuffer(req.rawBody)
        ? req.rawBody
        : Buffer.from(JSON.stringify(req.body));
      const expectedSignature = crypto
        .createHmac("sha256", webhookSecret)
        .update(rawBody)
        .digest("hex");

      if (expectedSignature !== signature) {
        return res.status(400).json({ message: "Invalid webhook signature" });
      }

      const event = req.body;
      if (event.event === "payment.captured") {
        const orderId = event.payload?.payment?.entity?.order_id;
        const paymentId = event.payload?.payment?.entity?.id;
        if (orderId) {
          const payment = await storage.markPaymentCapturedByOrderId(orderId, {
            razorpayPaymentId: paymentId,
          });
          if (payment) {
            await storage.updateWalletBalance(payment.userId, payment.amount);
            await storage.createTransaction({
              userId: payment.userId,
              amount: payment.amount,
              type: "razorpay",
              description: `Razorpay webhook payment #${paymentId}`,
            });
          }
        }
      }

      res.status(200).json({ status: "ok" });
    } catch (err: any) {
      console.error("Webhook error:", err);
      res.status(200).json({ status: "ok" });
    }
  });

  app.get("/api/payments/my", authMiddleware, async (req, res) => {
    try {
      const payments = await storage.getPaymentsByUser((req as any).userId);
      res.json(payments);
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

  // Notifications
  app.get("/api/notifications", authMiddleware, async (req, res) => {
    try {
      const notifs = await storage.getNotificationsByUser((req as any).userId);
      res.json(notifs);
    } catch (err: any) {
      res.status(500).json({ message: err.message });
    }
  });

  app.get("/api/notifications/unread-count", authMiddleware, async (req, res) => {
    try {
      const count = await storage.getUnreadNotificationCount((req as any).userId);
      res.json({ count });
    } catch (err: any) {
      res.status(500).json({ message: err.message });
    }
  });

  app.patch("/api/notifications/:id/read", authMiddleware, async (req, res) => {
    try {
      const n = await storage.markNotificationRead(Number(req.params.id), (req as any).userId);
      if (!n) return res.status(404).json({ message: "Notification not found" });
      res.json(n);
    } catch (err: any) {
      res.status(500).json({ message: err.message });
    }
  });

  app.post("/api/notifications/read-all", authMiddleware, async (req, res) => {
    try {
      await storage.markAllNotificationsRead((req as any).userId);
      res.json({ message: "All notifications marked as read" });
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
      const targetId = Number(req.params.id);
      const user = await storage.banUser(targetId, banned);
      if (!user) return res.status(404).json({ message: "User not found" });
      const { password, ...safeUser } = user;

      await storage.createAdminLog({
        adminId: (req as any).userId,
        action: banned ? "ban_user" : "unban_user",
        targetType: "user",
        targetId,
      });

      res.json(safeUser);
    } catch (err: any) {
      res.status(500).json({ message: err.message });
    }
  });

  // Admin wallet adjustment
  app.post("/api/admin/users/:id/wallet", authMiddleware, adminMiddleware, async (req, res) => {
    try {
      const targetId = Number(req.params.id);
      const { amount, type, description } = req.body;
      if (!amount || typeof amount !== "number" || amount <= 0) {
        return res.status(400).json({ message: "Amount must be positive" });
      }
      if (!type || !["admin_credit", "admin_debit"].includes(type)) {
        return res.status(400).json({ message: "Type must be admin_credit or admin_debit" });
      }

      const user = await storage.getUserById(targetId);
      if (!user) return res.status(404).json({ message: "User not found" });

      if (type === "admin_debit" && user.walletBalance < amount) {
        return res.status(400).json({ message: "User has insufficient balance for debit" });
      }

      const walletChange = type === "admin_credit" ? amount : -amount;
      await storage.updateWalletBalance(targetId, walletChange);
      await storage.createTransaction({
        userId: targetId,
        amount,
        type,
        description: description || (type === "admin_credit" ? "Admin credit" : "Admin debit"),
      });

      await storage.createNotification({
        userId: targetId,
        type: type === "admin_credit" ? "wallet_credit" : "wallet_debit",
        title: type === "admin_credit" ? "Wallet Credited" : "Wallet Debited",
        message: `Rs.${(amount / 100).toFixed(2)} has been ${type === "admin_credit" ? "credited to" : "debited from"} your wallet by admin.`,
      });

      await storage.createAdminLog({
        adminId: (req as any).userId,
        action: type,
        targetType: "user",
        targetId,
        details: `Amount: ${amount}, Reason: ${description || "N/A"}`,
      });

      const updated = await storage.getUserById(targetId);
      const { password, ...safeUser } = updated!;
      res.json(safeUser);
    } catch (err: any) {
      res.status(500).json({ message: err.message });
    }
  });

  // Admin Games
  app.post("/api/admin/games", authMiddleware, adminMiddleware, async (req, res) => {
    try {
      const game = await storage.createGame(req.body);

      await storage.createAdminLog({
        adminId: (req as any).userId,
        action: "create_game",
        targetType: "game",
        targetId: game.id,
      });

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

  app.delete("/api/admin/games/:id", authMiddleware, adminMiddleware, async (req, res) => {
    try {
      const gameId = Number(req.params.id);
      const game = await storage.getAllGames();
      const target = game.find(g => g.id === gameId);
      if (!target) return res.status(404).json({ message: "Game not found" });

      await storage.deleteGame(gameId);

      await storage.createAdminLog({
        adminId: (req as any).userId,
        action: "delete_game",
        targetType: "game",
        targetId: gameId,
        details: `Deleted game: ${target.name}`,
      });

      res.json({ success: true });
    } catch (err: any) {
      res.status(500).json({ message: err.message });
    }
  });

  // Admin Tournaments
  app.post("/api/admin/tournaments", authMiddleware, adminMiddleware, async (req, res) => {
  try {
    const data = { ...req.body };

    // 🔴 CRITICAL FIX: normalize startTime
    if (!data.startTime) {
      return res.status(400).json({ message: "Start time is required" });
    }
    data.startTime = new Date(data.startTime);

    if (isNaN(data.startTime.getTime())) {
      return res.status(400).json({ message: "Invalid start time" });
    }

    data.gameId = Number(data.gameId);
    data.entryFee = Number(data.entryFee ?? 0);
    data.prizePool = Number(data.prizePool ?? 0);
    data.maxSlots = Number(data.maxSlots);
    data.matchType = String(data.matchType);

    if (!Number.isInteger(data.gameId) || data.gameId <= 0) {
      return res.status(400).json({ message: "Invalid game" });
    }
    if (!["solo", "duo", "squad"].includes(data.matchType)) {
      return res.status(400).json({ message: "Invalid match type" });
    }
    if (!Number.isInteger(data.maxSlots) || data.maxSlots <= 0) {
      return res.status(400).json({ message: "Max slots must be a positive integer" });
    }
    if (!Number.isFinite(data.entryFee) || data.entryFee < 0) {
      return res.status(400).json({ message: "Entry fee must be a non-negative number" });
    }
    if (!Number.isFinite(data.prizePool) || data.prizePool < 0) {
      return res.status(400).json({ message: "Prize pool must be a non-negative number" });
    }

    // Parse prizeDistribution if needed
    if (typeof data.prizeDistribution === "string") {
      try {
        data.prizeDistribution = JSON.parse(data.prizeDistribution);
      } catch {
        return res.status(400).json({ message: "Invalid prize distribution JSON" });
      }
    }

    // Enforce predictable defaults for newly created tournaments.
    data.status = "upcoming";
    data.filledSlots = 0;

    const t = await storage.createTournament(data);
    res.json(t);
  } catch (err: any) {
    console.error("CREATE TOURNAMENT ERROR:", err);
    res.status(500).json({ message: err.message || "Server error" });
  }
});

  app.patch("/api/admin/tournaments/:id", authMiddleware, adminMiddleware, async (req, res) => {
    try {
      const data = { ...req.body };
      if (data.startTime) {
        data.startTime = new Date(data.startTime);
        if (isNaN(data.startTime.getTime())) {
          return res.status(400).json({ message: "Invalid start time" });
        }
      }

      if (data.gameId !== undefined) {
        data.gameId = Number(data.gameId);
        if (!Number.isInteger(data.gameId) || data.gameId <= 0) {
          return res.status(400).json({ message: "Invalid game" });
        }
      }
      if (data.entryFee !== undefined) {
        data.entryFee = Number(data.entryFee);
        if (!Number.isFinite(data.entryFee) || data.entryFee < 0) {
          return res.status(400).json({ message: "Entry fee must be a non-negative number" });
        }
      }
      if (data.prizePool !== undefined) {
        data.prizePool = Number(data.prizePool);
        if (!Number.isFinite(data.prizePool) || data.prizePool < 0) {
          return res.status(400).json({ message: "Prize pool must be a non-negative number" });
        }
      }
      if (data.maxSlots !== undefined) {
        data.maxSlots = Number(data.maxSlots);
        if (!Number.isInteger(data.maxSlots) || data.maxSlots <= 0) {
          return res.status(400).json({ message: "Max slots must be a positive integer" });
        }
      }
      if (data.matchType !== undefined) {
        data.matchType = String(data.matchType);
        if (!["solo", "duo", "squad"].includes(data.matchType)) {
          return res.status(400).json({ message: "Invalid match type" });
        }
      }
      if (data.prizeDistribution && typeof data.prizeDistribution === "string") {
        try {
          data.prizeDistribution = JSON.parse(data.prizeDistribution);
        } catch {
          return res.status(400).json({ message: "Invalid prize distribution JSON" });
        }
      }
      // Route-specific status endpoint controls status; protect against accidental overrides here.
      delete (data as any).status;
      delete (data as any).filledSlots;
      const t = await storage.updateTournament(Number(req.params.id), data);
      if (!t) return res.status(404).json({ message: "Tournament not found" });
      res.json(t);
    } catch (err: any) {
      res.status(500).json({ message: err.message });
    }
  });

  app.patch("/api/admin/tournaments/:id/status", authMiddleware, adminMiddleware, async (req, res) => {
    try {
      const { status } = req.body;
      const tournamentId = Number(req.params.id);
      const t = await storage.updateTournamentStatus(tournamentId, status);
      if (!t) return res.status(404).json({ message: "Tournament not found" });

      if (status === "live") {
        const regs = await storage.getRegistrationsByTournament(tournamentId);
        for (const reg of regs) {
          await storage.createNotification({
            userId: reg.userId,
            type: "match_started",
            title: "Match Started",
            message: `"${t.title}" is now LIVE! ${t.roomId ? `Room ID: ${t.roomId}` : "Check tournament details."}`,
          });
        }
      }

      await storage.createAdminLog({
        adminId: (req as any).userId,
        action: `update_tournament_status_${status}`,
        targetType: "tournament",
        targetId: tournamentId,
      });

      res.json(t);
    } catch (err: any) {
      res.status(500).json({ message: err.message });
    }
  });

  app.patch("/api/admin/tournaments/:id/room", authMiddleware, adminMiddleware, async (req, res) => {
    try {
      const { roomId, roomPassword } = req.body;
      const tournamentId = Number(req.params.id);
      const t = await storage.updateTournament(tournamentId, { roomId, roomPassword });
      if (!t) return res.status(404).json({ message: "Tournament not found" });

      const regs = await storage.getRegistrationsByTournament(tournamentId);
      for (const reg of regs) {
        await storage.createNotification({
          userId: reg.userId,
          type: "general",
          title: "Room Details Updated",
          message: `Room details for "${t.title}" have been updated. Room ID: ${roomId || "N/A"}`,
        });
      }

      await storage.createAdminLog({
        adminId: (req as any).userId,
        action: "update_room_details",
        targetType: "tournament",
        targetId: tournamentId,
      });

      res.json(t);
    } catch (err: any) {
      res.status(500).json({ message: err.message });
    }
  });

  app.delete("/api/admin/tournaments/:id", authMiddleware, adminMiddleware, async (req, res) => {
    try {
      const tournamentId = Number(req.params.id);
      const t = await storage.getTournamentById(tournamentId);
      if (!t) return res.status(404).json({ message: "Tournament not found" });

      await storage.deleteTournament(tournamentId);

      await storage.createAdminLog({
        adminId: (req as any).userId,
        action: "delete_tournament",
        targetType: "tournament",
        targetId: tournamentId,
        details: `Deleted tournament: ${t.title}`,
      });

      res.json({ success: true });
    } catch (err: any) {
      res.status(500).json({ message: err.message });
    }
  });

  // Admin: Declare results with auto prize distribution
  app.post("/api/admin/tournaments/:id/results", authMiddleware, adminMiddleware, async (req, res) => {
    try {
      const tournamentId = Number(req.params.id);
      const tournament = await storage.getTournamentById(tournamentId);
      if (!tournament) return res.status(404).json({ message: "Tournament not found" });
      if (tournament.status === "completed") {
        return res.status(400).json({ message: "Results already declared for this tournament" });
      }

      const existingResults = await storage.getResultsByTournament(tournamentId);
      if (existingResults.length > 0) {
        return res.status(400).json({ message: "Results already exist for this tournament" });
      }

      const { results: resultData } = req.body;
      if (!Array.isArray(resultData) || resultData.length === 0) {
        return res.status(400).json({ message: "Results array is required" });
      }

      const createdResults = [];
      const seenUsers = new Set<number>();
      for (const r of resultData) {
        if (!r.userId || !r.position) {
          continue;
        }
        if (seenUsers.has(r.userId)) {
          return res.status(400).json({ message: "Duplicate users in results payload" });
        }
        seenUsers.add(r.userId);
        const result = await storage.createResult({
          tournamentId,
          userId: r.userId,
          position: r.position,
          kills: r.kills || 0,
          prize: r.prize || 0,
        });
        createdResults.push(result);

        if (r.prize > 0) {
          await storage.updateWalletBalance(r.userId, r.prize);
          await storage.createTransaction({
            userId: r.userId,
            amount: r.prize,
            type: "winning",
            description: `Prize for position #${r.position} in "${tournament.title}"`,
            tournamentId,
          });

          await storage.createNotification({
            userId: r.userId,
            type: "results_declared",
            title: "Results Declared",
            message: `You placed #${r.position} in "${tournament.title}" and won Rs.${(r.prize / 100).toFixed(2)}!`,
          });
        } else {
          await storage.createNotification({
            userId: r.userId,
            type: "results_declared",
            title: "Results Declared",
            message: `You placed #${r.position} in "${tournament.title}".`,
          });
        }
      }

      await storage.updateTournamentStatus(tournamentId, "completed");

      await storage.createAdminLog({
        adminId: (req as any).userId,
        action: "declare_results",
        targetType: "tournament",
        targetId: tournamentId,
        details: `Declared ${createdResults.length} results, total prize distributed`,
      });

      res.json({ message: "Results declared and prizes distributed", results: createdResults });
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
      const wdId = Number(req.params.id);
      if (!["approved", "rejected", "paid"].includes(status)) {
        return res.status(400).json({ message: "Invalid withdrawal status" });
      }

      const existing = await storage.getWithdrawalById(wdId);
      if (!existing) return res.status(404).json({ message: "Withdrawal not found" });
      if (existing.status !== "pending") {
        return res.status(400).json({ message: `Withdrawal already processed as ${existing.status}` });
      }

      const wd = await storage.updateWithdrawal(wdId, { status: status as any, adminNote });
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

      await storage.createNotification({
        userId: wd.userId,
        type: "withdrawal_update",
        title: "Withdrawal Update",
        message: `Your withdrawal of Rs.${(wd.amount / 100).toFixed(2)} has been ${status}.${adminNote ? ` Note: ${adminNote}` : ""}`,
      });

      await storage.createAdminLog({
        adminId: (req as any).userId,
        action: `withdrawal_${status}`,
        targetType: "withdrawal",
        targetId: wdId,
      });

      res.json(wd);
    } catch (err: any) {
      res.status(500).json({ message: err.message });
    }
  });

  // Admin Logs
  app.get("/api/admin/logs", authMiddleware, adminMiddleware, async (_req, res) => {
    try {
      const logs = await storage.getAdminLogs();
      res.json(logs);
    } catch (err: any) {
      res.status(500).json({ message: err.message });
    }
  });

  // Banner routes
  app.get("/api/banners", async (_req, res) => {
    try {
      const b = await storage.getEnabledBanners();
      res.json(b);
    } catch (err: any) {
      res.status(500).json({ message: err.message });
    }
  });

  app.get("/api/admin/banners", authMiddleware, adminMiddleware, async (_req, res) => {
    try {
      const b = await storage.getAllBanners();
      res.json(b);
    } catch (err: any) {
      res.status(500).json({ message: err.message });
    }
  });

  app.post("/api/admin/banners", authMiddleware, adminMiddleware, upload.single("image"), async (req, res) => {
    try {
      const count = await storage.getBannerCount();
      if (count >= 5) {
        return res.status(400).json({ message: "Maximum 5 banners allowed. Delete one before adding a new one." });
      }
      if (!req.file) {
        return res.status(400).json({ message: "Image file is required" });
      }
      const imageUrl = `/uploads/${req.file.filename}`;
      const banner = await storage.createBanner({
        imageUrl,
        title: req.body.title || null,
        linkUrl: req.body.linkUrl || null,
        sortOrder: count,
      });
      await storage.createAdminLog({
        adminId: (req as any).userId,
        action: "create_banner",
        targetType: "banner",
        targetId: banner.id,
      });
      res.json(banner);
    } catch (err: any) {
      res.status(500).json({ message: err.message });
    }
  });

  app.patch("/api/admin/banners/:id", authMiddleware, adminMiddleware, async (req, res) => {
    try {
      const id = Number(req.params.id);
      const banner = await storage.updateBanner(id, req.body);
      if (!banner) return res.status(404).json({ message: "Banner not found" });
      res.json(banner);
    } catch (err: any) {
      res.status(500).json({ message: err.message });
    }
  });

  app.delete("/api/admin/banners/:id", authMiddleware, adminMiddleware, async (req, res) => {
    try {
      const id = Number(req.params.id);
      await storage.deleteBanner(id);
      await storage.createAdminLog({
        adminId: (req as any).userId,
        action: "delete_banner",
        targetType: "banner",
        targetId: id,
      });
      res.json({ success: true });
    } catch (err: any) {
      res.status(500).json({ message: err.message });
    }
  });

  // Google Client ID endpoint for frontend
  app.get("/api/config/google-client-id", (_req, res) => {
    const clientId = process.env.GOOGLE_CLIENT_ID;
    res.json({ clientId: clientId || null });
  });

  // Razorpay key endpoint for frontend
  app.get("/api/config/razorpay-key", (_req, res) => {
    const keyId = process.env.RAZORPAY_KEY_ID;
    res.json({ keyId: keyId || null });
  });

  // Seed and push DB schema on startup
  // Seed only in development (never push schema in production)
// ❌ REMOVE ALL AUTO DB PUSHING IN PROD


  return httpServer;
}
