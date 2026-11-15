/**
 * HTTP server: Express + WhatsApp Cloud API webhook.
 *
 * Endpoints:
 *   GET  /            — service info
 *   GET  /health      — liveness check (no auth, no dependencies)
 *   GET  /webhook     — Meta verification (hub.mode / hub.verify_token / hub.challenge)
 *   POST /webhook     — incoming WhatsApp events; messages are routed
 *                        and answered, everything else is acknowledged.
 */
import express, { type Request, type Response } from 'express';
import { config } from './config';
import { sendTextMessage } from './whatsapp/client';
import {
  handleIncomingMessage,
  parseWebhookBody,
} from './whatsapp/webhook';
import { runDasRemindersJob } from './jobs/reminders';

const app = express();
app.use(express.json({ limit: '1mb' }));

app.get('/', (_req: Request, res: Response) => {
  res.json({
    name: 'mei-whatsapp',
    version: '0.1.0',
    description:
      'Assistente de MEI no WhatsApp — scaffold v0.1 (não substitui um contador).',
    endpoints: [
      'GET /health',
      'GET /webhook',
      'POST /webhook',
      'POST /jobs/reminders (requer CRON_SECRET)',
    ],
  });
});

app.get('/health', (_req: Request, res: Response) => {
  res.json({ ok: true, at: new Date().toISOString() });
});

/**
 * Check if the caller is authorized to trigger scheduled cron jobs.
 */
function isCronAuthorized(req: Request): boolean {
  if (!config.cron.secret) return true; // If no secret configured in dev, allow

  const authHeader = req.headers.authorization;
  const bearerToken = authHeader?.startsWith('Bearer ')
    ? authHeader.slice(7).trim()
    : undefined;
  const querySecret = req.query.secret as string | undefined;

  return bearerToken === config.cron.secret || querySecret === config.cron.secret;
}

// Scheduled job: DAS due-date reminders (can be called by external cron or manually)
async function handleRemindersJob(req: Request, res: Response): Promise<void> {
  if (!isCronAuthorized(req)) {
    res.status(401).json({ error: 'Unauthorized: invalid or missing CRON_SECRET' });
    return;
  }

  const dryRun = req.query.dryRun === 'true' || req.body?.dryRun === true;
  try {
    const result = await runDasRemindersJob({ dryRun });
    res.json({ ok: true, result });
  } catch (err) {
    console.error('[jobs] reminders job failed:', err);
    res.status(500).json({ ok: false, error: 'Internal job execution error' });
  }
}

app.post('/jobs/reminders', handleRemindersJob);
app.get('/jobs/reminders', handleRemindersJob);

// Meta webhook verification: GET with hub.mode=subscribe, hub.verify_token
// and hub.challenge. Returns the challenge only when the token matches.
app.get('/webhook', (req: Request, res: Response) => {
  const mode = req.query['hub.mode'];
  const token = req.query['hub.verify_token'];
  const challenge = req.query['hub.challenge'];
  if (
    mode === 'subscribe' &&
    token === config.whatsapp.verifyToken &&
    typeof challenge === 'string'
  ) {
    res.status(200).send(challenge);
    return;
  }
  res.sendStatus(403);
});

app.post('/webhook', async (req: Request, res: Response) => {
  // Meta requires a fast 200; reply first, then process.
  res.sendStatus(200);
  try {
    const messages = parseWebhookBody(req.body);
    for (const message of messages) {
      const reply = await handleIncomingMessage(message);
      await sendTextMessage(message.from, reply);
    }
  } catch (err) {
    console.error('[webhook] failed to process event:', err);
  }
});

const port = config.port;
app.listen(port, () => {
  console.log(`[mei-whatsapp] listening on http://localhost:${port}`);
  console.log('[mei-whatsapp] GET /health — liveness check');
  console.log('[mei-whatsapp] POST /webhook — WhatsApp Cloud API events');
});

export default app;
