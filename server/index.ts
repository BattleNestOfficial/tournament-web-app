import express, { type Request, Response, NextFunction } from "express";
import { registerRoutes } from "./routes";
import { serveStatic } from "./static";
import { createServer } from "http";
import {
  ensureCouponsTables,
  ensureRegistrationsTeamColumn,
  ensureTournamentStatusEnumHasHot,
  ensureUserSecurityColumns,
  ensureWalletEngineColumns,
} from "./db";

const app = express();
app.set("trust proxy", 1);
const httpServer = createServer(app);

declare module "http" {
  interface IncomingMessage {
    rawBody?: Buffer;
  }
}

app.use(
  express.json({
    verify: (req, _res, buf) => {
      req.rawBody = buf;
    },
  }),
);

app.use(express.urlencoded({ extended: false }));

export function log(message: string, source = "express") {
  const formattedTime = new Date().toLocaleTimeString("en-US", {
    hour: "numeric",
    minute: "2-digit",
    second: "2-digit",
    hour12: true,
  });

  console.log(`${formattedTime} [${source}] ${message}`);
}

function redactSensitive(value: unknown): unknown {
  const sensitiveKeys = new Set([
    "password",
    "token",
    "authorization",
    "roomPassword",
    "razorpaySignature",
    "razorpay_signature",
  ]);

  if (Array.isArray(value)) {
    return value.map(redactSensitive);
  }

  if (value && typeof value === "object") {
    const obj = value as Record<string, unknown>;
    const output: Record<string, unknown> = {};
    for (const [key, nestedValue] of Object.entries(obj)) {
      output[key] = sensitiveKeys.has(key) ? "[REDACTED]" : redactSensitive(nestedValue);
    }
    return output;
  }

  return value;
}

app.use((req, res, next) => {
  const start = Date.now();
  const path = req.path;
  let capturedJsonResponse: Record<string, any> | undefined = undefined;

  const originalResJson = res.json;
  res.json = function (bodyJson, ...args) {
    capturedJsonResponse = bodyJson;
    return originalResJson.apply(res, [bodyJson, ...args]);
  };

  res.on("finish", () => {
    const duration = Date.now() - start;
    if (path.startsWith("/api")) {
      let logLine = `${req.method} ${path} ${res.statusCode} in ${duration}ms`;
      if (capturedJsonResponse) {
        logLine += ` :: ${JSON.stringify(redactSensitive(capturedJsonResponse))}`;
      }

      log(logLine);
    }
  });

  next();
});

async function runStartupStep(name: string, step: () => Promise<void>) {
  try {
    await step();
    log(`${name}: ok`, "startup");
  } catch (err) {
    // Schema alignment should not take down the whole process.
    console.error(`[startup] ${name} failed:`, err);
  }
}

(async () => {
  await runStartupStep("ensureTournamentStatusEnumHasHot", ensureTournamentStatusEnumHasHot);
  await runStartupStep("ensureRegistrationsTeamColumn", ensureRegistrationsTeamColumn);
  await runStartupStep("ensureUserSecurityColumns", ensureUserSecurityColumns);
  await runStartupStep("ensureCouponsTables", ensureCouponsTables);
  await runStartupStep("ensureWalletEngineColumns", ensureWalletEngineColumns);
  await registerRoutes(httpServer, app);

  app.use((err: any, _req: Request, res: Response, next: NextFunction) => {
    const status = err.status || err.statusCode || 500;
    const message = err.message || "Internal Server Error";

    console.error("Internal Server Error:", err);

    if (res.headersSent) {
      return next(err);
    }

    return res.status(status).json({ message });
  });

  // importantly only setup vite in development and after
  // setting up all the other routes so the catch-all route
  // doesn't interfere with the other routes
  if (process.env.NODE_ENV === "production") {
    serveStatic(app);
  } else {
    const { setupVite } = await import("./vite");
    await setupVite(httpServer, app);
  }

  // ALWAYS serve the app on the port specified in the environment variable PORT
  // Other ports are firewalled. Default to 5000 if not specified.
  // this serves both the API and the client.
  // It is the only port that is not firewalled.
  const port = Number(process.env.PORT || 5000);

httpServer.listen(
  {
    port,
    host: "0.0.0.0"
  },
  () => {
    console.log(`Server running on port ${port}`);
  }
);
})().catch((err) => {
  console.error("Fatal startup error:", err);
  process.exit(1);
});
