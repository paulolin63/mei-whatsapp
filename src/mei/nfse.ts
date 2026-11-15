/**
 * NFS-e (Nota Fiscal de Serviços eletrônica) — per-municipality registry.
 *
 * The rule that decides the answer for MEI (Resolução CGSN 169/2022):
 * MEI issues NFS-e in the Padrão Nacional, via the Emissor Nacional
 * (nfse.gov.br), since September 2023 — regardless of whether the
 * municipality has joined the national system. (ME/EPP do Simples
 * Nacional joined the same obligation on 01/11/2026, Resolução CGSN
 * 191/2026; LC 214/2025 art. 62 requires every municipality to adopt
 * the national standard or share its notes with the ADN from 2026.)
 *
 * So this registry does NOT gate MEI issuance by city: every entry
 * points at the Emissor Nacional first. The municipal portal is kept
 * for cadastro do prestador, consulta and retroactive issuance, and
 * for taxpayers outside the Simples Nacional.
 *
 * What this file does NOT claim: whether a municipality has signed
 * the convênio with the national system (that only matters for
 * non-Simples taxpayers). An earlier version tracked it per city with
 * unverified values; it was removed on 2026-11-15.
 *
 * IBGE codes were verified one by one against the IBGE localidades
 * API on 2026-11-15 (6 wrong codes fixed — see tests/nfse.test.ts).
 * Municipal portal URLs are NOT re-verified here: confirm on the
 * portal before issuing. Entries must be reviewed at least every 90
 * days (see `lastReviewedAt`); the assistant warns users when data
 * is stale.
 */

/** Canonical system identifier for the municipal portal behind NFS-e in a city. */
export type NfseSystem =
  | 'nota-do-milhao'    // São Paulo's proprietary system
  | 'nota-carioca'      // Rio de Janeiro's proprietary system
  | 'iss-digital'       // Campinas (ISS Digital / DSF)
  | 'bhiss-digital'     // Belo Horizonte
  | 'portal-proprio'    // Generic proprietary municipal portal (brand not tracked)
  | 'desconhecido';     // Unknown / unverified

export interface MunicipalityNfse {
  /** IBGE municipality code, e.g. "3550308". Verified against the IBGE API. */
  ibge: string;
  city: string;
  /** State abbreviation, e.g. "SP". */
  state: string;
  /** Search variants / alternate spellings (lowercase, unaccented) for fuzzy lookup. */
  aliases?: string[];
  /**
   * Municipal NFS-e portal URL. Today it serves for cadastro do
   * prestador, consulta and retroactive issuance — MEI issues in the
   * Emissor Nacional, not here.
   */
  portalUrl: string;
  /** Which municipal system the city uses. */
  system: NfseSystem;
  /** Plain-language notes: what is special about issuing here. */
  notes: string[];
  /**
   * URL or plain text reference used to verify this entry.
   * Must be updated whenever the entry changes.
   */
  source: string;
  /**
   * ISO date (YYYY-MM-DD) this entry was last reviewed against official sources.
   * When more than 90 days old, the assistant should warn the user.
   */
  lastReviewedAt: string;
}

/** Stale threshold: entries older than this many days trigger a warning. */
export const STALE_DAYS = 90;

/**
 * National Portal for MEI NFS-e issuance — Receita Federal.
 * MEI issues here in every municipality (CGSN 169/2022, since 09/2023).
 */
export const PORTAL_NACIONAL_URL = 'https://www.nfse.gov.br/EmissorNacional/Login';

/** Reviewed on 2026-11-15 (IBGE codes + national rule). */
const REVIEWED = '2026-11-15';
const NATIONAL_RULE = 'Regra do MEI: Resolução CGSN 169/2022 (Emissor Nacional desde 09/2023)';

