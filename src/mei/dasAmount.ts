/**
 * DAS amount (valor da guia) for MEI, by activity.
 *
 * Sources (verified 2026-11-14):
 * - Minimum wage 2026: R$ 1.621,00 — Decreto nº 12.797/2025, from
 *   2025: R$ 1.518,00. (gov.br / Ministério da Previdência Social.)
 * - DAS = INSS 5% of the minimum wage + R$ 1,00 ICMS (commerce /
 *   industry) and/or R$ 5,00 ISS (services). 2026 totals:
 *   comércio/indústria R$ 82,05; serviços R$ 86,05;
 *   comércio e serviços R$ 87,05. (Receita Federal, via Nubank blog
 *   and other 2026 tables — all agreeing.)
 * - MEI Caminhoneiro (transportador autônomo de cargas): INSS 12%
 *   of the minimum wage (R$ 194,52 in 2026). ICMS/ISS depend on the
 *   cargo type and destination, so they are NOT included here: the
 *   total for caminhoneiro is a floor, not the final guia.
 *
 * Money is computed in integer cents to avoid float rounding.
 * The table is annual: the minimum wage is set by decree every
 * January. When a new year starts, add its row to
 * MINIMUM_WAGE_BY_YEAR — years without a row throw instead of
 * guessing, because a wrong tax number is worse than no number.
 *
 * ⚠️ Scope: this computes the *fixed* DAS table only. It does not
 * handle late-payment fines/interest, DASN-SIMEI, or any SIMEI
 * complement. It is not tax advice — every reply points the user
 * to the Portal do Empreendedor or a human accountant.
 */
import { formatBrl } from './das';
import type { MeiActivity } from '../types';

/** Monthly minimum wage in integer cents (162100 = R$ 1.621,00). */
export interface MinimumWageRow {
  year: number;
  cents: number;
  /** Where the value comes from. */
  source: string;
}

/** Only years verified against an official source are listed. */
export const MINIMUM_WAGE_BY_YEAR: MinimumWageRow[] = [
  { year: 2025, cents: 151_800, source: 'R$ 1.518,00 — valor oficial de 2025' },
  { year: 2026, cents: 162_100, source: 'Decreto nº 12.797/2025 — R$ 1.621,00' },
];

/** INSS rate for a regular MEI (5% of the minimum wage). */
export const INSS_RATE = 0.05;
/** INSS rate for MEI Caminhoneiro (12% of the minimum wage). */
export const CAMINHONEIRO_INSS_RATE = 0.12;
/** Fixed ICMS for commerce/industry, in cents. */
export const ICMS_CENTS = 100;
/** Fixed ISS for services, in cents. */
export const ISS_CENTS = 500;

/** Minimum wage for a year, in integer cents. Throws for unknown years. */
export function minimumWageCents(year: number): number {
  const row = MINIMUM_WAGE_BY_YEAR.find((r) => r.year === year);
  if (!row) {
    const years = MINIMUM_WAGE_BY_YEAR.map((r) => r.year).join(', ');
    throw new RangeError(
      `Minimum wage not tabulated for ${year} (available: ${years}). ` +
        'Add the January decree value to MINIMUM_WAGE_BY_YEAR.',
    );
  }
  return row.cents;
}

export interface DasAmount {
  activity: MeiActivity;
  year: number;
  minimumWageBrl: number;
  inssBrl: number;
  icmsBrl: number;
  issBrl: number;
  totalBrl: number;
  /**
   * True for caminhoneiro: ICMS/ISS depend on cargo type and
   * destination, so `totalBrl` is a floor, not the final guia.
   */
  taxesVary?: boolean;
}

const VALID_ACTIVITIES: readonly MeiActivity[] = [
  'comercio',
  'servicos',
  'comercio_servicos',
  'caminhoneiro',
];

/**
 * DAS amount for one activity and year.
 * @param activity what the MEI does (see MeiActivity in types.ts)
 * @param year full year, e.g. 2026 (defaults to the current year)
 */
export function calculateDasAmount(
  activity: MeiActivity,
  year: number = new Date().getFullYear(),
): DasAmount {
  if (!VALID_ACTIVITIES.includes(activity)) {
    throw new RangeError(
      `Unknown MEI activity: ${String(activity)} ` +
        `(expected one of: ${VALID_ACTIVITIES.join(', ')})`,
    );
  }
  const wageCents = minimumWageCents(year);
  const rate = activity === 'caminhoneiro' ? CAMINHONEIRO_INSS_RATE : INSS_RATE;
  const inssCents = Math.round(wageCents * rate);
  let icmsCents = 0;
  let issCents = 0;
  if (activity === 'comercio' || activity === 'comercio_servicos') {
    icmsCents = ICMS_CENTS;
  }
  if (activity === 'servicos' || activity === 'comercio_servicos') {
    issCents = ISS_CENTS;
  }
  const totalCents = inssCents + icmsCents + issCents;
  return {
    activity,
    year,
    minimumWageBrl: wageCents / 100,
    inssBrl: inssCents / 100,
    icmsBrl: icmsCents / 100,
    issBrl: issCents / 100,
    totalBrl: totalCents / 100,
    ...(activity === 'caminhoneiro' ? { taxesVary: true } : {}),
  };
}

/**
 * Same as calculateDasAmount, but returns `undefined` instead of
 * throwing (unknown year). Used by the webhook and the reminders,
 * where a missing table must degrade to "check the Portal"
 * instead of crashing the reply.
 */
export function tryDasAmount(
  activity: MeiActivity,
  year: number,
): DasAmount | undefined {
  try {
    return calculateDasAmount(activity, year);
  } catch {
    return undefined;
  }
}

/** PT-BR labels for each activity, as shown to the user. */
export const MEI_ACTIVITY_LABELS: Record<MeiActivity, string> = {
  comercio: 'Comércio ou indústria',
  servicos: 'Prestação de serviços',
  comercio_servicos: 'Comércio e serviços',
  caminhoneiro: 'Transportador autônomo de cargas (MEI Caminhoneiro)',
};

/** The three standard DAS rows for a year (caminhoneiro excluded — see taxesVary). */
export function dasAmountTable(year: number): DasAmount[] {
  const standard: readonly MeiActivity[] = ['comercio', 'servicos', 'comercio_servicos'];
  return standard.map((activity) => calculateDasAmount(activity, year));
}

/**
 * Same as dasAmountTable, but returns `undefined` instead of throwing
 * (unknown year). Used by the webhook, where a missing table must
 * degrade to "check the Portal" instead of crashing the reply.
 */
export function tryDasAmountTable(year: number): DasAmount[] | undefined {
  try {
    return dasAmountTable(year);
  } catch {
    return undefined;
  }
}

/** One-line PT-BR breakdown, e.g. "INSS R$ 81,05 + ICMS R$ 1,00 = R$ 82,05". */
export function describeDasAmount(a: DasAmount): string {
  const parts = [`INSS ${formatBrl(a.inssBrl)}`];
  if (a.icmsBrl > 0) parts.push(`ICMS ${formatBrl(a.icmsBrl)}`);
  if (a.issBrl > 0) parts.push(`ISS ${formatBrl(a.issBrl)}`);
  const extra = a.taxesVary ? ' (ICMS/ISS variam com o tipo de carga e o destino)' : '';
  return `${parts.join(' + ')} = ${formatBrl(a.totalBrl)}${extra}`;
}
