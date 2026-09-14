import {
  CommunicationChannel,
  CommunicationPurpose,
} from "@receptionai/db";

export interface DefaultTemplateDefinition {
  key: string;
  channel: CommunicationChannel;
  name: string;
  purpose: CommunicationPurpose;
  subjectTemplate?: string;
  bodyTemplate: string;
  variables: string[];
}

export const DEFAULT_COMMUNICATION_TEMPLATES: DefaultTemplateDefinition[] = [
  // Appointment Confirmation SMS
  {
    key: "appointment_confirmation_sms",
    channel: "SMS",
    name: "Appointment Confirmation (SMS)",
    purpose: "APPOINTMENT_CONFIRMATION",
    bodyTemplate:
      "Hi {{customer_first_name}}, your {{service_name}} appointment with {{business_name}} is confirmed for {{appointment_date}} at {{appointment_time}}.",
    variables: [
      "customer_first_name",
      "service_name",
      "business_name",
      "appointment_date",
      "appointment_time",
      "timezone",
    ],
  },
  // Appointment Confirmation Email
  {
    key: "appointment_confirmation_email",
    channel: "EMAIL",
    name: "Appointment Confirmation (Email)",
    purpose: "APPOINTMENT_CONFIRMATION",
    subjectTemplate: "Appointment Confirmed: {{service_name}} with {{business_name}}",
    bodyTemplate:
      "Hello {{customer_first_name}},\n\nYour appointment for {{service_name}} has been confirmed for {{appointment_date}} at {{appointment_time}} ({{timezone}}).\n\nBusiness: {{business_name}}\nContact Phone: {{business_phone}}\n\nIf you need to reschedule or cancel, please give us a call.",
    variables: [
      "customer_first_name",
      "service_name",
      "business_name",
      "business_phone",
      "appointment_date",
      "appointment_time",
      "timezone",
    ],
  },

  // Appointment Reschedule SMS
  {
    key: "appointment_reschedule_sms",
    channel: "SMS",
    name: "Appointment Rescheduled (SMS)",
    purpose: "APPOINTMENT_RESCHEDULE",
    bodyTemplate:
      "Hi {{customer_first_name}}, your {{service_name}} appointment with {{business_name}} has been rescheduled to {{appointment_date}} at {{appointment_time}}.",
    variables: [
      "customer_first_name",
      "service_name",
      "business_name",
      "appointment_date",
      "appointment_time",
      "timezone",
    ],
  },
  // Appointment Reschedule Email
  {
    key: "appointment_reschedule_email",
    channel: "EMAIL",
    name: "Appointment Rescheduled (Email)",
    purpose: "APPOINTMENT_RESCHEDULE",
    subjectTemplate: "Appointment Rescheduled: {{service_name}} with {{business_name}}",
    bodyTemplate:
      "Hello {{customer_first_name}},\n\nYour appointment for {{service_name}} with {{business_name}} has been rescheduled to {{appointment_date}} at {{appointment_time}} ({{timezone}}).\n\nIf this was not you or if you need assistance, please contact us at {{business_phone}}.",
    variables: [
      "customer_first_name",
      "service_name",
      "business_name",
      "business_phone",
      "appointment_date",
      "appointment_time",
      "timezone",
    ],
  },

  // Appointment Cancellation SMS
  {
    key: "appointment_cancellation_sms",
    channel: "SMS",
    name: "Appointment Cancelled (SMS)",
    purpose: "APPOINTMENT_CANCELLATION",
    bodyTemplate:
      "Hi {{customer_first_name}}, your {{service_name}} appointment with {{business_name}} on {{appointment_date}} at {{appointment_time}} has been cancelled.",
    variables: [
      "customer_first_name",
      "service_name",
      "business_name",
      "appointment_date",
      "appointment_time",
    ],
  },
  // Appointment Cancellation Email
  {
    key: "appointment_cancellation_email",
    channel: "EMAIL",
    name: "Appointment Cancelled (Email)",
    purpose: "APPOINTMENT_CANCELLATION",
    subjectTemplate: "Appointment Cancelled: {{service_name}} with {{business_name}}",
    bodyTemplate:
      "Hello {{customer_first_name}},\n\nYour appointment for {{service_name}} on {{appointment_date}} at {{appointment_time}} has been cancelled.\n\nIf you would like to book another time, please contact {{business_name}} at {{business_phone}}.",
    variables: [
      "customer_first_name",
      "service_name",
      "business_name",
      "business_phone",
      "appointment_date",
      "appointment_time",
    ],
  },

  // Callback Confirmation SMS
  {
    key: "callback_confirmation_sms",
    channel: "SMS",
    name: "Callback Confirmation (SMS)",
    purpose: "CALLBACK_CONFIRMATION",
    bodyTemplate:
      "Hi {{customer_first_name}}, we received your request for a callback at {{business_name}}. Our team will reach out to you shortly.",
    variables: ["customer_first_name", "business_name"],
  },
  // Callback Confirmation Email
  {
    key: "callback_confirmation_email",
    channel: "EMAIL",
    name: "Callback Confirmation (Email)",
    purpose: "CALLBACK_CONFIRMATION",
    subjectTemplate: "Callback Request Received: {{business_name}}",
    bodyTemplate:
      "Hello {{customer_first_name}},\n\nThank you for reaching out to {{business_name}}. We have received your callback request and a member of our team will contact you as soon as possible.",
    variables: ["customer_first_name", "business_name", "business_phone"],
  },

  // Message Acknowledgement SMS
  {
    key: "message_acknowledgement_sms",
    channel: "SMS",
    name: "Message Received (SMS)",
    purpose: "MESSAGE_RECEIVED_CONFIRMATION",
    bodyTemplate:
      "Hi {{customer_first_name}}, your message has been received by {{business_name}} and forwarded to our team.",
    variables: ["customer_first_name", "business_name"],
  },
  // Message Acknowledgement Email
  {
    key: "message_acknowledgement_email",
    channel: "EMAIL",
    name: "Message Received (Email)",
    purpose: "MESSAGE_RECEIVED_CONFIRMATION",
    subjectTemplate: "Message Received: {{business_name}}",
    bodyTemplate:
      "Hello {{customer_first_name}},\n\nWe received your message for {{business_name}}. Our team will review it and get back to you if follow-up is required.",
    variables: ["customer_first_name", "business_name"],
  },

  // Team New Lead Alert Email
  {
    key: "team_new_lead_alert_email",
    channel: "EMAIL",
    name: "Team Alert: New Lead (Email)",
    purpose: "TEAM_NEW_LEAD_ALERT",
    subjectTemplate: "[New Lead] {{customer_first_name}} - {{business_name}}",
    bodyTemplate:
      "A new lead was captured by your AI receptionist.\n\nName: {{customer_first_name}} {{customer_last_name}}\nPhone: {{customer_phone}}\nEmail: {{customer_email}}\nIntent: {{lead_intent}}",
    variables: [
      "customer_first_name",
      "customer_last_name",
      "customer_phone",
      "customer_email",
      "lead_intent",
      "business_name",
    ],
  },

  // Team New Message Alert Email
  {
    key: "team_new_message_alert_email",
    channel: "EMAIL",
    name: "Team Alert: New Message (Email)",
    purpose: "TEAM_NEW_MESSAGE_ALERT",
    subjectTemplate: "[New Message] From {{customer_first_name}} - {{business_name}}",
    bodyTemplate:
      "A new message was recorded by your AI receptionist.\n\nFrom: {{customer_first_name}} {{customer_last_name}}\nPhone: {{customer_phone}}\nSubject: {{message_subject}}\nUrgency: {{message_urgency}}\n\nMessage:\n{{message_body}}",
    variables: [
      "customer_first_name",
      "customer_last_name",
      "customer_phone",
      "message_subject",
      "message_urgency",
      "message_body",
      "business_name",
    ],
  },
];
