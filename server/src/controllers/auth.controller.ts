import type { Request, Response } from "express";
import { db } from "../db/db.js";
import { hashPassword } from "../db/seed.js";
import { signToken, type AuthenticatedRequest } from "../middleware/auth.middleware.js";
import type { UserRole, CitizenProfile } from "../types/index.js";

export async function login(req: Request, res: Response): Promise<void> {
  const { username, password, expectedRole, rememberMe } = req.body;

  if (!username || !password) {
    res.status(400).json({
      success: false,
      error: "ValidationError",
      message: "Identifier (Email, Mobile, or Operator ID) and password are required.",
    });
    return;
  }

  const query = username.trim().toLowerCase();
  const user = db.state.users.find((u) => {
    const matchUsername = u.username.toLowerCase() === query;
    const matchEmail = u.email && u.email.toLowerCase() === query;
    const matchEntity = u.associatedEntityId && u.associatedEntityId.toLowerCase() === query;
    return matchUsername || matchEmail || matchEntity;
  });

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

  // Role validation if logging in through a role-specific portal
  if (expectedRole) {
    const isControlAdmin = user.role === "CONTROL_CENTRE_ADMIN";
    const roleMatches = user.role === expectedRole;
    if (!roleMatches && !isControlAdmin) {
      res.status(403).json({
        success: false,
        error: "RoleMismatch",
        message: `Account role is '${user.role}', which cannot access the '${expectedRole}' portal. Please sign in via the appropriate portal.`,
        currentRole: user.role,
        expectedRole,
      });
      return;
    }
  }

  const expiresInMinutes = rememberMe ? 60 * 24 * 7 : 60 * 24; // 7 days vs 24 hours
  const token = signToken(
    {
      userId: user.id,
      username: user.username,
      role: user.role,
      associatedEntityId: user.associatedEntityId,
    },
    expiresInMinutes
  );

  // Set HTTP-only secure cookie
  res.cookie("auth_token", token, {
    httpOnly: true,
    sameSite: "lax",
    maxAge: expiresInMinutes * 60 * 1000,
  });

  await db.logAudit(user.username, user.role, "USER_LOGIN", user.id, {
    ip: req.ip,
    rememberMe: Boolean(rememberMe),
    expectedRole,
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

export async function registerCitizen(req: Request, res: Response): Promise<void> {
  const { fullName, email, mobile, password, sector, conditions, emergencyContact } = req.body;

  if (!fullName || !password || (!email && !mobile)) {
    res.status(400).json({
      success: false,
      error: "ValidationError",
      message: "Full name, password, and at least an email or mobile number are required.",
    });
    return;
  }

  const cleanEmail = email?.trim().toLowerCase() || `${mobile?.trim()}@citizen.net`;
  const cleanUsername = cleanEmail.split("@")[0] || `cit_${Date.now()}`;

  // Check if user already exists
  const existingUser = db.state.users.find(
    (u) =>
      u.email.toLowerCase() === cleanEmail ||
      u.username.toLowerCase() === cleanUsername
  );

  if (existingUser) {
    res.status(409).json({
      success: false,
      error: "UserAlreadyExists",
      message: "An account with this email or mobile identifier is already registered. Please sign in.",
    });
    return;
  }

  const userId = `USR-CITIZEN-${Date.now()}`;
  const citizenId = `CIT-${Math.floor(1000 + Math.random() * 9000)}`;
  const passwordHash = hashPassword(password);

  const newUser = {
    id: userId,
    username: cleanUsername,
    fullName: fullName.trim(),
    email: cleanEmail,
    role: "CITIZEN" as UserRole,
    associatedEntityId: citizenId,
    passwordHash,
    createdAt: new Date().toISOString(),
  };

  const newProfile: CitizenProfile = {
    id: citizenId,
    userId,
    fullName: fullName.trim(),
    sector: sector || "Sector 7 · Riverside",
    evacuationOrder: "MANDATORY",
    assignedShelterId: "SH-01",
    distanceKm: 2.4,
    etaMinutes: 26,
    bloodGroup: "O+",
    conditions: conditions || "None",
    medication: "None",
    emergencyContact: emergencyContact || mobile || "+91 98200 12420",
    checklist: [
      { item: "Identity documents & cash", checked: true },
      { item: "3 days of medication", checked: false },
      { item: "Drinking water (4 L per person)", checked: false },
      { item: "Torch, power bank, whistle", checked: false },
      { item: "Mains power and gas switched off", checked: false },
    ],
    family: [],
    connectivityStatus: "ONLINE",
  };

  await db.withTransaction(async (state) => {
    state.users.push(newUser);
    state.citizenProfiles.push(newProfile);
  });

  const token = signToken({
    userId: newUser.id,
    username: newUser.username,
    role: newUser.role,
    associatedEntityId: citizenId,
  });

  res.cookie("auth_token", token, {
    httpOnly: true,
    sameSite: "lax",
    maxAge: 24 * 60 * 60 * 1000,
  });

  await db.logAudit(newUser.username, "CITIZEN", "CITIZEN_REGISTRATION", userId, {
    sector: newProfile.sector,
    citizenId,
  });

  res.status(201).json({
    success: true,
    message: "Citizen account successfully created. Welcome to SDREP.",
    token,
    user: {
      id: newUser.id,
      username: newUser.username,
      fullName: newUser.fullName,
      email: newUser.email,
      role: newUser.role,
      associatedEntityId: citizenId,
    },
  });
}

export async function forgotPassword(req: Request, res: Response): Promise<void> {
  const { identifier, portal } = req.body;

  if (!identifier) {
    res.status(400).json({
      success: false,
      error: "ValidationError",
      message: "Please enter your registered email, mobile number, or operator ID.",
    });
    return;
  }

  const query = identifier.trim().toLowerCase();
  const user = db.state.users.find(
    (u) =>
      u.username.toLowerCase() === query ||
      (u.email && u.email.toLowerCase() === query) ||
      (u.associatedEntityId && u.associatedEntityId.toLowerCase() === query)
  );

  await db.logAudit(query, "ANONYMOUS", "FORGOT_PASSWORD_REQUEST", query, {
    portal,
    userFound: Boolean(user),
  });

  if (portal === "CITIZEN" || user?.role === "CITIZEN") {
    res.json({
      success: true,
      message: "If an account matches your details, an emergency verification code has been dispatched. For immediate evacuation assistance, call 112 directly.",
    });
  } else {
    res.json({
      success: true,
      message: "Credential reset request recorded for security audit. For emergency response personnel, password re-provisioning requires verification from SDREP Control Centre (Radio Net-1 or Commander desk).",
    });
  }
}

export async function changePassword(req: AuthenticatedRequest, res: Response): Promise<void> {
  if (!req.user) {
    res.status(401).json({ success: false, message: "Unauthenticated" });
    return;
  }

  const { currentPassword, newPassword } = req.body;
  if (!currentPassword || !newPassword) {
    res.status(400).json({
      success: false,
      error: "ValidationError",
      message: "Current password and new password are required.",
    });
    return;
  }

  if (newPassword.length < 8) {
    res.status(400).json({
      success: false,
      error: "ValidationError",
      message: "New password must be at least 8 characters long.",
    });
    return;
  }

  const user = db.state.users.find((u) => u.id === req.user!.userId);
  if (!user) {
    res.status(404).json({ success: false, message: "User not found." });
    return;
  }

  if (user.passwordHash !== hashPassword(currentPassword)) {
    res.status(400).json({
      success: false,
      error: "InvalidPassword",
      message: "Current password does not match.",
    });
    return;
  }

  const newHash = hashPassword(newPassword);
  await db.withTransaction(async (state) => {
    const idx = state.users.findIndex((u) => u.id === req.user!.userId);
    if (idx !== -1) {
      state.users[idx]!.passwordHash = newHash;
    }
  });

  await db.logAudit(req.user.username, req.user.role, "PASSWORD_CHANGED", req.user.userId);

  res.json({
    success: true,
    message: "Password successfully updated.",
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
