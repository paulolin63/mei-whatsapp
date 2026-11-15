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
  assert.equal(m?.ibge, '4209102');
});

test('getMunicipality: IBGE code lookup', () => {
  const m = getMunicipality('4106902');
  assert.equal(m?.city, 'Curitiba');
});

test('getMunicipality: unknown city returns undefined', () => {
  assert.equal(getMunicipality('Marte'), undefined);
});

// ── coveredByNationalPortal flag ─────────────────────────────────────────────

test('registry: São Paulo is NOT covered by Portal Nacional', () => {
  const m = getMunicipality('São Paulo');
  assert.equal(m?.coveredByNationalPortal, false);
  assert.equal(m?.system, 'nota-do-milhao');
});

test('registry: Marília IS covered by Portal Nacional', () => {
  const m = getMunicipality('Marília');
  assert.equal(m?.coveredByNationalPortal, true);
  assert.equal(m?.portalNacionalUrl, PORTAL_NACIONAL_URL);
});

test('registry: Curitiba IS covered by Portal Nacional', () => {
  const m = getMunicipality('Curitiba');
  assert.equal(m?.coveredByNationalPortal, true);
});

test('registry: Rio de Janeiro is NOT covered by Portal Nacional', () => {
  const m = getMunicipality('Rio de Janeiro');
  assert.equal(m?.coveredByNationalPortal, false);
  assert.equal(m?.system, 'nota-carioca');
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
  assert.equal(isStale(m, new Date('2026-11-14')), false);
});

test('isStale: entry older than STALE_DAYS is stale', () => {
  const m = getMunicipality('Curitiba')!;
  // Simulate a date STALE_DAYS + 1 days after lastReviewedAt
  const reviewed = new Date(m.lastReviewedAt);
  const future = new Date(reviewed.getTime() + (STALE_DAYS + 1) * 24 * 60 * 60 * 1000);
  assert.equal(isStale(m, future), true);
});

// ── summarizeMunicipality ────────────────────────────────────────────────────

test('summarizeMunicipality: Portal Nacional cities highlight the unified URL', () => {
  const m = getMunicipality('Curitiba')!;
  const summary = summarizeMunicipality(m, new Date('2026-11-14'));
  assert.ok(summary.includes('Portal Nacional'), `Expected Portal Nacional mention, got: ${summary}`);
  assert.ok(summary.includes(PORTAL_NACIONAL_URL));
});

test('summarizeMunicipality: São Paulo shows its own portal URL', () => {
  const m = getMunicipality('São Paulo')!;
  const summary = summarizeMunicipality(m, new Date('2026-11-14'));
  assert.ok(summary.includes('nfe.prefeitura.sp.gov.br'));
  assert.ok(summary.includes('sistema próprio'));
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
