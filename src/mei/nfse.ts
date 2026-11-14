/**
 * NFS-e (Nota Fiscal de Serviços eletrônica) — per-municipality registry.
 *
 * Brazil has no single NFS-e system: each city runs its own portal
 * and its own rules (layout, authentication, whether the national
 * NFS-e portal covers it). The moat of this product is exactly this
 * registry, kept up to date city by city.
 *
 * v0.1 ships a small seed registry. Entries are data, not law — the
 * `notes` field records *where the rule came from* and the assistant
 * must always point the user at the official portal for the final word.
 */

export interface MunicipalityNfse {
  /** IBGE municipality code, e.g. "3550308". */
  ibge: string;
  city: string;
  state: string;
  /** Official NFS-e portal URL for the city. */
  portalUrl: string;
  /** Which system the city uses. */
  system: 'nota-do-milhao' | 'portal-proprio' | 'portal-nacional' | 'desconhecido';
  /** Plain-language notes: what is special about issuing here. */
  notes: string[];
  /** Whether the national NFS-e portal (gov.br) is known to cover this city. */
  coveredByNationalPortal: boolean;
}

const REGISTRY: MunicipalityNfse[] = [
  {
    ibge: '3550308',
    city: 'São Paulo',
    state: 'SP',
    portalUrl: 'https://nfe.prefeitura.sp.gov.br/',
    system: 'nota-do-milhao',
    notes: [
      'Sistema próprio: Nota do Milhão.',
      'MEI emite NFS-e pelo portal da Prefeitura ou pelo app.',
      'Exige certificado digital ou senha web, conforme o cadastro.',
    ],
    coveredByNationalPortal: false,
  },
  {
    ibge: '3529005',
    city: 'Marília',
    state: 'SP',
    portalUrl: 'https://www.marilia.sp.gov.br/',
    system: 'portal-proprio',
    notes: [
      'Portal próprio da Prefeitura de Marília.',
      'Regras de emissão e cadastro do prestador variam por decreto municipal — confirmar no portal.',
    ],
    coveredByNationalPortal: false,
  },
  {
    ibge: '3509502',
    city: 'Campinas',
    state: 'SP',
    portalUrl: 'https://issdigital.campinas.sp.gov.br/',
    system: 'portal-proprio',
    notes: [
      'Sistema ISS Digital da Prefeitura de Campinas.',
      'MEI deve estar cadastrado como prestador antes da primeira emissão.',
    ],
    coveredByNationalPortal: false,
  },
  {
    ibge: '3304557',
    city: 'Rio de Janeiro',
    state: 'RJ',
    portalUrl: 'https://notacarioca.rio.gov.br/',
    system: 'portal-proprio',
    notes: [
      'Sistema próprio: Nota Carioca.',
      'A NFS-e pode ser emitida pelo portal ou pelo aplicativo.',
    ],
    coveredByNationalPortal: false,
  },
  {
    ibge: '3106200',
    city: 'Belo Horizonte',
    state: 'MG',
    portalUrl: 'https://bhissdigital.pbh.gov.br/',
    system: 'portal-proprio',
    notes: [
      'Sistema BHISS Digital.',
      'Cadastro prévio do prestador é obrigatório.',
    ],
    coveredByNationalPortal: false,
  },
];

/** Find a municipality by IBGE code, or by city name (case-insensitive). */
export function getMunicipality(query: string): MunicipalityNfse | undefined {
  const q = query.trim().toLowerCase();
  return REGISTRY.find(
    (m) => m.ibge === q || m.city.toLowerCase() === q,
  );
}

/** All municipalities known to the registry. */
export function listMunicipalities(): MunicipalityNfse[] {
  return [...REGISTRY];
}

/** Short human-readable summary for a chat reply. */
export function summarizeMunicipality(m: MunicipalityNfse): string {
  const lines = [
    `NFS-e em ${m.city}/${m.state}:`,
    `• Portal oficial: ${m.portalUrl}`,
    ...m.notes.map((n) => `• ${n}`),
  ];
  if (!m.coveredByNationalPortal) {
    lines.push('• Esta cidade usa sistema próprio — o portal nacional não substitui o municipal.');
  }
  return lines.join('\n');
}
