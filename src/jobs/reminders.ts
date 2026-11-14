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

  return {
    phone: mei.phone,
    subject: `DAS ${when}`,
    dueDate: due.toISOString().slice(0, 10),
    message: [
      `Olá, ${mei.name}! 👋`,
      `O DAS referente a ${refMonth} ${when} (${dueStr}).`,
      'O valor depende da sua atividade (comércio, serviços ou ambos) — confira no Portal do Empreendedor ou com o seu contador.',
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

/** Generate all due reminders for a list of MEIs (DAS only, for now). */
export function generateReminders(
  meis: MeiProfile[],
  from: Date = new Date(),
): Reminder[] {
  const out: Reminder[] = [];
  for (const mei of meis) {
    const reminder = dasReminder(mei, from);
    if (reminder) out.push(reminder);
  }
  return out;
}
