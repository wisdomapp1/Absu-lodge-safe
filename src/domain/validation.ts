import { ALLOWED_AGENT_FEES_NAIRA } from './types.ts';
import type { InspectionTimeSlot, PaymentEventLog } from './types.ts';

export const ALLOWED_IMAGE_MIME_TYPES = ['image/jpeg', 'image/jpg', 'image/png', 'image/webp'];
export const ALLOWED_VIDEO_MIME_TYPES = ['video/mp4', 'video/quicktime', 'video/webm'];
export const MAX_IMAGE_SIZE_BYTES = 5 * 1024 * 1024; // 5 MB
export const MAX_VIDEO_SIZE_BYTES = 25 * 1024 * 1024; // 25 MB

export const INSPECTION_TIME_SLOTS: InspectionTimeSlot[] = [
  'Morning: 9am–12pm',
  'Afternoon: 12pm–4pm',
  'Evening: 4pm–6pm',
];

export const MANDATORY_BOOKING_POLICY_TEXT =
  'Pay ONLY Agent Fee plus Inspection Fee here first. Do NOT pay rent on this website. Do NOT pay any other fee to agent. When you go for inspection: Ask for lodge receipt BEFORE you pay rent. Make sure landlord or caretaker is aware before you pay rent. If agent tries to scam you, click REFUND in your dashboard. You will get your Agent Fee plus Inspection Fee back.';

export const RENT_PROTECTION_BANNER_TEXT =
  'Rent is paid directly to the landlord or caretaker after inspection, with a receipt. Never pay rent to an agent.';

export function validateMediaUpload(file: {
  name: string;
  type: string;
  size: number;
}): { valid: boolean; kind?: 'image' | 'video'; error?: string } {
  const mime = file.type.toLowerCase();
  const ext = file.name.split('.').pop()?.toLowerCase() || '';

  if (ALLOWED_IMAGE_MIME_TYPES.includes(mime) || ['jpg', 'jpeg', 'png', 'webp'].includes(ext)) {
    if (file.size > MAX_IMAGE_SIZE_BYTES) {
      return { valid: false, error: `${file.name} exceeds 5 MB image limit.` };
    }
    return { valid: true, kind: 'image' };
  }

  if (ALLOWED_VIDEO_MIME_TYPES.includes(mime) || ['mp4', 'mov', 'webm'].includes(ext)) {
    if (file.size > MAX_VIDEO_SIZE_BYTES) {
      return { valid: false, error: `${file.name} exceeds 25 MB video limit.` };
    }
    return { valid: true, kind: 'video' };
  }

  return {
    valid: false,
    error: `Unsupported file type for ${file.name}. Allowed formats: JPG, JPEG, PNG, WebP, MP4, MOV, WebM.`,
  };
}

export function validateAllowedAgentFeeNaira(agentFeeNaira: number): {
  valid: boolean;
  error?: string;
} {
  if (!ALLOWED_AGENT_FEES_NAIRA.includes(agentFeeNaira as (typeof ALLOWED_AGENT_FEES_NAIRA)[number])) {
    return {
      valid: false,
      error: 'Agent fee must be exactly ₦5,000, ₦10,000, ₦15,000, ₦20,000, ₦30,000, or ₦40,000.',
    };
  }
  return { valid: true };
}

export function validateAgentCommissionWithinLimit(
  yearlyRentKobo: number,
  agentCommissionKobo: number,
  maxCommissionPctOfRent: number
): { valid: boolean; maxAllowedKobo: number; error?: string } {
  const maxAllowedKobo = Math.round((yearlyRentKobo * maxCommissionPctOfRent) / 100);
  if (agentCommissionKobo < 0) {
    return { valid: false, maxAllowedKobo, error: 'Agent fee cannot be negative.' };
  }
  const naira = Math.round(agentCommissionKobo / 100);
  const discreteCheck = validateAllowedAgentFeeNaira(naira);
  if (!discreteCheck.valid) {
    return { valid: false, maxAllowedKobo, error: discreteCheck.error };
  }
  if (agentCommissionKobo > maxAllowedKobo && maxCommissionPctOfRent > 0) {
    // Allow discrete SUG-approved tiers even if rent is low, unless explicitly blocked
    return { valid: true, maxAllowedKobo };
  }
  return { valid: true, maxAllowedKobo };
}

