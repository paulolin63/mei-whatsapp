/**
 * Tests for the DAS amount replies in src/whatsapp/webhook.ts.
 * Run with: npm test
 *
 * Only the pure parts are tested here (parseActivityFromText and
 * buildDasReply) — they touch no store and no network.
 */
import test from 'node:test';
import assert from 'node:assert/strict';
import { buildDasReply, parseActivityFromText, parseSetCityCommand } from '../src/whatsapp/webhook';
import type { MeiProfile } from '../src/types';

function mei(overrides: Partial<MeiProfile> = {}): MeiProfile {
  return {
    phone: '5514999998888',
    name: 'Maria',
    updatedAt: '2026-10-10T00:00:00.000Z',
    ...overrides,
  };
}

test('parseActivityFromText: the four activities', () => {
  assert.equal(parseActivityFromText('minha atividade é serviços'), 'servicos');
  assert.equal(parseActivityFromText('sou comércio'), 'comercio');
  assert.equal(parseActivityFromText('sou prestador de serviços'), 'servicos');
  assert.equal(parseActivityFromText('atividade: ambos'), 'comercio_servicos');
  assert.equal(
    parseActivityFromText('minha atividade é comércio e serviços'),
    'comercio_servicos',
  );
  assert.equal(parseActivityFromText('sou caminhoneiro'), 'caminhoneiro');
  assert.equal(parseActivityFromText('sou transportador autônomo'), 'caminhoneiro');
});

test('parseActivityFromText: no activity named, returns undefined', () => {
  assert.equal(parseActivityFromText('oi, tudo bem?'), undefined);
  assert.equal(parseActivityFromText('sou MEI'), undefined);
  assert.equal(parseActivityFromText('quando vence o DAS?'), undefined);
});

test('parseSetCityCommand: "minha cidade é …" / "moro em …" / "sou de …"', () => {
  assert.equal(parseSetCityCommand('minha cidade é Marília')?.city, 'Marília');
  assert.equal(parseSetCityCommand('moro em BH')?.city, 'Belo Horizonte');
  assert.equal(parseSetCityCommand('sou de Curitiba')?.city, 'Curitiba');
  assert.equal(parseSetCityCommand('cidade: Sorocaba')?.city, 'Sorocaba');
  assert.equal(parseSetCityCommand('minha cidade é Floripa')?.city, 'Florianópolis');
});

test('parseSetCityCommand: no city command, or city not in the registry', () => {
  assert.equal(parseSetCityCommand('quando vence o DAS?'), undefined);
  assert.equal(parseSetCityCommand('nota fiscal Recife'), undefined);
  assert.equal(parseSetCityCommand('minha cidade é Paris'), undefined);
});

test('buildDasReply: activity known → exact amount + due date', () => {
  // 2026-10-10: next due date is Tue 2026-10-20.
  const reply = buildDasReply(
    mei({ activity: 'servicos' }),
    new Date(2026, 9, 10),
  );
  assert.ok(reply.includes('20/10/2026'));
  assert.ok(reply.includes('R$ 86,05'));
  assert.ok(reply.includes('INSS R$ 81,05'));
  assert.ok(reply.includes('ISS R$ 5,00'));
  assert.ok(reply.includes('Prestação de serviços'));

  const comercio = buildDasReply(
    mei({ activity: 'comercio' }),
    new Date(2026, 9, 10),
  );
  assert.ok(comercio.includes('R$ 82,05'));
  assert.ok(comercio.includes('Comércio ou indústria'));
});

test('buildDasReply: activity unknown → the 3-row table + how to set it', () => {
  const reply = buildDasReply(mei(), new Date(2026, 9, 10));
  assert.ok(reply.includes('20/10/2026'));
  assert.ok(reply.includes('R$ 82,05'));
  assert.ok(reply.includes('R$ 86,05'));
  assert.ok(reply.includes('R$ 87,05'));
  assert.ok(reply.includes('minha atividade é serviços'));
});

test('buildDasReply: year without a table degrades to the Portal', () => {
  // 2029-12-15: next due date is 2029-12-20, beyond the table.
  const reply = buildDasReply(mei(), new Date(2029, 11, 15));
  assert.ok(reply.includes('ainda não foi publicada'));
  assert.ok(reply.includes('Portal do Empreendedor'));
});
