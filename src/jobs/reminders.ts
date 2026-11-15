/**
 * DAS reminder job (v0.1).
 *
 * Pure functions: given a MEI profile and a reference date, produce
 * the reminders that are due. Sending is the caller's job (the
 * WhatsApp client) — keeping generation separate from transport makes
 * this testable without a phone number and without Meta credentials.
 *
 * In production this runs on a schedule (e.g. once a day, 09:00
 * America/Sao_Paulo); in v0.1 it is a library function the server
 * can call from a manual endpoint or a cron.
 */
import {
  capStatus,
  daysUntil,
  formatBrl,
  nextDueDate,
} from '../mei/das';
import { describeDasAmount, tryDasAmount } from '../mei/dasAmount';
import type { MeiProfile } from '../types';

export interface Reminder {
  phone: string;
  /** Short topic, e.g. "DAS vence em 3 dias". */
  subject: string;
  /** Full message text, ready to send on WhatsApp. */
  message: string;
  /** ISO date the reminder refers to. */
  dueDate: string;
}

/** Days in advance a DAS reminder is generated (inclusive). */
export const REMINDER_WINDOW_DAYS = 7;

/**
 * Build the DAS due-date reminder for one MEI, when the due date is
 * within `withinDays` (default 7). Returns `undefined` when nothing
 * is due soon — callers should send nothing in that case.
 */
export function dasReminder(
  mei: MeiProfile,
  from: Date = new Date(),
  withinDays: number = REMINDER_WINDOW_DAYS,
): Reminder | undefined {
  const due = nextDueDate(from);
  const days = daysUntil(due, from);
  if (days < 0 || days > withinDays) return undefined;

  const dueStr = due.toLocaleDateString('pt-BR');
  // The DAS due in month M refers to the revenue of month M-1.
  const refMonth = new Date(due.getFullYear(), due.getMonth() - 1, 1)
    .toLocaleDateString('pt-BR', { month: 'long' });
  const when =
    days === 0
      ? 'vence hoje'
      : days === 1
        ? 'vence amanhã'
        : `vence em ${days} dias`;

  // Exact amount when the MEI's activity is known; otherwise the
  // honest fallback is to point at the Portal, not to guess.
  const amount = mei.activity
    ? tryDasAmount(mei.activity, due.getFullYear())
    : undefined;
  const valueLine = amount
    ? `Valor: ${formatBrl(amount.totalBrl)} (${describeDasAmount(amount)}).`
    : 'O valor depende da sua atividade (comércio, serviços ou ambos) — confira no Portal do Empreendedor ou com o seu contador.';

  return {
    phone: mei.phone,
    subject: `DAS ${when}`,
    dueDate: due.toISOString().slice(0, 10),
    message: [
      `Olá, ${mei.name}! 👋`,
      `O DAS referente a ${refMonth} ${when} (${dueStr}).`,
      valueLine,
      'Lembre-se: o DAS em atraso gera multa e juros.',
      '',
      '— Contador MEI no WhatsApp',
    ].join('\n'),
  };
}

/**
 * Build the annual-cap warning for one MEI, when YTD revenue is at or
 * above 90% of the R$ 81.000 cap. This is a *warning*, not a calculation
 * of desenquadramento — only an accountant can confirm that.
 */
export function capWarning(
  mei: MeiProfile,
  revenueYtdBrl: number,
): Reminder | undefined {
  const status = capStatus(revenueYtdBrl);
  if (!status.nearLimit) return undefined;

  const used = Math.round(status.percentUsed * 100);
  const message = status.exceeded
    ? [
        `Olá, ${mei.name}! ⚠️`,
        `Seu faturamento no ano chegou a ${formatBrl(status.revenueYtdBrl)}, atingindo o teto do MEI (${formatBrl(status.annualCapBrl)}).`,
        'Ultrapassar o teto significa desenquadramento do MEI. Fale com um contador antes de emitir novas notas.',
        '',
        '— Contador MEI no WhatsApp',
      ].join('\n')
    : [
        `Olá, ${mei.name}! ⚠️`,
        `Seu faturamento no ano está em ${formatBrl(status.revenueYtdBrl)} — ${used}% do teto do MEI (${formatBrl(status.annualCapBrl)}).`,
        `Restam ${formatBrl(status.remainingBrl)} até o teto. Se você prevê ultrapassar, fale com um contador com antecedência.`,
        '',
        '— Contador MEI no WhatsApp',
      ].join('\n');

  return {
    phone: mei.phone,
    subject: 'Teto do MEI próximo do limite',
    message,
    dueDate: new Date().toISOString().slice(0, 10),
  };
}