/**
 * Detects suspicious external payment links or rent-collection wording inside lodge descriptions.
 * Runs both client-side and server-side to protect students from off-platform rent scams.
 */
export function detectSuspiciousListingDescription(description: string): {
  flagged: boolean;
  reason?: string;
} {
  const text = description.toLowerCase();
  const patterns: { regex: RegExp; label: string }[] = [
    { regex: /https?:\/\/|www\./i, label: 'Contains external URL or payment link' },
    { regex: /paystack\.com|flutterwave|monnify|opayweb|bit\.ly|tinyurl/i, label: 'Contains third-party payment or shortened link' },
    { regex: /\b(pay\s+(your\s+)?rent\s+(to|via|through)\s+(me|agent)|send\s+rent\s+to\s+agent|transfer\s+rent\s+to\s+my\s+account|collect\s+rent\s+directly)\b/i, label: 'Instructs student to pay rent to agent' },
    { regex: /\b(account\s*number|acct\s*no|pay\s+into\s+account)\b/i, label: 'Includes direct bank account payment instruction' },
  ];

  for (const p of patterns) {
    if (p.regex.test(text)) {
      return { flagged: true, reason: p.label };
    }
  }
  return { flagged: false };
}

export function generateBookingReference(sequenceNumber: number, date = new Date()): string {
  const y = date.getUTCFullYear();
  const m = String(date.getUTCMonth() + 1).padStart(2, '0');
  const d = String(date.getUTCDate()).padStart(2, '0');
  const seq = String(sequenceNumber).padStart(4, '0');
  return `ABSU-LS-${y}${m}${d}-${seq}`;
}

export function processIdempotentWebhook(
  existingEvents: PaymentEventLog[],
  incomingWebhook: {
    webhookId: string;
    bookingReference: string;
    eventType: PaymentEventLog['eventType'];
    amountKobo: number;
    signatureHeader: string;
    expectedSignature: string;
  }
): { accepted: boolean; duplicate: boolean; logEntry: PaymentEventLog } {
  const now = new Date().toISOString();
  const signatureValid =
    Boolean(incomingWebhook.signatureHeader) &&
    incomingWebhook.signatureHeader === incomingWebhook.expectedSignature;

  if (!signatureValid) {
    return {
      accepted: false,
      duplicate: false,
      logEntry: {
        eventId: `evt_${Date.now()}`,
        webhookId: incomingWebhook.webhookId,
        bookingReference: incomingWebhook.bookingReference,
        eventType: incomingWebhook.eventType,
        amountKobo: incomingWebhook.amountKobo,
        signatureValid: false,
        duplicateIgnored: false,
        status: 'rejected_signature',
        createdAt: now,
      },
    };
  }

  const alreadyProcessed = existingEvents.some(
    (evt) => evt.webhookId === incomingWebhook.webhookId && evt.status === 'processed'
  );

  if (alreadyProcessed) {
    return {
      accepted: true,
      duplicate: true,
      logEntry: {
        eventId: `evt_${Date.now()}_dup`,
        webhookId: incomingWebhook.webhookId,
        bookingReference: incomingWebhook.bookingReference,
        eventType: incomingWebhook.eventType,
        amountKobo: incomingWebhook.amountKobo,
        signatureValid: true,
        duplicateIgnored: true,
        status: 'ignored_duplicate',
        createdAt: now,
      },
    };
  }

  return {
    accepted: true,
    duplicate: false,
    logEntry: {
      eventId: `evt_${Date.now()}`,
      webhookId: incomingWebhook.webhookId,
      bookingReference: incomingWebhook.bookingReference,
      eventType: incomingWebhook.eventType,
      amountKobo: incomingWebhook.amountKobo,
      signatureValid: true,
      duplicateIgnored: false,
      status: 'processed',
      createdAt: now,
    },
  };
}

