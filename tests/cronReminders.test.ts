import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import os from 'node:os';
import {
  isWithin24hWindow,
  sendDasReminderSmart,
} from '../src/whatsapp/client';
import {
  extractFirstName,
  runDasRemindersJob,
} from '../src/jobs/reminders';
import { JsonStore } from '../src/store/db';

function tempStore(): { store: JsonStore; dir: string } {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'mei-cron-test-'));
  return { store: new JsonStore(dir), dir };
}

test('isWithin24hWindow: accurate 24-hour boundary detection', () => {
  const now = new Date('2026-11-14T12:00:00.000Z');

  // 1 hour ago -> within window
  assert.equal(
    isWithin24hWindow('2026-11-14T11:00:00.000Z', now),
    true,
  );

  // 23.5 hours ago -> within window
  assert.equal(
    isWithin24hWindow('2026-11-13T12:30:00.000Z', now),
    true,
  );

  // 24.5 hours ago -> outside window
  assert.equal(
    isWithin24hWindow('2026-11-13T11:00:00.000Z', now),
    false,
  );

  // undefined interaction -> outside window
  assert.equal(isWithin24hWindow(undefined, now), false);
});

test('extractFirstName: extracts first name or uses fallback', () => {
  assert.equal(extractFirstName('Maria da Silva'), 'Maria');
  assert.equal(extractFirstName('Paulo'), 'Paulo');
  assert.equal(extractFirstName(''), 'Empreendedor(a)');
});

test('sendDasReminderSmart: dispatches to session when inside 24h, template when outside', async () => {
  const now = new Date('2026-11-14T12:00:00.000Z');

  // Within 24h: session
  const resSession = await sendDasReminderSmart({
    to: '5511999990001',
    name: 'Maria',
    dueDateStr: '20/11/2026',
    amountStr: 'R$ 86,05',
    sessionBody: 'Olá Maria, DAS vence em 20/11',
    lastInteractionAt: '2026-11-14T10:00:00.000Z',
    now,
  });
  assert.equal(resSession.channel, 'session');

  // Outside 24h: template
  const resTemplate = await sendDasReminderSmart({
    to: '5511999990002',
    name: 'João',
    dueDateStr: '20/11/2026',
    amountStr: 'R$ 81,05',
    sessionBody: 'Olá João, DAS vence em 20/11',
    lastInteractionAt: '2026-11-10T10:00:00.000Z',
    now,
  });
  assert.equal(resTemplate.channel, 'template');
});

test('runDasRemindersJob: dry-run and dedup execution', async () => {
  const { store, dir } = tempStore();
  try {
    // 2026-10-15: due date is 2026-10-20 (5 days ahead, inside 7-day window)
    const referenceDate = new Date(2026, 9, 15);

    // Eligible MEI — interacted ~12–15h before the reference date,
    // so the preview channel is the free session message.
    store.upsertMei({
      phone: '5511999990001',
      name: 'Ana Silva',
      activity: 'servicos',
      updatedAt: '2026-10-14T12:00:00.000Z',
    });

    // upsertMei always stamps updatedAt with the real clock, so the
    // store file is edited directly to place Ana's last interaction
    // 12–15h before the reference date below.
    const storeFile = path.join(dir, 'store.json');
    const stored = JSON.parse(fs.readFileSync(storeFile, 'utf-8')) as {
      meis: { phone: string; updatedAt: string }[];
    };
    for (const m of stored.meis) {
      if (m.phone === '5511999990001') m.updatedAt = '2026-10-14T12:00:00.000Z';
    }
    fs.writeFileSync(storeFile, JSON.stringify(stored, null, 2));

    // Another MEI already reminded for this due date
    store.upsertMei({
      phone: '5511999990002',
      name: 'Carlos Oliveira',
      activity: 'comercio',
      updatedAt: '2026-10-10T08:00:00.000Z',
    });
    store.markDeadlineReminded('5511999990002', '2026-10-20', '2026-10-14T09:00:00.000Z');

    // Dry-run run
    const dryRunResult = await runDasRemindersJob({
      storeInstance: store,
      now: referenceDate,
      dryRun: true,
    });

    assert.equal(dryRunResult.totalMeis, 2);
    assert.equal(dryRunResult.eligible, 2);
    assert.equal(dryRunResult.skippedAlreadyReminded, 1);
    // Dry-run previews without sending or marking: sent stays 0.
    assert.equal(dryRunResult.sent, 0);
    assert.equal(dryRunResult.dryRun, true);
    assert.equal(dryRunResult.details.length, 1);
    assert.equal(dryRunResult.details[0].phone, '5511999990001');
    // Ana is inside the 24h window, so the preview channel is the
    // free session message, not the template.
    assert.equal(dryRunResult.details[0].channel, 'session');
    assert.equal(dryRunResult.details[0].sent, false);
    assert.equal(dryRunResult.details[0].reason, 'dry-run');
  } finally {
    fs.rmSync(dir, { recursive: true, force: true });
  }
});
