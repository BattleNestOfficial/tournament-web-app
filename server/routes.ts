import type { Express, Request, Response } from "express";
import { createServer, type Server } from "http";
import { storage } from "./storage";
import {
  generateToken,
  authMiddleware,
  authOptionalMiddleware,
  adminMiddleware,
  staffMiddleware,
} from "./auth";
import { loginSchema, signupSchema, couponTypeValues, insertDisputeSchema, insertHostApplicationSchema, type Tournament, type LoyaltyTier } from "@shared/schema";
import crypto from "crypto";
import bcrypt from "bcryptjs";
import rateLimit from "express-rate-limit";
import multer from "multer";
import path from "path";
import fs from "fs";
import {
  isBrevoConfigured,
  sendContactSecurityAlert,
  sendPasswordResetEmail,
  sendVerificationEmail,
} from "./email";

const uploadDir = path.join(process.cwd(), "uploads");
if (!fs.existsSync(uploadDir)) {
  fs.mkdirSync(uploadDir, { recursive: true });
}

const allowedImageExtRegex = /\.(jpg|jpeg|png|gif|webp)$/i;
const allowedImageMimeTypes = new Set([
  "image/jpeg",
  "image/png",
  "image/gif",
  "image/webp",
]);

function isAllowedImageUpload(file: { originalname: string; mimetype: string }) {
  return allowedImageExtRegex.test(path.extname(file.originalname)) && allowedImageMimeTypes.has(file.mimetype);
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
    if (isAllowedImageUpload(file)) {
      cb(null, true);
    } else {
      cb(new Error("Only image files are allowed"));
    }
  },
});

