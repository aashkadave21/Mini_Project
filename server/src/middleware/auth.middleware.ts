import crypto from "node:crypto";
import type { Request, Response, NextFunction } from "express";
import type { UserRole } from "../types/index.js";
import { db } from "../db/db.js";

const JWT_SECRET = process.env.JWT_SECRET || "sdrep_super_secret_jwt_key_2026";

export interface AuthPayload {
  userId: string;
  username: string;
  role: UserRole;
  associatedEntityId?: string;
  exp: number;
}

export function signToken(payload: Omit<AuthPayload, "exp">, expiresInMinutes = 60 * 24): string {
  const header = Buffer.from(JSON.stringify({ alg: "HS256", typ: "JWT" })).toString("base64url");
  const fullPayload: AuthPayload = {
    ...payload,
    exp: Math.floor(Date.now() / 1000) + expiresInMinutes * 60,
  };
  const body = Buffer.from(JSON.stringify(fullPayload)).toString("base64url");
  const signature = crypto.createHmac("sha256", JWT_SECRET).update(`${header}.${body}`).digest("base64url");
  return `${header}.${body}.${signature}`;
}

export function verifyToken(token: string): AuthPayload | null {
  try {
    const parts = token.split(".");
    if (parts.length !== 3) return null;
    const [header, body, signature] = parts;
    const expectedSignature = crypto.createHmac("sha256", JWT_SECRET).update(`${header}.${body}`).digest("base64url");
    if (signature !== expectedSignature) return null;

    const decoded = JSON.parse(Buffer.from(body!, "base64url").toString("utf-8")) as AuthPayload;
    if (decoded.exp && decoded.exp < Math.floor(Date.now() / 1000)) {
      return null; // Expired
    }
    return decoded;
  } catch {
    return null;
  }
}

export interface AuthenticatedRequest extends Request {
  user?: AuthPayload;
}

export function authenticate(req: AuthenticatedRequest, res: Response, next: NextFunction): void {
  const authHeader = req.headers.authorization;
  let token: string | undefined;

  if (authHeader && authHeader.startsWith("Bearer ")) {
    token = authHeader.split(" ")[1];
  } else if (req.cookies && req.cookies.auth_token) {
    token = req.cookies.auth_token;
  }

  if (!token) {
    res.status(401).json({
      success: false,
      error: "AuthenticationRequired",
      message: "Access token is missing. Please log in with authorized credentials.",
      timestamp: new Date().toISOString(),
    });
    return;
  }

  const payload = verifyToken(token);
  if (!payload) {
    res.status(401).json({
      success: false,
      error: "InvalidToken",
      message: "Access token is invalid or has expired.",
      timestamp: new Date().toISOString(),
    });
    return;
  }

  req.user = payload;
  next();
}

export function optionalAuthenticate(req: AuthenticatedRequest, _res: Response, next: NextFunction): void {
  const authHeader = req.headers.authorization;
  if (authHeader && authHeader.startsWith("Bearer ")) {
    const token = authHeader.split(" ")[1];
    if (token) {
      const payload = verifyToken(token);
      if (payload) {
        req.user = payload;
      }
    }
  }
  next();
}

export function requireRole(allowedRoles: UserRole[]) {
  return (req: AuthenticatedRequest, res: Response, next: NextFunction): void => {
    if (!req.user) {
      res.status(401).json({
        success: false,
        error: "Unauthenticated",
        message: "You must be authenticated to perform this operation.",
      });
      return;
    }

    if (!allowedRoles.includes(req.user.role)) {
      db.logAudit(
        req.user.username,
        req.user.role,
        "UNAUTHORIZED_ACCESS_ATTEMPT",
        req.originalUrl,
        { requiredRoles: allowedRoles }
      );

      res.status(403).json({
        success: false,
        error: "Forbidden",
        message: `Role ${req.user.role} lacks permission. Required roles: ${allowedRoles.join(", ")}`,
        timestamp: new Date().toISOString(),
      });
      return;
    }

    next();
  };
}