const REGISTRY: MunicipalityNfse[] = [
  // ── SP Capital ──────────────────────────────────────────────────────────────
  {
    ibge: '3550308',
    city: 'São Paulo',
    state: 'SP',
    aliases: ['sao paulo', 'sp capital'],
    portalUrl: 'https://nfe.prefeitura.sp.gov.br/login.aspx',
    system: 'nota-do-milhao',
    notes: [
      'Sistema próprio: Nota do Milhão (Prefeitura de SP).',
      'MEI com tomador CNPJ emite obrigatoriamente no Emissor Nacional (IN SF/SUREM 13/2026); para tomador pessoa física, a emissão nacional é facultativa.',
      'Sistema municipal fica só para consulta e emissão retroativa.',
      'Exige senha web cadastrada no portal; opcionalmente certificado digital.',
      'ISS: 2% a 5% conforme a atividade (Lei 13.701/2003 e atualizações).',
    ],
    source: `https://nfe.prefeitura.sp.gov.br/login.aspx — portal municipal. ${NATIONAL_RULE}`,
    lastReviewedAt: REVIEWED,
  },
  // ── Interior SP ─────────────────────────────────────────────────────────────
  {
    ibge: '3529005',
    city: 'Marília',
    state: 'SP',
    aliases: ['marilia'],
    portalUrl: 'https://www.marilia.sp.gov.br/nfse',
    system: 'portal-proprio',
    notes: ['ISS: 2% conforme tabela municipal vigente.'],
    source: `https://www.marilia.sp.gov.br/nfse — portal municipal. ${NATIONAL_RULE}`,
    lastReviewedAt: REVIEWED,
  },
  {
    ibge: '3509502',
    city: 'Campinas',
    state: 'SP',
    aliases: [],
    portalUrl: 'https://issdigital.campinas.sp.gov.br/',
    system: 'iss-digital',
    notes: [
      'Sistema ISS Digital da Prefeitura de Campinas (modelo 3: sistema próprio integrado ao ADN).',
      'MEI deve estar cadastrado como prestador antes da primeira emissão.',
      'Simples e MEI usam o Emissor Nacional desde 01/11/2026.',
    ],
    source: `https://issdigital.campinas.sp.gov.br/ — portal municipal. ${NATIONAL_RULE}`,
    lastReviewedAt: REVIEWED,
  },
  {
    ibge: '3543402',
    city: 'Ribeirão Preto',
    state: 'SP',
    aliases: ['ribeirao preto'],
    portalUrl: 'https://nfse.ribeiraopreto.sp.gov.br/',
    system: 'portal-proprio',
    notes: [],
    source: `https://nfse.ribeiraopreto.sp.gov.br/ — portal municipal. ${NATIONAL_RULE}`,
    lastReviewedAt: REVIEWED,
  },
  {
    ibge: '3549805',
    city: 'São José do Rio Preto',
    state: 'SP',
    aliases: ['rio preto', 'sao jose do rio preto'],
    portalUrl: 'https://www.riopreto.sp.gov.br/nfse',
    system: 'portal-proprio',
    notes: [],
    source: `https://www.riopreto.sp.gov.br/nfse — portal municipal. ${NATIONAL_RULE}`,
    lastReviewedAt: REVIEWED,
  },
  {
    ibge: '3552205',
    city: 'Sorocaba',
    state: 'SP',
    aliases: [],
    portalUrl: 'https://nfse.sorocaba.sp.gov.br/',
    system: 'portal-proprio',
    notes: [],
    source: `https://nfse.sorocaba.sp.gov.br/ — portal municipal. ${NATIONAL_RULE}`,
    lastReviewedAt: REVIEWED,
  },
  {
    ibge: '3506003',
    city: 'Bauru',
    state: 'SP',
    aliases: [],
    portalUrl: 'https://www.bauru.sp.gov.br/nfse',
    system: 'portal-proprio',
    notes: [],
    source: `https://www.bauru.sp.gov.br/nfse — portal municipal. ${NATIONAL_RULE}`,
    lastReviewedAt: REVIEWED,
  },
  // ── RJ Capital ──────────────────────────────────────────────────────────────
  {
    ibge: '3304557',
    city: 'Rio de Janeiro',
    state: 'RJ',
    aliases: ['rio', 'rio de janeiro'],
    portalUrl: 'https://notacarioca.rio.gov.br/',
    system: 'nota-carioca',
    notes: [
      'Sistema próprio: Nota Carioca (Prefeitura do Rio).',
      'Nota Carioca segue disponível para consulta e pelo app.',
    ],
    source: `https://notacarioca.rio.gov.br/ — portal municipal. ${NATIONAL_RULE}`,
    lastReviewedAt: REVIEWED,
  },
  {
    ibge: '3303302',
    city: 'Niterói',
    state: 'RJ',
    aliases: ['niteroi'],
    portalUrl: 'https://nfse.niteroi.rj.gov.br/',
    system: 'portal-proprio',
    notes: [],
    source: `https://nfse.niteroi.rj.gov.br/ — portal municipal. ${NATIONAL_RULE}`,
    lastReviewedAt: REVIEWED,
  },
  // ── MG Capital ──────────────────────────────────────────────────────────────
  {
    ibge: '3106200',
    city: 'Belo Horizonte',
    state: 'MG',
    aliases: ['bh', 'belo horizonte'],
    portalUrl: 'https://bhissdigital.pbh.gov.br/',
    system: 'bhiss-digital',
    notes: [
      'Sistema BHISS Digital (Prefeitura de BH).',
      'Cadastro prévio do prestador é obrigatório.',
    ],
    source: `https://bhissdigital.pbh.gov.br/ — portal municipal. ${NATIONAL_RULE}`,
    lastReviewedAt: REVIEWED,
  },
  {
    ibge: '3170206',
    city: 'Uberlândia',
    state: 'MG',
    aliases: ['uberlandia'],
    portalUrl: 'https://nfse.uberlandia.mg.gov.br/',
    system: 'portal-proprio',
    notes: [],
    source: `https://nfse.uberlandia.mg.gov.br/ — portal municipal. ${NATIONAL_RULE}`,
    lastReviewedAt: REVIEWED,
  },
  // ── RS ──────────────────────────────────────────────────────────────────────
  {
    ibge: '4314902',
    city: 'Porto Alegre',
    state: 'RS',
    aliases: ['poa', 'porto alegre'],
    portalUrl: 'https://www.portoalegre.rs.gov.br/nfse',
    system: 'portal-proprio',
    notes: [],
    source: `https://www.portoalegre.rs.gov.br/nfse — portal municipal. ${NATIONAL_RULE}`,
    lastReviewedAt: REVIEWED,
  },
  // ── PR ──────────────────────────────────────────────────────────────────────
  {
    ibge: '4106902',
    city: 'Curitiba',
    state: 'PR',
    aliases: [],
    portalUrl: 'https://nfse.curitiba.pr.gov.br/',
    system: 'portal-proprio',
    notes: [],
    source: `https://nfse.curitiba.pr.gov.br/ — portal municipal. ${NATIONAL_RULE}`,
    lastReviewedAt: REVIEWED,
  },
  // ── SC ──────────────────────────────────────────────────────────────────────
  {
    ibge: '4205407',
    city: 'Florianópolis',
    state: 'SC',
    aliases: ['florianopolis', 'floripa'],
    portalUrl: 'https://nfse.pmf.sc.gov.br/',
    system: 'portal-proprio',
    notes: [],
    source: `https://nfse.pmf.sc.gov.br/ — portal municipal. ${NATIONAL_RULE}`,
    lastReviewedAt: REVIEWED,
  },
  // ── PE ──────────────────────────────────────────────────────────────────────
  {
    ibge: '2611606',
    city: 'Recife',
    state: 'PE',
    aliases: [],
    portalUrl: 'https://nfse.recife.pe.gov.br/',
    system: 'portal-proprio',
    notes: [],
    source: `https://nfse.recife.pe.gov.br/ — portal municipal. ${NATIONAL_RULE}`,
    lastReviewedAt: REVIEWED,
  },
  // ── BA ──────────────────────────────────────────────────────────────────────
  {
    ibge: '2927408',
    city: 'Salvador',
    state: 'BA',
    aliases: [],
    portalUrl: 'https://nfse.salvador.ba.gov.br/',
    system: 'portal-proprio',
    notes: [],
    source: `https://nfse.salvador.ba.gov.br/ — portal municipal. ${NATIONAL_RULE}`,
    lastReviewedAt: REVIEWED,
  },
  // ── CE ──────────────────────────────────────────────────────────────────────
  {
    ibge: '2304400',
    city: 'Fortaleza',
    state: 'CE',
    aliases: [],
    portalUrl: 'https://nfse.fortaleza.ce.gov.br/',
    system: 'portal-proprio',
    notes: [],
    source: `https://nfse.fortaleza.ce.gov.br/ — portal municipal. ${NATIONAL_RULE}`,
    lastReviewedAt: REVIEWED,
  },
  // ── AM ──────────────────────────────────────────────────────────────────────
  {
    ibge: '1302603',
    city: 'Manaus',
    state: 'AM',
    aliases: [],
    portalUrl: 'https://nfse.manaus.am.gov.br/',
    system: 'portal-proprio',
    notes: [],
    source: `https://nfse.manaus.am.gov.br/ — portal municipal. ${NATIONAL_RULE}`,
    lastReviewedAt: REVIEWED,
  },
  // ── GO ──────────────────────────────────────────────────────────────────────
  {
    ibge: '5208707',
    city: 'Goiânia',
    state: 'GO',
    aliases: ['goiania'],
    portalUrl: 'https://nfse.goiania.go.gov.br/',
    system: 'portal-proprio',
    notes: [],
    source: `https://nfse.goiania.go.gov.br/ — portal municipal. ${NATIONAL_RULE}`,
    lastReviewedAt: REVIEWED,
  },
  // ── DF ──────────────────────────────────────────────────────────────────────
  {
    ibge: '5300108',
    city: 'Brasília',
    state: 'DF',
    aliases: ['brasilia', 'df'],
    portalUrl: 'https://nfse.df.gov.br/',
    system: 'portal-proprio',
    notes: [],
    source: `https://nfse.df.gov.br/ — portal municipal. ${NATIONAL_RULE}`,
    lastReviewedAt: REVIEWED,
  },
];