const uploadMemory = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 8 * 1024 * 1024 },
  fileFilter: (_req, file, cb) => {
    if (isAllowedImageUpload(file)) {
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

const EMAIL_VERIFICATION_TTL_MS = 24 * 60 * 60 * 1000;
const PASSWORD_RESET_TTL_MS = 30 * 60 * 1000;
const PHONE_VERIFICATION_TTL_MS = 10 * 60 * 1000;
const WITHDRAWAL_COOLDOWN_MS = 24 * 60 * 60 * 1000;
const OTP_REQUEST_WINDOW_MS = 15 * 60 * 1000;
const OTP_REQUEST_MAX = 5;
const OTP_MAX_ATTEMPTS = 5;
const OTP_LOCK_MS = 15 * 60 * 1000;
const DAILY_WITHDRAWAL_LIMIT_PAISA = Number(process.env.DAILY_WITHDRAWAL_LIMIT_PAISA || 2000000);
const IS_PRODUCTION = process.env.NODE_ENV === "production";
const IDEMPOTENCY_TTL_MS = Math.max(60_000, Number(process.env.IDEMPOTENCY_TTL_MS || 10 * 60 * 1000));

type IdempotencyCacheRecord = {
  status: number;
  body: unknown;
  expiresAt: number;
};

const idempotencyCache = new Map<string, IdempotencyCacheRecord>();

function shouldExposeDevSecrets() {
  return !IS_PRODUCTION;
}

function logDevOtp(scope: string, details: Record<string, unknown>) {
  if (IS_PRODUCTION) return;
  const safeDetails = Object.entries(details)
    .map(([key, value]) => `${key}=${String(value ?? "")}`)
    .join(" ");
  console.log(`[${scope}] ${safeDetails}`);
}

function getPublicErrorMessage(error: unknown, fallback = "Internal Server Error") {
  if (!IS_PRODUCTION && error instanceof Error && error.message) {
    return error.message;
  }
  return fallback;
}

function parsePaisaAmount(value: unknown): number | null {
  if (typeof value !== "number" || !Number.isFinite(value) || !Number.isInteger(value)) return null;
  return value;
}

function cleanupIdempotencyCache() {
  const now = Date.now();
  idempotencyCache.forEach((value, key) => {
    if (value.expiresAt <= now) {
      idempotencyCache.delete(key);
    }
  });
}

function getIdempotencyCacheKey(req: Request, scope: string, actorId: number | string) {
  const rawHeader = req.headers["idempotency-key"];
  const key = typeof rawHeader === "string" ? rawHeader.trim() : "";
  if (!key) return null;
  if (key.length < 8 || key.length > 128) return "__invalid__";
  return `${scope}:${req.method}:${req.path}:${actorId}:${key}`;
}

function replayIdempotentResponse(cacheKey: string, res: Response) {
  const cached = idempotencyCache.get(cacheKey);
  if (!cached) return false;
  if (cached.expiresAt <= Date.now()) {
    idempotencyCache.delete(cacheKey);
    return false;
  }
  res.setHeader("X-Idempotent-Replay", "true");
  res.status(cached.status).json(cached.body);
  return true;
}

function cacheIdempotentResponse(cacheKey: string, status: number, body: unknown) {
  idempotencyCache.set(cacheKey, {
    status,
    body,
    expiresAt: Date.now() + IDEMPOTENCY_TTL_MS,
  });
}

function createPhoneOtp() {
  return Math.floor(100000 + Math.random() * 900000).toString();
}

function createEmailVerificationOtp() {
  return Math.floor(100000 + Math.random() * 900000).toString();
}

function createPasswordResetOtp() {
  return Math.floor(100000 + Math.random() * 900000).toString();
}

const otpRequestHistory = new Map<string, number[]>();

function consumeOtpRequestQuota(key: string) {
  const now = Date.now();
  const windowStart = now - OTP_REQUEST_WINDOW_MS;
  const existing = otpRequestHistory.get(key) || [];
  const active = existing.filter((ts) => ts >= windowStart);
  if (active.length >= OTP_REQUEST_MAX) {
    const oldest = active[0];
    const retryAfterSec = Math.max(1, Math.ceil((oldest + OTP_REQUEST_WINDOW_MS - now) / 1000));
    otpRequestHistory.set(key, active);
    return { allowed: false, retryAfterSec };
  }
  active.push(now);
  otpRequestHistory.set(key, active);
  return { allowed: true, retryAfterSec: 0 };
}

function getOtpRetryAfterSec(lockUntil?: Date | null) {
  if (!lockUntil) return 0;
  return Math.max(1, Math.ceil((lockUntil.getTime() - Date.now()) / 1000));
}

function isOtpLocked(lockUntil?: Date | null) {
  return Boolean(lockUntil && lockUntil.getTime() > Date.now());
}

function getOtpFields(kind: "email" | "phone" | "password") {
  if (kind === "email") {
    return {
      attempt: "emailVerificationAttempts",
      lock: "emailVerificationLockUntil",
    } as const;
  }
  if (kind === "phone") {
    return {
      attempt: "phoneVerificationAttempts",
      lock: "phoneVerificationLockUntil",
    } as const;
  }
  return {
    attempt: "passwordResetAttempts",
    lock: "passwordResetLockUntil",
  } as const;
}

async function registerOtpFailure(user: any, kind: "email" | "phone" | "password") {
  const fields = getOtpFields(kind);
  const currentAttempts = Number(user?.[fields.attempt] || 0) + 1;
  const updates: any = { [fields.attempt]: currentAttempts };

  if (currentAttempts >= OTP_MAX_ATTEMPTS) {
    const lockUntil = new Date(Date.now() + OTP_LOCK_MS);
    updates[fields.attempt] = 0;
    updates[fields.lock] = lockUntil;
    const updated = await storage.updateUserProfile(user.id, updates);
    return {
      locked: true,
      lockUntil,
      attemptsRemaining: 0,
      user: updated || user,
    };
  }

  const updated = await storage.updateUserProfile(user.id, updates);
  return {
    locked: false,
    lockUntil: null as Date | null,
    attemptsRemaining: Math.max(OTP_MAX_ATTEMPTS - currentAttempts, 0),
    user: updated || user,
  };
}

function normalizeEmail(value: unknown): string | null {
  if (typeof value !== "string") return null;
  const normalized = value.trim().toLowerCase();
  if (!normalized) return null;
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  return emailRegex.test(normalized) ? normalized : null;
}

function normalizePhone(value: unknown): string | null {
  if (value === null) return null;
  if (typeof value !== "string") return null;
  const trimmed = value.trim();
  if (!trimmed) return null;
  const normalized = trimmed.replace(/[^\d+]/g, "");
  const phoneRegex = /^\+?[1-9]\d{7,14}$/;
  return phoneRegex.test(normalized) ? normalized : null;
}

function sanitizeUser(user: any) {
  if (!user) return user;
  const {
    password,
    emailVerificationToken,
    emailVerificationExpires,
    emailVerificationAttempts,
    emailVerificationLockUntil,
    passwordResetToken,
    passwordResetExpires,
    passwordResetAttempts,
    passwordResetLockUntil,
    phoneVerificationCode,
    phoneVerificationExpires,
    phoneVerificationAttempts,
    phoneVerificationLockUntil,
    ...safeUser
  } = user;
  return safeUser;
}

function getTournamentStatusValue(value: unknown): "hot" | "upcoming" | "live" | "completed" | "cancelled" {
  const normalized = String(value || "").toLowerCase().trim();
  if (normalized === "hot") return "hot";
  if (normalized === "upcoming") return "upcoming";
  if (normalized === "live") return "live";
  if (normalized === "completed") return "completed";
  return "cancelled";
}

function getAutoScaledPrizePoolValue(input: {
  status: unknown;
  prizePool: unknown;
  filledSlots: unknown;
  maxSlots: unknown;
}): number {
  const status = getTournamentStatusValue(input.status);
  const basePrizePool = Math.max(0, Math.round(Number(input.prizePool || 0)));
  const maxSlots = Number.isFinite(Number(input.maxSlots)) && Number(input.maxSlots) > 0
    ? Math.round(Number(input.maxSlots))
    : 0;
  const filledSlotsRaw = Number.isFinite(Number(input.filledSlots)) && Number(input.filledSlots) >= 0
    ? Math.round(Number(input.filledSlots))
    : 0;
  const filledSlots = maxSlots > 0 ? Math.min(filledSlotsRaw, maxSlots) : filledSlotsRaw;

  if (status !== "live" && status !== "completed") {
    return basePrizePool;
  }
  if (basePrizePool <= 0 || maxSlots <= 0) {
    return basePrizePool;
  }

  const ratio = Math.max(0, Math.min(1, filledSlots / maxSlots));
  return Math.max(0, Math.round(basePrizePool * ratio));
}

type OcrParsedRow = {
  slNo: number;
  detectedName: string;
  rank: number;
  kills: number;
};

function normalizePlayerKey(value: unknown): string {
  return String(value || "")
    .toLowerCase()
    .replace(/[^a-z0-9]/g, "");
}

function levenshteinDistance(a: string, b: string): number {
  if (a === b) return 0;
  if (!a.length) return b.length;
  if (!b.length) return a.length;

  const dp: number[][] = Array.from({ length: a.length + 1 }, () =>
    Array.from({ length: b.length + 1 }, () => 0),
  );

  for (let i = 0; i <= a.length; i += 1) dp[i][0] = i;
  for (let j = 0; j <= b.length; j += 1) dp[0][j] = j;

  for (let i = 1; i <= a.length; i += 1) {
    for (let j = 1; j <= b.length; j += 1) {
      const cost = a[i - 1] === b[j - 1] ? 0 : 1;
      dp[i][j] = Math.min(
        dp[i - 1][j] + 1,
        dp[i][j - 1] + 1,
        dp[i - 1][j - 1] + cost,
      );
    }
  }
  return dp[a.length][b.length];
}

function computeNameSimilarityScore(aRaw: unknown, bRaw: unknown): number {
  const a = normalizePlayerKey(aRaw);
  const b = normalizePlayerKey(bRaw);
  if (!a || !b) return 0;
  if (a === b) return 1;
  if (a.includes(b) || b.includes(a)) return 0.9;
  const maxLen = Math.max(a.length, b.length);
  if (maxLen === 0) return 0;
  const distance = levenshteinDistance(a, b);
  return Math.max(0, 1 - distance / maxLen);
}

async function extractTextFromImageWithOcrSpace(file: {
  buffer: Buffer;
  mimetype?: string;
  originalname?: string;
}): Promise<string> {
  const apiKey = String(process.env.OCR_SPACE_API_KEY || "helloworld").trim();
  if (!apiKey) {
    throw new Error("OCR provider key missing");
  }

  const formData = new FormData();
  formData.append("apikey", apiKey);
  formData.append("language", "eng");
  formData.append("isOverlayRequired", "false");
  formData.append("detectOrientation", "true");
  formData.append("scale", "true");
  formData.append("OCREngine", String(process.env.OCR_SPACE_ENGINE || "2"));
  const fileBytes = Uint8Array.from(file.buffer);
  formData.append(
    "file",
    new Blob([fileBytes], { type: file.mimetype || "image/png" }),
    file.originalname || "bgmi-result.png",
  );

  const response = await fetch("https://api.ocr.space/parse/image", {
    method: "POST",
    body: formData,
  });
  if (!response.ok) {
    throw new Error(`OCR request failed (${response.status})`);
  }

  const payload = (await response.json()) as {
    IsErroredOnProcessing?: boolean;
    ErrorMessage?: string | string[];
    ParsedResults?: Array<{ ParsedText?: string }>;
  };

  if (payload?.IsErroredOnProcessing) {
    const errorMessage = Array.isArray(payload.ErrorMessage)
      ? payload.ErrorMessage.join(", ")
      : payload.ErrorMessage || "OCR processing failed";
    throw new Error(errorMessage);
  }

  const text = (payload?.ParsedResults || [])
    .map((item) => String(item?.ParsedText || "").trim())
    .filter(Boolean)
    .join("\n");

  if (!text.trim()) {
    throw new Error("No readable text found in screenshot");
  }

  return text;
}

function collectTextCandidates(value: unknown, out: string[], depth = 0) {
  if (depth > 8 || value == null) return;
  if (typeof value === "string") {
    const trimmed = value.trim();
    if (trimmed.length >= 2 && /[a-z0-9]/i.test(trimmed)) {
      out.push(trimmed);
    }
    return;
  }
  if (Array.isArray(value)) {
    for (const item of value) {
      collectTextCandidates(item, out, depth + 1);
    }
    return;
  }
  if (typeof value === "object") {
    for (const [key, nested] of Object.entries(value as Record<string, unknown>)) {
      const lowerKey = key.toLowerCase();
      if (
        typeof nested === "string" &&
        (lowerKey.includes("text") || lowerKey.includes("word") || lowerKey.includes("line") || lowerKey.includes("content"))
      ) {
        const trimmed = nested.trim();
        if (trimmed.length >= 2 && /[a-z0-9]/i.test(trimmed)) {
          out.push(trimmed);
        }
      }
      collectTextCandidates(nested, out, depth + 1);
    }
  }
}

async function extractTextFromImageWithApi4Ai(file: {
  buffer: Buffer;
  mimetype?: string;
  originalname?: string;
}): Promise<string> {
  const configuredEndpoint = String(process.env.API4AI_OCR_ENDPOINT || "").trim();
  const endpoints = [
    configuredEndpoint,
    "https://demo.api4.ai/ocr/v1/results",
    "https://demo.api4ai.cloud/ocr/v1/results",
  ].filter((value, index, arr) => !!value && arr.indexOf(value) === index);

  if (endpoints.length === 0) {
    throw new Error("API4AI endpoint is not configured");
  }

  const apiKey = String(process.env.API4AI_OCR_KEY || process.env.API4AI_API_KEY || "").trim();
  const appId = String(process.env.API4AI_APP_ID || "").trim();
  const appSecret = String(process.env.API4AI_APP_SECRET || "").trim();

  let lastError = "";
  for (const endpoint of endpoints) {
    const headers: Record<string, string> = {};
    if (apiKey) {
      headers["A4A-KEY"] = apiKey;
      headers["Authorization"] = `Bearer ${apiKey}`;
      headers["x-api-key"] = apiKey;
    }
    if (appId) headers["A4A-CLIENT-APP-ID"] = appId;
    if (appSecret) headers["A4A-CLIENT-APP-KEY"] = appSecret;

    const formData = new FormData();
    const fileBytes = Uint8Array.from(file.buffer);
    const blob = new Blob([fileBytes], { type: file.mimetype || "image/png" });
    formData.append("image", blob, file.originalname || "bgmi-result.png");
    formData.append("file", blob, file.originalname || "bgmi-result.png");

    try {
      const response = await fetch(endpoint, {
        method: "POST",
        headers,
        body: formData,
      });
      if (!response.ok) {
        const text = (await response.text()).slice(0, 300);
        lastError = `API4AI request failed (${response.status}) ${text}`;
        continue;
      }

      const payload = (await response.json()) as unknown;
      const candidates: string[] = [];
      collectTextCandidates(payload, candidates);
      const mergedText = Array.from(new Set(candidates))
        .join("\n")
        .trim();
      if (!mergedText) {
        lastError = "API4AI response did not contain OCR text";
        continue;
      }
      return mergedText;
    } catch (err: any) {
      lastError = err?.message || "API4AI OCR request failed";
    }
  }

  throw new Error(lastError || "API4AI OCR request failed");
}

async function extractTextFromImage(file: {
  buffer: Buffer;
  mimetype?: string;
  originalname?: string;
}): Promise<string> {
  const provider = String(process.env.OCR_PROVIDER || "auto").toLowerCase().trim();

  if (provider === "api4ai") {
    return extractTextFromImageWithApi4Ai(file);
  }
  if (provider === "ocrspace") {
    return extractTextFromImageWithOcrSpace(file);
  }

  try {
    return await extractTextFromImageWithApi4Ai(file);
  } catch {
    return extractTextFromImageWithOcrSpace(file);
  }
}

function parseBgmiRowsFromText(rawText: string): OcrParsedRow[] {
  const lines = rawText
    .split(/\r?\n/)
    .map((line) => line.replace(/\s+/g, " ").trim())
    .filter(Boolean);

  const parsedRows: OcrParsedRow[] = [];
  const seenKeys = new Set<string>();

  for (const line of lines) {
    if (/^(rank|name|kills?|finishes?|finish|total|result|match)\b/i.test(line)) {
      continue;
    }

    const numericMatches = line.match(/\d+/g) || [];
    if (numericMatches.length < 2) continue;

    const numbers = numericMatches.map((n) => Math.max(0, Number(n)));
    let slNo = 0;
    let rank = 0;
    let kills = 0;

    if (numbers.length >= 3) {
      slNo = numbers[0];
      rank = numbers[1];
      kills = numbers[2];
    } else {
      rank = numbers[0];
      kills = numbers[1];
    }

    if (!Number.isFinite(rank) || rank <= 0 || rank > 100) continue;
    if (!Number.isFinite(kills) || kills < 0 || kills > 80) {
      kills = Math.max(0, Math.min(80, kills || 0));
    }

    const detectedName = line
      .replace(/\b\d+\b/g, " ")
      .replace(/\b(rank|kills?|finishes?|finish|sl|no|name)\b/gi, " ")
      .replace(/[|:;,_]/g, " ")
      .replace(/\s+/g, " ")
      .trim();

    if (detectedName.length < 2 || !/[a-z]/i.test(detectedName)) continue;

    const dedupeKey = `${normalizePlayerKey(detectedName)}|${rank}|${kills}`;
    if (seenKeys.has(dedupeKey)) continue;
    seenKeys.add(dedupeKey);

    parsedRows.push({
      slNo: slNo > 0 ? slNo : parsedRows.length + 1,
      detectedName,
      rank,
      kills,
    });
  }

  return parsedRows
    .sort((a, b) => a.rank - b.rank || a.slNo - b.slNo)
    .slice(0, 100);
}

function parsePrizeDistributionMap(raw: unknown): Map<number, number> {
  const mapping = new Map<number, number>();
  if (!Array.isArray(raw)) return mapping;

  for (const entry of raw) {
    const item = entry as { position?: unknown; prize?: unknown };
    const position = Number(item?.position);
    const prize = Number(item?.prize);
    if (!Number.isInteger(position) || position <= 0) continue;
    if (!Number.isFinite(prize) || prize < 0) continue;
    mapping.set(position, Math.round(prize));
  }

  return mapping;
}

function getMetadataSource(value: unknown): string {
  if (!value || typeof value !== "object") return "";
  const sourceValue = (value as Record<string, unknown>).source;
  return typeof sourceValue === "string" ? sourceValue : "";
}

function getMetadataOrderId(value: unknown): string {
  if (!value || typeof value !== "object") return "";
  const orderIdValue = (value as Record<string, unknown>).orderId;
  return typeof orderIdValue === "string" ? orderIdValue : "";
}

function signaturesMatch(expected: string, provided: string): boolean {
  const expectedBuffer = Buffer.from(expected, "utf8");
  const providedBuffer = Buffer.from(provided, "utf8");
  if (expectedBuffer.length !== providedBuffer.length) return false;
  return crypto.timingSafeEqual(expectedBuffer, providedBuffer);
}

function normalizeCouponTypeForRoute(value: unknown) {
  const raw = String(value || "").toLowerCase().trim();
  return couponTypeValues.includes(raw as any) ? (raw as (typeof couponTypeValues)[number]) : null;
}

function normalizeDisputeStatus(value: unknown): "open" | "in_review" | "resolved" | null {
  const raw = String(value || "").toLowerCase().trim();
  if (raw === "open" || raw === "submitted") return "open";
  if (raw === "in_review") return "in_review";
  if (raw === "resolved" || raw === "rejected") return "resolved";
  return null;
}

function normalizeHostApplicationStatus(value: unknown): "pending" | "in_review" | "approved" | "rejected" | null {
  const raw = String(value || "").toLowerCase().trim();
  if (raw === "pending" || raw === "open") return "pending";
  if (raw === "in_review") return "in_review";
  if (raw === "approved") return "approved";
  if (raw === "rejected") return "rejected";
  return null;
}

function normalizeYouTubeLiveUrl(value: unknown): string | null {
  if (value == null) return null;
  const raw = String(value).trim();
  if (!raw) return null;

  try {
    const parsed = new URL(raw);
    const protocol = parsed.protocol.toLowerCase();
    if (protocol !== "https:" && protocol !== "http:") {
      return null;
    }
    const host = parsed.hostname.toLowerCase();
    const validHost =
      host === "youtube.com" ||
      host.endsWith(".youtube.com") ||
      host === "youtu.be";
    if (!validHost) {
      return null;
    }
    return parsed.toString();
  } catch {
    return null;
  }
}

function getTierBadge(tier: LoyaltyTier): string {
  if (tier === "vip") return "VIP";
  if (tier === "gold") return "Gold";
  if (tier === "silver") return "Silver";
  return "Bronze";
}

export async function registerRoutes(
  httpServer: Server,
  app: Express
): Promise<Server> {

  app.get("/api/health", (_req, res) => {
    res.json({
      status: "ok",
      service: "battle-nest-api",
      timestamp: new Date().toISOString(),
      uptimeSec: Math.floor(process.uptime()),
    });
  });

  app.get("/api/ready", async (_req, res) => {
    try {
      await storage.getStats();
      res.json({
        status: "ready",
        timestamp: new Date().toISOString(),
      });
    } catch (err) {
      res.status(503).json({
        status: "not_ready",
        message: getPublicErrorMessage(err),
      });
    }
  });

  app.use("/api/", apiLimiter);

  const idempotencyCleanupTimer = setInterval(
    () => cleanupIdempotencyCache(),
    Math.min(IDEMPOTENCY_TTL_MS, 60_000),
  );
  if (typeof (idempotencyCleanupTimer as any).unref === "function") {
    (idempotencyCleanupTimer as any).unref();
  }
  httpServer.on("close", () => clearInterval(idempotencyCleanupTimer));

  const express = await import("express");
  app.use("/uploads", express.default.static(uploadDir));

  app.post("/api/admin/upload-image", authMiddleware, staffMiddleware, upload.single("image"), async (req, res) => {
    try {
      if (!req.file) return res.status(400).json({ message: "No image file provided" });
      const imageUrl = `/uploads/${req.file.filename}`;
      res.json({ imageUrl });
    } catch (err: any) {
      res.status(500).json({ message: err.message });
    }
  });

  const tournamentStreamClients = new Set<Response>();

  function pushSseEvent(client: Response, event: string, data: Record<string, unknown>) {
    client.write(`event: ${event}\n`);
    client.write(`data: ${JSON.stringify(data)}\n\n`);
  }

  function broadcastTournamentUpdate(
    tournament: Pick<Tournament, "id" | "status" | "filledSlots" | "maxSlots" | "startTime" | "roomId" | "roomPassword">,
    reason: string,
  ) {
    if (tournamentStreamClients.size === 0) return;
    const payload = {
      tournamentId: Number(tournament.id),
      status: getTournamentStatusValue(tournament.status),
      filledSlots: Number(tournament.filledSlots || 0),
      maxSlots: Number(tournament.maxSlots || 0),
      startTime: tournament.startTime ? new Date(tournament.startTime).toISOString() : null,
      roomPublished: Boolean(tournament.roomId && tournament.roomPassword),
      reason,
      ts: Date.now(),
    };

    tournamentStreamClients.forEach((client) => {
      pushSseEvent(client, "tournament_update", payload);
    });
  }

  function broadcastAdminUpdate(data: {
    entity: string;
    action: string;
    targetId?: number | null;
    metadata?: Record<string, unknown>;
  }) {
    if (tournamentStreamClients.size === 0) return;
    const payload = {
      entity: data.entity,
      action: data.action,
      targetId: data.targetId ?? null,
      metadata: data.metadata || null,
      ts: Date.now(),
    };
    tournamentStreamClients.forEach((client) => {
      pushSseEvent(client, "admin_update", payload);
    });
  }

  async function notifyTournamentLive(tournament: Tournament, source: "auto_start" | "manual_live" | "full_slots") {
    const regs = await storage.getRegistrationsByTournament(Number(tournament.id));
    if (regs.length === 0) return;

    for (const reg of regs) {
      await storage.createNotification({
        userId: reg.userId,
        type: "match_started",
        title: "Match Started",
        message: `"${tournament.title}" is now LIVE! ${
          tournament.roomId ? `Room ID: ${tournament.roomId}` : "Check tournament details."
        }`,
      });
    }

    broadcastTournamentUpdate(tournament, source);
  }

  async function refundCancelledTournament(tournament: Tournament) {
    const entryFee = Number(tournament.entryFee || 0);
    const tournamentId = Number(tournament.id);
    if (entryFee <= 0 || !Number.isInteger(tournamentId) || tournamentId <= 0) {
      const regs = await storage.getRegistrationsByTournament(tournamentId);
      for (const reg of regs) {
        await storage.createNotification({
          userId: reg.userId,
          type: "general",
          title: "Tournament Cancelled",
          message: `"${tournament.title}" has been cancelled.`,
        });
      }
      return { refundedUsers: 0, refundedAmount: 0 };
    }

    const regs = await storage.getRegistrationsByTournament(tournamentId);
    const uniqueUserIds = Array.from(
      new Set(regs.map((reg) => Number(reg.userId)).filter((id) => Number.isInteger(id) && id > 0)),
    );
    let refundedUsers = 0;
    let refundedAmount = 0;

    for (const userId of uniqueUserIds) {
      const txHistory = await storage.getTransactionsByUser(userId);
      const alreadyRefunded = txHistory.some(
        (tx) =>
          Number(tx.tournamentId) === tournamentId &&
          String(tx.type) === "admin_credit" &&
          getMetadataSource(tx.metadata) === "tournament_cancel_refund",
      );

      if (alreadyRefunded) {
        continue;
      }

      const beforeUser = await storage.getUserById(userId);
      if (!beforeUser) continue;
      const afterUser = await storage.updateWalletBalance(userId, entryFee);
      if (!afterUser) continue;

      await storage.createTransaction({
        userId,
        amount: entryFee,
        type: "admin_credit",
        walletType: "main",
        mainBalanceBefore: beforeUser.mainWalletBalance || 0,
        mainBalanceAfter: afterUser.mainWalletBalance || 0,
        bonusBalanceBefore: beforeUser.bonusWalletBalance || 0,
        bonusBalanceAfter: afterUser.bonusWalletBalance || 0,
        metadata: { source: "tournament_cancel_refund" },
        description: `Refund for cancelled tournament "${tournament.title}"`,
        tournamentId,
      });

      await storage.createNotification({
        userId,
        type: "wallet_credit",
        title: "Tournament Cancelled",
        message: `"${tournament.title}" was cancelled. Entry fee Rs.${(entryFee / 100).toFixed(2)} has been refunded.`,
      });

      refundedUsers += 1;
      refundedAmount += entryFee;
    }

    return { refundedUsers, refundedAmount };
  }

  const paymentCreditLocks = new Map<string, Promise<{ user: any | null; credited: boolean }>>();
  const sseRetryMs = Math.min(30000, Math.max(1000, Number(process.env.SSE_RETRY_MS || 3000)));
  const sseHeartbeatMs = Math.min(60000, Math.max(10000, Number(process.env.SSE_HEARTBEAT_MS || 25000)));

  async function ensurePaymentWalletCredit(
    payment: { userId: number; amount: number; razorpayOrderId: string },
    meta: { source: "razorpay_verify" | "razorpay_webhook"; paymentId?: string | null },
  ) {
    const existingLock = paymentCreditLocks.get(payment.razorpayOrderId);
    if (existingLock) {
      return existingLock;
    }

    const lockPromise = (async () => {
      const txHistory = await storage.getTransactionsByUser(payment.userId);
      const alreadyCredited = txHistory.some(
        (tx) => String(tx.type) === "razorpay" && getMetadataOrderId(tx.metadata) === payment.razorpayOrderId,
      );
      const beforeUser = await storage.getUserById(payment.userId);
      if (alreadyCredited) {
        return { user: beforeUser || null, credited: false };
      }
      if (!beforeUser) {
        const err = new Error("User not found");
        (err as any).code = "USER_NOT_FOUND";
        throw err;
      }
      const updatedUser = await storage.updateWalletBalance(payment.userId, payment.amount);
      if (!updatedUser) {
        throw new Error("Wallet update failed");
      }
      await storage.createTransaction({
        userId: payment.userId,
        amount: payment.amount,
        type: "razorpay",
        walletType: "main",
        mainBalanceBefore: beforeUser.mainWalletBalance || 0,
        mainBalanceAfter: updatedUser.mainWalletBalance || 0,
        bonusBalanceBefore: beforeUser.bonusWalletBalance || 0,
        bonusBalanceAfter: updatedUser.bonusWalletBalance || 0,
        metadata: {
          source: meta.source,
          orderId: payment.razorpayOrderId,
          paymentId: meta.paymentId || null,
        },
        description: `Razorpay payment #${meta.paymentId || payment.razorpayOrderId}`,
      });
      await storage.createNotification({
        userId: payment.userId,
        type: "wallet_credit",
        title: "Payment Successful",
        message: `Rs.${(payment.amount / 100).toFixed(2)} has been added to your wallet.`,
      });
      return { user: updatedUser, credited: true };
    })()
      .finally(() => {
        paymentCreditLocks.delete(payment.razorpayOrderId);
      });

    paymentCreditLocks.set(payment.razorpayOrderId, lockPromise);
    return lockPromise;
  }

  app.get("/api/tournaments/stream", (_req, res) => {
    res.setHeader("Content-Type", "text/event-stream");
    res.setHeader("Cache-Control", "no-cache, no-transform");
    res.setHeader("Connection", "keep-alive");
    res.setHeader("X-Accel-Buffering", "no");
    res.flushHeaders();

    res.write(`retry: ${sseRetryMs}\n\n`);
    pushSseEvent(res, "stream_status", {
      status: "connected",
      retryMs: sseRetryMs,
      heartbeatMs: sseHeartbeatMs,
      ts: Date.now(),
    });
    tournamentStreamClients.add(res);

    const keepAlive = setInterval(() => {
      if ((res as any).writableEnded) return;
      pushSseEvent(res, "heartbeat", { ts: Date.now() });
    }, sseHeartbeatMs);

    res.on("close", () => {
      clearInterval(keepAlive);
      tournamentStreamClients.delete(res);
    });
  });

  let lifecycleTickRunning = false;
  const lifecyclePollMs = Math.max(3000, Number(process.env.TOURNAMENT_LIFECYCLE_POLL_MS || 10000));

  async function runTournamentLifecycleTick() {
    if (lifecycleTickRunning) return;
    lifecycleTickRunning = true;

    try {
      const now = Date.now();
      const allTournaments = await storage.getAllTournaments();

      for (const tournament of allTournaments) {
        const status = getTournamentStatusValue(tournament.status);
        const startMs = new Date(tournament.startTime).getTime();
        if (Number.isNaN(startMs)) continue;
        if ((status === "upcoming" || status === "hot") && startMs <= now) {
          const updated = await storage.updateTournamentStatus(Number(tournament.id), "live");
          if (updated) {
            await notifyTournamentLive(updated, "auto_start");
          }
        }
      }
    } catch (err) {
      console.error("Tournament lifecycle tick failed:", err);
    } finally {
      lifecycleTickRunning = false;
    }
  }

  const lifecycleTimer = setInterval(() => {
    void runTournamentLifecycleTick();
  }, lifecyclePollMs);
  if (typeof (lifecycleTimer as any).unref === "function") {
    (lifecycleTimer as any).unref();
  }
  httpServer.on("close", () => clearInterval(lifecycleTimer));
  void runTournamentLifecycleTick();

  async function requireVerifiedEmail(userId: number, res: any) {
    const user = await storage.getUserById(userId);
    if (!user) {
      res.status(404).json({ message: "User not found" });
      return null;
    }
    if (!user.emailVerified) {
      res.status(403).json({ message: "Email verification required" });
      return null;
    }
    return user;
  }

  async function requireWithdrawalEligibility(userId: number, res: any) {
    const user = await storage.getUserById(userId);
    if (!user) {
      res.status(404).json({ message: "User not found" });
      return null;
    }
    if (!user.emailVerified) {
      res.status(403).json({ message: "Verify your email before withdrawing" });
      return null;
    }
    if (!user.phone || !user.phoneVerified) {
      res.status(403).json({ message: "Phone verification required before withdrawal" });
      return null;
    }
    if (user.withdrawalLockUntil && user.withdrawalLockUntil.getTime() > Date.now()) {
      res.status(403).json({
        message: `Withdrawals are locked until ${user.withdrawalLockUntil.toLocaleString("en-IN")}`,
      });
      return null;
    }
    return user;
  }

  // Auth routes
  app.get("/api/auth/me", authMiddleware, async (req, res) => {
    try {
      const user = await storage.getUserById(Number((req as any).userId));
      if (!user) return res.status(404).json({ message: "User not found" });
      res.json({ user: sanitizeUser(user) });
    } catch (err: any) {
      res.status(500).json({ message: err.message });
    }
  });

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
      password,
    });

    const verificationOtp = createEmailVerificationOtp();
    const verificationExpires = new Date(Date.now() + EMAIL_VERIFICATION_TTL_MS);
    const updatedUser = await storage.updateUserProfile(user.id, {
      emailVerificationToken: verificationOtp,
      emailVerificationExpires: verificationExpires,
      emailVerified: false,
      emailVerificationAttempts: 0,
      emailVerificationLockUntil: null,
    });

    try {
      if (isBrevoConfigured()) {
        await sendVerificationEmail({
          toEmail: user.email,
          username: user.username,
          otp: verificationOtp,
        });
      } else {
        console.warn("[EMAIL_VERIFY] Brevo is not configured. Email OTP delivery is disabled.");
      }
    } catch (mailError: any) {
      console.error("Verification email send failed on signup:", mailError?.message || mailError);
    }
    logDevOtp("EMAIL_VERIFY", { user: user.email, otp: verificationOtp });

    const token = generateToken(user.id, user.role);
    const safeUser = sanitizeUser(updatedUser || user);
      const payload: any = {
        token,
        user: safeUser,
        message: "Signup successful. Please verify your email.",
      };
      if (shouldExposeDevSecrets()) {
        payload.devEmailVerificationOtp = verificationOtp;
        payload.devEmailVerificationToken = verificationOtp;
      }

    return res.status(201).json(payload);
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
      const safeUser = sanitizeUser(user);
      res.json({ token, user: safeUser });
    } catch (err: any) {
      res.status(500).json({ message: getPublicErrorMessage(err, "Server error") });
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
          await storage.updateUserProfile(user.id, { googleId, avatarUrl: picture || null, emailVerified: true });
          user = await storage.getUserById(user.id);
        } else {
          let userToCreate = {
            username: (name || email.split("@")[0]).replace(/[^a-zA-Z0-9_]/g, "").slice(0, 20) || `user_${Date.now()}`,
            email,
            googleId,
            avatarUrl: picture,
          };

          for (let i = 0; i < 5; i++) {
            try {
              user = await storage.createGoogleUser(userToCreate);
              break; 
            } catch (err: any) {
              if (err?.code === "23505") { // Unique violation
                userToCreate.username = `${userToCreate.username.slice(0, 20)}_${Math.floor(Math.random() * 9999)}`;
              } else {
                throw err;
              }
            }
          }

        }
      }

      if (!user) return res.status(500).json({ message: "Failed to create account" });
      if (user.banned) return res.status(403).json({ message: "Account is banned" });

      const token = generateToken(user.id, user.role);
      const safeUser = sanitizeUser(user);
      res.json({ token, user: safeUser });
    } catch (err: any) {
      console.error("Google auth error:", err);
      res.status(500).json({ message: "Google authentication failed" });
    }
  });

  app.post("/api/auth/request-email-verification", authMiddleware, async (req, res) => {
    try {
      const userId = (req as any).userId;
      const user = await storage.getUserById(userId);
      if (!user) return res.status(404).json({ message: "User not found" });
      if (user.emailVerified) return res.json({ message: "Email already verified" });
      if (isOtpLocked(user.emailVerificationLockUntil)) {
        return res.status(429).json({
          message: `Too many invalid email OTP attempts. Try again in ${getOtpRetryAfterSec(user.emailVerificationLockUntil)}s.`,
        });
      }

      const requestQuota = consumeOtpRequestQuota(`email-verify:${user.email.toLowerCase()}`);
      if (!requestQuota.allowed) {
        return res.status(429).json({
          message: `Too many OTP requests. Try again in ${requestQuota.retryAfterSec}s.`,
        });
      }

      const verificationOtp = createEmailVerificationOtp();
      const verificationExpires = new Date(Date.now() + EMAIL_VERIFICATION_TTL_MS);
      await storage.updateUserProfile(userId, {
        emailVerificationToken: verificationOtp,
        emailVerificationExpires: verificationExpires,
        emailVerificationAttempts: 0,
        emailVerificationLockUntil: null,
      });

      if (isBrevoConfigured()) {
        await sendVerificationEmail({
          toEmail: user.email,
          username: user.username,
          otp: verificationOtp,
        });
      } else {
        console.warn("[EMAIL_VERIFY] Brevo is not configured. Email OTP delivery is disabled.");
      }
      logDevOtp("EMAIL_VERIFY", { user: user.email, otp: verificationOtp });

      const payload: any = { message: "Email verification OTP sent" };
      if (shouldExposeDevSecrets()) {
        payload.devEmailVerificationOtp = verificationOtp;
        payload.devEmailVerificationToken = verificationOtp;
      }
      res.json(payload);
    } catch (err: any) {
      res.status(500).json({ message: getPublicErrorMessage(err) });
    }
  });

  app.post("/api/auth/verify-email", authLimiter, async (req, res) => {
    try {
      const otpInput = typeof req.body?.otp === "string"
        ? req.body.otp.trim()
        : typeof req.body?.token === "string"
          ? req.body.token.trim()
          : "";
      if (!otpInput) return res.status(400).json({ message: "Email verification OTP is required" });

      const emailInput = normalizeEmail(req.body?.email);
      const user = emailInput
        ? await storage.getUserByEmail(emailInput)
        : await storage.getUserByEmailVerificationToken(otpInput);
      if (!user) return res.status(400).json({ message: "Invalid email verification OTP" });
      if (isOtpLocked(user.emailVerificationLockUntil)) {
        return res.status(429).json({
          message: `Too many invalid email OTP attempts. Try again in ${getOtpRetryAfterSec(user.emailVerificationLockUntil)}s.`,
        });
      }
      if (!user.emailVerificationToken || user.emailVerificationToken !== otpInput) {
        const fail = await registerOtpFailure(user, "email");
        if (fail.locked && fail.lockUntil) {
          return res.status(429).json({
            message: `Too many invalid email OTP attempts. Try again in ${getOtpRetryAfterSec(fail.lockUntil)}s.`,
          });
        }
        return res.status(400).json({
          message: `Invalid email verification OTP. ${fail.attemptsRemaining} attempt(s) left.`,
        });
      }
      if (!user.emailVerificationExpires || user.emailVerificationExpires.getTime() < Date.now()) {
        return res.status(400).json({ message: "Email verification OTP expired" });
      }

      const updated = await storage.updateUserProfile(user.id, {
        emailVerified: true,
        emailVerificationToken: null,
        emailVerificationExpires: null,
        emailVerificationAttempts: 0,
        emailVerificationLockUntil: null,
      });

      res.json({ message: "Email verified successfully", user: sanitizeUser(updated || user) });
    } catch (err: any) {
      res.status(500).json({ message: getPublicErrorMessage(err) });
    }
  });

  app.post("/api/auth/request-password-reset", authLimiter, async (req, res) => {
    try {
      const email = typeof req.body?.email === "string" ? req.body.email.trim() : "";
      if (!email) return res.status(400).json({ message: "Email is required" });

      const normalizedEmail = normalizeEmail(email);
      if (!normalizedEmail) return res.status(400).json({ message: "Enter a valid email" });
      const quotaKey = `password-reset:${normalizedEmail || email.toLowerCase()}`;
      const requestQuota = consumeOtpRequestQuota(quotaKey);
      if (!requestQuota.allowed) {
        return res.status(429).json({
          message: `Too many OTP requests. Try again in ${requestQuota.retryAfterSec}s.`,
        });
      }

      const user = await storage.getUserByEmail(normalizedEmail);
      if (!user) return res.json({ message: "If this email exists, a reset OTP has been sent." });
      if (isOtpLocked(user.passwordResetLockUntil)) {
        return res.status(429).json({
          message: `Too many invalid reset OTP attempts. Try again in ${getOtpRetryAfterSec(user.passwordResetLockUntil)}s.`,
        });
      }

      const resetOtp = createPasswordResetOtp();
      const resetExpires = new Date(Date.now() + PASSWORD_RESET_TTL_MS);
      await storage.updateUserProfile(user.id, {
        passwordResetToken: resetOtp,
        passwordResetExpires: resetExpires,
        passwordResetAttempts: 0,
        passwordResetLockUntil: null,
      });

      try {
        if (isBrevoConfigured()) {
          await sendPasswordResetEmail({
            toEmail: user.email,
            username: user.username,
            otp: resetOtp,
          });
        } else {
          console.warn("[PASSWORD_RESET] Brevo is not configured. Password reset OTP delivery is disabled.");
        }
      } catch (mailError: any) {
        // Keep generic success response to avoid email enumeration vectors.
        console.error("Password reset email send failed:", mailError?.message || mailError);
      }
      logDevOtp("PASSWORD_RESET", { user: normalizedEmail, otp: resetOtp });

      const payload: any = { message: "If this email exists, a reset OTP has been sent." };
      if (shouldExposeDevSecrets()) {
        payload.devPasswordResetOtp = resetOtp;
        payload.devPasswordResetToken = resetOtp;
      }
      res.json(payload);
    } catch (err: any) {
      res.status(500).json({ message: getPublicErrorMessage(err) });
    }
  });

  app.post("/api/auth/reset-password", authLimiter, async (req, res) => {
    try {
      const emailInput = normalizeEmail(req.body?.email);
      const otpInput = typeof req.body?.otp === "string"
        ? req.body.otp.trim()
        : typeof req.body?.token === "string"
          ? req.body.token.trim()
          : "";
      const newPassword = typeof req.body?.newPassword === "string" ? req.body.newPassword : "";
      if (!emailInput) return res.status(400).json({ message: "Email is required" });
      if (!otpInput) return res.status(400).json({ message: "Reset OTP is required" });
      if (!newPassword || newPassword.length < 6) {
        return res.status(400).json({ message: "New password must be at least 6 characters" });
      }

      const user = await storage.getUserByEmail(emailInput);
      if (!user) return res.status(400).json({ message: "Invalid reset OTP" });
      if (isOtpLocked(user.passwordResetLockUntil)) {
        return res.status(429).json({
          message: `Too many invalid reset OTP attempts. Try again in ${getOtpRetryAfterSec(user.passwordResetLockUntil)}s.`,
        });
      }
      if (!user.passwordResetToken || user.passwordResetToken !== otpInput) {
        const fail = await registerOtpFailure(user, "password");
        if (fail.locked && fail.lockUntil) {
          return res.status(429).json({
            message: `Too many invalid reset OTP attempts. Try again in ${getOtpRetryAfterSec(fail.lockUntil)}s.`,
          });
        }
        return res.status(400).json({
          message: `Invalid reset OTP. ${fail.attemptsRemaining} attempt(s) left.`,
        });
      }
      if (!user.passwordResetExpires || user.passwordResetExpires.getTime() < Date.now()) {
        return res.status(400).json({ message: "Reset OTP expired" });
      }

      const hashedPassword = await bcrypt.hash(newPassword, 10);
      await storage.updateUserProfile(user.id, {
        password: hashedPassword,
        passwordResetToken: null,
        passwordResetExpires: null,
        passwordResetAttempts: 0,
        passwordResetLockUntil: null,
      });

      res.json({ message: "Password reset successful" });
    } catch (err: any) {
      res.status(500).json({ message: getPublicErrorMessage(err) });
    }
  });

  app.post("/api/auth/request-phone-verification", authMiddleware, async (req, res) => {
    try {
      const userId = (req as any).userId;
      const user = await storage.getUserById(userId);
      if (!user) return res.status(404).json({ message: "User not found" });
      if (!user.phone) return res.status(400).json({ message: "Add phone number before verification" });
      if (user.phoneVerified) return res.json({ message: "Phone already verified" });
      if (isOtpLocked(user.phoneVerificationLockUntil)) {
        return res.status(429).json({
          message: `Too many invalid phone OTP attempts. Try again in ${getOtpRetryAfterSec(user.phoneVerificationLockUntil)}s.`,
        });
      }

      const requestQuota = consumeOtpRequestQuota(`phone-verify:${user.phone}`);
      if (!requestQuota.allowed) {
        return res.status(429).json({
          message: `Too many OTP requests. Try again in ${requestQuota.retryAfterSec}s.`,
        });
      }

      const otp = createPhoneOtp();
      const expires = new Date(Date.now() + PHONE_VERIFICATION_TTL_MS);
      await storage.updateUserProfile(userId, {
        phoneVerificationCode: otp,
        phoneVerificationExpires: expires,
        phoneVerificationAttempts: 0,
        phoneVerificationLockUntil: null,
      });

      // TODO: Integrate SMS provider to deliver OTP.
      logDevOtp("PHONE_VERIFY", { userId: user.id, phone: user.phone, otp });

      const payload: any = { message: "Phone verification code sent" };
      if (shouldExposeDevSecrets()) {
        payload.devPhoneOtp = otp;
      }
      res.json(payload);
    } catch (err: any) {
      res.status(500).json({ message: getPublicErrorMessage(err) });
    }
  });

  app.post("/api/auth/verify-phone", authMiddleware, async (req, res) => {
    try {
      const userId = (req as any).userId;
      const code = typeof req.body?.code === "string" ? req.body.code.trim() : "";
      if (!code) return res.status(400).json({ message: "Verification code is required" });

      const user = await storage.getUserById(userId);
      if (!user) return res.status(404).json({ message: "User not found" });
      if (!user.phone) return res.status(400).json({ message: "Phone number is missing" });
      if (isOtpLocked(user.phoneVerificationLockUntil)) {
        return res.status(429).json({
          message: `Too many invalid phone OTP attempts. Try again in ${getOtpRetryAfterSec(user.phoneVerificationLockUntil)}s.`,
        });
      }
      if (!user.phoneVerificationCode || user.phoneVerificationCode !== code) {
        const fail = await registerOtpFailure(user, "phone");
        if (fail.locked && fail.lockUntil) {
          return res.status(429).json({
            message: `Too many invalid phone OTP attempts. Try again in ${getOtpRetryAfterSec(fail.lockUntil)}s.`,
          });
        }
        return res.status(400).json({
          message: `Invalid verification code. ${fail.attemptsRemaining} attempt(s) left.`,
        });
      }
      if (!user.phoneVerificationExpires || user.phoneVerificationExpires.getTime() < Date.now()) {
        return res.status(400).json({ message: "Verification code expired" });
      }

      const updated = await storage.updateUserProfile(userId, {
        phoneVerified: true,
        phoneVerificationCode: null,
        phoneVerificationExpires: null,
        phoneVerificationAttempts: 0,
        phoneVerificationLockUntil: null,
      });

      res.json({ message: "Phone verified successfully", user: sanitizeUser(updated || user) });
    } catch (err: any) {
      res.status(500).json({ message: getPublicErrorMessage(err) });
    }
  });

  app.patch("/api/users/contact", authMiddleware, async (req, res) => {
    try {
      const userId = (req as any).userId;
      const currentUser = await storage.getUserById(userId);
      if (!currentUser) return res.status(404).json({ message: "User not found" });

      const hasEmailInput = Object.prototype.hasOwnProperty.call(req.body ?? {}, "email");
      const hasPhoneInput = Object.prototype.hasOwnProperty.call(req.body ?? {}, "phone");
      if (!hasEmailInput && !hasPhoneInput) {
        return res.status(400).json({ message: "Provide email and/or phone to update" });
      }

      const updates: any = {};
      let emailChanged = false;
      let phoneChanged = false;
      let verificationOtp: string | null = null;

      if (hasEmailInput) {
        const nextEmail = normalizeEmail(req.body?.email);
        if (!nextEmail) {
          return res.status(400).json({ message: "Enter a valid email address" });
        }
        if (nextEmail !== currentUser.email.toLowerCase()) {
          const existing = await storage.getUserByEmail(nextEmail);
          if (existing && existing.id !== userId) {
            return res.status(400).json({ message: "Email already registered" });
          }
          verificationOtp = createEmailVerificationOtp();
          updates.email = nextEmail;
          updates.emailVerified = false;
          updates.emailVerificationToken = verificationOtp;
          updates.emailVerificationExpires = new Date(Date.now() + EMAIL_VERIFICATION_TTL_MS);
          updates.emailVerificationAttempts = 0;
          updates.emailVerificationLockUntil = null;
          updates.emailChangedAt = new Date();
          emailChanged = true;
        }
      }

      if (hasPhoneInput) {
        const rawPhone = req.body?.phone;
        const nextPhone = rawPhone === null || (typeof rawPhone === "string" && !rawPhone.trim())
          ? null
          : normalizePhone(rawPhone);
        if (rawPhone !== null && !(typeof rawPhone === "string" && !rawPhone.trim()) && !nextPhone) {
          return res.status(400).json({ message: "Enter a valid phone number" });
        }

        const currentPhone = currentUser.phone ?? null;
        if (nextPhone !== currentPhone) {
          updates.phone = nextPhone;
          updates.phoneVerified = false;
          updates.phoneVerificationCode = null;
          updates.phoneVerificationExpires = null;
          updates.phoneVerificationAttempts = 0;
          updates.phoneVerificationLockUntil = null;
          updates.phoneChangedAt = new Date();
          phoneChanged = true;
        }
      }

      if (!emailChanged && !phoneChanged) {
        return res.json({ message: "No contact changes detected", user: sanitizeUser(currentUser) });
      }

      const withdrawalLockUntil = new Date(Date.now() + WITHDRAWAL_COOLDOWN_MS);
      updates.withdrawalLockUntil = withdrawalLockUntil;
      const updated = await storage.updateUserProfile(userId, updates);
      if (!updated) return res.status(404).json({ message: "User not found" });

      if (verificationOtp) {
        try {
          if (isBrevoConfigured()) {
            await sendVerificationEmail({
              toEmail: updated.email,
              username: updated.username,
              otp: verificationOtp,
            });
          } else {
            console.warn("[EMAIL_VERIFY] Brevo is not configured. Email OTP delivery is disabled.");
          }
        } catch (mailError: any) {
          console.error("Verification email send failed after contact update:", mailError?.message || mailError);
        }
        logDevOtp("EMAIL_VERIFY", { user: updated.email, otp: verificationOtp });
      }

      if ((emailChanged || phoneChanged) && isBrevoConfigured()) {
        try {
          await sendContactSecurityAlert({
            toEmail: currentUser.email,
            username: currentUser.username,
            changedEmail: emailChanged,
            changedPhone: phoneChanged,
            withdrawalLockUntil,
          });
        } catch (mailError: any) {
          console.error("Contact security alert send failed:", mailError?.message || mailError);
        }
      }

      const payload: any = {
        message: "Contact details updated. Withdrawals are temporarily locked for security.",
        user: sanitizeUser(updated),
      };
      if (verificationOtp && shouldExposeDevSecrets()) {
        payload.devEmailVerificationOtp = verificationOtp;
        payload.devEmailVerificationToken = verificationOtp;
      }

      res.json(payload);
    } catch (err: any) {
      res.status(500).json({ message: getPublicErrorMessage(err) });
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
      const validStatuses = new Set(["hot", "upcoming", "live", "completed", "cancelled"]);
      const statusFilter = statusFilterRaw
        .split(",")
        .map((s) => s.trim().toLowerCase())
        .filter((s) => validStatuses.has(s));

      const tournaments = await storage.getAllTournaments();
      let joinedTournamentIds = new Set<number>();
      if (Number.isInteger(userId) && userId > 0) {
        try {
          const registrations = await storage.getRegistrationsByUser(userId);
          joinedTournamentIds = new Set(
            registrations
              .map((r) => Number(r.tournamentId))
              .filter((id) => Number.isInteger(id) && id > 0)
          );
        } catch (err) {
          console.error("Failed to load user registrations for tournament list:", err);
        }
      }

      const filteredTournaments = tournaments.filter((t) => {
        const titleValue = typeof t.title === "string" ? t.title : "";
        const rawStatus = String(t.status ?? "").toLowerCase().trim();
        const normalizedStatus = validStatuses.has(rawStatus) ? rawStatus : "upcoming";
        const statusMatches = statusFilter.length === 0 || statusFilter.includes(normalizedStatus);
        const searchMatches = !searchRaw || titleValue.toLowerCase().includes(searchRaw);
        return statusMatches && searchMatches;
      });

      const result = filteredTournaments
        .filter((t) => Number.isInteger(t.id) && t.id > 0)
        .map((t) => {
          const isJoined = joinedTournamentIds.has(t.id);
          const rawStatus = String(t.status ?? "").toLowerCase().trim();
          const normalizedStatus = validStatuses.has(rawStatus) ? rawStatus : "upcoming";
          const canSeeRoom =
            userRole === "admin" ||
            userRole === "host" ||
            (isJoined && normalizedStatus === "live");

          return {
            ...t,
            title: typeof t.title === "string" ? t.title : "Untitled Tournament",
            entryFee: Number.isFinite(t.entryFee) ? t.entryFee : 0,
            maxSlots: Number.isFinite(t.maxSlots) && t.maxSlots > 0 ? t.maxSlots : 1,
            filledSlots: Number.isFinite(t.filledSlots) && t.filledSlots >= 0 ? t.filledSlots : 0,
            prizePool: getAutoScaledPrizePoolValue({
              status: normalizedStatus,
              prizePool: t.prizePool,
              filledSlots: t.filledSlots,
              maxSlots: t.maxSlots,
            }),
            status: normalizedStatus,
            roomId: canSeeRoom ? t.roomId : null,
            roomPassword: canSeeRoom ? t.roomPassword : null,
          };
        });

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
      if (Number.isInteger(userId) && userId > 0) {
        try {
          const reg = await storage.getRegistration(userId, tournamentId);
          isJoined = !!reg;
        } catch (err) {
          console.error("Tournament registration lookup error:", err);
        }
      }

      // ✅ FINAL ACCESS RULE
      const rawStatus = String(t.status ?? "").toLowerCase().trim();
      const normalizedStatus =
        ["hot", "upcoming", "live", "completed", "cancelled"].includes(rawStatus)
          ? rawStatus
          : "upcoming";

      const canSeeRoom =
        userRole === "admin" ||
        userRole === "host" ||
        (isJoined && normalizedStatus === "live");

      res.json({
        ...t,
        title: typeof t.title === "string" ? t.title : "Untitled Tournament",
        entryFee: Number.isFinite(t.entryFee) ? t.entryFee : 0,
        maxSlots: Number.isFinite(t.maxSlots) && t.maxSlots > 0 ? t.maxSlots : 1,
        filledSlots: Number.isFinite(t.filledSlots) && t.filledSlots >= 0 ? t.filledSlots : 0,
        prizePool: getAutoScaledPrizePoolValue({
          status: normalizedStatus,
          prizePool: t.prizePool,
          filledSlots: t.filledSlots,
          maxSlots: t.maxSlots,
        }),
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
        const team = r.teamId ? await storage.getTeamById(r.teamId) : null;
        return {
          ...r,
          username: user?.username,
          displayName: r.inGameName || user?.username,
          teamName: team?.name || null,
        };
      })
    );

    res.json(enriched);
  } catch (err: any) {
    res.status(500).json({ message: err.message });
  }
});

  // 🔓 Public: Total registered users (email + Google)
