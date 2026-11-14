/**
 * Receipt classifier — keyword/pattern stub (v0.1).
 *
 * The interface is the point: `ReceiptClassifier` is what the rest of
 * the app calls. Today the implementation is a hand-written keyword
 * table; later it can be swapped for an LLM call without touching the
 * webhook or the store. Always keep the `matchedKeywords` audit trail —
 * a user who disagrees with a category must be able to see *why*.
 */
import type { ReceiptCategory } from '../types';

export interface Classification {
  category: ReceiptCategory;
  /** 0..1, rough. Keyword hits push it up; no hit leaves it low. */
  confidence: number;
  matchedKeywords: string[];
}

export interface ReceiptClassifier {
  classify(text: string): Classification;
}

/** One rule: if any keyword matches, the receipt is this category. */
interface Rule {
  category: ReceiptCategory;
  keywords: string[];
}

const RULES: Rule[] = [
  {
    category: 'alimentacao',
    keywords: [
      'restaurante', 'lanchonete', 'padaria', 'mercado', 'supermercado',
      'acougue', 'hortifruti', 'ifood', 'rappi', 'refeicao', 'marmita',
      'cafe', 'cafeteria', 'pizzaria', 'sorveteria',
    ],
  },
  {
    category: 'transporte',
    keywords: [
      'combustivel', 'gasolina', 'etanol', 'diesel', 'posto',
      'uber', '99', 'estacionamento', 'pedagio', 'onibus', 'passagem',
      'mecanica', 'oficina', 'pneu', 'oleo',
    ],
  },
  {
    category: 'material',
    keywords: [
      'material de construcao', 'ferragem', 'papelaria', 'livraria',
      'informatica', 'eletronicos', 'ferramenta', 'tinta', 'madeira',
      'loja de', 'atacado', 'distribuidora',
    ],
  },
  {
    category: 'servico',
    keywords: [
      'internet', 'telefone', 'celular', 'plano', 'assinatura',
      'contador', 'contabilidade', 'mensalidade', 'aluguel', 'energia',
      'agua', 'manutencao', 'consultoria', 'curso', 'treinamento',
    ],
  },
  {
    category: 'imposto',
    keywords: [
      'das', 'simples nacional', 'guia', 'darf', 'iss', 'icms',
      'prefeitura', 'receita federal', 'tributo', 'taxa',
    ],
  },
];

/** Normalise text for matching: lowercase, strip accents. */
function normalize(text: string): string {
  return text
    .toLowerCase()
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '');
}

function normalizeKeyword(keyword: string): string {
  return normalize(keyword);
}

/** Keyword-based classifier. Deterministic, no network, no cost. */
export class KeywordClassifier implements ReceiptClassifier {
  classify(text: string): Classification {
    const haystack = normalize(text);
    let best: Classification = {
      category: 'outros',
      confidence: 0.1,
      matchedKeywords: [],
    };

    for (const rule of RULES) {
      const matched = rule.keywords.filter((k) =>
        haystack.includes(normalizeKeyword(k)),
      );
      if (matched.length === 0) continue;
      // More keyword hits -> higher confidence, capped at 0.95.
      const confidence = Math.min(0.55 + 0.1 * matched.length, 0.95);
      if (confidence > best.confidence) {
        best = { category: rule.category, confidence, matchedKeywords: matched };
      }
    }
    return best;
  }
}

/** Best-effort BRL amount parser: finds "R$ 1.234,56" or "1234,56". */
export function parseAmountBrl(text: string): number | undefined {
  const match = text.match(/R\$\s*([\d.]+,\d{2})|([\d.]+,\d{2})/);
  const raw = match?.[1] ?? match?.[2];
  if (!raw) return undefined;
  const value = Number.parseFloat(raw.replace(/\./g, '').replace(',', '.'));
  return Number.isFinite(value) ? value : undefined;
}
