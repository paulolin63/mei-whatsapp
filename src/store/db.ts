/**
 * JSON-file store (v0.1).
 *
 * Data lives in `<DATA_DIR>/*.json` and is gitignored. The store is
 * deliberately behind a small repository interface so it can be
 * replaced by Postgres later without touching the webhook or the jobs:
 * every read/write goes through `JsonStore`, never through `fs` directly.
 *
 * This is a single-process store: writes are synchronous and atomic
 * enough for a pilot (write to temp file, then rename). It is NOT
 * suitable for concurrent multi-instance use — that is what the
 * Postgres migration in docs/ARQUITETURA.md is for.
 */
import fs from 'node:fs';
import path from 'node:path';
import { randomUUID } from 'node:crypto';
import { config } from '../config';
import type { Deadline, MeiProfile, Receipt } from '../types';

interface StoreData {
  meis: MeiProfile[];
  receipts: Receipt[];
  deadlines: Deadline[];
}

const EMPTY: StoreData = { meis: [], receipts: [], deadlines: [] };

export class JsonStore {
  private readonly dir: string;

  constructor(dataDir: string = config.dataDir) {
    this.dir = dataDir;
    fs.mkdirSync(this.dir, { recursive: true });
  }

  // -- MEI profiles -------------------------------------------------------

  getMei(phone: string): MeiProfile | undefined {
    return this.read().meis.find((m) => m.phone === phone);
  }

  upsertMei(profile: MeiProfile): MeiProfile {
    const data = this.read();
    const index = data.meis.findIndex((m) => m.phone === profile.phone);
    const saved: MeiProfile = {
      ...profile,
      updatedAt: new Date().toISOString(),
    };
    if (index >= 0) {
      data.meis[index] = { ...data.meis[index], ...saved };
    } else {
      data.meis.push(saved);
    }
    this.write(data);
    return saved;
  }

  listMeis(): MeiProfile[] {
    return this.read().meis;
  }

  /**
   * LGPD deletion (Art. 18): remove the MEI profile and everything
   * tied to the phone (receipts, deadlines) in one atomic write.
   * Returns what was actually removed.
   */
  deleteMeiByPhone(phone: string): {
    deletedMei: boolean;
    deletedReceipts: number;
    deletedDeadlines: number;
  } {
    const data = this.read();
    const before = {
      meis: data.meis.length,
      receipts: data.receipts.length,
      deadlines: data.deadlines.length,
    };
    data.meis = data.meis.filter((m) => m.phone !== phone);
    data.receipts = data.receipts.filter((r) => r.phone !== phone);
    data.deadlines = data.deadlines.filter((d) => d.phone !== phone);
    this.write(data);
    return {
      deletedMei: data.meis.length < before.meis,
      deletedReceipts: before.receipts - data.receipts.length,
      deletedDeadlines: before.deadlines - data.deadlines.length,
    };
  }

  // -- Receipts ------------------------------------------------------------

  addReceipt(receipt: Omit<Receipt, 'id' | 'createdAt'>): Receipt {
    const data = this.read();
    const saved: Receipt = {
      ...receipt,
      id: randomUUID(),
      createdAt: new Date().toISOString(),
    };
    data.receipts.push(saved);
    this.write(data);
    return saved;
  }

  listReceipts(phone?: string): Receipt[] {
    const all = this.read().receipts;
    return phone ? all.filter((r) => r.phone === phone) : all;
  }

  // -- Deadlines -----------------------------------------------------------

  addDeadline(deadline: Omit<Deadline, 'id'>): Deadline {
    const data = this.read();
    const saved: Deadline = { ...deadline, id: randomUUID() };
    data.deadlines.push(saved);
    this.write(data);
    return saved;
  }

  listDeadlines(phone?: string): Deadline[] {
    const all = this.read().deadlines;
    return phone ? all.filter((d) => d.phone === phone) : all;
  }

  /**
   * Check whether a DAS reminder has already been sent for this due date.
   */
  hasBeenReminded(phone: string, dueDate: string): boolean {
    const deadlines = this.listDeadlines(phone);
    return deadlines.some(
      (d) => d.kind === 'DAS' && d.dueDate === dueDate && Boolean(d.remindedAt),
    );
  }

  /**
   * Mark a DAS reminder as sent so we do not send duplicate notifications.
   */
  markDeadlineReminded(
    phone: string,
    dueDate: string,
    remindedAt: string = new Date().toISOString(),
  ): void {
    const data = this.read();
    const existing = data.deadlines.find(
      (d) => d.phone === phone && d.dueDate === dueDate && d.kind === 'DAS',
    );
    if (existing) {
      existing.remindedAt = remindedAt;
    } else {
      data.deadlines.push({
        id: randomUUID(),
        phone,
        kind: 'DAS',
        dueDate,
        description: `DAS com vencimento em ${dueDate}`,
        remindedAt,
      });
    }
    this.write(data);
  }

  // -- internals -----------------------------------------------------------

  private read(): StoreData {
    const file = path.join(this.dir, 'store.json');
    if (!fs.existsSync(file)) return structuredClone(EMPTY);
    try {
      const parsed = JSON.parse(fs.readFileSync(file, 'utf-8')) as Partial<StoreData>;
      return {
        meis: parsed.meis ?? [],
        receipts: parsed.receipts ?? [],
        deadlines: parsed.deadlines ?? [],
      };
    } catch {
      // A corrupt store must not crash the webhook; start from empty
      // and let the operator inspect the file.
      console.error('[store] store.json is corrupt, starting empty');
      return structuredClone(EMPTY);
    }
  }

  private write(data: StoreData): void {
    const file = path.join(this.dir, 'store.json');
    const tmp = `${file}.tmp`;
    fs.writeFileSync(tmp, JSON.stringify(data, null, 2), 'utf-8');
    fs.renameSync(tmp, file);
  }
}

/** Shared default store instance used by the webhook and the jobs. */
export const store = new JsonStore();