app.post(
  "/api/admin/tournaments/:id/results/extract",
  authMiddleware,
  staffMiddleware,
  uploadMemory.single("screenshot"),
  async (req, res) => {
    try {
      const tournamentId = Number(req.params.id);
      if (!Number.isInteger(tournamentId) || tournamentId <= 0) {
        return res.status(400).json({ message: "Invalid tournament id" });
      }
      if (!req.file) {
        return res.status(400).json({ message: "Result screenshot is required" });
      }

      const tournament = await storage.getTournamentById(tournamentId);
      if (!tournament) {
        return res.status(404).json({ message: "Tournament not found" });
      }

      const regs = await storage.getRegistrationsByTournament(tournamentId);
      const participants = await Promise.all(
        regs.map(async (reg) => {
          const user = await storage.getUserById(reg.userId);
          return {
            userId: Number(reg.userId),
            displayName: String(reg.inGameName || user?.username || `Player #${reg.userId}`),
            username: String(user?.username || ""),
          };
        }),
      );

      const rawText = await extractTextFromImage({
        buffer: req.file.buffer,
        mimetype: req.file.mimetype,
        originalname: req.file.originalname,
      });
      const parsedRows = parseBgmiRowsFromText(rawText);
      if (parsedRows.length === 0) {
        return res.status(422).json({
          message: "Could not detect rank/name/kills from screenshot. Try a clearer image.",
          rawText: rawText.slice(0, 4000),
        });
      }

      const rows = parsedRows.map((row) => {
        let bestMatch: { userId: number; displayName: string; score: number } | null = null;
        for (const participant of participants) {
          const scoreByDisplayName = computeNameSimilarityScore(row.detectedName, participant.displayName);
          const scoreByUsername = computeNameSimilarityScore(row.detectedName, participant.username);
          const score = Math.max(scoreByDisplayName, scoreByUsername);
          if (!bestMatch || score > bestMatch.score) {
            bestMatch = {
              userId: participant.userId,
              displayName: participant.displayName,
              score,
            };
          }
        }

        const matched = bestMatch && bestMatch.score >= 0.52 ? bestMatch : null;
        return {
          slNo: row.slNo,
          detectedName: row.detectedName,
          rank: row.rank,
          kills: row.kills,
          matchedUserId: matched?.userId || null,
          matchedDisplayName: matched?.displayName || null,
          confidence: matched ? Number((matched.score * 100).toFixed(1)) : 0,
        };
      });

      res.json({
        rows,
        rawText: rawText.slice(0, 4000),
        participantsCount: participants.length,
      });
    } catch (err: any) {
      res.status(500).json({ message: err.message || "Failed to extract results from screenshot" });
    }
  },
);

