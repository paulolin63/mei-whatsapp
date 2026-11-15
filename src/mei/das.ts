/**
 * DAS (Documento de Arrecadação do Simples Nacional) rules for MEI.
 *
 * Sources: the MEI monthly DAS is due on the 20th of each month
 * (referring to the previous month's revenue). When the 20th falls on
 * a non-business day (weekend or banking holiday), the due date moves to
 * the next business day (Receita Federal rule). The annual gross-revenue cap
 * for MEI is R$ 81,000 (R$ 6,750 per month, pro-rata for the months the MEI
 * was active in the year).
 *
 * ⚠️ Legal scope: this module encodes the *calendar* rules only.
 * It does not compute the DAS amount (that depends on the activity:
 * commerce/industry, services, or both) and it is not tax advice.
 * See docs/ESPEC.md and the DISCLAIMER in README.md.
 */

import { isNationalOrBankingHoliday } from './holidays';

/** Day of the month the DAS is due. */
export const DAS_DUE_DAY = 20;

/** Annual gross-revenue cap for MEI, in BRL. */
export const ANNUAL_CAP_BRL = 81_000;

/** Monthly proportional cap, in BRL (81,000 / 12). */
export const MONTHLY_CAP_BRL = 6_750;

/** Days per month limit for the "near the cap" warning (90%). */
export const CAP_WARNING_THRESHOLD = 0.9;

/**
 * True for Monday–Friday, excluding Brazilian national and banking holidays.
 */
export function isBusinessDay(date: Date): boolean {
  const day = date.getDay();
  if (day === 0 || day === 6) {
    return false; // not Sunday, not Saturday
  }
  return !isNationalOrBankingHoliday(date);
}

/** Advance `date` (a copy) until it lands on a business day. */
export function rollForwardToBusinessDay(date: Date): Date {
  const next = new Date(date);
  while (!isBusinessDay(next)) {
    next.setDate(next.getDate() + 1);
  }
  return next;
}

/**
 * DAS due date for a given month, honouring the weekend rule.
 * @param year full year, e.g. 2026
 * @param month 1-based month, e.g. 11 for November
 */
export function dasDueDate(year: number, month: number): Date {
  const base = new Date(year, month - 1, DAS_DUE_DAY);
  // new Date() normalises out-of-range months (13 -> next Jan), which
  // is convenient but hides mistakes; guard against it.
  if (base.getMonth() !== month - 1) {
    throw new RangeError(`Invalid month: ${month}`);
  }
  return rollForwardToBusinessDay(base);
}

/**
 * Next DAS due date on or after `from` (defaults to now).
 * If today's due date has not passed yet, it is returned; otherwise
 * the following month's.
 */
export function nextDueDate(from: Date = new Date()): Date {
  const thisMonth = dasDueDate(from.getFullYear(), from.getMonth() + 1);
  if (thisMonth.getTime() >= startOfDay(from).getTime()) {
    return thisMonth;
  }
  const next = new Date(from.getFullYear(), from.getMonth() + 1, 1);
  return dasDueDate(next.getFullYear(), next.getMonth() + 1);
}

/** Whole days from `from` until `date` (negative if past). */
export function daysUntil(date: Date, from: Date = new Date()): number {
  const msPerDay = 24 * 60 * 60 * 1000;
  return Math.round(
    (startOfDay(date).getTime() - startOfDay(from).getTime()) / msPerDay,
  );
}

/** Proportional annual cap for a MEI opened part-way through the year. */
export function proportionalCapBrl(monthsActiveInYear: number): number {
  const months = Math.min(Math.max(monthsActiveInYear, 0), 12);
  return months * MONTHLY_CAP_BRL;
}

export interface CapStatus {
  revenueYtdBrl: number;
  annualCapBrl: number;
  remainingBrl: number;
  percentUsed: number;
  /** true once the year-to-date revenue reaches the cap. */
  exceeded: boolean;
  /** true at/above 90% of the cap — time to warn about desenquadramento. */
  nearLimit: boolean;
}

/**
 * Evaluate year-to-date revenue against the MEI cap.
 * Exceeding the cap means desenquadramento (leaving MEI) — the user
 * must be told to talk to an accountant; this function only reports.
 */
export function capStatus(
  revenueYtdBrl: number,
  annualCapBrl: number = ANNUAL_CAP_BRL,
): CapStatus {
  const percentUsed = annualCapBrl > 0 ? revenueYtdBrl / annualCapBrl : 0;
  return {
    revenueYtdBrl,
    annualCapBrl,
    remainingBrl: annualCapBrl - revenueYtdBrl,
    percentUsed,
    exceeded: revenueYtdBrl >= annualCapBrl,
    nearLimit: percentUsed >= CAP_WARNING_THRESHOLD,
  };
}

/** Format a BRL amount as pt-BR currency, e.g. "R$ 1.234,56". */
export function formatBrl(value: number): string {
  return value.toLocaleString('pt-BR', {
    style: 'currency',
    currency: 'BRL',
  });
}

function startOfDay(date: Date): Date {
  const d = new Date(date);
  d.setHours(0, 0, 0, 0);
  return d;
}
