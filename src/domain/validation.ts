import type { PaymentEventLog } from './types.ts';

export const ALLOWED_IMAGE_MIME_TYPES = ['image/jpeg', 'image/jpg', 'image/png', 'image/webp'];
export const ALLOWED_VIDEO_MIME_TYPES = ['video/mp4'];
export const MAX_IMAGE_SIZE_BYTES = 5 * 1024 * 1024; // 5 MB
export const MAX_VIDEO_SIZE_BYTES = 25 * 1024 * 1024; // 25 MB

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

  if (ALLOWED_VIDEO_MIME_TYPES.includes(mime) || ext === 'mp4') {
    if (file.size > MAX_VIDEO_SIZE_BYTES) {
      return { valid: false, error: `${file.name} exceeds 25 MB MP4 video limit.` };
    }
    return { valid: true, kind: 'video' };
  }

  return {
    valid: false,
    error: `Unsupported file type for ${file.name}. Allowed formats: JPG, JPEG, PNG, WebP, and MP4.`,
  };
}

export function validateAgentCommissionWithinLimit(
  yearlyRentKobo: number,
  agentCommissionKobo: number,
  maxCommissionPctOfRent: number
): { valid: boolean; maxAllowedKobo: number; error?: string } {
  const maxAllowedKobo = Math.round((yearlyRentKobo * maxCommissionPctOfRent) / 100);
  if (agentCommissionKobo < 0) {
    return { valid: false, maxAllowedKobo, error: 'Agent commission cannot be negative.' };
  }
  if (agentCommissionKobo > maxAllowedKobo) {
    return {
      valid: false,
      maxAllowedKobo,
      error: `Agent commission exceeds SUG cap of ${maxCommissionPctOfRent}% of yearly rent.`,
    };
  }
  return { valid: true, maxAllowedKobo };
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
  preferredTimeSlot: string;
  campusMeetupPoint: string;
}): { valid: boolean; error?: string } {
  if (!input.fullName.trim() || input.fullName.trim().length < 2) {
    return { valid: false, error: 'Please provide your full contact name for the inspection.' };
  }
  const digits = input.phoneNumber.replace(/\D/g, '');
  if (digits.length < 7) {
    return { valid: false, error: 'Please provide a valid phone number so the agent can reach you.' };
  }
  if (!input.preferredTimeSlot.trim()) {
    return { valid: false, error: 'Please select a preferred inspection time window.' };
  }
  if (!input.campusMeetupPoint.trim()) {
    return { valid: false, error: 'Please choose or enter a campus meetup point.' };
  }
  return { valid: true };
}

export function validateLodgeMediaRequirements(
  media: { type: 'image' | 'video' }[]
): { valid: boolean; imageCount: number; videoCount: number; error?: string } {
  const imageCount = media.filter((m) => m.type === 'image').length;
  const videoCount = media.filter((m) => m.type === 'video').length;

  if (imageCount !== 4) {
    return {
      valid: false,
      imageCount,
      videoCount,
      error: `Please upload exactly 4 lodge photos (currently ${imageCount}/4 uploaded).`,
    };
  }
  if (videoCount !== 1) {
    return {
      valid: false,
      imageCount,
      videoCount,
      error: `Please upload 1 lodge walkthrough video (MP4) before posting (currently ${videoCount}/1 uploaded).`,
    };
  }
  return { valid: true, imageCount, videoCount };
}
