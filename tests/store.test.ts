import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { JsonStore } from '../src/store/db';

function tempStore(): { store: JsonStore; dir: string } {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'mei-store-test-'));
  return { store: new JsonStore(dir), dir };
}

test('deleteMeiByPhone: removes the MEI, their receipts and deadlines, keeps others', () => {
  const { store, dir } = tempStore();
  try {
    store.upsertMei({ phone: '5514911111111', name: 'Ana', activity: 'servicos', updatedAt: '' });
    store.upsertMei({ phone: '5514922222222', name: 'Beto', updatedAt: '' });
    store.addReceipt({ phone: '5514911111111', extractedText: 'mercado', category: 'alimentacao', confidence: 0.9, matchedKeywords: ['mercado'], amountBrl: 45.9 });
    store.addReceipt({ phone: '5514911111111', extractedText: 'uber', category: 'transporte', confidence: 0.9, matchedKeywords: ['uber'] });
    store.addReceipt({ phone: '5514922222222', extractedText: 'papelaria', category: 'material', confidence: 0.9, matchedKeywords: [] });
    store.addDeadline({ phone: '5514911111111', kind: 'DAS', dueDate: '2026-11-20', description: 'DAS novembro' });
    store.addDeadline({ phone: '5514922222222', kind: 'DAS', dueDate: '2026-11-20', description: 'DAS novembro' });

    const result = store.deleteMeiByPhone('5514911111111');
    assert.deepEqual(result, { deletedMei: true, deletedReceipts: 2, deletedDeadlines: 1 });
    assert.equal(store.getMei('5514911111111'), undefined);
    assert.equal(store.listReceipts('5514911111111').length, 0);
    assert.equal(store.listDeadlines('5514911111111').length, 0);
    assert.equal(store.getMei('5514922222222')?.name, 'Beto');
    assert.equal(store.listReceipts('5514922222222').length, 1);
    assert.equal(store.listDeadlines('5514922222222').length, 1);
  } finally {
    fs.rmSync(dir, { recursive: true, force: true });
  }
});

test('deleteMeiByPhone: unknown phone removes nothing', () => {
  const { store, dir } = tempStore();
  try {
    store.upsertMei({ phone: '5514911111111', name: 'Ana', updatedAt: '' });
    const result = store.deleteMeiByPhone('5514999999999');
    assert.deepEqual(result, { deletedMei: false, deletedReceipts: 0, deletedDeadlines: 0 });
    assert.equal(store.getMei('5514911111111')?.name, 'Ana');
  } finally {
    fs.rmSync(dir, { recursive: true, force: true });
  }
});
