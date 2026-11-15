/**
 * Tests for the DAS amount line in src/jobs/reminders.ts.
 * Run with: npm test
 *
 * The reminder is pure (no I/O): given a profile and a reference
 * date it returns the message that would be sent.
 */
import test from 'node:test';
import assert from 'node:assert/strict';
import { dasReminder } from '../src/jobs/reminders';
import type { MeiProfile } from '../src/types';

function mei(overrides: Partial<MeiProfile> = {}): MeiProfile {
  return {
    phone: '5514999998888',
    name: 'Maria',
    updatedAt: '2026-10-10T00:00:00.000Z',
    ...overrides,
  };
}

test('dasReminder: activity known → message carries the exact amount', () => {
  // 2026-10-15: due Tue 2026-10-20, 5 days ahead (inside the 7-day window).
  const reminder = dasReminder(
    mei({ activity: 'servicos' }),
    new Date(2026, 9, 15),
  );
  assert.ok(reminder);
  assert.ok(reminder?.message.includes('R$ 86,05'));
  assert.ok(reminder?.message.includes('INSS R$ 81,05'));
  assert.ok(reminder?.message.includes('20/10/2026'));
});

test('dasReminder: activity unknown → honest "depends on activity" line', () => {
  const reminder = dasReminder(mei(), new Date(2026, 9, 15));
  assert.ok(reminder);
  assert.ok(reminder?.message.includes('depende da sua atividade'));
  assert.ok(!reminder?.message.includes('R$ 86,05'));
});

test('dasReminder: outside the window → no reminder', () => {
  // 2026-10-01: due date 19 days away, outside the 7-day window.
  assert.equal(dasReminder(mei(), new Date(2026, 9, 1)), undefined);
});
