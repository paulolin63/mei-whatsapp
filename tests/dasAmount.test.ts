/**
 * Tests for src/mei/dasAmount.ts — DAS amount by activity.
 * Run with: npm test
 *
 * Values verified against the official tables (checked 2026-11-14):
 * - 2026 minimum wage R$ 1.621,00 (Decreto nº 12.797/2025);
 *   INSS 5% = R$ 81,05. Totals: comércio R$ 82,05,
 *   serviços R$ 86,05, comércio e serviços R$ 87,05.
 * - 2025 minimum wage R$ 1.518,00; INSS 5% = R$ 75,90.
 *   Totals: comércio R$ 76,90, serviços R$ 80,90,
 *   comércio e serviços R$ 81,90.
 * - MEI Caminhoneiro 2026: INSS 12% = R$ 194,52 (ICMS/ISS vary
 *   with cargo type and destination, so they are not included).
 */
import test from 'node:test';
import assert from 'node:assert/strict';
import {
  calculateDasAmount,
  dasAmountTable,
  describeDasAmount,
  minimumWageCents,
  tryDasAmount,
  tryDasAmountTable,
} from '../src/mei/dasAmount';

test('minimumWageCents: tabulated years, in integer cents', () => {
  assert.equal(minimumWageCents(2026), 162_100);
  assert.equal(minimumWageCents(2025), 151_800);
  assert.throws(() => minimumWageCents(2030), RangeError);
});

test('calculateDasAmount: 2026 table — the three standard activities', () => {
  const comercio = calculateDasAmount('comercio', 2026);
  assert.equal(comercio.minimumWageBrl, 1621);
  assert.equal(comercio.inssBrl, 81.05);
  assert.equal(comercio.icmsBrl, 1);
  assert.equal(comercio.issBrl, 0);
  assert.equal(comercio.totalBrl, 82.05);
  assert.equal(comercio.taxesVary, undefined);

  const servicos = calculateDasAmount('servicos', 2026);
  assert.equal(servicos.inssBrl, 81.05);
  assert.equal(servicos.icmsBrl, 0);
  assert.equal(servicos.issBrl, 5);
  assert.equal(servicos.totalBrl, 86.05);

  const ambos = calculateDasAmount('comercio_servicos', 2026);
  assert.equal(ambos.inssBrl, 81.05);
  assert.equal(ambos.icmsBrl, 1);
  assert.equal(ambos.issBrl, 5);
  assert.equal(ambos.totalBrl, 87.05);
});

test('calculateDasAmount: 2025 table follows the 2025 minimum wage', () => {
  assert.equal(calculateDasAmount('comercio', 2025).totalBrl, 76.9);
  assert.equal(calculateDasAmount('servicos', 2025).totalBrl, 80.9);
  assert.equal(calculateDasAmount('comercio_servicos', 2025).totalBrl, 81.9);
  assert.equal(calculateDasAmount('comercio', 2025).inssBrl, 75.9);
});

test('calculateDasAmount: caminhoneiro pays 12% INSS, taxes vary', () => {
  const cam = calculateDasAmount('caminhoneiro', 2026);
  assert.equal(cam.inssBrl, 194.52);
  assert.equal(cam.icmsBrl, 0);
  assert.equal(cam.issBrl, 0);
  // Floor only: ICMS/ISS depend on cargo type and destination.
  assert.equal(cam.totalBrl, 194.52);
  assert.equal(cam.taxesVary, true);
});

test('calculateDasAmount: unknown activity or year throws', () => {
  assert.throws(
    () => calculateDasAmount('industria' as never, 2026),
    RangeError,
  );
  assert.throws(() => calculateDasAmount('comercio', 2030), RangeError);
});

test('tryDasAmount / tryDasAmountTable: undefined instead of throwing', () => {
  assert.equal(tryDasAmount('comercio', 2030), undefined);
  assert.equal(tryDasAmountTable(2030), undefined);
  assert.equal(tryDasAmount('servicos', 2026)?.totalBrl, 86.05);
});

test('dasAmountTable: three rows, in order, 2026 totals', () => {
  const rows = dasAmountTable(2026);
  assert.equal(rows.length, 3);
  assert.deepEqual(
    rows.map((r) => r.activity),
    ['comercio', 'servicos', 'comercio_servicos'],
  );
  assert.deepEqual(
    rows.map((r) => r.totalBrl),
    [82.05, 86.05, 87.05],
  );
});

test('describeDasAmount: one-line PT-BR breakdown', () => {
  const text = describeDasAmount(calculateDasAmount('comercio', 2026));
  assert.ok(text.includes('INSS R$ 81,05'));
  assert.ok(text.includes('ICMS R$ 1,00'));
  assert.ok(text.includes('R$ 82,05'));

  const both = describeDasAmount(calculateDasAmount('comercio_servicos', 2026));
  assert.ok(both.includes('ISS R$ 5,00'));
  assert.ok(both.includes('R$ 87,05'));

  const cam = describeDasAmount(calculateDasAmount('caminhoneiro', 2026));
  assert.ok(cam.includes('variam com o tipo de carga'));
});
