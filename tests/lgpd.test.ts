import test from 'node:test';
import assert from 'node:assert/strict';
import {
  isMyDataRequest,
  isDeleteRequest,
  isDeleteConfirm,
  isDeleteRequestPending,
  buildMyDataReply,
  buildDeleteRequestReply,
  buildDeleteDoneReply,
  buildDeleteNotPendingReply,
} from '../src/mei/lgpd';
import type { MeiProfile, Receipt } from '../src/types';

const fullMei: MeiProfile = {
  phone: '5514999998888',
  name: 'Paulo',
  cnpj: '12345678000190',
  activity: 'servicos',
  municipalityIbge: '3529005',
  updatedAt: '2026-11-15T00:00:00.000Z',
};

const emptyMei: MeiProfile = {
  phone: '5514999998888',
  name: 'Empreendedor(a)',
  updatedAt: '2026-11-15T00:00:00.000Z',
};

function receipt(overrides: Partial<Receipt> & { id: string }): Receipt {
  return {
    phone: '5514999998888',
    extractedText: '',
    category: 'outros',
    confidence: 0.9,
    matchedKeywords: [],
    createdAt: '2026-11-14T10:00:00.000Z',
    ...overrides,
  };
}

// ── triggers ─────────────────────────────────────────────────────────────────

test('isMyDataRequest: "/meus-dados" and "meus dados"', () => {
  assert.equal(isMyDataRequest('/meus-dados'), true);
  assert.equal(isMyDataRequest('quero ver meus dados'), true);
  assert.equal(isMyDataRequest('quando vence o DAS?'), false);
  assert.equal(isMyDataRequest('apagar meus dados'), true);
});

test('isDeleteRequest: request forms, not confirmations', () => {
  assert.equal(isDeleteRequest('/apagar-dados'), true);
  assert.equal(isDeleteRequest('apagar meus dados'), true);
  assert.equal(isDeleteRequest('apagar tudo'), true);
  assert.equal(isDeleteRequest('excluir minha conta'), true);
  assert.equal(isDeleteRequest('apagar os dados'), true);
  assert.equal(isDeleteRequest('quanto é o DAS?'), false);
  assert.equal(isDeleteRequest('sim, apagar'), false);
});

test('isDeleteConfirm: "sim, apagar" and variants', () => {
  assert.equal(isDeleteConfirm('sim, apagar'), true);
  assert.equal(isDeleteConfirm('sim, apagar meus dados'), true);
  assert.equal(isDeleteConfirm('SIM, APAGAR'), true);
  assert.equal(isDeleteConfirm('sim apagar tudo'), true);
  assert.equal(isDeleteConfirm('apagar meus dados'), false);
  assert.equal(isDeleteConfirm('sim'), false);
});

test('isDeleteRequestPending: 24h window', () => {
  const now = new Date('2026-11-15T12:00:00.000Z');
  assert.equal(isDeleteRequestPending(emptyMei, now), false);
  const fresh = { ...emptyMei, deleteRequestedAt: '2026-11-15T11:00:00.000Z' };
  assert.equal(isDeleteRequestPending(fresh, now), true);
  const almostExpired = { ...emptyMei, deleteRequestedAt: '2026-11-14T13:00:00.000Z' };
  assert.equal(isDeleteRequestPending(almostExpired, now), true);
  const expired = { ...emptyMei, deleteRequestedAt: '2026-11-14T11:00:00.000Z' };
  assert.equal(isDeleteRequestPending(expired, now), false);
});

// ── replies ──────────────────────────────────────────────────────────────────

test('buildMyDataReply: full profile with receipts', () => {
  const receipts = [
    receipt({ id: 'r1', category: 'alimentacao', extractedText: 'mercado', amountBrl: 45.9, matchedKeywords: ['mercado'] }),
    receipt({ id: 'r2', category: 'transporte', extractedText: 'uber', amountBrl: 12, createdAt: '2026-11-13T09:00:00.000Z', matchedKeywords: ['uber'] }),
  ];
  const reply = buildMyDataReply(fullMei, receipts);
  assert.ok(reply.includes('5514999998888'));
  assert.ok(reply.includes('Paulo'));
  assert.ok(reply.includes('12345678000190'));
  assert.ok(reply.includes('Prestação de serviços'));
  assert.ok(reply.includes('Marília/SP'));
  assert.ok(reply.includes('Comprovantes guardados: 2'));
  assert.ok(reply.includes('R$ 57,90'), `Expected total R$ 57,90, got: ${reply}`);
  assert.ok(reply.includes('Alimentação'));
  assert.ok(reply.includes('Transporte'));
});

test('buildMyDataReply: empty profile, no receipts', () => {
  const reply = buildMyDataReply(emptyMei, []);
  assert.ok(reply.includes('Comprovantes guardados: 0'));
  assert.ok(reply.includes('não informada'));
  assert.ok(reply.includes('não informado'));
  assert.ok(!reply.includes('Últimos comprovantes'));
});

test('buildMyDataReply: caps the receipt list at 5', () => {
  const receipts = Array.from({ length: 7 }, (_, i) =>
    receipt({ id: `r${i}`, category: 'outros', createdAt: `2026-11-0${i + 1}T10:00:00.000Z` }),
  );
  const reply = buildMyDataReply(emptyMei, receipts);
  assert.ok(reply.includes('…e mais 2 comprovante(s).'));
});

test('buildDeleteRequestReply: shows what will be removed', () => {
  const reply = buildDeleteRequestReply(3, 1);
  assert.ok(reply.includes('3 comprovante(s)'));
  assert.ok(reply.includes('1 prazo(s)'));
  assert.ok(reply.includes('sim, apagar'));
});

test('buildDeleteDoneReply: shows what was actually removed', () => {
  const reply = buildDeleteDoneReply({ deletedMei: true, deletedReceipts: 2, deletedDeadlines: 1 });
  assert.ok(reply.includes('Comprovantes apagados: 2'));
  assert.ok(reply.includes('Prazos apagados: 1'));
});

test('buildDeleteNotPendingReply: points to the request step first', () => {
  const reply = buildDeleteNotPendingReply();
  assert.ok(reply.includes('apagar meus dados'));
});
