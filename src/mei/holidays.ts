/**
 * Brazilian National and Banking Holidays calendar.
 *
 * Sources:
 * - Federal Laws: Lei 662/1949, Lei 6.802/1980, Lei 10.607/2002.
 * - Lei 14.759/2023: Dia Nacional de Zumbi e da Consciência Negra (Nov 20)
 *   became an official national holiday starting in 2024.
 * - FEBRABAN / BACEN (Resolução CMN nº 4.880/2020): banks do not operate on
 *   national holidays, Carnival (Mon & Tue), Good Friday, and Corpus Christi.
 *
 * For MEI DAS tax payments, Receita Federal states that if the 20th falls on
 * a day without banking hours (weekend or banking holiday), the due date
 * is postponed to the immediately following business day.
 */

export interface Holiday {
  date: string; // YYYY-MM-DD
  name: string;
  type: 'national' | 'banking';
}

/**
 * Computes Easter Sunday for a given year using the Anonymous Gregorian algorithm (Meeus/Jones/Butcher).
 */
export function getEasterSunday(year: number): Date {
  const a = year % 19;
  const b = Math.floor(year / 100);
  const c = year % 100;
  const d = Math.floor(b / 4);
  const e = b % 4;
  const f = Math.floor((b + 8) / 25);
  const g = Math.floor((b - f + 1) / 3);
  const h = (19 * a + b - d - g + 15) % 30;
  const i = Math.floor(c / 4);
  const k = c % 4;
  const l = (32 + 2 * e + 2 * i - h - k) % 7;
  const m = Math.floor((a + 11 * h + 22 * l) / 451);
  const month = Math.floor((h + l - 7 * m + 114) / 31); // 3 = March, 4 = April
  const day = ((h + l - 7 * m + 114) % 31) + 1;
  return new Date(year, month - 1, day);
}

function addDays(date: Date, days: number): Date {
  const res = new Date(date);
  res.setDate(res.getDate() + days);
  return res;
}

function formatDate(date: Date): string {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, '0');
  const d = String(date.getDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
}

/**
 * Returns all national and banking holidays for a specific year in Brazil.
 */
export function getBrazilianHolidays(year: number): Holiday[] {
  const easter = getEasterSunday(year);

  // Mobile holidays (relative to Easter)
  const carnavalSegunda = addDays(easter, -48);
  const carnavalTerca = addDays(easter, -47);
  const sextaFeiraSanta = addDays(easter, -2);
  const corpusChristi = addDays(easter, 60);

  const holidays: Holiday[] = [
    { date: `${year}-01-01`, name: 'Confraternização Universal', type: 'national' },
    { date: formatDate(carnavalSegunda), name: 'Carnaval (segunda-feira)', type: 'banking' },
    { date: formatDate(carnavalTerca), name: 'Carnaval (terça-feira)', type: 'banking' },
    { date: formatDate(sextaFeiraSanta), name: 'Sexta-feira Santa (Paixão de Cristo)', type: 'national' },
    { date: `${year}-04-21`, name: 'Tiradentes', type: 'national' },
    { date: `${year}-05-01`, name: 'Dia Mundial do Trabalho', type: 'national' },
    { date: formatDate(corpusChristi), name: 'Corpus Christi', type: 'banking' },
    { date: `${year}-09-07`, name: 'Independência do Brasil', type: 'national' },
    { date: `${year}-10-12`, name: 'Nossa Senhora Aparecida', type: 'national' },
    { date: `${year}-11-02`, name: 'Finados', type: 'national' },
    { date: `${year}-11-15`, name: 'Proclamação da República', type: 'national' },
    { date: `${year}-11-20`, name: 'Dia Nacional de Zumbi e da Consciência Negra', type: 'national' },
    { date: `${year}-12-25`, name: 'Natal', type: 'national' },
  ];

  return holidays.sort((a, b) => a.date.localeCompare(b.date));
}

/**
 * Check if a date is a Brazilian national or banking holiday.
 */
export function isNationalOrBankingHoliday(date: Date): boolean {
  const key = formatDate(date);
  const list = getBrazilianHolidays(date.getFullYear());
  return list.some((h) => h.date === key);
}

/**
 * Retrieve the holiday info if the date is a holiday, otherwise undefined.
 */
export function getHolidayInfo(date: Date): Holiday | undefined {
  const key = formatDate(date);
  const list = getBrazilianHolidays(date.getFullYear());
  return list.find((h) => h.date === key);
}
