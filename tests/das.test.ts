/**
 * Tests for src/mei/das.ts — DAS due-date and MEI cap rules.
 * Run with: npm test   (builds src, compiles tests to dist-test/,
 * then node --test dist-test/tests/)
 *
 * Dates used (verified against the real calendar):
 * - 2026-11-20 is a Friday      -> due date stays the 20th
 * - 2026-12-20 is a Sunday      -> rolls to Monday 2026-12-21
 * - 2027-02-20 is a Saturday    -> rolls to Monday 2027-02-22
 * - 2026-06-20 is a Saturday    -> rolls to Monday 2026-06-22
 * - 2026-09-20 is a Sunday      -> rolls to Monday 2026-09-21
 */
import test from 'node:test';
import assert from 'node:assert/strict';
import {
  ANNUAL_CAP_BRL,
  MONTHLY_CAP_BRL,
  capStatus,
  dasDueDate,
  daysUntil,
  isBusinessDay,
  nextDueDate,
  proportionalCapBrl,
} from '../src/mei/das';

function iso(date: Date): string {
  return date.toISOString().slice(0, 10);
}

function localDate(year: number, month: number, day: number): Date {
  return new Date(year, month - 1, day);
}

test('dasDueDate: 20th on an ordinary weekday stays the 20th', () => {
  // 2026-10-20 is a Tuesday (no holiday).
  assert.equal(iso(dasDueDate(2026, 10)), '2026-10-20');
  // 2026-08-20 is a Thursday (no holiday).
  assert.equal(iso(dasDueDate(2026, 8)), '2026-08-20');
});

test('dasDueDate: Nov 20 on Consciência Negra rolls past weekend to Monday', () => {
  // 2026-11-20 is Friday + National Holiday (Consciência Negra, Lei 14.759/2023)
  // Rolls: Fri 20 (Holiday) -> Sat 21 (Weekend) -> Sun 22 (Weekend) -> Mon 23 (Business Day)
  assert.equal(iso(dasDueDate(2026, 11)), '2026-11-23');
});

test('dasDueDate: 20th on Sunday + 21st on Tiradentes rolls to Tuesday', () => {
  // In 2025, April 20 is Easter Sunday.
  // April 21 is Tiradentes (National Holiday).
  // Due date must roll to Tuesday 2025-04-22.
  assert.equal(iso(dasDueDate(2025, 4)), '2025-04-22');
});

test('dasDueDate: 20th on a Sunday rolls to Monday', () => {
  // 2026-12-20 is a Sunday -> Monday 2026-12-21.
  assert.equal(iso(dasDueDate(2026, 12)), '2026-12-21');
  // 2026-09-20 is a Sunday -> Monday 2026-09-21.
  assert.equal(iso(dasDueDate(2026, 9)), '2026-09-21');
});

test('dasDueDate: 20th on a Saturday rolls to Monday', () => {
  // 2027-02-20 is a Saturday -> Monday 2027-02-22.
  assert.equal(iso(dasDueDate(2027, 2)), '2027-02-22');
  // 2026-06-20 is a Saturday -> Monday 2026-06-22.
  assert.equal(iso(dasDueDate(2026, 6)), '2026-06-22');
});

test('dasDueDate: rejects an invalid month', () => {
  assert.throws(() => dasDueDate(2026, 13), RangeError);
});

test('isBusinessDay: weekend vs weekday vs holiday', () => {
  // 2026-11-21 Saturday, 2026-11-22 Sunday -> not business days
  assert.equal(isBusinessDay(localDate(2026, 11, 21)), false);
  assert.equal(isBusinessDay(localDate(2026, 11, 22)), false);
  // 2026-11-20 Friday is Consciência Negra (national holiday) -> not business day
  assert.equal(isBusinessDay(localDate(2026, 11, 20)), false);
  // 2026-11-13 Friday is an ordinary workday -> business day
  assert.equal(isBusinessDay(localDate(2026, 11, 13)), true);
});

test('nextDueDate: returns this month when the due date has not passed', () => {
  // On 2026-10-10 the October due date (Tue 2026-10-20) is still ahead.
  assert.equal(iso(nextDueDate(localDate(2026, 10, 10))), '2026-10-20');
});

test('nextDueDate: on the due date itself, returns today', () => {
  assert.equal(iso(nextDueDate(localDate(2026, 10, 20))), '2026-10-20');
});

test('nextDueDate: after the due date, returns next month (honouring holidays & weekends)', () => {
  // 2026-10-21 is past the October due date; next is November,
  // whose 20th is Consciência Negra (Fri holiday) -> rolls to Monday 2026-11-23.
  assert.equal(iso(nextDueDate(localDate(2026, 10, 21))), '2026-11-23');
});

test('daysUntil: counts whole days between dates', () => {
  assert.equal(daysUntil(localDate(2026, 11, 20), localDate(2026, 11, 13)), 7);
  assert.equal(daysUntil(localDate(2026, 11, 20), localDate(2026, 11, 20)), 0);
  assert.equal(daysUntil(localDate(2026, 11, 13), localDate(2026, 11, 20)), -7);
});

test('annual cap math: constants and proportional cap', () => {
  assert.equal(ANNUAL_CAP_BRL, 81_000);
  assert.equal(MONTHLY_CAP_BRL, 6_750);
  assert.equal(proportionalCapBrl(12), 81_000);
  assert.equal(proportionalCapBrl(6), 40_500);
  assert.equal(proportionalCapBrl(1), 6_750);
  assert.equal(proportionalCapBrl(0), 0);
  // Clamped to the year, never above the annual cap.
  assert.equal(proportionalCapBrl(24), 81_000);
});

test('capStatus: below, near and above the cap', () => {
  const below = capStatus(10_000);
  assert.equal(below.exceeded, false);
  assert.equal(below.nearLimit, false);
  assert.equal(below.remainingBrl, 71_000);
  assert.ok(Math.abs(below.percentUsed - 10_000 / 81_000) < 1e-9);

  // 90% of 81,000 = 72,900 -> warning turns on.
  const near = capStatus(72_900);
  assert.equal(near.nearLimit, true);
  assert.equal(near.exceeded, false);
  assert.equal(near.remainingBrl, 8_100);

  const over = capStatus(81_000);
  assert.equal(over.exceeded, true);
  assert.equal(over.nearLimit, true);
  assert.equal(over.remainingBrl, 0);

  const wayOver = capStatus(95_000);
  assert.equal(wayOver.exceeded, true);
  assert.equal(wayOver.remainingBrl, -14_000);
});