app.get("/api/leaderboard", async (req, res) => {
  try {
    const limitRaw = Number(req.query.limit);
    const limit = Number.isInteger(limitRaw) ? Math.min(Math.max(limitRaw, 1), 100) : 50;

    const [allUsers, allTournaments] = await Promise.all([
      storage.getAllUsers(),
      storage.getAllTournaments(),
    ]);
    const usernameById = new Map<number, string>(
      allUsers.map((user) => [Number(user.id), user.username || `User #${user.id}`]),
    );

    const leaderboard = new Map<
      number,
      { userId: number; username: string; totalPrize: number; totalKills: number; wins: number; podiums: number; tournamentsPlayed: number }
    >();

    for (const tournament of allTournaments) {
      if (getTournamentStatusValue(tournament.status) !== "completed") continue;
      const rows = await storage.getResultsByTournament(Number(tournament.id));
      for (const row of rows) {
        const userId = Number(row.userId);
        if (!Number.isInteger(userId) || userId <= 0) continue;

        const current = leaderboard.get(userId) || {
          userId,
          username: usernameById.get(userId) || `User #${userId}`,
          totalPrize: 0,
          totalKills: 0,
          wins: 0,
          podiums: 0,
          tournamentsPlayed: 0,
        };

        current.totalPrize += Number(row.prize || 0);
        current.totalKills += Number(row.kills || 0);
        current.tournamentsPlayed += 1;
        if (Number(row.position) === 1) current.wins += 1;
        if (Number(row.position) > 0 && Number(row.position) <= 3) current.podiums += 1;
        leaderboard.set(userId, current);
      }
    }

    const ranked = Array.from(leaderboard.values())
      .sort((a, b) => {
        if (b.totalPrize !== a.totalPrize) return b.totalPrize - a.totalPrize;
        if (b.wins !== a.wins) return b.wins - a.wins;
        if (b.totalKills !== a.totalKills) return b.totalKills - a.totalKills;
        return a.userId - b.userId;
      })
      .slice(0, limit)
      .map((entry, index) => ({ ...entry, rank: index + 1 }));

    res.json(ranked);
  } catch (err: any) {
    res.status(500).json({ message: err.message });
  }
});

