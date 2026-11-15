/**
 * Authorization for the cron endpoints (POST /jobs/reminders).
 *
 * Fail closed: when no CRON_SECRET is configured, every request is
 * denied. An operator who forgets the secret in production must get
 * 401s, not an open endpoint that can trigger paid template messages.
 * Comparison is timing-safe (crypto.timingSafeEqual).
 *
 * The secret is a parameter (defaulting to config) so this is
 * unit-testable without a server — see tests/cronAuth.test.ts.
 */
import { timingSafeEqual } from 'node:crypto';
import { config } from '../config';

export interface CronAuthRequest {
  headers?: { authorization?: string };
  query?: { secret?: unknown };
}

function secretsEqual(a: string, b: string): boolean {
  const bufA = Buffer.from(a, 'utf-8');
  const bufB = Buffer.from(b, 'utf-8');
  if (bufA.length !== bufB.length) return false;
  return timingSafeEqual(bufA, bufB);
}

export function isCronAuthorized(
  req: CronAuthRequest,
  secret: string = config.cron.secret,
): boolean {
  if (!secret) return false;

  const authHeader = req.headers?.authorization;
  const bearerToken = authHeader?.startsWith('Bearer ')
    ? authHeader.slice(7).trim()
    : undefined;
  const querySecret = typeof req.query?.secret === 'string' ? req.query.secret : undefined;

  const bearerOk = bearerToken !== undefined && secretsEqual(bearerToken, secret);
  const queryOk = querySecret !== undefined && secretsEqual(querySecret, secret);
  return bearerOk || queryOk;
}
