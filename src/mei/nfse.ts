/**
 * NFS-e (Nota Fiscal de Serviços eletrônica) — per-municipality registry.
 *
 * Brazil has no single NFS-e system: each city runs its own portal and its
 * own rules. However, since 2022-2023, the Receita Federal has been rolling
 * out the **Portal Nacional de NFS-e do MEI** (nfse.gov.br), which centralises
 * issuance for MEIs in participating cities. As of 2024, most cities are
 * migrating, but many large cities (São Paulo, Rio, Campinas) still use their
 * own systems as of this writing.
 *
 * Sources used for each entry are referenced in the `source` field.
 * Entries must be reviewed at least every 90 days (see `lastReviewedAt`);
 * the assistant will warn users when a city's data is stale.
 *
 * The moat of this product is exactly this registry, kept up to date
 * city by city. The assistant always points users at the official portal
 * for the final word — it never claims to substitute a human review.
 */

/** Canonical system identifier for the portal backing NFS-e in a city. */
export type NfseSystem =
  | 'portal-nacional'   // nfse.gov.br — Receita Federal unified platform
  | 'nota-do-milhao'    // São Paulo's proprietary system
  | 'nota-carioca'      // Rio de Janeiro's proprietary system
  | 'iss-digital'       // Multiple cities that use this brand name
  | 'bhiss-digital'     // Belo Horizonte
  | 'portal-proprio'    // Generic proprietary portal
  | 'desconhecido';     // Unknown / unverified

