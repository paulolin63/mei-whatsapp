import test from 'node:test';
import assert from 'node:assert/strict';
import {
  getEasterSunday,
  getBrazilianHolidays,
  isNationalOrBankingHoliday,
  getHolidayInfo,
} from '../src/mei/holidays';

function iso(date: Date): string {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, '0');
  const d = String(date.getDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
}

test('getEasterSunday: accurately computes Easter Sunday for known years', () => {
  assert.equal(iso(getEasterSunday(2024)), '2024-03-31');
  assert.equal(iso(getEasterSunday(2025)), '2025-04-20');
  assert.equal(iso(getEasterSunday(2026)), '2026-04-05');
  assert.equal(iso(getEasterSunday(2027)), '2027-03-28');
});

test('getBrazilianHolidays: includes Nov 20 Consciência Negra (Lei 14.759/2023)', () => {
  const holidays2026 = getBrazilianHolidays(2026);
  const nov20 = holidays2026.find((h) => h.date === '2026-11-20');
  assert.ok(nov20, 'Nov 20 must be present');
  assert.equal(nov20?.name, 'Dia Nacional de Zumbi e da Consciência Negra');
  assert.equal(nov20?.type, 'national');
});

test('getBrazilianHolidays: mobile banking holidays (Carnaval, Sexta-feira Santa, Corpus Christi)', () => {
  // In 2026, Easter is 2026-04-05
  // Carnaval Tue: 2026-02-17
  // Sexta-feira Santa: 2026-04-03
  // Corpus Christi: 2026-06-04
  const list = getBrazilianHolidays(2026);
  assert.ok(list.some((h) => h.date === '2026-02-17' && h.name.includes('Carnaval')));
  assert.ok(list.some((h) => h.date === '2026-04-03' && h.name.includes('Sexta-feira Santa')));
  assert.ok(list.some((h) => h.date === '2026-06-04' && h.name.includes('Corpus Christi')));
});

test('isNationalOrBankingHoliday: correctly detects holidays vs ordinary days', () => {
  // Tiradentes: April 21
  assert.equal(isNationalOrBankingHoliday(new Date(2026, 3, 21)), true);
  // Nov 20: Consciência Negra
  assert.equal(isNationalOrBankingHoliday(new Date(2026, 10, 20)), true);
  // Nov 19: Ordinary day
  assert.equal(isNationalOrBankingHoliday(new Date(2026, 10, 19)), false);
  // Oct 12: N. Sra Aparecida
  assert.equal(isNationalOrBankingHoliday(new Date(2026, 9, 12)), true);
});

test('getHolidayInfo: returns metadata for a holiday', () => {
  const info = getHolidayInfo(new Date(2026, 0, 1));
  assert.equal(info?.name, 'Confraternização Universal');
});