/** Normalise text for fuzzy matching: lowercase + strip accents. */
function normalize(text: string): string {
  return text
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .trim();
}

/**
 * Find a municipality by IBGE code, exact city name, or alias (all case-insensitive,
 * accent-insensitive). Returns the first match.
 */
export function getMunicipality(query: string): MunicipalityNfse | undefined {
  const q = normalize(query);
  return REGISTRY.find(
    (m) =>
      m.ibge === q ||
      normalize(m.city) === q ||
      (m.aliases ?? []).some((a) => normalize(a) === q),
  );
}

/** All municipalities in the registry. */
export function listMunicipalities(): MunicipalityNfse[] {
  return [...REGISTRY];
}

/**
 * Returns true when the entry was last reviewed more than STALE_DAYS ago.
 */
export function isStale(m: MunicipalityNfse, now: Date = new Date()): boolean {
  const reviewed = new Date(m.lastReviewedAt);
  const diffMs = now.getTime() - reviewed.getTime();
  return diffMs > STALE_DAYS * 24 * 60 * 60 * 1000;
}

/**
 * Short human-readable WhatsApp reply for a city.
 * MEI always issues in the Emissor Nacional first; the municipal
 * portal is shown for cadastro and consulta. Appends a stale warning
 * when applicable.
 */
