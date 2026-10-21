import type { Request, Response } from "express";
import { db } from "../db/db.js";
import { hashPassword } from "../db/seed.js";
import { signToken, type AuthenticatedRequest } from "../middleware/auth.middleware.js";

export async function login(req: Request, res: Response): Promise<void> {
  const { username, password } = req.body;

  if (!username || !password) {
    res.status(400).json({
      success: false,
      error: "ValidationError",
      message: "Username (or Operator ID) and password are required.",
    });
    return;
  }

  const user = db.state.users.find(
    (u) => u.username.toLowerCase() === username.trim().toLowerCase()
  );

  if (!user) {
    res.status(401).json({
      success: false,
      error: "AuthenticationFailed",
      message: "Invalid credentials or unauthorized operator ID.",
    });
    return;
  }

  const inputHash = hashPassword(password);
  if (user.passwordHash !== inputHash) {
    res.status(401).json({
      success: false,
      error: "AuthenticationFailed",
      message: "Invalid passphrase or hardware token.",
    });
    return;
  }

  const token = signToken({
    userId: user.id,
    username: user.username,
    role: user.role,
    associatedEntityId: user.associatedEntityId,
  });

  // Set HTTP-only secure cookie
  res.cookie("auth_token", token, {
    httpOnly: true,
    sameSite: "lax",
    maxAge: 24 * 60 * 60 * 1000,
  });

  await db.logAudit(user.username, user.role, "USER_LOGIN", user.id, {
    ip: req.ip,
  });

  res.json({
    success: true,
    token,
    user: {
      id: user.id,
      username: user.username,
      fullName: user.fullName,
      email: user.email,
      role: user.role,
      associatedEntityId: user.associatedEntityId,
    },
  });
}

export async function getCurrentUser(req: AuthenticatedRequest, res: Response): Promise<void> {
  if (!req.user) {
    res.status(401).json({ success: false, message: "Unauthenticated" });
    return;
  }

  const user = db.state.users.find((u) => u.id === req.user!.userId);
  if (!user) {
    res.status(404).json({ success: false, message: "User profile not found." });
    return;
  }

  res.json({
    success: true,
    user: {
      id: user.id,
      username: user.username,
      fullName: user.fullName,
      email: user.email,
      role: user.role,
      associatedEntityId: user.associatedEntityId,
    },
  });
}

export async function logout(req: AuthenticatedRequest, res: Response): Promise<void> {
  res.clearCookie("auth_token");
  if (req.user) {
    await db.logAudit(req.user.username, req.user.role, "USER_LOGOUT", req.user.userId);
  }
  res.json({ success: true, message: "Logged out successfully." });
}
