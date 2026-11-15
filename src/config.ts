/**
 * Configuration, read from the environment (see .env.example).
 * No secret is ever hard-coded; missing WhatsApp credentials simply
 * disable sending (see src/whatsapp/client.ts) instead of crashing.
 */
import 'dotenv/config';
import path from 'node:path';

function envInt(name: string, fallback: number): number {
  const raw = process.env[name];
  if (!raw) return fallback;
  const parsed = Number.parseInt(raw, 10);
  return Number.isFinite(parsed) ? parsed : fallback;
}

export const config = {
  port: envInt('PORT', 3000),

  whatsapp: {
    /** Token Meta sends back during webhook verification. */
    verifyToken: process.env.WHATSAPP_VERIFY_TOKEN ?? 'dev-verify-token',
    /** Permanent/long-lived access token for the Cloud API. Empty = sending disabled. */
    token: process.env.WHATSAPP_TOKEN ?? '',
    /** Phone number id of the WhatsApp Business number. Empty = sending disabled. */
    phoneNumberId: process.env.WHATSAPP_PHONE_NUMBER_ID ?? '',
    /** Graph API version used by the client. */
    apiVersion: 'v21.0',
  },

  gemini: {
    /** Gemini API key for OCR and receipt understanding. Empty = stub mode. */
    apiKey: process.env.GEMINI_API_KEY ?? '',
    /** Gemini model to use for multimodal OCR. */
    model: process.env.GEMINI_MODEL ?? 'gemini-2.5-flash',
  },

  cron: {
    /** Secret token required to trigger the cron jobs endpoint. Empty = no secret required. */
    secret: process.env.CRON_SECRET ?? '',
  },

  /** Directory holding the JSON store files. */
  dataDir: path.resolve(process.cwd(), process.env.DATA_DIR ?? 'data'),
} as const;

export type Config = typeof config;