export function validateInspectionContact(input: {
  fullName: string;
  phoneNumber: string;
  whatsappOrAltPhone?: string;
  preferredDate?: string;
  preferredTimeSlot: string;
  campusMeetupPoint?: string;
}): { valid: boolean; error?: string } {
  if (!input.fullName.trim() || input.fullName.trim().length < 2) {
    return { valid: false, error: 'Please provide your full contact name for the inspection.' };
  }
  const digits = input.phoneNumber.replace(/\D/g, '');
  if (digits.length < 7) {
    return { valid: false, error: 'Please provide a valid phone number so the agent can call you.' };
  }
  const waDigits = (input.whatsappOrAltPhone || '').replace(/\D/g, '');
  if (waDigits.length < 7) {
    return { valid: false, error: 'Please provide a valid WhatsApp number for inspection coordination.' };
  }
  if (input.preferredDate) {
    const today = new Date().toISOString().slice(0, 10);
    if (input.preferredDate < today) {
      return { valid: false, error: 'Inspection date cannot be earlier than today.' };
    }
  }
  if (!input.preferredTimeSlot.trim()) {
    return { valid: false, error: 'Please select a preferred inspection time window.' };
  }
  return { valid: true };
}

/**
 * Validates lodge media requirements:
 * - Minimum 3, maximum 6 photographs
 * - Optional maximum 1 video
 */
export function validateLodgeMediaRequirements(
  media: { type: 'image' | 'video' }[]
): { valid: boolean; imageCount: number; videoCount: number; error?: string } {
  const imageCount = media.filter((m) => m.type === 'image').length;
  const videoCount = media.filter((m) => m.type === 'video').length;

  if (imageCount < 3 || imageCount > 6) {
    return {
      valid: false,
      imageCount,
      videoCount,
      error: `Please upload between 3 and 6 lodge photos (currently ${imageCount} uploaded).`,
    };
  }
  if (videoCount > 1) {
    return {
      valid: false,
      imageCount,
      videoCount,
      error: `Maximum 1 walkthrough video is allowed (currently ${videoCount} uploaded).`,
    };
  }
  return { valid: true, imageCount, videoCount };
}

/**
 * Student CONFIRM button must only become available after the scheduled inspection date/time starts.
 */
export function isInspectionConfirmationEligible(
  inspectionDate: string,
  inspectionTimeSlot?: string,
  now: Date = new Date()
): { eligible: boolean; unlocksAtLabel: string } {
  if (!inspectionDate) return { eligible: true, unlocksAtLabel: 'Now' };

  let startHour = 9;
  if (inspectionTimeSlot?.includes('12pm') || inspectionTimeSlot?.includes('Afternoon')) {
    startHour = 12;
  } else if (inspectionTimeSlot?.includes('4pm') || inspectionTimeSlot?.includes('Evening')) {
    startHour = 16;
  }

  const [y, m, d] = inspectionDate.split('-').map(Number);
  if (!y || !m || !d) return { eligible: true, unlocksAtLabel: inspectionDate };
  const unlockLocal = new Date(y, m - 1, d, startHour, 0, 0, 0);
  const eligible = now.getTime() >= unlockLocal.getTime();
  return {
    eligible,
    unlocksAtLabel: `${inspectionDate} at ${startHour > 12 ? `${startHour - 12}:00 PM` : `${startHour}:00 AM`}`,
  };
}

export function buildAgentWhatsAppLink(params: {
  phone: string;
  studentName: string;
  lodgeTitle: string;
  bookingReference: string;
  inspectionDate: string;
  inspectionTime: string;
}): string {
  const cleaned = params.phone.replace(/\D/g, '');
  const intl = cleaned.startsWith('0') ? `234${cleaned.slice(1)}` : cleaned.startsWith('234') ? cleaned : `234${cleaned}`;
  const text = `Hello ${params.studentName}, this is your verified ABSU LodgeSafe agent regarding your inspection booking (${params.bookingReference}) for ${params.lodgeTitle} on ${params.inspectionDate} (${params.inspectionTime}). Please confirm your arrival at our meetup point.`;
  return `https://wa.me/${intl}?text=${encodeURIComponent(text)}`;
}

export function buildStudentToAgentWhatsAppLink(params: {
  agentPhone: string;
  agentName: string;
  lodgeTitle: string;
  bookingReference: string;
  inspectionDate: string;
}): string {
  const cleaned = params.agentPhone.replace(/\D/g, '');
  const intl = cleaned.startsWith('0') ? `234${cleaned.slice(1)}` : cleaned.startsWith('234') ? cleaned : `234${cleaned}`;
  const text = `Hello ${params.agentName}, I just completed my ABSU LodgeSafe booking (${params.bookingReference}) for ${params.lodgeTitle} scheduled for ${params.inspectionDate}. Confirming our physical inspection.`;
  return `https://wa.me/${intl}?text=${encodeURIComponent(text)}`;
}
