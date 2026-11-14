/**
 * WhatsApp Cloud API client (v0.1).
 *
 * Uses the global `fetch` (Node 20+). When no token / phone number id
 * is configured (the normal case while developing), sending is a
 * graceful no-op: the message is logged and a `{ sent: false }`
 * result is returned — the server never crashes for lack of credentials.
 */
import { config } from '../config';

export interface SendResult {
  sent: boolean;
  /** WhatsApp message id, when actually sent. */
  messageId?: string;
  /** Why it was not sent ("not-configured" | "api-error" ...). */
  reason?: string;
}

/** True when the client is actually able to call the Cloud API. */
export function isConfigured(): boolean {
  return Boolean(config.whatsapp.token && config.whatsapp.phoneNumberId);
}

/**
 * Send a plain-text WhatsApp message.
 * @param to recipient phone in E.164 format, digits only, e.g. "5514999998888"
 */
export async function sendTextMessage(
  to: string,
  body: string,
): Promise<SendResult> {
  if (!isConfigured()) {
    console.log(`[whatsapp] not configured — would send to ${to}: ${body}`);
    return { sent: false, reason: 'not-configured' };
  }

  const url =
    `https://graph.facebook.com/${config.whatsapp.apiVersion}/` +
    `${config.whatsapp.phoneNumberId}/messages`;

  const res = await fetch(url, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${config.whatsapp.token}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      messaging_product: 'whatsapp',
      recipient_type: 'individual',
      to,
      type: 'text',
      text: { preview_url: false, body },
    }),
  });

  if (!res.ok) {
    const detail = await res.text().catch(() => '');
    console.error(`[whatsapp] send failed (${res.status}): ${detail}`);
    return { sent: false, reason: `api-error-${res.status}` };
  }

  const data = (await res.json()) as {
    messages?: { id: string }[];
  };
  return { sent: true, messageId: data.messages?.[0]?.id };
}
