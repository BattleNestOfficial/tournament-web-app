import jwt from "jsonwebtoken";
import type { Request, Response, NextFunction } from "express";

const JWT_SECRET = process.env.SESSION_SECRET;
if (!JWT_SECRET) {
  throw new Error("SESSION_SECRET environment variable is required");
}

export function generateToken(userId: number, role: string): string {
  return jwt.sign({ userId, role }, JWT_SECRET, { expiresIn: "7d" });
}

export function verifyToken(
  token: string
): { userId: number; role: string } | null {
  try {
    return jwt.verify(token, JWT_SECRET) as {
      userId: number;
      role: string;
    };
  } catch {
    return null;
  }
}

export function authMiddleware(
  req: Request,
  res: Response,
  next: NextFunction
) {
  const authHeader = req.headers.authorization;
  if (!authHeader || !authHeader.startsWith("Bearer ")) {
    return res.status(401).json({ message: "Authentication required" });
  }

  const token = authHeader.slice(7);
  const payload = verifyToken(token);
  if (!payload) {
    return res.status(401).json({ message: "Invalid or expired token" });
  }

  (req as any).userId = payload.userId;
  (req as any).userRole = payload.role;
  next();
}

/**
 * ✅ OPTIONAL AUTH
 * - Allows guests
 * - Adds userId + role if token exists
 */
export function authOptionalMiddleware(
  req: Request,
  _res: Response,
  next: NextFunction
) {
  const authHeader = req.headers.authorization;

  if (!authHeader || !authHeader.startsWith("Bearer ")) {
    return next(); // guest user
  }

  const token = authHeader.slice(7);
  const payload = verifyToken(token);

  if (!payload) {
    return next(); // invalid token → treat as guest
  }

  (req as any).userId = payload.userId;
  (req as any).userRole = payload.role;
  next();
}

export function adminMiddleware(
  req: Request,
  res: Response,
  next: NextFunction
) {
  if ((req as any).userRole !== "admin") {
    return res.status(403).json({ message: "Admin access required" });
  }
  next();
}
