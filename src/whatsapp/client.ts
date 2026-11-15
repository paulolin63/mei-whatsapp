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

export interface SendTemplateParams {
  to: string;
  templateName: string;
  languageCode?: string;
  bodyParameters: string[];
}

/**
 * Send an approved WhatsApp Message Template (outside the 24h window).
 * Example: lembrete_das_vencimento with variables {{1}}, {{2}}, {{3}}.
 */
export async function sendTemplateMessage(
  params: SendTemplateParams,
): Promise<SendResult> {
  const { to, templateName, languageCode = 'pt_BR', bodyParameters } = params;

  if (!isConfigured()) {
    console.log(
      `[whatsapp] not configured — would send template '${templateName}' to ${to} with params: ${JSON.stringify(
        bodyParameters,
      )}`,
    );
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
      type: 'template',
      template: {
        name: templateName,
        language: { code: languageCode },
        components: [
          {
            type: 'body',
            parameters: bodyParameters.map((text) => ({
              type: 'text',
              text,
            })),
          },
        ],
      },
    }),
  });

  if (!res.ok) {
    const detail = await res.text().catch(() => '');
    console.error(`[whatsapp] send template failed (${res.status}): ${detail}`);
    return { sent: false, reason: `api-error-${res.status}` };
  }

  const data = (await res.json()) as {
    messages?: { id: string }[];
  };
  return { sent: true, messageId: data.messages?.[0]?.id };
}

/**
 * Check if the user had an incoming interaction within the last 24 hours.
 */
export function isWithin24hWindow(
  lastInteractionAt?: string,
  now: Date = new Date(),
): boolean {
  if (!lastInteractionAt) return false;
  const lastTime = new Date(lastInteractionAt).getTime();
  if (Number.isNaN(lastTime)) return false;
  const diffMs = now.getTime() - lastTime;
  return diffMs >= 0 && diffMs <= 24 * 60 * 60 * 1000;
}

/**
 * Smart dispatcher for DAS reminders:
 * If user is within 24h window -> sends free plain-text session message.
 * If user is outside 24h window -> sends approved Utility template (lembrete_das_vencimento).
 */
export async function sendDasReminderSmart(params: {
  to: string;
  name: string;
  dueDateStr: string;
  amountStr: string;
  sessionBody: string;
  lastInteractionAt?: string;
  now?: Date;
}): Promise<SendResult & { channel: 'session' | 'template' }> {
  const { to, name, dueDateStr, amountStr, sessionBody, lastInteractionAt, now } = params;

  if (isWithin24hWindow(lastInteractionAt, now)) {
    const res = await sendTextMessage(to, sessionBody);
    return { ...res, channel: 'session' };
  }

  // Outside 24h window: use the Meta approved template
  const res = await sendTemplateMessage({
    to,
    templateName: 'lembrete_das_vencimento',
    languageCode: 'pt_BR',
    bodyParameters: [name, dueDateStr, amountStr],
  });
  return { ...res, channel: 'template' };
}

export interface DownloadedMedia {
  buffer: Buffer;
  mimeType: string;
}

/**
 * Download a media file (e.g. receipt photo) from WhatsApp Cloud API.
 * Returns null if client is not configured or download fails.
 */
export async function downloadMedia(
  mediaId: string,
): Promise<DownloadedMedia | null> {
  if (!isConfigured()) {
    console.log(`[whatsapp] not configured — skipping download for mediaId ${mediaId}`);
    return null;
  }

  try {
    const metaUrl =
      `https://graph.facebook.com/${config.whatsapp.apiVersion}/${mediaId}`;

    const metaRes = await fetch(metaUrl, {
      headers: {
        Authorization: `Bearer ${config.whatsapp.token}`,
      },
    });

    if (!metaRes.ok) {
      console.error(`[whatsapp] failed to fetch media url (${metaRes.status})`);
      return null;
    }

    const metaData = (await metaRes.json()) as {
      url?: string;
      mime_type?: string;
    };

    if (!metaData.url) {
      return null;
    }

    const fileRes = await fetch(metaData.url, {
      headers: {
        Authorization: `Bearer ${config.whatsapp.token}`,
        'User-Agent': 'curl/7.64.1',
      },
    });

    if (!fileRes.ok) {
      console.error(`[whatsapp] failed to download media file (${fileRes.status})`);
      return null;
    }

    const arrayBuffer = await fileRes.arrayBuffer();
    return {
      buffer: Buffer.from(arrayBuffer),
      mimeType: metaData.mime_type ?? 'image/jpeg',
    };
  } catch (err) {
    console.error('[whatsapp] media download error:', err);
    return null;
  }
}
