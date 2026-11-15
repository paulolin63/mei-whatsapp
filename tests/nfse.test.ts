import test from 'node:test';
import assert from 'node:assert/strict';
import {
  getMunicipality,
  listMunicipalities,
  summarizeMunicipality,
  extractCityFromText,
  isStale,
  PORTAL_NACIONAL_URL,
  STALE_DAYS,
} from '../src/mei/nfse';

// ── getMunicipality ──────────────────────────────────────────────────────────

test('getMunicipality: exact city name (accented)', () => {
  const m = getMunicipality('São Paulo');
  assert.equal(m?.ibge, '3550308');
  assert.equal(m?.city, 'São Paulo');
});

test('getMunicipality: exact city name (unaccented)', () => {
  const m = getMunicipality('sao paulo');
  assert.equal(m?.ibge, '3550308');
});

test('getMunicipality: alias lookup (BH → Belo Horizonte)', () => {
  const m = getMunicipality('bh');
  assert.equal(m?.ibge, '3106200');
});

test('getMunicipality: alias lookup (rio → Rio de Janeiro)', () => {
  const m = getMunicipality('rio');
  assert.equal(m?.ibge, '3304557');
});

test('getMunicipality: alias lookup (floripa → Florianópolis)', () => {
  const m = getMunicipality('floripa');
  // 4209102 is Joinville, not Florianópolis — fixed 2026-11-15.
  assert.equal(m?.ibge, '4205407');
});

test('getMunicipality: IBGE code lookup', () => {
  const m = getMunicipality('4106902');
  assert.equal(m?.city, 'Curitiba');
});

test('getMunicipality: unknown city returns undefined', () => {
  assert.equal(getMunicipality('Marte'), undefined);
});

// ── IBGE ground truth ────────────────────────────────────────────────────────
// Every IBGE code in the registry, checked one by one against the
// IBGE localidades API (servicodados.ibge.gov.br) on 2026-11-15.
// This is the regression guard: an earlier version had 6 wrong codes
// (all plausible-looking) and the tests passed anyway, because they
// only asserted internal consistency. Never drop this test.

test('registry: every IBGE code maps to the right city (IBGE API, 2026-11-15)', () => {
  const expected: Record<string, string> = {
    '3550308': 'São Paulo',
    '3529005': 'Marília',
    '3509502': 'Campinas',
    '3543402': 'Ribeirão Preto',
    '3549805': 'São José do Rio Preto',
    '3552205': 'Sorocaba',
    '3506003': 'Bauru',
    '3304557': 'Rio de Janeiro',
    '3303302': 'Niterói',
    '3106200': 'Belo Horizonte',
    '3170206': 'Uberlândia',
    '4314902': 'Porto Alegre',
    '4106902': 'Curitiba',
    '4205407': 'Florianópolis',
    '2611606': 'Recife',
    '2927408': 'Salvador',
    '2304400': 'Fortaleza',
    '1302603': 'Manaus',
    '5208707': 'Goiânia',
    '5300108': 'Brasília',
  };
  const codes = Object.keys(expected);
  assert.equal(listMunicipalities().length, codes.length);
  for (const code of codes) {
    const m = getMunicipality(code);
    assert.equal(
      m?.city,
      expected[code],
      `IBGE code ${code} should be ${expected[code]}, got ${m?.city}`,
    );
  }
});

test('registry: no entry keeps the old wrong IBGE codes', () => {
  // 3543401 does not exist; 3518800 is Guarulhos, 3548500 Santos,
  // 3503208 Araraquara, 3303500 Nova Iguaçu, 4209102 Joinville.
  for (const wrong of ['3543401', '3518800', '3548500', '3503208', '3303500', '4209102']) {
    assert.equal(getMunicipality(wrong), undefined, `Wrong code ${wrong} still resolves`);
  }
});

// ── listMunicipalities ───────────────────────────────────────────────────────

test('listMunicipalities: returns all cities (>= 20)', () => {
  const list = listMunicipalities();
  assert.ok(list.length >= 20, `Expected >= 20 cities, got ${list.length}`);
});

test('listMunicipalities: covers major capitals', () => {
  const list = listMunicipalities();
  const cities = list.map((m) => m.city);
  for (const capital of ['São Paulo', 'Rio de Janeiro', 'Belo Horizonte', 'Curitiba', 'Porto Alegre', 'Brasília']) {
    assert.ok(cities.includes(capital), `Missing capital: ${capital}`);
  }
});

