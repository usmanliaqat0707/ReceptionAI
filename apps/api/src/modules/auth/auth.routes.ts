import { FastifyInstance } from "fastify";
import { prisma } from "@receptionai/db";
import {
  generateSecureToken,
  hashToken,
  hashPassword,
  verifyPassword,
} from "@receptionai/security";
import {
  signupSchema,
  loginSchema,
  forgotPasswordSchema,
  resetPasswordSchema,
  verifyEmailSchema,
} from "@receptionai/validation";
import {
  SESSION_COOKIE_NAME,
  SESSION_EXPIRY_DAYS,
  PASSWORD_RESET_EXPIRY_HOURS,
} from "@receptionai/config";
import { authenticateSession } from "../../middleware/auth";
import { mailProvider } from "../../lib/mail";

export async function authRoutes(app: FastifyInstance) {
  // 1. Signup
  app.post("/api/v1/auth/signup", async (req, reply) => {
    const validated = signupSchema.parse(req.body);

    const existingUser = await prisma.user.findUnique({
      where: { email: validated.email },
    });

    if (existingUser) {
      return reply.status(409).send({
        error: {
          code: "EMAIL_EXISTS",
          message: "An account with this email address already exists.",
          requestId: req.id,
        },
      });
    }

    const passwordHash = await hashPassword(validated.password);

    const user = await prisma.user.create({
      data: {
        name: validated.name,
        email: validated.email,
        passwordHash,
      },
      select: {
        id: true,
        email: true,
        name: true,
        avatarUrl: true,
        status: true,
        createdAt: true,
      },
    });

    // Create session
    const rawToken = generateSecureToken();
    const tokenHash = hashToken(rawToken);
    const expiresAt = new Date();
    expiresAt.setDate(expiresAt.getDate() + SESSION_EXPIRY_DAYS);

    await prisma.session.create({
      data: {
        userId: user.id,
        tokenHash,
        expiresAt,
        ipAddress: req.ip,
        userAgent: req.headers["user-agent"] || null,
      },
    });

    // Set secure cookie
    reply.setCookie(SESSION_COOKIE_NAME, rawToken, {
      path: "/",
      httpOnly: true,
      secure: process.env.NODE_ENV === "production",
      sameSite: "lax",
      maxAge: SESSION_EXPIRY_DAYS * 24 * 60 * 60,
    });

    return reply.status(201).send({
      data: {
        user,
      },
    });
  });

  // 2. Login
  app.post("/api/v1/auth/login", async (req, reply) => {
    const validated = loginSchema.parse(req.body);

    const user = await prisma.user.findUnique({
      where: { email: validated.email },
    });

    if (!user || user.status === "DISABLED") {
      return reply.status(401).send({
        error: {
          code: "INVALID_CREDENTIALS",
          message: "Invalid email or password.",
          requestId: req.id,
        },
      });
    }

    const isValidPassword = await verifyPassword(validated.password, user.passwordHash);
    if (!isValidPassword) {
      return reply.status(401).send({
        error: {
          code: "INVALID_CREDENTIALS",
          message: "Invalid email or password.",
          requestId: req.id,
        },
      });
    }

    // Create session
    const rawToken = generateSecureToken();
    const tokenHash = hashToken(rawToken);
    const expiresAt = new Date();
    expiresAt.setDate(expiresAt.getDate() + SESSION_EXPIRY_DAYS);

    await prisma.session.create({
      data: {
        userId: user.id,
        tokenHash,
        expiresAt,
        ipAddress: req.ip,
        userAgent: req.headers["user-agent"] || null,
      },
    });

    // Set secure cookie
    reply.setCookie(SESSION_COOKIE_NAME, rawToken, {
      path: "/",
      httpOnly: true,
      secure: process.env.NODE_ENV === "production",
      sameSite: "lax",
      maxAge: SESSION_EXPIRY_DAYS * 24 * 60 * 60,
    });

    return reply.send({
      data: {
        user: {
          id: user.id,
          email: user.email,
          name: user.name,
          avatarUrl: user.avatarUrl,
          status: user.status,
        },
      },
    });
  });

  // 3. Logout
  app.post("/api/v1/auth/logout", async (req, reply) => {
    const rawToken = req.cookies[SESSION_COOKIE_NAME];
    if (rawToken) {
      const tokenHash = hashToken(rawToken);
      await prisma.session
        .updateMany({
          where: { tokenHash, revokedAt: null },
          data: { revokedAt: new Date() },
        })
        .catch(() => {});
    }

    reply.clearCookie(SESSION_COOKIE_NAME, {
      path: "/",
      httpOnly: true,
      secure: process.env.NODE_ENV === "production",
      sameSite: "lax",
    });

    return reply.send({ data: { success: true } });
  });

  // 4. Current User & Memberships
  app.get("/api/v1/auth/me", { preHandler: [authenticateSession] }, async (req, reply) => {
    const user = req.user!;

    const memberships = await prisma.workspaceMembership.findMany({
      where: { userId: user.id, status: "ACTIVE" },
      include: {
        workspace: {
          select: {
            id: true,
            name: true,
            slug: true,
            industry: true,
            timezone: true,
            status: true,
          },
        },
      },
      orderBy: { createdAt: "asc" },
    });

    return reply.send({
      data: {
        user: {
          id: user.id,
          email: user.email,
          name: user.name,
          avatarUrl: user.avatarUrl,
          status: user.status,
        },
        memberships: memberships.map((m) => ({
          id: m.id,
          role: m.role,
          status: m.status,
          workspace: m.workspace,
        })),
      },
    });
  });

  // 5. Forgot Password
  app.post("/api/v1/auth/forgot-password", async (req, reply) => {
    const validated = forgotPasswordSchema.parse(req.body);

    const user = await prisma.user.findUnique({
      where: { email: validated.email },
    });

    if (user && user.status === "ACTIVE") {
      const rawToken = generateSecureToken();
      const tokenHash = hashToken(rawToken);
      const expiresAt = new Date();
      expiresAt.setHours(expiresAt.getHours() + PASSWORD_RESET_EXPIRY_HOURS);

      await prisma.passwordResetToken.create({
        data: {
          userId: user.id,
          tokenHash,
          expiresAt,
        },
      });

      const resetUrl = `${process.env.WEB_URL || "http://localhost:3000"}/reset-password?token=${rawToken}`;
      await mailProvider.sendMail({
        to: user.email,
        subject: "ReceptionAI Password Reset Request",
        text: `You requested a password reset for your ReceptionAI account.\n\nUse this link within ${PASSWORD_RESET_EXPIRY_HOURS} hours:\n${resetUrl}\n\nIf you did not request this, please ignore this email.`,
      });
    }

    // Always return safe success message to prevent user enumeration
    return reply.send({
      data: {
        message:
          "If that email address is registered, instructions to reset your password have been sent.",
      },
    });
  });

  // 6. Reset Password
  app.post("/api/v1/auth/reset-password", async (req, reply) => {
    const validated = resetPasswordSchema.parse(req.body);
    const tokenHash = hashToken(validated.token);

    const resetRecord = await prisma.passwordResetToken.findUnique({
      where: { tokenHash },
    });

    if (!resetRecord || resetRecord.usedAt !== null || resetRecord.expiresAt < new Date()) {
      return reply.status(400).send({
        error: {
          code: "INVALID_OR_EXPIRED_TOKEN",
          message: "The password reset token is invalid, expired, or has already been used.",
          requestId: req.id,
        },
      });
    }

    const newPasswordHash = await hashPassword(validated.newPassword);

    // Atomic transaction: update password, consume token, and revoke existing sessions
    await prisma.$transaction(async (tx) => {
      await tx.user.update({
        where: { id: resetRecord.userId },
        data: { passwordHash: newPasswordHash },
      });

      await tx.passwordResetToken.update({
        where: { id: resetRecord.id },
        data: { usedAt: new Date() },
      });

      await tx.session.updateMany({
        where: { userId: resetRecord.userId, revokedAt: null },
        data: { revokedAt: new Date() },
      });
    });

    return reply.send({
      data: {
        message:
          "Password reset successful. All active sessions have been invalidated. Please log in.",
      },
    });
  });

  // 7. Verify Email
  app.post("/api/v1/auth/verify-email", async (req, reply) => {
    const validated = verifyEmailSchema.parse(req.body);
    const tokenHash = hashToken(validated.token);

    const tokenRecord = await prisma.emailVerificationToken.findUnique({
      where: { tokenHash },
    });

    if (!tokenRecord || tokenRecord.usedAt !== null || tokenRecord.expiresAt < new Date()) {
      return reply.status(400).send({
        error: {
          code: "INVALID_TOKEN",
          message: "Email verification link is invalid, expired, or already used.",
          requestId: req.id,
        },
      });
    }

    await prisma.$transaction([
      prisma.user.update({
        where: { id: tokenRecord.userId },
        data: { emailVerifiedAt: new Date() },
      }),
      prisma.emailVerificationToken.update({
        where: { id: tokenRecord.id },
        data: { usedAt: new Date() },
      }),
    ]);

    return reply.send({ data: { verified: true } });
  });
}
