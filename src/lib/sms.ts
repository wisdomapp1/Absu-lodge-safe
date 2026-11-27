export interface SmsSendPayload {
  toPhone: string;
  message: string;
  reference?: string;
}

export interface SmsSendResult {
  sent: boolean;
  configured: boolean;
  provider: string;
  reason?: string;
}

export interface SmsProvider {
  readonly name: string;
  isConfigured(): boolean;
  sendSms(payload: SmsSendPayload): Promise<SmsSendResult>;
}

/**
 * Honest unconfigured SMS adapter. Never reports fake delivery when no external
 * SMS gateway (e.g. Termii / Africa's Talking / Twilio) is configured.
 */
export class UnconfiguredSmsProvider implements SmsProvider {
  readonly name = 'unconfigured';

  isConfigured(): boolean {
    return false;
  }

  async sendSms(_payload: SmsSendPayload): Promise<SmsSendResult> {
    return {
      sent: false,
      configured: false,
      provider: this.name,
      reason: 'No live SMS provider configured. Use WhatsApp deep link or configure SMS gateway credentials server-side.',
    };
  }
}

export const smsProvider: SmsProvider = new UnconfiguredSmsProvider();
