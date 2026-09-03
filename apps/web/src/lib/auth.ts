import { prisma } from "@receptionai/db";
import jwt from "jsonwebtoken";
import { cookies } from "next/headers";

const JWT_SECRET = process.env.JWT_SECRET || "receptionai_super_secret_jwt_key_portfolio_2026";

export interface SessionUser {
  id: string;
  email: string;
  name: string;
  avatarUrl?: string | null;
  workspaceId: string;
  workspaceName: string;
  workspaceSlug: string;
  role: string;
}

export async function getCurrentUser(): Promise<SessionUser | null> {
  const cookieStore = cookies();
  const token = cookieStore.get("rai_session")?.value;

  if (token) {
    try {
      const decoded = jwt.verify(token, JWT_SECRET) as SessionUser;
      return decoded;
    } catch {
      // Invalid token, fall through to demo session
    }
  }

  // Seamless fallback for demo/portfolio preview: load Bright Dental workspace owner
  try {
    const defaultWorkspace = await prisma.workspace.findFirst({
      where: { slug: "bright-dental" },
      include: {
        members: {
          include: {
            user: true,
          },
        },
      },
    });

    if (defaultWorkspace && defaultWorkspace.members.length > 0) {
      const member = defaultWorkspace.members[0];
      return {
        id: member.user.id,
        email: member.user.email,
        name: member.user.name,
        avatarUrl: member.user.avatarUrl,
        workspaceId: defaultWorkspace.id,
        workspaceName: defaultWorkspace.name,
        workspaceSlug: defaultWorkspace.slug,
        role: member.role,
      };
    }
  } catch (err) {
    console.warn("Could not load default demo workspace from DB:", err);
  }

  return {
    id: "usr_demo_vance",
    email: "demo@brightdental.com",
    name: "Dr. Marcus Vance",
    workspaceId: "ws_bright_dental",
    workspaceName: "Bright Dental",
    workspaceSlug: "bright-dental",
    role: "OWNER",
  };
}

export function createSessionToken(payload: SessionUser): string {
  return jwt.sign(payload, JWT_SECRET, { expiresIn: "7d" });
}
