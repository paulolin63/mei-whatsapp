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

const app = express();
app.use(express.json({ limit: '1mb' }));

app.get('/', (_req: Request, res: Response) => {
  res.json({
    name: 'mei-whatsapp',
    version: '0.1.0',
    description:
      'Assistente de MEI no WhatsApp — scaffold v0.1 (não substitui um contador).',
    endpoints: ['GET /health', 'GET /webhook', 'POST /webhook'],
  });
});

app.get('/health', (_req: Request, res: Response) => {
  res.json({ ok: true, at: new Date().toISOString() });
});

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
