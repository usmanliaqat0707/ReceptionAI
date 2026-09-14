import {
  PrismaClient,
  UserStatus,
  WorkspaceRole,
  MembershipStatus,
  WorkspaceStatus,
  ActorType,
  ReceptionistStatus,
  TransferDestinationType,
  TransferDestinationStatus,
  ReceptionistTransferPurpose,
} from "@prisma/client";
import { hashPassword } from "@receptionai/security";

const prisma = new PrismaClient();

export async function seed() {
  console.log("🌱 Seeding ReceptionAI Phase 2 database...");

  // 1. Clean existing records in dependency order
  await prisma.conversationConfirmation.deleteMany();
  await prisma.receptionistToolExecution.deleteMany();
  await prisma.receptionistMessage.deleteMany();
  await prisma.lead.deleteMany();
  await prisma.contact.deleteMany();
  await prisma.businessProfile.deleteMany();
  await prisma.realtimeTestSession.deleteMany();
  await prisma.receptionistConfigurationVersion.deleteMany();
  await prisma.receptionistTransferDestination.deleteMany();
  await prisma.transferDestination.deleteMany();
  await prisma.receptionist.deleteMany();
  await prisma.businessHour.deleteMany();
  await prisma.specialHour.deleteMany();
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

  // 6. Create Workspace Business Hours (Mon-Fri 09:00 - 17:00, Sat 10:00 - 14:00, Sun Closed)
  const defaultHours = [
    { dayOfWeek: 1, openTime: "09:00", closeTime: "17:00", enabled: true },
    { dayOfWeek: 2, openTime: "09:00", closeTime: "17:00", enabled: true },
    { dayOfWeek: 3, openTime: "09:00", closeTime: "17:00", enabled: true },
    { dayOfWeek: 4, openTime: "09:00", closeTime: "17:00", enabled: true },
    { dayOfWeek: 5, openTime: "09:00", closeTime: "17:00", enabled: true },
    { dayOfWeek: 6, openTime: "10:00", closeTime: "14:00", enabled: true },
    { dayOfWeek: 0, openTime: "09:00", closeTime: "17:00", enabled: false },
  ];

  for (const h of defaultHours) {
    await prisma.businessHour.create({
      data: {
        workspaceId: brightDental.id,
        dayOfWeek: h.dayOfWeek,
        openTime: h.openTime,
        closeTime: h.closeTime,
        enabled: h.enabled,
      },
    });
  }

  // 7. Create Demo Transfer Destination: Front Desk Human (+15555550100)
  const frontDeskTransfer = await prisma.transferDestination.create({
    data: {
      workspaceId: brightDental.id,
      name: "Front Desk Human",
      type: TransferDestinationType.PHONE,
      destination: "+15555550100",
      status: TransferDestinationStatus.ACTIVE,
    },
  });

  // 8. Create Demo Receptionist: Ava (Dental Office Receptionist)
  const ava = await prisma.receptionist.create({
    data: {
      workspaceId: brightDental.id,
      name: "Ava",
      slug: "ava",
      roleTitle: "Dental Office Receptionist",
      industry: "DENTAL",
      primaryLanguage: "en-US",
      description:
        "Primary receptionist for new patient inquiries and appointment intake at Bright Dental.",
      status: ReceptionistStatus.DRAFT,
      greeting: "Thank you for calling Bright Dental. This is Ava. How may I help you today?",
      afterHoursGreeting:
        "Thank you for calling Bright Dental. Our clinic is currently closed. If this is an urgent dental emergency, please hold or leave a message.",
      instructions: `You are Ava, the front-desk receptionist for Bright Dental.

Core Responsibilities:
- Greet patients warmly and identify whether they are an existing or new patient.
- Answer general questions regarding our dental services, cleanings, and accepted dental plans.
- For appointment requests, collect the patient's preferred day, time, and reason for visit.
- For dental emergencies (e.g. severe swelling, unbearable toothache, bleeding, trauma), immediately offer to escalate or transfer according to emergency protocol.
- Never invent pricing or guarantee specific insurance coverage.
- Maintain a warm, calm, and reassuring tone at all times.`,
      voiceConfig: {
        speakingStyle: "warm",
        speakingRate: "normal",
        responsePacing: "balanced",
      },
      personalityConfig: {
        traits: ["PROFESSIONAL", "FRIENDLY", "PATIENT", "CONCISE"],
      },
      objectiveConfig: {
        objectives: [
          "ANSWER_QUESTIONS",
          "CAPTURE_LEADS",
          "BOOK_APPOINTMENTS",
          "TRANSFER_CALLS",
          "TAKE_MESSAGES",
        ],
      },
      behaviorConfig: {
        responseLength: "balanced",
        askOneQuestionAtATime: true,
        confirmCriticalDetails: true,
        allowCallerInterruptions: true,
        silenceHandling: "PROMPT_ONCE",
        silenceTimeoutSeconds: 8,
        unknownAnswerBehavior: "take_message",
      },
      afterHoursConfig: {
        mode: "TAKE_MESSAGE",
        useCustomGreeting: true,
      },
      escalationConfig: {
        onHumanRequest: true,
        onEmergency: true,
        onRepeatedFailure: true,
        onUnsupportedRequest: false,
      },
      configurationVersion: 1,
      createdByUserId: demoOwner.id,
      updatedByUserId: demoOwner.id,
    },
  });

  // Link transfer destination to Ava
  await prisma.receptionistTransferDestination.create({
    data: {
      receptionistId: ava.id,
      transferDestinationId: frontDeskTransfer.id,
      priority: 1,
      purpose: ReceptionistTransferPurpose.GENERAL,
      enabled: true,
    },
  });

  // 9. Create Business Profile for Bright Dental
  await prisma.businessProfile.create({
    data: {
      workspaceId: brightDental.id,
      businessName: "Bright Dental Care",
      legalName: "Bright Dental Care PLLC",
      description: "Comprehensive family, cosmetic, and emergency dental care.",
      phone: "+12125550199",
      email: "info@brightdental.com",
      website: "https://brightdental.example.com",
      addressLine1: "1200 Dental Way",
      addressLine2: "Suite 400",
      city: "New York",
      region: "NY",
      postalCode: "10001",
      country: "US",
      timezone: "America/New_York",
    },
  });

  // 10. Create Demo Contacts
  const contactElena = await prisma.contact.create({
    data: {
      workspaceId: brightDental.id,
      firstName: "Elena",
      lastName: "Rostova",
      phone: "+12125550144",
      normalizedPhone: "+12125550144",
      email: "elena@example.com",
      normalizedEmail: "elena@example.com",
      company: "Rostova Media",
      source: "VOICE_RECEPTIONIST",
      notes: "First-time caller interested in teeth whitening.",
    },
  });

  const contactDavid = await prisma.contact.create({
    data: {
      workspaceId: brightDental.id,
      firstName: "David",
      lastName: "Miller",
      phone: "+12125550188",
      normalizedPhone: "+12125550188",
      email: "david.miller@example.com",
      normalizedEmail: "david.miller@example.com",
      company: null,
      source: "MANUAL",
      notes: "Referred by Dr. Vance.",
    },
  });

  const contactSophia = await prisma.contact.create({
    data: {
      workspaceId: brightDental.id,
      firstName: "Sophia",
      lastName: "Chen",
      phone: "+12125550122",
      normalizedPhone: "+12125550122",
      email: "sophia.chen@example.com",
      normalizedEmail: "sophia.chen@example.com",
      company: "TechVentures",
      source: "VOICE_RECEPTIONIST",
      notes: "Follow-up inquiry regarding lab results.",
    },
  });

  // 11. Create Demo Leads
  await prisma.lead.create({
    data: {
      workspaceId: brightDental.id,
      contactId: contactElena.id,
      receptionistId: ava.id,
      status: "NEW",
      source: "VOICE_RECEPTIONIST",
      intent: "Teeth Whitening & Comprehensive Exam",
      qualification: "Prefers Friday afternoon slot, has Delta Dental insurance",
      notes: "Caller was friendly and requested pricing breakdown.",
    },
  });

  await prisma.lead.create({
    data: {
      workspaceId: brightDental.id,
      contactId: contactDavid.id,
      receptionistId: ava.id,
      status: "QUALIFIED",
      source: "MANUAL",
      intent: "Dental Implant Consultation",
      qualification: "Needs upper molar implant replacement, high priority",
      notes: "Consultation booked for next month.",
    },
  });

  // 12. Create Demo Messages
  await prisma.receptionistMessage.create({
    data: {
      workspaceId: brightDental.id,
      contactId: contactElena.id,
      receptionistId: ava.id,
      subject: "Inquiry about Saturday opening hours",
      body: "Elena called asking if the clinic will be open on Saturday the 15th for an emergency cleaning.",
      urgency: "NORMAL",
      status: "NEW",
      callbackRequested: false,
    },
  });

  await prisma.receptionistMessage.create({
    data: {
      workspaceId: brightDental.id,
      contactId: contactSophia.id,
      receptionistId: ava.id,
      subject: "Urgent Callback Requested - Dr. Vance",
      body: "Sophia Chen called requesting a return phone call from Dr. Vance before 11:00 AM regarding her recent treatment plan.",
      urgency: "HIGH",
      status: "NEW",
      callbackRequested: true,
      requestedCallbackWindow: "MORNING",
    },
  });

  // 13. Record Initial Audit Events
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
        action: "receptionist.created",
        resourceType: "receptionist",
        resourceId: ava.id,
        metadata: { name: ava.name, slug: ava.slug, roleTitle: ava.roleTitle },
      },
    ],
  });

  // 14. Seed Phase 5: Knowledge Base Sources & Documents
  console.log("   - Seeding Knowledge Base...");
  const manualContent = `
# Bright Dental Care Services & Clinical Policies

## Dental Cleaning and Prophylaxis
Bright Dental Care offers professional comprehensive dental cleaning, tartar removal, and enamel polishing. Routine cleanings are recommended every six months to prevent periodontal disease.

## Professional Teeth Whitening
Bright Dental offers in-office laser teeth whitening as well as custom take-home whitening trays. Our in-office whitening procedure brightens smiles by up to 8 shades in a single 60-minute session.

## Routine Exams & Digital X-Rays
Comprehensive examinations include oral cancer screening, periodontal evaluation, and low-radiation digital bitewing x-rays.

## New Patient Arrival Policy
New patients must arrive 15 minutes prior to their scheduled appointment time to complete required medical history documentation and insurance verification forms.

## Accepted Dental Insurance Plans
Bright Dental accepts most major PPO dental insurance plans, including Delta Dental, Cigna, MetLife, and Guardian. Patients should call our front desk for plan-specific co-pay and deductible verification.
`.trim();

  const sourceServices = await prisma.knowledgeSource.create({
    data: {
      workspaceId: brightDental.id,
      type: "MANUAL",
      name: "Bright Dental Services & Policies",
      description: "Official guide on dental cleanings, teeth whitening, exams, and patient arrival policies.",
      status: "READY",
      embeddingProvider: "openai",
      embeddingModel: "text-embedding-3-small",
      configuration: {
        title: "Bright Dental Care Services & Clinical Policies",
        content: manualContent,
      },
      lastIndexedAt: new Date(),
      lastSuccessfulIndexedAt: new Date(),
    },
  });

  const genServices = await prisma.knowledgeIndexGeneration.create({
    data: {
      workspaceId: brightDental.id,
      sourceId: sourceServices.id,
      generation: 1,
      status: "COMPLETED",
      completedAt: new Date(),
      embeddingModel: "text-embedding-3-small",
      documentCount: 1,
      chunkCount: 3,
    },
  });

  await prisma.knowledgeSource.update({
    where: { id: sourceServices.id },
    data: { activeGenerationId: genServices.id },
  });

  const docServices = await prisma.knowledgeDocument.create({
    data: {
      workspaceId: brightDental.id,
      sourceId: sourceServices.id,
      generationId: genServices.id,
      title: "Bright Dental Care Services & Clinical Policies",
      mimeType: "text/plain",
      contentHash: "hash_services_001",
      status: "ACTIVE",
      indexedAt: new Date(),
    },
  });

  // Assign source to demo receptionist Ava
  await prisma.receptionistKnowledgeSource.create({
    data: {
      receptionistId: ava.id,
      knowledgeSourceId: sourceServices.id,
    },
  });

  // Seed chunks with deterministic vectors
  function generateDeterministicVector(text: string): string {
    const v = new Array(1536).fill(0);
    const tokens = text.toLowerCase().match(/\b[a-z0-9_]+\b/g) || [text];
    for (const token of tokens) {
      let sum = 0;
      for (let i = 0; i < token.length; i++) sum = (sum * 31 + token.charCodeAt(i)) % 1536;
      v[sum] += 0.5;
    }
    let norm = Math.sqrt(v.reduce((a, b) => a + b * b, 0)) || 1;
    return `[${v.map((n) => (n / norm).toFixed(6)).join(",")}]`;
  }

  const chunksData = [
    {
      text: "Bright Dental offers in-office laser teeth whitening as well as custom take-home whitening trays. Our in-office whitening procedure brightens smiles by up to 8 shades in a single 60-minute session.",
      path: "Services > Teeth Whitening",
    },
    {
      text: "Bright Dental Care offers professional comprehensive dental cleaning, tartar removal, and enamel polishing. Routine cleanings are recommended every six months.",
      path: "Services > Dental Cleaning",
    },
    {
      text: "New patients must arrive 15 minutes prior to their scheduled appointment time to complete required medical history documentation and insurance verification forms. We accept Delta Dental, Cigna, MetLife, and Guardian.",
      path: "Policies > Arrival & Insurance",
    },
  ];

  for (let idx = 0; idx < chunksData.length; idx++) {
    const item = chunksData[idx];
    const vecStr = generateDeterministicVector(item.text);
    await prisma.$executeRawUnsafe(
      `INSERT INTO "knowledge_chunks" (
        "id", "workspaceId", "sourceId", "documentId", "generationId",
        "chunkIndex", "content", "contentHash", "tokenCount", "headingPath",
        "embedding", "embeddingModel", "createdAt", "updatedAt"
      ) VALUES (
        $1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11::vector, $12, NOW(), NOW()
      );`,
      `chk_seed_${idx + 1}`,
      brightDental.id,
      sourceServices.id,
      docServices.id,
      genServices.id,
      idx,
      item.text,
      `hash_chk_${idx}`,
      40,
      item.path,
      vecStr,
      "text-embedding-3-small"
    );
  }

  console.log("✅ Seed completed successfully!");
  console.log("   - Demo Owner: demo@brightdental.com / password123");
  console.log("   - Demo Staff: sarah@brightdental.com / password123");
  console.log("   - Workspace: Bright Dental (slug: bright-dental)");
  console.log("   - Demo Receptionist: Ava (slug: ava, status: DRAFT)");
  console.log("   - Demo Transfer: Front Desk Human (+15555550100)");
  console.log("   - Demo Business Profile: Bright Dental Care");
  console.log("   - Demo Contacts: Elena Rostova, David Miller, Sophia Chen");
  console.log("   - Demo Leads: 2 active leads");
  console.log("   - Demo Messages: 2 messages (1 callback request)");
}

if (require.main === module || (typeof process !== "undefined" && process.argv[1]?.includes("seed"))) {
  seed()
    .catch((e) => {
      console.error("❌ Seed failed:", e);
      process.exit(1);
    })
    .finally(async () => {
      await prisma.$disconnect();
    });
}