import { store, JsonStore } from '../store/db';
import {
  sendDasReminderSmart,
  isWithin24hWindow,
} from '../whatsapp/client';

export interface ReminderRunResult {
  totalMeis: number;
  eligible: number;
  skippedAlreadyReminded: number;
  sent: number;
  dryRun: boolean;
  details: Array<{
    phone: string;
    dueDate: string;
    channel: 'session' | 'template';
    sent: boolean;
    reason?: string;
  }>;
}

/**
 * Format the first name of a MEI for the template.
 */
export function extractFirstName(fullName: string): string {
  const clean = fullName.trim().split(/\s+/)[0] ?? 'Empreendedor(a)';
  return clean || 'Empreendedor(a)';
}

/**
 * Run the DAS reminder job over all MEIs in the store.
 * - Filters for MEIs within the 7-day reminder window
 * - Skips MEIs that were already reminded for this due date
 * - Dispatches via session text (<=24h) or template (>24h)
 * - Marks deadline as reminded in the store
 */
export async function runDasRemindersJob(options: {
  storeInstance?: JsonStore;
  now?: Date;
  dryRun?: boolean;
} = {}): Promise<ReminderRunResult> {
  const currentStore = options.storeInstance ?? store;
  const now = options.now ?? new Date();
  const isDryRun = Boolean(options.dryRun);

  const meis = currentStore.listMeis();
  const details: ReminderRunResult['details'] = [];

  let eligible = 0;
  let skippedAlreadyReminded = 0;
  let sent = 0;

  for (const mei of meis) {
    const reminder = dasReminder(mei, now);
    if (!reminder) continue;

    eligible++;

    if (currentStore.hasBeenReminded(mei.phone, reminder.dueDate)) {
      skippedAlreadyReminded++;
      continue;
    }

    const firstName = extractFirstName(mei.name);
    const dueYear = Number.parseInt(reminder.dueDate.slice(0, 4), 10);
    const amountData = mei.activity ? tryDasAmount(mei.activity, dueYear) : undefined;
    const amountStr = amountData ? formatBrl(amountData.totalBrl) : 'a conferir';

    // Format dueDate to DD/MM/YYYY for the template
    const [year, month, day] = reminder.dueDate.split('-');
    const dueDateStr = `${day}/${month}/${year}`;

    if (isDryRun) {
      // Preview only: report what would happen — the channel is the
      // one the window would select, and nothing is sent or marked.
      const wouldBeChannel = isWithin24hWindow(mei.updatedAt, now)
        ? 'session'
        : 'template';
      details.push({
        phone: mei.phone,
        dueDate: reminder.dueDate,
        channel: wouldBeChannel,
        sent: false,
        reason: 'dry-run',
      });
      continue;
    }

    const dispatch = await sendDasReminderSmart({
      to: mei.phone,
      name: firstName,
      dueDateStr,
      amountStr,
      sessionBody: reminder.message,
      lastInteractionAt: mei.updatedAt,
      now,
    });

    details.push({
      phone: mei.phone,
      dueDate: reminder.dueDate,
      channel: dispatch.channel,
      sent: dispatch.sent,
      reason: dispatch.reason,
    });

    if (dispatch.sent) {
      currentStore.markDeadlineReminded(mei.phone, reminder.dueDate, now.toISOString());
      sent++;
    }
  }

  return {
    totalMeis: meis.length,
    eligible,
    skippedAlreadyReminded,
    sent,
    dryRun: isDryRun,
    details,
  };
}