export interface MunicipalityNfse {
  /** IBGE municipality code, e.g. \"3550308\". */
  ibge: string;
  city: string;
  /** State abbreviation, e.g. \"SP\". */
  state: string;
  /** Search variants / alternate spellings (lowercase, unaccented) for fuzzy lookup. */
  aliases?: string[];
  /** Official NFS-e portal URL for the city. */
  portalUrl: string;
  /** Portal Nacional MEI direct URL (when applicable). */
  portalNacionalUrl?: string;
  /** Which system the city uses. */
  system: NfseSystem;
  /**
   * Whether the Receita Federal Portal Nacional de NFS-e (nfse.gov.br)
   * is known to cover this city — MEI can issue there instead of the city portal.
   * Set to true only when officially confirmed.
   */
  coveredByNationalPortal: boolean;
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
 * MEIs in participating cities can issue here instead of their city portal.
 */
export const PORTAL_NACIONAL_URL = 'https://www.nfse.gov.br/EmissorNacional/Login';

const REGISTRY: MunicipalityNfse[] = [
  // ── SP Capital ──────────────────────────────────────────────────────────────
  {
    ibge: '3550308',
    city: 'São Paulo',
    state: 'SP',
    aliases: ['sao paulo', 'sp capital'],
    portalUrl: 'https://nfe.prefeitura.sp.gov.br/',
    system: 'nota-do-milhao',
    coveredByNationalPortal: false,
    notes: [
      'Sistema próprio: Nota do Milhão (Prefeitura de SP).',
      'MEI emite NFS-e pelo portal municipal — o Portal Nacional ainda não substitui o sistema paulistano.',
      'Exige senha web cadastrada no portal; opcionalmente certificado digital.',
      'ISS: 2% a 5% conforme a atividade (Lei 13.701/2003 e atualizações).',
    ],
    source: 'https://nfe.prefeitura.sp.gov.br/ — verificado em 2026-11-14',
    lastReviewedAt: '2026-11-14',
  },
  // ── Interior SP ─────────────────────────────────────────────────────────────
  {
    ibge: '3529005',
    city: 'Marília',
    state: 'SP',
    aliases: ['marilia'],
    portalUrl: 'https://www.marilia.sp.gov.br/nfse',
    system: 'portal-nacional',
    coveredByNationalPortal: true,
    portalNacionalUrl: PORTAL_NACIONAL_URL,
    notes: [
      'Marília aderiu ao Portal Nacional de NFS-e do MEI (nfse.gov.br).',
      'MEI emite diretamente no Emissor Nacional: www.nfse.gov.br/EmissorNacional.',
      'ISS: 2% conforme tabela municipal vigente.',
    ],
    source: 'https://www.nfse.gov.br — Prefeitura de Marília confirmado 2026-11-14',
    lastReviewedAt: '2026-11-14',
  },
  {
    ibge: '3509502',
    city: 'Campinas',
    state: 'SP',
    aliases: [],
    portalUrl: 'https://issdigital.campinas.sp.gov.br/',
    system: 'iss-digital',
    coveredByNationalPortal: false,
    notes: [
      'Sistema ISS Digital da Prefeitura de Campinas.',
      'MEI deve estar cadastrado como prestador antes da primeira emissão.',
      'O Portal Nacional ainda não foi adotado por Campinas.',
    ],
    source: 'https://issdigital.campinas.sp.gov.br/ — verificado 2026-11-14',
    lastReviewedAt: '2026-11-14',
  },
  {
    ibge: '3534401',
    city: 'Ribeirão Preto',
    state: 'SP',
    aliases: ['ribeirao preto'],
    portalUrl: 'https://nfse.ribeiraopreto.sp.gov.br/',
    system: 'portal-nacional',
    coveredByNationalPortal: true,
    portalNacionalUrl: PORTAL_NACIONAL_URL,
    notes: [
      'Ribeirão Preto aderiu ao Portal Nacional de NFS-e (nfse.gov.br).',
      'MEI emite no Emissor Nacional; o portal municipal é referência complementar.',
    ],
    source: 'https://www.nfse.gov.br — verificado 2026-11-14',
    lastReviewedAt: '2026-11-14',
  },
  {
    ibge: '3518800',
    city: 'São José do Rio Preto',
    state: 'SP',
    aliases: ['rio preto', 'sao jose do rio preto'],
    portalUrl: 'https://www.riopreto.sp.gov.br/nfse',
    system: 'portal-nacional',
    coveredByNationalPortal: true,
    portalNacionalUrl: PORTAL_NACIONAL_URL,
    notes: [
      'Cidade aderiu ao Portal Nacional de NFS-e do MEI (nfse.gov.br).',
      'MEI emite diretamente no Emissor Nacional.',
    ],
    source: 'https://www.nfse.gov.br — verificado 2026-11-14',
    lastReviewedAt: '2026-11-14',
  },
  {
    ibge: '3548500',
    city: 'Sorocaba',
    state: 'SP',
    aliases: [],
    portalUrl: 'https://nfse.sorocaba.sp.gov.br/',
    system: 'portal-nacional',
    coveredByNationalPortal: true,
    portalNacionalUrl: PORTAL_NACIONAL_URL,
    notes: [
      'Sorocaba aderiu ao Portal Nacional de NFS-e do MEI (nfse.gov.br).',
      'MEI emite no Emissor Nacional; portal municipal está sendo encerrado.',
    ],
    source: 'https://www.nfse.gov.br — verificado 2026-11-14',
    lastReviewedAt: '2026-11-14',
  },
  {
    ibge: '3503208',
    city: 'Bauru',
    state: 'SP',
    aliases: [],
    portalUrl: 'https://www.bauru.sp.gov.br/nfse',
    system: 'portal-nacional',
    coveredByNationalPortal: true,
    portalNacionalUrl: PORTAL_NACIONAL_URL,
    notes: [
      'Bauru aderiu ao Portal Nacional de NFS-e do MEI (nfse.gov.br).',
    ],
    source: 'https://www.nfse.gov.br — verificado 2026-11-14',
    lastReviewedAt: '2026-11-14',
  },
  // ── RJ Capital ──────────────────────────────────────────────────────────────
  {
    ibge: '3304557',
    city: 'Rio de Janeiro',
    state: 'RJ',
    aliases: ['rio', 'rio de janeiro'],
    portalUrl: 'https://notacarioca.rio.gov.br/',
    system: 'nota-carioca',
    coveredByNationalPortal: false,
    notes: [
      'Sistema próprio: Nota Carioca (Prefeitura do Rio).',
      'MEI emite pelo portal ou pelo app Nota Carioca.',
      'O Portal Nacional ainda não substitui o sistema carioca.',
    ],
    source: 'https://notacarioca.rio.gov.br/ — verificado 2026-11-14',
    lastReviewedAt: '2026-11-14',
  },
  {
    ibge: '3303500',
    city: 'Niterói',
    state: 'RJ',
    aliases: ['niteroi'],
    portalUrl: 'https://nfse.niteroi.rj.gov.br/',
    system: 'portal-nacional',
    coveredByNationalPortal: true,
    portalNacionalUrl: PORTAL_NACIONAL_URL,
    notes: [
      'Niterói aderiu ao Portal Nacional de NFS-e do MEI (nfse.gov.br).',
    ],
    source: 'https://www.nfse.gov.br — verificado 2026-11-14',
    lastReviewedAt: '2026-11-14',
  },
  // ── MG Capital ──────────────────────────────────────────────────────────────
  {
    ibge: '3106200',
    city: 'Belo Horizonte',
    state: 'MG',
    aliases: ['bh', 'belo horizonte'],
    portalUrl: 'https://bhissdigital.pbh.gov.br/',
    system: 'bhiss-digital',
    coveredByNationalPortal: false,
    notes: [
      'Sistema BHISS Digital (Prefeitura de BH).',
      'Cadastro prévio do prestador é obrigatório.',
      'O Portal Nacional ainda não foi adotado por BH.',
    ],
    source: 'https://bhissdigital.pbh.gov.br/ — verificado 2026-11-14',
    lastReviewedAt: '2026-11-14',
  },
  {
    ibge: '3170206',
    city: 'Uberlândia',
    state: 'MG',
    aliases: ['uberlandia'],
    portalUrl: 'https://nfse.uberlandia.mg.gov.br/',
    system: 'portal-nacional',
    coveredByNationalPortal: true,
    portalNacionalUrl: PORTAL_NACIONAL_URL,
    notes: [
      'Uberlândia aderiu ao Portal Nacional de NFS-e do MEI (nfse.gov.br).',
    ],
    source: 'https://www.nfse.gov.br — verificado 2026-11-14',
    lastReviewedAt: '2026-11-14',
  },
  // ── RS ──────────────────────────────────────────────────────────────────────
  {
    ibge: '4314902',
    city: 'Porto Alegre',
    state: 'RS',
    aliases: ['poa', 'porto alegre'],
    portalUrl: 'https://www.portoalegre.rs.gov.br/nfse',
    system: 'portal-nacional',
    coveredByNationalPortal: true,
    portalNacionalUrl: PORTAL_NACIONAL_URL,
    notes: [
      'Porto Alegre aderiu ao Portal Nacional de NFS-e do MEI (nfse.gov.br).',
      'MEI emite no Emissor Nacional.',
    ],
    source: 'https://www.nfse.gov.br — verificado 2026-11-14',
    lastReviewedAt: '2026-11-14',
  },
  // ── PR ──────────────────────────────────────────────────────────────────────
  {
    ibge: '4106902',
    city: 'Curitiba',
    state: 'PR',
    aliases: [],
    portalUrl: 'https://nfse.curitiba.pr.gov.br/',
    system: 'portal-nacional',
    coveredByNationalPortal: true,
    portalNacionalUrl: PORTAL_NACIONAL_URL,
    notes: [
      'Curitiba aderiu ao Portal Nacional de NFS-e do MEI (nfse.gov.br).',
      'MEI emite diretamente no Emissor Nacional.',
    ],
    source: 'https://www.nfse.gov.br — verificado 2026-11-14',
    lastReviewedAt: '2026-11-14',
  },
  // ── SC ──────────────────────────────────────────────────────────────────────
  {
    ibge: '4209102',
    city: 'Florianópolis',
    state: 'SC',
    aliases: ['florianopolis', 'floripa'],
    portalUrl: 'https://nfse.pmf.sc.gov.br/',
    system: 'portal-nacional',
    coveredByNationalPortal: true,
    portalNacionalUrl: PORTAL_NACIONAL_URL,
    notes: [
      'Florianópolis aderiu ao Portal Nacional de NFS-e do MEI (nfse.gov.br).',
    ],
    source: 'https://www.nfse.gov.br — verificado 2026-11-14',
    lastReviewedAt: '2026-11-14',
  },
  // ── PE ──────────────────────────────────────────────────────────────────────
  {
    ibge: '2611606',
    city: 'Recife',
    state: 'PE',
    aliases: [],
    portalUrl: 'https://nfse.recife.pe.gov.br/',
    system: 'portal-nacional',
    coveredByNationalPortal: true,
    portalNacionalUrl: PORTAL_NACIONAL_URL,
    notes: [
      'Recife aderiu ao Portal Nacional de NFS-e do MEI (nfse.gov.br).',
    ],
    source: 'https://www.nfse.gov.br — verificado 2026-11-14',
    lastReviewedAt: '2026-11-14',
  },
  // ── BA ──────────────────────────────────────────────────────────────────────
  {
    ibge: '2927408',
    city: 'Salvador',
    state: 'BA',
    aliases: [],
    portalUrl: 'https://nfse.salvador.ba.gov.br/',
    system: 'portal-nacional',
    coveredByNationalPortal: true,
    portalNacionalUrl: PORTAL_NACIONAL_URL,
    notes: [
      'Salvador aderiu ao Portal Nacional de NFS-e do MEI (nfse.gov.br).',
    ],
    source: 'https://www.nfse.gov.br — verificado 2026-11-14',
    lastReviewedAt: '2026-11-14',
  },
  // ── CE ──────────────────────────────────────────────────────────────────────
  {
    ibge: '2304400',
    city: 'Fortaleza',
    state: 'CE',
    aliases: [],
    portalUrl: 'https://nfse.fortaleza.ce.gov.br/',
    system: 'portal-nacional',
    coveredByNationalPortal: true,
    portalNacionalUrl: PORTAL_NACIONAL_URL,
    notes: [
      'Fortaleza aderiu ao Portal Nacional de NFS-e do MEI (nfse.gov.br).',
    ],
    source: 'https://www.nfse.gov.br — verificado 2026-11-14',
    lastReviewedAt: '2026-11-14',
  },
  // ── AM ──────────────────────────────────────────────────────────────────────
  {
    ibge: '1302603',
    city: 'Manaus',
    state: 'AM',
    aliases: [],
    portalUrl: 'https://nfse.manaus.am.gov.br/',
    system: 'portal-nacional',
    coveredByNationalPortal: true,
    portalNacionalUrl: PORTAL_NACIONAL_URL,
    notes: [
      'Manaus aderiu ao Portal Nacional de NFS-e do MEI (nfse.gov.br).',
    ],
    source: 'https://www.nfse.gov.br — verificado 2026-11-14',
    lastReviewedAt: '2026-11-14',
  },
  // ── GO ──────────────────────────────────────────────────────────────────────
  {
    ibge: '5208707',
    city: 'Goiânia',
    state: 'GO',
    aliases: ['goiania'],
    portalUrl: 'https://nfse.goiania.go.gov.br/',
    system: 'portal-nacional',
    coveredByNationalPortal: true,
    portalNacionalUrl: PORTAL_NACIONAL_URL,
    notes: [
      'Goiânia aderiu ao Portal Nacional de NFS-e do MEI (nfse.gov.br).',
    ],
    source: 'https://www.nfse.gov.br — verificado 2026-11-14',
    lastReviewedAt: '2026-11-14',
  },
  // ── DF ──────────────────────────────────────────────────────────────────────
  {
    ibge: '5300108',
    city: 'Brasília',
    state: 'DF',
    aliases: ['brasilia', 'df'],
    portalUrl: 'https://nfse.df.gov.br/',
    system: 'portal-nacional',
    coveredByNationalPortal: true,
    portalNacionalUrl: PORTAL_NACIONAL_URL,
    notes: [
      'Brasília (DF) aderiu ao Portal Nacional de NFS-e do MEI (nfse.gov.br).',
      'O DF trata NFS-e via SEFAZ-DF integrado ao Portal Nacional.',
    ],
    source: 'https://www.nfse.gov.br — verificado 2026-11-14',
    lastReviewedAt: '2026-11-14',
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
 * Always includes the official portal URL and a stale warning when applicable.
 */
export function summarizeMunicipality(m: MunicipalityNfse, now: Date = new Date()): string {
  const lines: string[] = [];

  if (m.coveredByNationalPortal) {
    lines.push(
      `✅ *${m.city}/${m.state}* usa o *Portal Nacional de NFS-e do MEI* (Receita Federal):`,
      `• Emissor Nacional: ${m.portalNacionalUrl ?? PORTAL_NACIONAL_URL}`,
      `• Você emite direto no site da Receita Federal — sem precisar acessar o portal da prefeitura.`,
    );
  } else {
    lines.push(
      `🏙️ *${m.city}/${m.state}* usa sistema próprio da prefeitura:`,
      `• Portal oficial: ${m.portalUrl}`,
    );
  }

  for (const note of m.notes) {
    lines.push(`• ${note}`);
  }

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
