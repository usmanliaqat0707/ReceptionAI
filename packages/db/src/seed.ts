import {
  PrismaClient,
  UserStatus,
  WorkspaceRole,
  MembershipStatus,
  WorkspaceStatus,
  ActorType,
} from "@prisma/client";
import { hashPassword } from "@receptionai/security";

const prisma = new PrismaClient();

export async function seed() {
  console.log("🌱 Seeding ReceptionAI Phase 1 database...");

  // 1. Clean existing records in dependency order
  await prisma.auditLog.deleteMany();
  await prisma.passwordResetToken.deleteMany();
  await prisma.emailVerificationToken.deleteMany();
  await prisma.session.deleteMany();
  await prisma.workspaceInvitation.deleteMany();
  await prisma.workspaceMembership.deleteMany();
  await prisma.workspace.deleteMany();
  await prisma.user.deleteMany();

  // 2. Create Demo Owner (Dr. Marcus Vance)
  const ownerPasswordHash = await hashPassword("password123");
  const demoOwner = await prisma.user.create({
    data: {
      email: "demo@brightdental.com",
      name: "Dr. Marcus Vance",
      passwordHash: ownerPasswordHash,
      emailVerifiedAt: new Date(),
      status: UserStatus.ACTIVE,
    },
  });

  // 3. Create Second Team Member (Sarah Jenkins - Reception Staff)
  const staffPasswordHash = await hashPassword("password123");
  const demoStaff = await prisma.user.create({
    data: {
      email: "sarah@brightdental.com",
      name: "Sarah Jenkins",
      passwordHash: staffPasswordHash,
      emailVerifiedAt: new Date(),
      status: UserStatus.ACTIVE,
    },
  });

  // 4. Create Workspace: Bright Dental
  const brightDental = await prisma.workspace.create({
    data: {
      name: "Bright Dental",
      slug: "bright-dental",
      timezone: "America/New_York",
      industry: "Dental Clinic",
      status: WorkspaceStatus.ACTIVE,
    },
  });

  // 5. Create Memberships
  await prisma.workspaceMembership.create({
    data: {
      workspaceId: brightDental.id,
      userId: demoOwner.id,
      role: WorkspaceRole.OWNER,
      status: MembershipStatus.ACTIVE,
    },
  });

  await prisma.workspaceMembership.create({
    data: {
      workspaceId: brightDental.id,
      userId: demoStaff.id,
      role: WorkspaceRole.RECEPTION_STAFF,
      status: MembershipStatus.ACTIVE,
    },
  });

  // 6. Record Initial Audit Events
  await prisma.auditLog.createMany({
    data: [
      {
        workspaceId: brightDental.id,
        actorUserId: demoOwner.id,
        actorType: ActorType.USER,
        action: "workspace.created",
        resourceType: "workspace",
        resourceId: brightDental.id,
        metadata: { name: brightDental.name, slug: brightDental.slug },
      },
      {
        workspaceId: brightDental.id,
        actorUserId: demoOwner.id,
        actorType: ActorType.USER,
        action: "member.added",
        resourceType: "workspace_membership",
        resourceId: demoStaff.id,
        metadata: { role: WorkspaceRole.RECEPTION_STAFF, email: demoStaff.email },
      },
    ],
  });

  console.log("✅ Seed completed successfully!");
  console.log("   - Demo Owner: demo@brightdental.com / password123");
  console.log("   - Demo Staff: sarah@brightdental.com / password123");
  console.log("   - Workspace: Bright Dental (slug: bright-dental)");
}

if (process.env.NODE_ENV !== "test") {
  seed()
    .catch((e) => {
      console.error("❌ Seed failed:", e);
      process.exit(1);
    })
    .finally(async () => {
      await prisma.$disconnect();
    });
}
