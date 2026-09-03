import { PrismaClient, WorkspaceRole, ReceptionistStatus, CallStatus, CallOutcome, LeadStatus, AppointmentStatus, MessageUrgency, KnowledgeSourceStatus } from "@prisma/client";
import bcrypt from "bcryptjs";

const prisma = new PrismaClient();

async function main() {
  console.log("🌱 Starting ReceptionAI database seed...");

  // 1. Clear previous data
  await prisma.usageEvent.deleteMany();
  await prisma.auditLog.deleteMany();
  await prisma.apiKey.deleteMany();
  await prisma.webhookDelivery.deleteMany();
  await prisma.webhookEndpoint.deleteMany();
  await prisma.message.deleteMany();
  await prisma.callSummary.deleteMany();
  await prisma.callToolExecution.deleteMany();
  await prisma.callMessage.deleteMany();
  await prisma.callParticipant.deleteMany();
  await prisma.appointment.deleteMany();
  await prisma.lead.deleteMany();
  await prisma.call.deleteMany();
  await prisma.contact.deleteMany();
  await prisma.receptionistKnowledgeSource.deleteMany();
  await prisma.knowledgeChunk.deleteMany();
  await prisma.knowledgeDocument.deleteMany();
  await prisma.knowledgeSource.deleteMany();
  await prisma.specialHour.deleteMany();
  await prisma.businessHour.deleteMany();
  await prisma.service.deleteMany();
  await prisma.phoneNumber.deleteMany();
  await prisma.receptionist.deleteMany();
  await prisma.workspaceMember.deleteMany();
  await prisma.workspace.deleteMany();
  await prisma.user.deleteMany();

  // 2. Create Primary Demo User
  const passwordHash = await bcrypt.hash("password123", 10);
  const demoUser = await prisma.user.create({
    data: {
      email: "demo@brightdental.com",
      name: "Dr. Marcus Vance",
      passwordHash,
      emailVerifiedAt: new Date(),
      avatarUrl: "https://images.unsplash.com/photo-1622253692010-333f2da6031d?w=150&auto=format&fit=crop&q=80",
    },
  });

  const secondaryUser = await prisma.user.create({
    data: {
      email: "emma.clark@sterlinglegal.com",
      name: "Emma Clark, Esq.",
      passwordHash,
      emailVerifiedAt: new Date(),
      avatarUrl: "https://images.unsplash.com/photo-1573496359142-b8d87734a5a2?w=150&auto=format&fit=crop&q=80",
    },
  });

  console.log("👤 Created demo users");

  // 3. Create Workspaces
  const brightDental = await prisma.workspace.create({
    data: {
      name: "Bright Dental",
      slug: "bright-dental",
      timezone: "America/Los_Angeles",
      industry: "Dental Clinic",
      members: {
        create: {
          userId: demoUser.id,
          role: WorkspaceRole.OWNER,
        },
      },
    },
  });

  const sterlingLegal = await prisma.workspace.create({
    data: {
      name: "Sterling Legal Partners",
      slug: "sterling-legal",
      timezone: "America/New_York",
      industry: "Law Firm",
      members: {
        create: {
          userId: secondaryUser.id,
          role: WorkspaceRole.OWNER,
        },
      },
    },
  });

  console.log("🏢 Created workspaces");

  // 4. Create Business Hours for Bright Dental
  for (let day = 0; day <= 6; day++) {
    const isWeekday = day >= 1 && day <= 5;
    const isSaturday = day === 6;
    await prisma.businessHour.create({
      data: {
        workspaceId: brightDental.id,
        dayOfWeek: day,
        openTime: isWeekday ? "08:30" : isSaturday ? "09:00" : "00:00",
        closeTime: isWeekday ? "17:30" : isSaturday ? "14:00" : "00:00",
        enabled: isWeekday || isSaturday,
      },
    });
  }

  // 5. Create Services for Bright Dental
  const servicesData = [
    { name: "Dental Cleaning & Polish", description: "Routine preventive dental cleaning, plaque removal, and fluoride polish.", durationMinutes: 45, priceText: "$120" },
    { name: "Comprehensive Dental Exam & X-Rays", description: "Full mouth digital X-rays, periodontal evaluation, and dentist examination.", durationMinutes: 60, priceText: "$180" },
    { name: "Teeth Whitening Treatment", description: "In-office professional Philips Zoom whitening session.", durationMinutes: 60, priceText: "$350" },
    { name: "Emergency Toothache Consultation", description: "Same-day diagnostic triage for sudden pain, cracked teeth, or oral injury.", durationMinutes: 30, priceText: "$150" },
    { name: "Invisalign Orthodontic Consult", description: "3D iTero digital scan and orthodontic evaluation.", durationMinutes: 45, priceText: "Complimentary" },
    { name: "Crown & Bridge Consultation", description: "Restorative consultation for damaged or missing teeth.", durationMinutes: 45, priceText: "$140" },
  ];

  const createdServices = [];
  for (const s of servicesData) {
    const svc = await prisma.service.create({
      data: {
        workspaceId: brightDental.id,
        ...s,
      },
    });
    createdServices.push(svc);
  }

  console.log("🦷 Created dental clinic services");

  // 6. Create AI Receptionist: Ava
  const ava = await prisma.receptionist.create({
    data: {
      workspaceId: brightDental.id,
      name: "Ava",
      slug: "ava",
      description: "Primary front-desk voice receptionist for Bright Dental clinic.",
      role: "Dental Office Receptionist",
      industry: "dental",
      language: "en-US",
      status: ReceptionistStatus.ACTIVE,
      voiceConfig: {
        voice: "alloy",
        speed: 1.0,
        style: "friendly",
        interruptionHandling: true,
        responseLength: "concise",
      },
      personalityConfig: {
        traits: ["Professional", "Friendly", "Warm", "Patient", "Concise"],
        tone: "friendly",
      },
      greeting: "Thank you for calling Bright Dental. This is Ava. How may I help you today?",
      afterHoursGreeting: "Thank you for calling Bright Dental. Our office is currently closed, but I can help you schedule an upcoming appointment or take a message for our staff.",
      instructions: `You are Ava, the front-desk AI voice receptionist for Bright Dental located in Springfield.
Your job is to answer incoming calls warmly, professionally, and concisely.

CORE BEHAVIORS:
1. Identify Caller Need: Determine whether the caller wants to schedule an appointment, ask about insurance/pricing, get directions, or report an urgent dental emergency.
2. Calendar & Scheduling: Never fabricate availability. Always use 'check_availability' with the requested service and date preference. Offer specific slots (e.g. 10:30 AM or 3:00 PM).
3. Confirm Details: Before booking, confirm the caller's name, phone number, chosen service, and exact appointment time.
4. Medical Emergencies: If a caller is experiencing severe facial trauma, uncontrolled bleeding, or breathing difficulty, instruct them to call 911 immediately or offer to transfer them to Dr. Vance's emergency line.
5. Tone: Speak in short, conversational sentences. Avoid reading lengthy bullet lists over voice.`,
      objectiveConfig: {
        answerQuestions: true,
        bookAppointments: true,
        captureLeads: true,
        takeMessages: true,
        transferEmergency: true,
        handleAfterHours: true,
      },
      behaviorConfig: {
        maxDurationSeconds: 600,
        silenceTimeoutSeconds: 15,
        recordCalls: true,
      },
    },
  });

  // Secondary Receptionist for Law Firm: Emma
  await prisma.receptionist.create({
    data: {
      workspaceId: sterlingLegal.id,
      name: "Emma",
      slug: "emma",
      description: "Intake and consultation coordinator for Sterling Legal.",
      role: "Legal Intake Specialist",
      industry: "legal",
      language: "en-US",
      status: ReceptionistStatus.ACTIVE,
      voiceConfig: {
        voice: "shimmer",
        speed: 0.95,
        style: "professional",
        interruptionHandling: true,
        responseLength: "concise",
      },
      personalityConfig: {
        traits: ["Professional", "Poised", "Empathetic", "Concise"],
        tone: "formal",
      },
      greeting: "Thank you for calling Sterling Legal Partners. My name is Emma. How can I assist you today?",
      instructions: "You are Emma, intake coordinator at Sterling Legal Partners. Assist callers with case inquiries, schedule paid initial consultations, and route urgent legal notices.",
    },
  });

  // 7. Phone Number for Ava
  const primaryNumber = await prisma.phoneNumber.create({
    data: {
      workspaceId: brightDental.id,
      number: "+1 (541) 555-0199",
      country: "US",
      provider: "twilio",
      receptionistId: ava.id,
      status: "active",
      capabilities: { voice: true, sms: true },
    },
  });

  // 8. Knowledge Base for Bright Dental
  const kbSource = await prisma.knowledgeSource.create({
    data: {
      workspaceId: brightDental.id,
      name: "Bright Dental Knowledge Guide",
      type: "manual",
      status: KnowledgeSourceStatus.READY,
      config: { autoSync: true },
    },
  });

  const kbDoc = await prisma.knowledgeDocument.create({
    data: {
      workspaceId: brightDental.id,
      sourceId: kbSource.id,
      title: "Clinic Services, Insurance, Hours & Protocols",
      contentHash: "hsh_dental_kb_v1",
      metadata: { author: "Dr. Marcus Vance", verified: true },
    },
  });

  const chunksData = [
    {
      content: "Bright Dental is located at 742 Evergreen Terrace, Suite 300, Springfield, OR 97477. Free validated parking is available in the medical garage adjacent to the west entrance. The building is wheelchair accessible with elevator access to the 3rd floor.",
      metadata: { category: "location_parking" },
    },
    {
      content: "Office Operating Hours: Monday through Friday from 8:30 AM to 5:30 PM. Saturday from 9:00 AM to 2:00 PM for cleanings and scheduled procedures. Closed on Sundays. After-hours callers can leave urgent messages or book online appointments.",
      metadata: { category: "hours" },
    },
    {
      content: "Insurances Accepted: We are in-network with Delta Dental Premier & PPO, MetLife, Cigna Dental, Guardian, Aetna, and BlueCross BlueShield. We submit out-of-network claims on your behalf. We also accept CareCredit with 0% promotional APR financing for 6 or 12 months.",
      metadata: { category: "insurance_billing" },
    },
    {
      content: "Routine Pricing: Preventive Dental Cleaning is $120. Comprehensive Dental Exam with full-mouth digital X-Rays is $180. Professional In-Office Zoom Whitening is $350. Emergency toothache diagnosis is $150. New patient consultation is $49 special promo.",
      metadata: { category: "pricing" },
    },
    {
      content: "New Patient Procedures: New patients are asked to arrive 10 minutes prior to their appointment with a government-issued photo ID and current dental insurance card. Digital intake forms can be completed on your phone beforehand via the SMS confirmation link.",
      metadata: { category: "new_patients" },
    },
    {
      content: "Dental Emergencies & Tooth Trauma: Severe toothache, knocked-out teeth, or facial swelling qualify as urgent. We reserve two same-day emergency slots daily at 11:30 AM and 4:00 PM. Callers in extreme distress should be transferred directly to Dr. Vance's emergency triage line.",
      metadata: { category: "emergencies" },
    },
    {
      content: "Cancellation & Rescheduling Policy: We require at least 24 hours advance notice for appointment rescheduling or cancellation to avoid a $45 late fee. We understand sickness and unforeseen emergencies and will waive fees under reasonable circumstances.",
      metadata: { category: "cancellation_policy" },
    },
  ];

  for (let i = 0; i < chunksData.length; i++) {
    await prisma.knowledgeChunk.create({
      data: {
        workspaceId: brightDental.id,
        sourceId: kbSource.id,
        documentId: kbDoc.id,
        content: chunksData[i].content,
        tokenCount: Math.round(chunksData[i].content.length / 4),
        chunkIndex: i,
        metadata: chunksData[i].metadata,
      },
    });
  }

  // Link Knowledge Source to Ava
  await prisma.receptionistKnowledgeSource.create({
    data: {
      receptionistId: ava.id,
      knowledgeSourceId: kbSource.id,
    },
  });

  console.log("📚 Populated knowledge base and assigned to Ava");

  // 9. Generate realistic synthetic callers & contacts
  const firstNames = ["James", "Emma", "Liam", "Olivia", "Noah", "Sophia", "Lucas", "Isabella", "Mason", "Mia", "Ethan", "Harper", "Alexander", "Evelyn", "Daniel", "Abigail", "Henry", "Emily", "Sebastian", "Elizabeth", "Jackson", "Sofia", "Aiden", "Avery", "Matthew", "Ella", "David", "Scarlett", "Joseph", "Grace", "Samuel", "Chloe", "Benjamin", "Victoria", "Carter", "Riley", "Owen", "Aria", "Wyatt", "Lily"];
  const lastNames = ["Smith", "Johnson", "Williams", "Brown", "Jones", "Garcia", "Miller", "Davis", "Rodriguez", "Martinez", "Hernandez", "Lopez", "Gonzalez", "Wilson", "Anderson", "Thomas", "Taylor", "Moore", "Jackson", "Martin", "Lee", "Perez", "Thompson", "White", "Harris", "Sanchez", "Clark", "Ramirez", "Lewis", "Robinson", "Walker", "Young", "Allen", "King", "Wright", "Scott", "Torres", "Nguyen", "Hill", "Flores"];

  const createdContacts = [];
  for (let i = 0; i < 40; i++) {
    const fn = firstNames[i % firstNames.length];
    const ln = lastNames[i % lastNames.length];
    const phone = `+1 (541) 555-01${10 + i}`;
    const email = `${fn.toLowerCase()}.${ln.toLowerCase()}@example.com`;

    const contact = await prisma.contact.create({
      data: {
        workspaceId: brightDental.id,
        firstName: fn,
        lastName: ln,
        phone,
        email,
        source: "voice_call",
        metadata: { patientType: i % 3 === 0 ? "new" : "existing" },
      },
    });
    createdContacts.push(contact);
  }

  console.log(`👥 Created ${createdContacts.length} contacts`);

  // 10. Generate 250 Realistic Synthetic Calls across the last 30 days
  const now = new Date();
  const outcomes: CallOutcome[] = [
    CallOutcome.APPOINTMENT_BOOKED,
    CallOutcome.QUESTION_ANSWERED,
    CallOutcome.LEAD_CAPTURED,
    CallOutcome.MESSAGE_TAKEN,
    CallOutcome.CALL_TRANSFERRED,
    CallOutcome.APPOINTMENT_RESCHEDULED,
    CallOutcome.CALLBACK_REQUESTED,
  ];

  const intents = [
    "Book routine cleaning",
    "Inquire about dental insurance",
    "Emergency tooth pain",
    "Teeth whitening cost",
    "Reschedule Thursday appointment",
    "Directions and parking query",
    "Leave message for Dr. Vance",
    "New patient registration",
  ];

  let bookedCount = 0;
  let leadsCount = 0;
  let transfersCount = 0;
  let messagesCount = 0;

  for (let i = 0; i < 250; i++) {
    // Distribute calls over past 30 days
    const daysAgo = Math.floor(Math.random() * 30);
    const hourOfDay = 8 + Math.floor(Math.random() * 9); // 8:00 to 17:00
    const minute = Math.floor(Math.random() * 60);
    const callDate = new Date(now.getTime() - daysAgo * 24 * 3600 * 1000);
    callDate.setHours(hourOfDay, minute, 0, 0);

    const contact = createdContacts[i % createdContacts.length];
    const duration = 60 + Math.floor(Math.random() * 240); // 60 to 300 seconds
    const endedAt = new Date(callDate.getTime() + duration * 1000);

    // Pick weighted outcome
    let outcome: CallOutcome;
    const rand = Math.random();
    if (rand < 0.28) {
      outcome = CallOutcome.APPOINTMENT_BOOKED;
      bookedCount++;
    } else if (rand < 0.58) {
      outcome = CallOutcome.QUESTION_ANSWERED;
    } else if (rand < 0.72) {
      outcome = CallOutcome.LEAD_CAPTURED;
      leadsCount++;
    } else if (rand < 0.84) {
      outcome = CallOutcome.CALL_TRANSFERRED;
      transfersCount++;
    } else if (rand < 0.94) {
      outcome = CallOutcome.MESSAGE_TAKEN;
      messagesCount++;
    } else {
      outcome = CallOutcome.CALLBACK_REQUESTED;
    }

    const intent = intents[Math.floor(Math.random() * intents.length)];
    const sentiment = Math.random() > 0.15 ? "positive" : Math.random() > 0.5 ? "neutral" : "mixed";

    const call = await prisma.call.create({
      data: {
        workspaceId: brightDental.id,
        receptionistId: ava.id,
        phoneNumberId: primaryNumber.id,
        direction: "inbound",
        callerNumber: contact.phone,
        destinationNumber: primaryNumber.number,
        status: CallStatus.COMPLETED,
        startedAt: callDate,
        answeredAt: new Date(callDate.getTime() + 3000),
        endedAt,
        durationSeconds: duration,
        primaryOutcome: outcome,
        sentiment,
        recordingStatus: "available",
        recordingKey: `recordings/call_${brightDental.id}_${i}.mp3`,
      },
    });

    // Participant
    await prisma.callParticipant.create({
      data: {
        callId: call.id,
        type: "caller",
        contactId: contact.id,
        phoneNumber: contact.phone,
        displayName: `${contact.firstName} ${contact.lastName}`,
      },
    });

    // If it's one of the primary demo calls, create rich conversation messages & tool executions
    if (i < 15 || outcome === CallOutcome.APPOINTMENT_BOOKED) {
      const selectedService = createdServices[Math.floor(Math.random() * createdServices.length)];

      await prisma.callMessage.createMany({
        data: [
          {
            workspaceId: brightDental.id,
            callId: call.id,
            sequence: 1,
            role: "assistant",
            text: "Thank you for calling Bright Dental. This is Ava. How may I help you today?",
          },
          {
            workspaceId: brightDental.id,
            callId: call.id,
            sequence: 2,
            role: "caller",
            text: `Hi Ava, I'd like to book an appointment for a ${selectedService.name.toLowerCase()} tomorrow afternoon.`,
          },
          {
            workspaceId: brightDental.id,
            callId: call.id,
            sequence: 3,
            role: "assistant",
            text: `I would be happy to help with that! Let me check our schedule for ${selectedService.name} tomorrow afternoon. Just a moment.`,
          },
          {
            workspaceId: brightDental.id,
            callId: call.id,
            sequence: 4,
            role: "assistant",
            text: `We have openings tomorrow at 2:00 PM and 3:30 PM with Dr. Vance. Would either of those times work for you?`,
          },
          {
            workspaceId: brightDental.id,
            callId: call.id,
            sequence: 5,
            role: "caller",
            text: "3:30 PM works great for me.",
          },
          {
            workspaceId: brightDental.id,
            callId: call.id,
            sequence: 6,
            role: "assistant",
            text: `Wonderful! Just to confirm, you are scheduled for a ${selectedService.name} tomorrow at 3:30 PM. We'll send a confirmation text to ${contact.phone}. Is there anything else I can help with?`,
          },
        ],
      });

      // Tool executions
      await prisma.callToolExecution.create({
        data: {
          workspaceId: brightDental.id,
          callId: call.id,
          receptionistId: ava.id,
          toolName: "check_availability",
          toolCallId: `call_tool_${i}_1`,
          inputJson: { service: selectedService.name, datePreference: "tomorrow afternoon" },
          outputJson: { availableSlots: ["14:00", "15:30"], durationMinutes: selectedService.durationMinutes },
          status: "success",
          durationMs: 245,
        },
      });

      if (outcome === CallOutcome.APPOINTMENT_BOOKED) {
        await prisma.callToolExecution.create({
          data: {
            workspaceId: brightDental.id,
            callId: call.id,
            receptionistId: ava.id,
            toolName: "book_appointment",
            toolCallId: `call_tool_${i}_2`,
            inputJson: { contactId: contact.id, serviceId: selectedService.id, slot: "15:30" },
            outputJson: { success: true, appointmentId: `apt_${call.id.slice(-6)}`, confirmed: true },
            status: "success",
            durationMs: 180,
          },
        });

        // Create actual appointment record
        const apptDate = new Date(callDate.getTime() + 24 * 3600 * 1000);
        apptDate.setHours(15, 30, 0, 0);
        const apptEnd = new Date(apptDate.getTime() + selectedService.durationMinutes * 60 * 1000);

        await prisma.appointment.create({
          data: {
            workspaceId: brightDental.id,
            contactId: contact.id,
            callId: call.id,
            receptionistId: ava.id,
            serviceId: selectedService.id,
            startAt: apptDate,
            endAt: apptEnd,
            status: AppointmentStatus.CONFIRMED,
            notes: `Booked via voice call with Ava for ${selectedService.name}`,
          },
        });
      }
    }

    // Call Summary
    await prisma.callSummary.create({
      data: {
        workspaceId: brightDental.id,
        callId: call.id,
        summary: `${contact.firstName} called regarding ${intent.toLowerCase()}. Ava addressed the request smoothly and concluded with outcome: ${outcome.replace(/_/g, " ").toLowerCase()}.`,
        intent,
        primaryOutcome: outcome,
        sentiment,
        followUpRequired: outcome === CallOutcome.MESSAGE_TAKEN || outcome === CallOutcome.CALLBACK_REQUESTED,
        structuredData: {
          callerName: `${contact.firstName} ${contact.lastName}`,
          phone: contact.phone,
          intent,
          outcome,
          resolvedByAgent: outcome !== CallOutcome.CALL_TRANSFERRED,
        },
      },
    });

    // If outcome is LEAD_CAPTURED
    if (outcome === CallOutcome.LEAD_CAPTURED && i % 2 === 0) {
      await prisma.lead.create({
        data: {
          workspaceId: brightDental.id,
          contactId: contact.id,
          callId: call.id,
          status: i % 4 === 0 ? LeadStatus.QUALIFIED : LeadStatus.NEW,
          intent,
          score: 85,
          estimatedValue: 280.0,
          notes: `Lead captured via incoming phone call with Ava. Interested in ${intent}.`,
        },
      });
    }

    // If outcome is MESSAGE_TAKEN
    if (outcome === CallOutcome.MESSAGE_TAKEN && i % 3 === 0) {
      await prisma.message.create({
        data: {
          workspaceId: brightDental.id,
          callId: call.id,
          contactId: contact.id,
          subject: `Message from ${contact.firstName} ${contact.lastName}`,
          body: `Caller requested a callback regarding insurance co-pay questions. Available tomorrow morning.`,
          urgency: MessageUrgency.NORMAL,
          callbackRequested: true,
          status: "unread",
        },
      });
    }
  }

  console.log(`📞 Seeded 250 calls (Booked: ${bookedCount}, Leads: ${leadsCount}, Transfers: ${transfersCount}, Messages: ${messagesCount})`);

  // 11. Create Demo API Key & Webhook Endpoint
  await prisma.apiKey.create({
    data: {
      workspaceId: brightDental.id,
      name: "Production Zapier Integration",
      prefix: "rai_live_",
      secretHash: await bcrypt.hash("rai_live_sample_secret_key", 10),
      scopes: ["calls:read", "contacts:read", "appointments:read", "appointments:write"],
    },
  });

  const webhook = await prisma.webhookEndpoint.create({
    data: {
      workspaceId: brightDental.id,
      url: "https://api.brightdental.com/webhooks/receptionai",
      secretHash: await bcrypt.hash("whsec_dental_secret_key", 10),
      subscribedEvents: ["call.completed", "appointment.created", "lead.created"],
    },
  });

  await prisma.webhookDelivery.create({
    data: {
      workspaceId: brightDental.id,
      endpointId: webhook.id,
      eventId: "evt_call_001_complete",
      eventType: "call.completed",
      payload: { callId: "sample_call", outcome: "APPOINTMENT_BOOKED" },
      attempt: 1,
      status: "succeeded",
      responseCode: 200,
    },
  });

  console.log("✨ ReceptionAI Database Seed Completed Successfully!");
}

main()
  .catch((e) => {
    console.error("❌ Seed failed:", e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