app.get("/api/leaderboard/:userId/analytics", async (req, res) => {
  try {
    const userId = Number(req.params.userId);
    if (!Number.isInteger(userId) || userId <= 0) {
      return res.status(400).json({ message: "Invalid user id" });
    }

    const [allUsers, allTournaments] = await Promise.all([
      storage.getAllUsers(),
      storage.getAllTournaments(),
    ]);

    const usernameById = new Map<number, string>(
      allUsers.map((user) => [Number(user.id), user.username || `User #${user.id}`]),
    );

    const completedTournaments = allTournaments
      .filter((tournament) => getTournamentStatusValue(tournament.status) === "completed")
      .sort((a, b) => new Date(a.startTime).getTime() - new Date(b.startTime).getTime());

    const bucketLabels = ["00-03", "04-07", "08-11", "12-15", "16-19", "20-23"];
    const dayLabels = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];

    const playedMatches: Array<{
      tournamentId: number;
      title: string;
      startTime: string;
      kills: number;
      position: number;
      prize: number;
    }> = [];
    const heatmapBuckets = new Map<string, { day: number; bucket: number; matches: number; wins: number; kills: number; score: number }>();

    for (const tournament of completedTournaments) {
      const rows = await storage.getResultsByTournament(Number(tournament.id));
      const row = rows.find((entry) => Number(entry.userId) === userId);
      if (!row) continue;

      const kills = Math.max(0, Number(row.kills || 0));
      const position = Math.max(1, Number(row.position || 0));
      const prize = Math.max(0, Number(row.prize || 0));
      const start = new Date(tournament.startTime);
      const isValidDate = !Number.isNaN(start.getTime());
      const day = isValidDate ? start.getDay() : 0;
      const bucket = isValidDate ? Math.max(0, Math.min(5, Math.floor(start.getHours() / 4))) : 0;
      const winBonus = position === 1 ? 5 : position <= 3 ? 2 : 0;
      const score = kills + winBonus;
      const key = `${day}-${bucket}`;

      const existing = heatmapBuckets.get(key) || {
        day,
        bucket,
        matches: 0,
        wins: 0,
        kills: 0,
        score: 0,
      };
      existing.matches += 1;
      existing.kills += kills;
      existing.score += score;
      if (position === 1) existing.wins += 1;
      heatmapBuckets.set(key, existing);

      playedMatches.push({
        tournamentId: Number(tournament.id),
        title: tournament.title,
        startTime: isValidDate ? start.toISOString() : new Date(0).toISOString(),
        kills,
        position,
        prize,
      });
    }

    playedMatches.sort((a, b) => new Date(a.startTime).getTime() - new Date(b.startTime).getTime());

    const matchesPlayed = playedMatches.length;
    const wins = playedMatches.filter((match) => match.position === 1).length;
    const podiums = playedMatches.filter((match) => match.position > 0 && match.position <= 3).length;
    const totalKills = playedMatches.reduce((sum, match) => sum + match.kills, 0);
    const totalPrize = playedMatches.reduce((sum, match) => sum + match.prize, 0);
    const winRate = matchesPlayed > 0 ? (wins / matchesPlayed) * 100 : 0;
    const avgKills = matchesPlayed > 0 ? totalKills / matchesPlayed : 0;

    let runningWins = 0;
    let runningKills = 0;

    const winTrend = playedMatches.map((match, index) => {
      if (match.position === 1) runningWins += 1;
      const played = index + 1;
      return {
        match: played,
        label: `M${played}`,
        date: match.startTime,
        winRate: Number(((runningWins / played) * 100).toFixed(2)),
        won: match.position === 1 ? 1 : 0,
      };
    });

    const killsTrend = playedMatches.map((match, index) => {
      runningKills += match.kills;
      const played = index + 1;
      return {
        match: played,
        label: `M${played}`,
        date: match.startTime,
        kills: match.kills,
        avgKills: Number((runningKills / played).toFixed(2)),
      };
    });

    let maxScore = 0;
    heatmapBuckets.forEach((bucket) => {
      if (bucket.score > maxScore) maxScore = bucket.score;
    });

    const heatmap: Array<{
      day: number;
      dayLabel: string;
      bucket: number;
      bucketLabel: string;
      matches: number;
      wins: number;
      kills: number;
      score: number;
      intensity: number;
    }> = [];

    for (let day = 0; day < dayLabels.length; day += 1) {
      for (let bucket = 0; bucket < bucketLabels.length; bucket += 1) {
        const value = heatmapBuckets.get(`${day}-${bucket}`);
        const score = value?.score || 0;
        heatmap.push({
          day,
          dayLabel: dayLabels[day],
          bucket,
          bucketLabel: bucketLabels[bucket],
          matches: value?.matches || 0,
          wins: value?.wins || 0,
          kills: value?.kills || 0,
          score,
          intensity: maxScore > 0 ? Number((score / maxScore).toFixed(4)) : 0,
        });
      }
    }

    res.json({
      userId,
      username: usernameById.get(userId) || `User #${userId}`,
      summary: {
        matchesPlayed,
        wins,
        podiums,
        totalKills,
        totalPrize,
        winRate: Number(winRate.toFixed(2)),
        avgKills: Number(avgKills.toFixed(2)),
      },
      dayLabels,
      bucketLabels,
      winTrend,
      killsTrend,
      heatmap,
    });
  } catch (err: any) {
    res.status(500).json({ message: err.message });
  }
});

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

      if (!(await requireVerifiedEmail(userId, res))) return;

      const tournament = await storage.getTournamentById(tournamentId);
      if (!tournament) return res.status(404).json({ message: "Tournament not found" });

      const inGameName = typeof req.body?.inGameName === "string" ? req.body.inGameName.trim() : undefined;
      const couponCode = typeof req.body?.couponCode === "string" ? req.body.couponCode.trim().toUpperCase() : "";
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
        couponCode: couponCode || undefined,
      });

      if (getTournamentStatusValue(tournament.status) !== "live" && getTournamentStatusValue(joined.tournament.status) === "live") {
        await notifyTournamentLive(joined.tournament, "full_slots");
      } else {
        broadcastTournamentUpdate(joined.tournament, "slot_filled");
      }

      res.json({ message: "Joined successfully", user: sanitizeUser(joined.user) });
    } catch (err: any) {
      if (err?.code === "TOURNAMENT_NOT_FOUND") return res.status(404).json({ message: err.message });
      if (err?.code === "TOURNAMENT_CLOSED") return res.status(400).json({ message: err.message });
      if (err?.code === "TOURNAMENT_FULL") return res.status(400).json({ message: err.message });
      if (err?.code === "ALREADY_REGISTERED") return res.status(400).json({ message: err.message });
      if (err?.code === "USER_NOT_FOUND") return res.status(404).json({ message: err.message });
      if (err?.code === "USER_BANNED") return res.status(403).json({ message: err.message });
      if (err?.code === "INSUFFICIENT_BALANCE") return res.status(400).json({ message: err.message });
      if (err?.code === "INVALID_COUPON") return res.status(400).json({ message: err.message });
      if (err?.code === "COUPON_EXPIRED") return res.status(400).json({ message: err.message });
      if (err?.code === "COUPON_LIMIT_REACHED") return res.status(400).json({ message: err.message });
      if (err?.code === "COUPON_USER_LIMIT_REACHED") return res.status(400).json({ message: err.message });
      if (err?.code === "COUPON_NOT_APPLICABLE") return res.status(400).json({ message: err.message });
      if (err?.code === "COUPON_MIN_ENTRY_NOT_MET") return res.status(400).json({ message: err.message });
      if (err?.code === "COUPON_FRAUD_BLOCKED") return res.status(403).json({ message: err.message });
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

      return res.json({ user: sanitizeUser(user) });
    }

    const updated = await storage.updateUserProfile(userId, updates);
    if (!updated) return res.status(404).json({ message: "User not found" });

    res.json({ user: sanitizeUser(updated) });
  } catch (err: any) {
    res.status(500).json({ message: err.message });
  }
});

  app.get("/api/host/application/my", authMiddleware, async (req, res) => {
    try {
      const userId = Number((req as any).userId);
      const application = await storage.getLatestHostApplicationByUser(userId);
      res.json(application || null);
    } catch (err: any) {
      res.status(500).json({ message: err.message });
    }
  });

  app.post("/api/host/application", authMiddleware, async (req, res) => {
    try {
      const userId = Number((req as any).userId);
      const user = await storage.getUserById(userId);
      if (!user) return res.status(404).json({ message: "User not found" });
      if (user.role === "host" || user.role === "admin") {
        return res.status(400).json({ message: "You already have elevated access." });
      }

      const latest = await storage.getLatestHostApplicationByUser(userId);
      if (latest && (latest.status === "pending" || latest.status === "in_review")) {
        return res.status(400).json({ message: "You already have an active host application." });
      }

      const payload = {
        fullName: typeof req.body?.fullName === "string" ? req.body.fullName.trim() : "",
        contactNumber: typeof req.body?.contactNumber === "string" ? req.body.contactNumber.trim() : "",
        platform: typeof req.body?.platform === "string" ? req.body.platform.trim() : "",
        channelName: typeof req.body?.channelName === "string" ? req.body.channelName.trim() : "",
        channelUrl:
          typeof req.body?.channelUrl === "string" && req.body.channelUrl.trim().length > 0
            ? req.body.channelUrl.trim()
            : null,
        socialFollowers: Number.isFinite(Number(req.body?.socialFollowers))
          ? Math.max(0, Math.round(Number(req.body?.socialFollowers)))
          : 0,
        experience: typeof req.body?.experience === "string" ? req.body.experience.trim() : "",
      };

      const parsed = insertHostApplicationSchema.safeParse(payload);
      if (!parsed.success) {
        return res.status(400).json({
          message: parsed.error.errors[0]?.message || "Invalid host application payload",
        });
      }

      const created = await storage.createHostApplication({
        userId,
        ...parsed.data,
      });

      await storage.createNotification({
        userId,
        type: "general",
        title: "Host Application Submitted",
        message: "Your host/youtuber request was submitted and is now under review.",
      });

      broadcastAdminUpdate({
        entity: "host_application",
        action: "create",
        targetId: Number(created.id),
      });
      res.status(201).json(created);
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
      const amount = parsePaisaAmount(req.body?.amount);
      if (amount == null || amount <= 0 || amount > 10000000) {
        return res.status(400).json({ message: "Invalid amount. Must be a positive integer amount in paise." });
      }

      const idempotencyKey = getIdempotencyCacheKey(req, "wallet_add", userId);
      if (idempotencyKey === "__invalid__") {
        return res.status(400).json({ message: "Invalid Idempotency-Key header" });
      }
      if (idempotencyKey && replayIdempotentResponse(idempotencyKey, res)) {
        return;
      }

      const beforeUser = await storage.getUserById(userId);
      if (!beforeUser) return res.status(404).json({ message: "User not found" });
      const updatedUser = await storage.updateWalletBalance(userId, amount);
      if (!updatedUser) return res.status(400).json({ message: "Wallet update failed" });
      await storage.createTransaction({
        userId,
        amount,
        type: "deposit",
        walletType: "main",
        mainBalanceBefore: beforeUser.mainWalletBalance || 0,
        mainBalanceAfter: updatedUser.mainWalletBalance || 0,
        bonusBalanceBefore: beforeUser.bonusWalletBalance || 0,
        bonusBalanceAfter: updatedUser.bonusWalletBalance || 0,
        metadata: { source: "manual_topup" },
        description: "Wallet deposit",
      });

      const payload = { user: sanitizeUser(updatedUser), message: "Money added successfully" };
      if (idempotencyKey) {
        cacheIdempotentResponse(idempotencyKey, 200, payload);
      }
      res.json(payload);
    } catch (err: any) {
      res.status(500).json({ message: getPublicErrorMessage(err) });
    }
  });

  app.post("/api/wallet/redeem-coupon", authMiddleware, async (req, res) => {
    try {
      const userId = (req as any).userId;
      const rawCode = req.body?.code;
      const code = typeof rawCode === "string" ? rawCode.trim() : "";
      if (!code) {
        return res.status(400).json({ message: "Coupon code is required" });
      }

      const redeemed = await storage.redeemCoupon(userId, code, { context: "wallet" });
      const message =
        redeemed.bonusAmount > 0
          ? `Coupon redeemed. Rs.${(redeemed.bonusAmount / 100).toFixed(2)} credited to bonus wallet.`
          : `Coupon applied successfully.`;
      res.json({
        user: sanitizeUser(redeemed.user),
        coupon: redeemed.coupon,
        amount: redeemed.amount,
        discountAmount: redeemed.discountAmount,
        bonusAmount: redeemed.bonusAmount,
        message,
      });
    } catch (err: any) {
      if (err?.code === "INVALID_COUPON") return res.status(400).json({ message: err.message });
      if (err?.code === "COUPON_EXPIRED") return res.status(400).json({ message: err.message });
      if (err?.code === "COUPON_LIMIT_REACHED") return res.status(400).json({ message: err.message });
      if (err?.code === "COUPON_USER_LIMIT_REACHED") return res.status(400).json({ message: err.message });
      if (err?.code === "COUPON_NOT_APPLICABLE") return res.status(400).json({ message: err.message });
      if (err?.code === "COUPON_CONDITION_FAILED") return res.status(400).json({ message: err.message });
      if (err?.code === "COUPON_FRAUD_BLOCKED") return res.status(403).json({ message: err.message });
      if (err?.code === "USER_NOT_FOUND") return res.status(404).json({ message: err.message });
      res.status(500).json({ message: getPublicErrorMessage(err) });
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
      const amount = parsePaisaAmount(req.body?.amount);
      if (amount == null || amount < 100 || amount > 10000000) {
        return res.status(400).json({ message: "Amount must be between 1 and 100000 rupees" });
      }

      const idempotencyKey = getIdempotencyCacheKey(req, "payments_create_order", userId);
      if (idempotencyKey === "__invalid__") {
        return res.status(400).json({ message: "Invalid Idempotency-Key header" });
      }
      if (idempotencyKey && replayIdempotentResponse(idempotencyKey, res)) {
        return;
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

      const payload = {
        orderId: order.id,
        amount: amount,
        currency: "INR",
        keyId: keyId,
      };
      if (idempotencyKey) {
        cacheIdempotentResponse(idempotencyKey, 200, payload);
      }
      res.json(payload);
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

      if (!signaturesMatch(expectedSignature, String(razorpay_signature))) {
        return res.status(400).json({ message: "Invalid payment signature" });
      }

      const payment = await storage.getPaymentByOrderId(razorpay_order_id);
      if (!payment) return res.status(404).json({ message: "Payment order not found" });
      if (payment.userId !== userId) return res.status(403).json({ message: "Unauthorized" });

      const capturedPayment = await storage.markPaymentCapturedByOrderId(razorpay_order_id, {
        razorpayPaymentId: razorpay_payment_id,
        razorpaySignature: razorpay_signature,
      });
      const paymentForCredit = capturedPayment || payment;
      const creditResult = await ensurePaymentWalletCredit(
        {
          userId: paymentForCredit.userId,
          amount: paymentForCredit.amount,
          razorpayOrderId: paymentForCredit.razorpayOrderId,
        },
        {
          source: "razorpay_verify",
          paymentId: razorpay_payment_id,
        },
      );

      if (!creditResult.user) {
        return res.status(404).json({ message: "User not found" });
      }

      res.json({
        message: creditResult.credited ? "Payment verified successfully" : "Payment already verified",
        user: sanitizeUser(creditResult.user),
      });
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

      if (!signaturesMatch(expectedSignature, String(signature))) {
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
          const paymentForCredit = payment || (await storage.getPaymentByOrderId(orderId));
          if (paymentForCredit) {
            await ensurePaymentWalletCredit(
              {
                userId: paymentForCredit.userId,
                amount: paymentForCredit.amount,
                razorpayOrderId: paymentForCredit.razorpayOrderId,
              },
              {
                source: "razorpay_webhook",
                paymentId,
              },
            );
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
      res.status(500).json({ message: getPublicErrorMessage(err) });
    }
  });

  app.get("/api/transactions/my", authMiddleware, async (req, res) => {
    try {
      const txs = await storage.getTransactionsByUser((req as any).userId);
      res.json(txs);
    } catch (err: any) {
      res.status(500).json({ message: getPublicErrorMessage(err) });
    }
  });

  app.get("/api/users/loyalty", authMiddleware, async (req, res) => {
    try {
      const userId = (req as any).userId;
      const profile = await storage.getUserLoyaltyProfile(userId);
      res.json({
        ...profile,
        tierLabel: getTierBadge(profile.tier),
      });
    } catch (err: any) {
      res.status(500).json({ message: getPublicErrorMessage(err) });
    }
  });

  // Withdrawals
  app.post("/api/withdrawals", authMiddleware, async (req, res) => {
    try {
      const userId = (req as any).userId;
      const amount = parsePaisaAmount(req.body?.amount);
      const upiId = req.body?.upiId;
      const bankDetails = req.body?.bankDetails;
      if (amount == null || amount < 5000) {
        return res.status(400).json({ message: "Minimum withdrawal is \u20B950" });
      }

      const idempotencyKey = getIdempotencyCacheKey(req, "withdrawals_create", userId);
      if (idempotencyKey === "__invalid__") {
        return res.status(400).json({ message: "Invalid Idempotency-Key header" });
      }
      if (idempotencyKey && replayIdempotentResponse(idempotencyKey, res)) {
        return;
      }

      const user = await requireWithdrawalEligibility(userId, res);
      if (!user) return;
      if ((user.mainWalletBalance || 0) < amount) {
        return res.status(400).json({ message: "Insufficient withdrawable balance" });
      }
      const loyaltyProfile = await storage.getUserLoyaltyProfile(userId);
      const feePercent = Math.max(0, Number(loyaltyProfile.benefits.platformFeePercent || 0));
      const platformFee = Math.round((amount * feePercent) / 100);
      const netAmount = Math.max(0, amount - platformFee);
      if (netAmount <= 0) {
        return res.status(400).json({ message: "Withdrawal amount is too low after platform fee" });
      }

      const dayStart = new Date();
      dayStart.setHours(0, 0, 0, 0);
      const dayEnd = new Date(dayStart);
      dayEnd.setDate(dayEnd.getDate() + 1);

      const withdrawnToday = await storage.getUserWithdrawalTotalForDay(userId, dayStart, dayEnd);
      if (withdrawnToday + amount > DAILY_WITHDRAWAL_LIMIT_PAISA) {
        return res.status(400).json({
          message: `Daily withdrawal limit exceeded. Limit: \u20B9${(DAILY_WITHDRAWAL_LIMIT_PAISA / 100).toFixed(0)}`,
        });
      }

      const updatedUser = await storage.updateWalletBalance(userId, -amount);
      if (!updatedUser) return res.status(400).json({ message: "Insufficient withdrawable balance" });
      await storage.createTransaction({
        userId,
        amount,
        type: "withdrawal",
        walletType: "main",
        mainBalanceBefore: user.mainWalletBalance || 0,
        mainBalanceAfter: updatedUser.mainWalletBalance || 0,
        bonusBalanceBefore: user.bonusWalletBalance || 0,
        bonusBalanceAfter: updatedUser.bonusWalletBalance || 0,
        metadata: {
          source: "withdrawal_request",
          dailyWithdrawnBefore: withdrawnToday,
          platformFee,
          netAmount,
          feePercent,
          loyaltyTier: loyaltyProfile.tier,
        },
        description: `Withdrawal request (tier ${getTierBadge(loyaltyProfile.tier)}, fee ${feePercent}%)`,
      });

      const wd = await storage.createWithdrawal({
        userId,
        amount,
        platformFee,
        netAmount,
        feePercent,
        loyaltyTier: loyaltyProfile.tier,
        upiId,
        bankDetails,
      });
      const payload = {
        ...wd,
        user: sanitizeUser(updatedUser),
        dailyLimit: DAILY_WITHDRAWAL_LIMIT_PAISA,
        dailyUsed: withdrawnToday + amount,
        loyalty: {
          tier: loyaltyProfile.tier,
          tierLabel: getTierBadge(loyaltyProfile.tier),
          feePercent,
          platformFee,
          netAmount,
        },
      };
      if (idempotencyKey) {
        cacheIdempotentResponse(idempotencyKey, 200, payload);
      }
      res.json(payload);
    } catch (err: any) {
      res.status(500).json({ message: getPublicErrorMessage(err) });
    }
  });

  app.get("/api/withdrawals/my", authMiddleware, async (req, res) => {
    try {
      const wds = await storage.getWithdrawalsByUser((req as any).userId);
      res.json(wds);
    } catch (err: any) {
      res.status(500).json({ message: getPublicErrorMessage(err) });
    }
  });

  // Disputes
  app.post("/api/disputes", authMiddleware, upload.single("screenshot"), async (req, res) => {
    try {
      const userId = (req as any).userId;
      if (!req.file) {
        return res.status(400).json({ message: "Evidence screenshot is required" });
      }

      const tournamentRef =
        typeof req.body?.tournamentRef === "string" ? req.body.tournamentRef.trim() : "";
      const rawTournamentId = /^\d+$/.test(tournamentRef) ? Number(tournamentRef) : null;
      const payload = {
        reportType: typeof req.body?.reportType === "string" ? req.body.reportType.trim().toLowerCase() : "hacker",
        accusedGameName: typeof req.body?.accusedGameName === "string" ? req.body.accusedGameName.trim() : "",
        tournamentRef,
        tournamentId: Number.isInteger(rawTournamentId) && rawTournamentId! > 0 ? rawTournamentId : null,
        description: typeof req.body?.description === "string" ? req.body.description.trim() : "",
      };
      const parsed = insertDisputeSchema.safeParse(payload);
      if (!parsed.success) {
        return res.status(400).json({ message: parsed.error.errors[0]?.message || "Invalid dispute payload" });
      }

      const screenshotUrl = `/uploads/${req.file.filename}`;
      const dispute = await storage.createDispute({
        userId,
        reportType: parsed.data.reportType || "hacker",
        accusedGameName: parsed.data.accusedGameName,
        tournamentRef: parsed.data.tournamentRef,
        tournamentId: parsed.data.tournamentId ?? null,
        description: parsed.data.description,
        screenshotUrl,
      });

      await storage.createDisputeLog({
        disputeId: dispute.id,
        actorUserId: userId,
        actorRole: "user",
        action: "created",
        note: `Ticket opened (${dispute.reportType})`,
      });

      res.status(201).json(dispute);
    } catch (err: any) {
      res.status(500).json({ message: err.message });
    }
  });

  app.get("/api/disputes/my", authMiddleware, async (req, res) => {
    try {
      const userId = (req as any).userId;
      const myDisputes = await storage.getDisputesByUser(userId);
      res.json(myDisputes);
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
      const safe = all.map((item) => sanitizeUser(item));
      res.json(safe);
    } catch (err: any) {
      res.status(500).json({ message: err.message });
    }
  });

  app.get("/api/admin/host-applications", authMiddleware, adminMiddleware, async (_req, res) => {
    try {
      const applications = await storage.getHostApplications();
      res.json(applications);
    } catch (err: any) {
      res.status(500).json({ message: err.message });
    }
  });

  app.patch("/api/admin/host-applications/:id", authMiddleware, adminMiddleware, async (req, res) => {
    try {
      const applicationId = Number(req.params.id);
      if (!Number.isInteger(applicationId) || applicationId <= 0) {
        return res.status(400).json({ message: "Invalid application id" });
      }
      const status = normalizeHostApplicationStatus(req.body?.status);
      if (!status) {
        return res.status(400).json({ message: "Invalid status" });
      }
      const adminNote = typeof req.body?.adminNote === "string" ? req.body.adminNote.trim() : "";
      const existing = await storage.getHostApplicationById(applicationId);
      if (!existing) {
        return res.status(404).json({ message: "Host application not found" });
      }

      const currentStatus = normalizeHostApplicationStatus(existing.status);
      if (!currentStatus) {
        return res.status(400).json({ message: "Current host application status is invalid" });
      }
      const allowedTransitions: Record<"pending" | "in_review" | "approved" | "rejected", Array<"pending" | "in_review" | "approved" | "rejected">> = {
        pending: ["in_review", "approved", "rejected"],
        in_review: ["approved", "rejected"],
        approved: [],
        rejected: [],
      };
      if (!allowedTransitions[currentStatus].includes(status)) {
        return res.status(400).json({
          message: `Invalid status transition: ${currentStatus} -> ${status}`,
        });
      }

      const adminId = Number((req as any).userId);
      const updates: any = {
        status,
        adminNote: adminNote || null,
      };
      if (status === "in_review" || status === "approved" || status === "rejected") {
        updates.reviewedBy = adminId;
        updates.reviewedAt = new Date();
      }

      const updated = await storage.updateHostApplication(applicationId, updates);
      if (!updated) {
        return res.status(404).json({ message: "Host application not found" });
      }

      if (status === "approved") {
        const applicant = await storage.getUserById(existing.userId);
        if (applicant && applicant.role !== "admin" && applicant.role !== "host") {
          await storage.updateUserProfile(applicant.id, { role: "host" as any });
        }
      }

      await storage.createNotification({
        userId: existing.userId,
        type: "general",
        title: "Host Application Update",
        message:
          status === "approved"
            ? "Your host request was approved. You now have host tournament panel access."
            : status === "pending"
              ? "Your host request is now open."
            : status === "rejected"
              ? "Your host request was rejected. You can update details and re-apply."
              : "Your host request is now in review.",
      });

      await storage.createAdminLog({
        adminId,
        action: `host_application_${status}`,
        targetType: "host_application",
        targetId: applicationId,
        details: `userId=${existing.userId}${adminNote ? `, note=${adminNote}` : ""}`,
      });

      broadcastAdminUpdate({
        entity: "host_application",
        action: status,
        targetId: applicationId,
        metadata: { userId: existing.userId },
      });
      if (status === "approved") {
        broadcastAdminUpdate({
          entity: "user",
          action: "promote_host",
          targetId: existing.userId,
        });
      }

      res.json(updated);
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

      await storage.createAdminLog({
        adminId: (req as any).userId,
        action: banned ? "ban_user" : "unban_user",
        targetType: "user",
        targetId,
      });

      broadcastAdminUpdate({
        entity: "user",
        action: banned ? "ban" : "unban",
        targetId,
      });
      res.json(sanitizeUser(user));
    } catch (err: any) {
      res.status(500).json({ message: err.message });
    }
  });

  app.patch("/api/admin/users/:id/remove-host", authMiddleware, adminMiddleware, async (req, res) => {
    try {
      const targetId = Number(req.params.id);
      if (!Number.isInteger(targetId) || targetId <= 0) {
        return res.status(400).json({ message: "Invalid user id" });
      }

      const targetUser = await storage.getUserById(targetId);
      if (!targetUser) return res.status(404).json({ message: "User not found" });
      if (targetUser.role === "admin") {
        return res.status(400).json({ message: "Cannot remove admin role using this action" });
      }
      const wasHost = targetUser.role === "host";
      let finalUser = targetUser;

      if (wasHost) {
        const updated = await storage.updateUserProfile(targetId, { role: "user" as any });
        if (!updated) return res.status(404).json({ message: "User not found" });
        finalUser = updated;

        await storage.createNotification({
          userId: targetId,
          type: "general",
          title: "Host Access Removed",
          message: "Your host panel access has been removed by admin.",
        });

        await storage.createAdminLog({
          adminId: (req as any).userId,
          action: "remove_host_access",
          targetType: "user",
          targetId,
        });

        broadcastAdminUpdate({
          entity: "user",
          action: "remove_host",
          targetId,
        });
      }

      const removedApplications = await storage.deleteHostApplicationsByUser(targetId);
      if (removedApplications > 0) {
        await storage.createAdminLog({
          adminId: (req as any).userId,
          action: "delete_host_applications",
          targetType: "host_application",
          targetId,
          details: `removed=${removedApplications}`,
        });
      }

      if (removedApplications > 0 || wasHost) {
        broadcastAdminUpdate({
          entity: "host_application",
          action: "removed_for_user",
          metadata: { userId: targetId, removedApplications },
        });
      }

      res.json({
        user: sanitizeUser(finalUser),
        hostRemoved: wasHost,
        removedApplications,
      });
    } catch (err: any) {
      res.status(500).json({ message: err.message });
    }
  });

  // Admin wallet adjustment
  app.post("/api/admin/users/:id/wallet", authMiddleware, adminMiddleware, async (req, res) => {
    try {
      const targetId = Number(req.params.id);
      const amount = parsePaisaAmount(req.body?.amount);
      const { type, description } = req.body;
      if (amount == null || amount <= 0) {
        return res.status(400).json({ message: "Amount must be a positive integer amount in paise" });
      }
      if (!type || !["admin_credit", "admin_debit"].includes(type)) {
        return res.status(400).json({ message: "Type must be admin_credit or admin_debit" });
      }

      const idempotencyKey = getIdempotencyCacheKey(req, "admin_wallet_adjustment", Number((req as any).userId || 0));
      if (idempotencyKey === "__invalid__") {
        return res.status(400).json({ message: "Invalid Idempotency-Key header" });
      }
      if (idempotencyKey && replayIdempotentResponse(idempotencyKey, res)) {
        return;
      }

      const user = await storage.getUserById(targetId);
      if (!user) return res.status(404).json({ message: "User not found" });

      if (type === "admin_debit" && (user.mainWalletBalance || 0) < amount) {
        return res.status(400).json({ message: "User has insufficient withdrawable balance for debit" });
      }

      const walletChange = type === "admin_credit" ? amount : -amount;
      const updatedUser = await storage.updateWalletBalance(targetId, walletChange);
      if (!updatedUser) {
        return res.status(400).json({ message: "Wallet update failed" });
      }
      await storage.createTransaction({
        userId: targetId,
        amount,
        type,
        walletType: "main",
        mainBalanceBefore: user.mainWalletBalance || 0,
        mainBalanceAfter: updatedUser.mainWalletBalance || 0,
        bonusBalanceBefore: user.bonusWalletBalance || 0,
        bonusBalanceAfter: updatedUser.bonusWalletBalance || 0,
        metadata: { source: "admin_adjustment" },
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

      broadcastAdminUpdate({
        entity: "wallet",
        action: type === "admin_credit" ? "credit" : "debit",
        targetId,
        metadata: { amount },
      });
      const payload = sanitizeUser(updatedUser);
      if (idempotencyKey) {
        cacheIdempotentResponse(idempotencyKey, 200, payload);
      }
      res.json(payload);
    } catch (err: any) {
      res.status(500).json({ message: getPublicErrorMessage(err) });
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

      broadcastAdminUpdate({
        entity: "game",
        action: "create",
        targetId: Number(game.id),
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
      broadcastAdminUpdate({
        entity: "game",
        action: "update",
        targetId: Number(game.id),
      });
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

      broadcastAdminUpdate({
        entity: "game",
        action: "delete",
        targetId: gameId,
      });
      res.json({ success: true });
    } catch (err: any) {
      res.status(500).json({ message: err.message });
    }
  });

  // Admin Tournaments
  app.post("/api/admin/tournaments", authMiddleware, staffMiddleware, async (req, res) => {
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
    if (data.liveStreamUrl !== undefined) {
      const hasLiveStreamInput =
        typeof data.liveStreamUrl === "string"
          ? data.liveStreamUrl.trim().length > 0
          : Boolean(data.liveStreamUrl);
      const normalizedLiveStreamUrl = normalizeYouTubeLiveUrl(data.liveStreamUrl);
      if (hasLiveStreamInput && !normalizedLiveStreamUrl) {
        return res.status(400).json({ message: "Live stream URL must be a valid YouTube link" });
      }
      data.liveStreamUrl = normalizedLiveStreamUrl;
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
    broadcastAdminUpdate({
      entity: "tournament",
      action: "create",
      targetId: Number(t.id),
    });
    res.json(t);
  } catch (err: any) {
    console.error("CREATE TOURNAMENT ERROR:", err);
    res.status(500).json({ message: err.message || "Server error" });
  }
});

  app.patch("/api/admin/tournaments/:id", authMiddleware, staffMiddleware, async (req, res) => {
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
      if (data.liveStreamUrl !== undefined) {
        const hasLiveStreamInput =
          typeof data.liveStreamUrl === "string"
            ? data.liveStreamUrl.trim().length > 0
            : Boolean(data.liveStreamUrl);
        const normalizedLiveStreamUrl = normalizeYouTubeLiveUrl(data.liveStreamUrl);
        if (hasLiveStreamInput && !normalizedLiveStreamUrl) {
          return res.status(400).json({ message: "Live stream URL must be a valid YouTube link" });
        }
        data.liveStreamUrl = normalizedLiveStreamUrl;
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
      broadcastAdminUpdate({
        entity: "tournament",
        action: "update",
        targetId: Number(t.id),
      });
      res.json(t);
    } catch (err: any) {
      res.status(500).json({ message: err.message });
    }
  });

  app.patch("/api/admin/tournaments/:id/status", authMiddleware, staffMiddleware, async (req, res) => {
    try {
      const { status } = req.body;
      if (!["hot", "upcoming", "live", "completed", "cancelled"].includes(String(status))) {
        return res.status(400).json({ message: "Invalid tournament status" });
      }
      const tournamentId = Number(req.params.id);
      const previous = await storage.getTournamentById(tournamentId);
      if (!previous) return res.status(404).json({ message: "Tournament not found" });

      const previousStatus = getTournamentStatusValue(previous.status);
      const nextStatus = getTournamentStatusValue(status);

      const t = await storage.updateTournamentStatus(tournamentId, nextStatus);
      if (!t) return res.status(404).json({ message: "Tournament not found" });

      if (nextStatus === "live" && previousStatus !== "live") {
        await notifyTournamentLive(t, "manual_live");
      } else {
        broadcastTournamentUpdate(t, `admin_status_${nextStatus}`);
      }

      if (nextStatus === "cancelled" && previousStatus !== "cancelled") {
        const refundStats = await refundCancelledTournament(t);
        if (refundStats.refundedUsers > 0) {
          broadcastAdminUpdate({
            entity: "wallet",
            action: "tournament_cancel_refund",
            targetId: tournamentId,
            metadata: {
              refundedUsers: refundStats.refundedUsers,
              refundedAmount: refundStats.refundedAmount,
            },
          });
        }
      }

      await storage.createAdminLog({
        adminId: (req as any).userId,
        action: `update_tournament_status_${nextStatus}`,
        targetType: "tournament",
        targetId: tournamentId,
      });

      broadcastAdminUpdate({
        entity: "tournament",
        action: `status_${nextStatus}`,
        targetId: tournamentId,
      });
      res.json(t);
    } catch (err: any) {
      res.status(500).json({ message: err.message });
    }
  });

  app.patch("/api/admin/tournaments/:id/room", authMiddleware, staffMiddleware, async (req, res) => {
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

      broadcastTournamentUpdate(t, "room_published");
      broadcastAdminUpdate({
        entity: "tournament_room",
        action: "update",
        targetId: tournamentId,
      });
      res.json(t);
    } catch (err: any) {
      res.status(500).json({ message: err.message });
    }
  });

  app.delete("/api/admin/tournaments/:id", authMiddleware, staffMiddleware, async (req, res) => {
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

      broadcastAdminUpdate({
        entity: "tournament",
        action: "delete",
        targetId: tournamentId,
      });
      res.json({ success: true });
    } catch (err: any) {
      res.status(500).json({ message: err.message });
    }
  });

  // Admin: Declare results with auto prize distribution
  app.post("/api/admin/tournaments/:id/results", authMiddleware, staffMiddleware, async (req, res) => {
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

      const prizeDistributionMap = parsePrizeDistributionMap(tournament.prizeDistribution);
      const basePrizePool = Math.max(0, Math.round(Number(tournament.prizePool || 0)));
      const effectivePrizePool = getAutoScaledPrizePoolValue({
        status: tournament.status,
        prizePool: tournament.prizePool,
        filledSlots: tournament.filledSlots,
        maxSlots: tournament.maxSlots,
      });
      const prizeScaleRatio =
        basePrizePool > 0 ? Math.max(0, Math.min(1, effectivePrizePool / basePrizePool)) : 1;
      let remainingPrizePool = effectivePrizePool;
      const createdResults = [];
      const seenUsers = new Set<number>();
      let totalPrizeDistributed = 0;
      for (const r of resultData) {
        const userId = Number(r?.userId);
        const position = Number(r?.position);
        if (!Number.isInteger(userId) || userId <= 0 || !Number.isInteger(position) || position <= 0) {
          continue;
        }
        if (seenUsers.has(userId)) {
          return res.status(400).json({ message: "Duplicate users in results payload" });
        }
        seenUsers.add(userId);

        const inputPrize = Number(r?.prize);
        const mappedPrize = prizeDistributionMap.get(position) || 0;
        const desiredPayout =
          Number.isFinite(inputPrize) && inputPrize >= 0
            ? Math.round(inputPrize)
            : mappedPrize;
        const scaledPayout =
          prizeScaleRatio < 1 ? Math.round(desiredPayout * prizeScaleRatio) : desiredPayout;
        const payout = Math.max(0, Math.min(scaledPayout, remainingPrizePool));
        remainingPrizePool = Math.max(0, remainingPrizePool - payout);
        const kills = Number.isFinite(Number(r?.kills)) ? Math.max(0, Math.round(Number(r?.kills))) : 0;

        const result = await storage.createResult({
          tournamentId,
          userId,
          position,
          kills,
          prize: payout,
        });
        createdResults.push(result);

        if (payout > 0) {
          const winnerBefore = await storage.getUserById(userId);
          const winnerAfter = await storage.updateWalletBalance(userId, payout);
          if (!winnerBefore || !winnerAfter) {
            return res.status(404).json({ message: "Winner account not found" });
          }
          await storage.createTransaction({
            userId,
            amount: payout,
            type: "winning",
            walletType: "main",
            mainBalanceBefore: winnerBefore.mainWalletBalance || 0,
            mainBalanceAfter: winnerAfter.mainWalletBalance || 0,
            bonusBalanceBefore: winnerBefore.bonusWalletBalance || 0,
            bonusBalanceAfter: winnerAfter.bonusWalletBalance || 0,
            metadata: { source: "result_payout", position },
            description: `Prize for position #${position} in "${tournament.title}"`,
            tournamentId,
          });

          await storage.createNotification({
            userId,
            type: "results_declared",
            title: "Results Declared",
            message: `You placed #${position} in "${tournament.title}" and won Rs.${(payout / 100).toFixed(2)}!`,
          });
          totalPrizeDistributed += payout;
        } else {
          await storage.createNotification({
            userId,
            type: "results_declared",
            title: "Results Declared",
            message: `You placed #${position} in "${tournament.title}".`,
          });
        }
      }

      const completedTournament = await storage.updateTournamentStatus(tournamentId, "completed");

      const participantRegs = await storage.getRegistrationsByTournament(tournamentId);
      for (const reg of participantRegs) {
        if (seenUsers.has(Number(reg.userId))) continue;
        await storage.createNotification({
          userId: reg.userId,
          type: "results_declared",
          title: "Leaderboard Updated",
          message: `Results for "${tournament.title}" are now live. Check the leaderboard.`,
        });
      }

      await storage.createAdminLog({
        adminId: (req as any).userId,
        action: "declare_results",
        targetType: "tournament",
        targetId: tournamentId,
        details: `Declared ${createdResults.length} results, total prize distributed ${totalPrizeDistributed}`,
      });

      if (completedTournament) {
        broadcastTournamentUpdate(completedTournament, "results_declared");
      }
      broadcastAdminUpdate({
        entity: "tournament_results",
        action: "declare",
        targetId: tournamentId,
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
        const beforeUser = await storage.getUserById(wd.userId);
        const refundedUser = await storage.updateWalletBalance(wd.userId, wd.amount);
        if (!beforeUser || !refundedUser) {
          return res.status(404).json({ message: "User not found for withdrawal refund" });
        }
        await storage.createTransaction({
          userId: wd.userId,
          amount: wd.amount,
          type: "admin_credit",
          walletType: "main",
          mainBalanceBefore: beforeUser.mainWalletBalance || 0,
          mainBalanceAfter: refundedUser.mainWalletBalance || 0,
          bonusBalanceBefore: beforeUser.bonusWalletBalance || 0,
          bonusBalanceAfter: refundedUser.bonusWalletBalance || 0,
          metadata: { source: "withdrawal_rejected_refund", withdrawalId: wd.id },
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

      broadcastAdminUpdate({
        entity: "withdrawal",
        action: status,
        targetId: wdId,
        metadata: { userId: wd.userId },
      });
      res.json(wd);
    } catch (err: any) {
      res.status(500).json({ message: err.message });
    }
  });

  // Admin Disputes
  app.get("/api/admin/disputes", authMiddleware, adminMiddleware, async (_req, res) => {
    try {
      const items = await storage.getAllDisputes();
      res.json(items);
    } catch (err: any) {
      res.status(500).json({ message: err.message });
    }
  });

  app.patch("/api/admin/disputes/:id", authMiddleware, adminMiddleware, async (req, res) => {
    try {
      const disputeId = Number(req.params.id);
      if (!Number.isInteger(disputeId) || disputeId <= 0) {
        return res.status(400).json({ message: "Invalid dispute id" });
      }

      const status = normalizeDisputeStatus(req.body?.status);
      if (!status) return res.status(400).json({ message: "Invalid dispute status" });

      const existing = await storage.getDisputeById(disputeId);
      if (!existing) return res.status(404).json({ message: "Dispute not found" });

      const currentStatus = normalizeDisputeStatus(existing.status);
      if (!currentStatus) {
        return res.status(400).json({ message: "Current dispute status is invalid" });
      }
      if (currentStatus === "resolved" && status !== "resolved") {
        return res.status(400).json({ message: "Resolved tickets are final and cannot be moved back" });
      }
      if (currentStatus === "resolved" && status === "resolved") {
        return res.json(existing);
      }

      const adminId = Number((req as any).userId);
      const updatePayload: any = {
        status,
      };

      if (status === "resolved") {
        updatePayload.resolvedBy = adminId;
        updatePayload.resolvedAt = new Date();
      } else if (status === "open" || status === "in_review") {
        updatePayload.resolvedBy = null;
        updatePayload.resolvedAt = null;
      }

      const updated = await storage.updateDispute(disputeId, updatePayload);
      if (!updated) return res.status(404).json({ message: "Dispute not found" });

      await storage.createDisputeLog({
        disputeId,
        actorUserId: adminId,
        actorRole: "admin",
        action: `status_${status}`,
        note: `Status updated to ${status}`,
      });

      await storage.createNotification({
        userId: updated.userId,
        type: "general",
        title: "Support Ticket Update",
        message: `Your ticket #${updated.id} is now ${status.replace("_", " ")}.`,
      });

      await storage.createAdminLog({
        adminId,
        action: "update_dispute_status",
        targetType: "dispute",
        targetId: disputeId,
        details: `status=${status}`,
      });

      broadcastAdminUpdate({
        entity: "support_ticket",
        action: status,
        targetId: disputeId,
      });
      res.json(updated);
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
      broadcastAdminUpdate({
        entity: "banner",
        action: "create",
        targetId: Number(banner.id),
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
      broadcastAdminUpdate({
        entity: "banner",
        action: "update",
        targetId: id,
      });
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
      broadcastAdminUpdate({
        entity: "banner",
        action: "delete",
        targetId: id,
      });
      res.json({ success: true });
    } catch (err: any) {
      res.status(500).json({ message: err.message });
    }
  });

  // Coupon routes
  app.get("/api/admin/coupons", authMiddleware, adminMiddleware, async (_req, res) => {
    try {
      const items = await storage.getAllCoupons();
      res.json(items);
    } catch (err: any) {
      res.status(500).json({ message: err.message });
    }
  });

  app.get("/api/admin/coupons/analytics", authMiddleware, adminMiddleware, async (_req, res) => {
    try {
      const analytics = await storage.getCouponAnalytics();
      res.json(analytics);
    } catch (err: any) {
      res.status(500).json({ message: err.message });
    }
  });

  app.post("/api/admin/coupons", authMiddleware, adminMiddleware, async (req, res) => {
    try {
      const rawCode = req.body?.code;
      const rawType = normalizeCouponTypeForRoute(req.body?.couponType) || "bonus_credit";
      const rawValue = Number(req.body?.value ?? req.body?.amount ?? 0);
      const globalUsageLimitRaw = req.body?.globalUsageLimit;
      const perUserLimitRaw = req.body?.perUserLimit;
      const enabled = req.body?.enabled !== false;
      const fraudHookEnabled = req.body?.fraudHookEnabled === true;
      const rawExpiresAt = req.body?.expiresAt;
      const rawMinEntryFee = req.body?.minEntryFee;
      const rawMetadata = req.body?.metadata;
      const code = typeof rawCode === "string" ? rawCode.trim().toUpperCase() : "";

      if (!code || code.length < 3 || code.length > 64) {
        return res.status(400).json({ message: "Coupon code must be between 3 and 64 characters" });
      }

      let value = 0;
      if (rawType === "free_entry") {
        value = 0;
      } else {
        if (!Number.isFinite(rawValue) || rawValue < 0) {
          return res.status(400).json({ message: "Coupon value must be zero or greater" });
        }
        value = Math.round(rawValue * 100);
        if (value <= 0) {
          return res.status(400).json({ message: "Coupon value must be greater than 0" });
        }
      }

      const globalUsageLimit =
        globalUsageLimitRaw == null || globalUsageLimitRaw === ""
          ? null
          : Math.max(1, Math.round(Number(globalUsageLimitRaw)));
      const perUserLimit =
        perUserLimitRaw == null || perUserLimitRaw === ""
          ? 1
          : Math.max(1, Math.round(Number(perUserLimitRaw)));
      if (globalUsageLimit != null && !Number.isFinite(globalUsageLimit)) {
        return res.status(400).json({ message: "Invalid global usage limit" });
      }
      if (!Number.isFinite(perUserLimit) || perUserLimit <= 0) {
        return res.status(400).json({ message: "Invalid per-user usage limit" });
      }

      const expiresAt =
        rawExpiresAt == null || rawExpiresAt === ""
          ? null
          : new Date(rawExpiresAt);
      if (expiresAt && Number.isNaN(expiresAt.getTime())) {
        return res.status(400).json({ message: "Invalid expiry date" });
      }

      const minEntryFee =
        rawMinEntryFee == null || rawMinEntryFee === ""
          ? null
          : Math.max(0, Math.round(Number(rawMinEntryFee) * 100));
      if (minEntryFee != null && !Number.isFinite(minEntryFee)) {
        return res.status(400).json({ message: "Invalid min entry condition" });
      }

      const tournamentId = null;

      const metadata =
        rawMetadata && typeof rawMetadata === "object"
          ? (rawMetadata as Record<string, unknown>)
          : null;

      if (
        rawType === "flat_discount" ||
        rawType === "free_entry"
      ) {
        if (minEntryFee != null && minEntryFee < 0) {
          return res.status(400).json({ message: "Min entry condition must be non-negative" });
        }
      }

      const coupon = await storage.createCoupon({
        code,
        couponType: rawType,
        value,
        enabled,
        globalUsageLimit,
        perUserLimit,
        expiresAt,
        minEntryFee,
        tournamentId,
        fraudHookEnabled,
        metadata,
        createdBy: (req as any).userId,
      });

      await storage.createAdminLog({
        adminId: (req as any).userId,
        action: "create_coupon",
        targetType: "coupon",
        targetId: coupon.id,
        details: `type=${rawType}, value=${value}, perUserLimit=${perUserLimit}, globalUsageLimit=${globalUsageLimit ?? "none"}`,
      });

      broadcastAdminUpdate({
        entity: "coupon",
        action: "create",
        targetId: Number(coupon.id),
      });
      res.json(coupon);
    } catch (err: any) {
      if (err?.code === "23505") return res.status(400).json({ message: "Coupon code already exists" });
      res.status(500).json({ message: err.message });
    }
  });

  app.delete("/api/admin/coupons/:id", authMiddleware, adminMiddleware, async (req, res) => {
    try {
      const id = Number(req.params.id);
      await storage.deleteCoupon(id);
      await storage.createAdminLog({
        adminId: (req as any).userId,
        action: "delete_coupon",
        targetType: "coupon",
        targetId: id,
      });
      broadcastAdminUpdate({
        entity: "coupon",
        action: "delete",
        targetId: id,
      });
      res.json({ success: true });
    } catch (err: any) {
      res.status(500).json({ message: err.message });
    }
  });

  // Google Client ID endpoint for frontend
  app.get("/api/config/google-client-id", (_req, res) => {
    const clientId =
      process.env.GOOGLE_CLIENT_ID ||
      process.env.VITE_GOOGLE_CLIENT_ID ||
      null;
    res.setHeader("Cache-Control", "no-store, no-cache, must-revalidate, proxy-revalidate");
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