// ── isStale ──────────────────────────────────────────────────────────────────

test('isStale: fresh entry is not stale', () => {
  const m = getMunicipality('Curitiba')!;
  assert.equal(isStale(m, new Date('2026-11-15')), false);
});

test('isStale: entry older than STALE_DAYS is stale', () => {
  const m = getMunicipality('Curitiba')!;
  // Simulate a date STALE_DAYS + 1 days after lastReviewedAt
  const reviewed = new Date(m.lastReviewedAt);
  const future = new Date(reviewed.getTime() + (STALE_DAYS + 1) * 24 * 60 * 60 * 1000);
  assert.equal(isStale(m, future), true);
});

// ── summarizeMunicipality ────────────────────────────────────────────────────
// The rule for MEI (CGSN 169/2022): every MEI issues in the Emissor
// Nacional, whatever the city. The summary must say so for all cities.

test('summarizeMunicipality: every city directs MEI to the Emissor Nacional', () => {
  for (const m of listMunicipalities()) {
    const summary = summarizeMunicipality(m, new Date('2026-11-15'));
    assert.ok(
      summary.includes('Emissor Nacional'),
      `${m.city}: expected Emissor Nacional mention`,
    );
    assert.ok(
      summary.includes(PORTAL_NACIONAL_URL),
      `${m.city}: expected the national portal URL`,
    );
    assert.ok(
      summary.includes(m.portalUrl),
      `${m.city}: expected the municipal portal URL`,
    );
  }
});

test('summarizeMunicipality: São Paulo says the municipal system is consultation-only', () => {
  const m = getMunicipality('São Paulo')!;
  const summary = summarizeMunicipality(m, new Date('2026-11-15'));
  assert.ok(summary.includes('nfe.prefeitura.sp.gov.br/login.aspx'));
  assert.ok(summary.includes('consulta'));
  assert.ok(summary.includes('Emissor Nacional'));
});

test('summarizeMunicipality: Marília shows its municipal portal', () => {
  const m = getMunicipality('Marília')!;
  const summary = summarizeMunicipality(m, new Date('2026-11-15'));
  assert.ok(summary.includes('marilia.sp.gov.br/nfse'));
  assert.ok(summary.includes('Para emitir:'));
});

test('summarizeMunicipality: stale entry appends warning', () => {
  const m = getMunicipality('Curitiba')!;
  const reviewed = new Date(m.lastReviewedAt);
  const staleDate = new Date(reviewed.getTime() + (STALE_DAYS + 5) * 24 * 60 * 60 * 1000);
  const summary = summarizeMunicipality(m, staleDate);
  assert.ok(summary.includes('90 dias'), `Expected stale warning, got: ${summary}`);
});

// ── extractCityFromText ──────────────────────────────────────────────────────

test('extractCityFromText: "NFS-e em Curitiba?" → Curitiba', () => {
  const m = extractCityFromText('NFS-e em Curitiba?');
  assert.equal(m?.city, 'Curitiba');
});

test('extractCityFromText: "como emito nota em Salvador" → Salvador', () => {
  const m = extractCityFromText('como emito nota em Salvador');
  assert.equal(m?.city, 'Salvador');
});

test('extractCityFromText: "minha cidade é Floripa" → Florianópolis (via alias)', () => {
  const m = extractCityFromText('minha cidade é Floripa');
  assert.equal(m?.city, 'Florianópolis');
});

test('extractCityFromText: "nota fiscal Recife" → Recife', () => {
  const m = extractCityFromText('nota fiscal Recife');
  assert.equal(m?.city, 'Recife');
});

test('extractCityFromText: message with no known city → undefined', () => {
  const m = extractCityFromText('quando vence o DAS?');
  assert.equal(m, undefined);
});

test('extractCityFromText: BH alias in sentence', () => {
  const m = extractCityFromText('trabalho em BH, como faço a nota?');
  assert.equal(m?.city, 'Belo Horizonte');
});

test('extractCityFromText: "Rio" in message → Rio de Janeiro', () => {
  const m = extractCityFromText('moro no Rio, como emito?');
  assert.equal(m?.city, 'Rio de Janeiro');
});

test('extractCityFromText: "São Paulo" via pattern', () => {
  const m = extractCityFromText('como emito em São Paulo?');
  assert.equal(m?.ibge, '3550308');
});