export function summarizeMunicipality(m: MunicipalityNfse, now: Date = new Date()): string {
  const lines: string[] = [
    `✅ *${m.city}/${m.state}* — MEI emite NFS-e no *Emissor Nacional* (Receita Federal):`,
    `• Emissor Nacional: ${PORTAL_NACIONAL_URL}`,
    `• Acesso com conta gov.br, usuário/senha ou certificado digital.`,
    `• Portal da prefeitura (cadastro e consulta): ${m.portalUrl}`,
  ];

  for (const note of m.notes) {
    lines.push(`• ${note}`);
  }

  lines.push(
    `Para emitir: entre no Emissor Nacional, preencha os dados do tomador e do serviço e confira antes de confirmar.`,
  );

  if (isStale(m, now)) {
    lines.push(
      `\n⚠️ Esta informação tem mais de 90 dias — confirme no portal antes de emitir.`,
    );
  }

  return lines.join('\n');
}

/**
 * Best-effort city name extraction from a WhatsApp message.
 * Looks for patterns like "em Salvador", "de Curitiba", "NFS-e Curitiba",
 * or any name/alias match scanned across the full normalised message.
 */
export function extractCityFromText(text: string): MunicipalityNfse | undefined {
  const nText = normalize(text);

  // Build a list of all searchable names (city names + aliases),
  // sorted longest-first so "são paulo" matches before "paulo".
  const candidates: { key: string; entry: MunicipalityNfse }[] = [];
  for (const entry of REGISTRY) {
    candidates.push({ key: normalize(entry.city), entry });
    for (const alias of entry.aliases ?? []) {
      candidates.push({ key: normalize(alias), entry });
    }
  }
  candidates.sort((a, b) => b.key.length - a.key.length);

  // Brute-force scan: check every candidate name against the full normalised text,
  // requiring word-boundary-like delimiters (space, start/end, punctuation).
  for (const { key, entry } of candidates) {
    if (key.length < 2) continue;
    const escaped = key.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    const re = new RegExp(`(?:^|[\\s,])${escaped}(?:[\\s,\\.\\?!]|$)`, 'i');
    if (re.test(nText)) {
      return entry;
    }
  }

  return undefined;
}
