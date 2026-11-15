/**
 * LGPD (Lei Geral de Proteção de Dados, Lei 13.709/2018) — data-subject
 * rights inside WhatsApp.
 *
 * Art. 18 gives every user the right to confirm the processing of
 * their data, to access it, and to request its deletion. The pilot
 * stores phone numbers, CNPJ and financial receipts, so the assistant
 * must answer two commands in-chat:
 * - "meus dados" (/meus-dados): a readable summary of everything
 *   stored for that phone number.
 * - "apagar meus dados" (/apagar-dados): a two-step deletion —
 *   request first, then confirm with "sim, apagar" within 24h.
 *   The profile, receipts and deadlines are removed in one write
 *   (see JsonStore.deleteMeiByPhone).
 *
 * Everything here is pure (no store access) — the webhook applies
 * the side effects. Unit-tested in tests/lgpd.test.ts.
 */
import { formatBrl } from './das';
import { MEI_ACTIVITY_LABELS } from './dasAmount';
import { getMunicipality } from './nfse';
import type { MeiProfile, Receipt } from '../types';

/** How long a deletion request stays valid before it must be repeated. */
export const DELETE_CONFIRM_WINDOW_MS = 24 * 60 * 60 * 1000;

/** Number of receipts shown in the export summary (the rest is counted). */
export const MY_DATA_RECEIPTS_SHOWN = 5;

const RECEIPT_CATEGORY_LABELS: Record<Receipt['category'], string> = {
  alimentacao: 'Alimentação',
  transporte: 'Transporte',
  material: 'Material',
  servico: 'Serviço',
  imposto: 'Imposto',
  outros: 'Outros',
};

function truncate(text: string, max: number): string {
  return text.length <= max ? text : `${text.slice(0, max - 1)}…`;
}

/** "meus dados" / "/meus-dados" — the user wants to see their stored data. */
export function isMyDataRequest(text: string): boolean {
  const q = text.toLowerCase();
  return q.includes('/meus-dados') || q.includes('meus dados');
}

/** "apagar meus dados" / "/apagar-dados" — the user wants everything deleted. */
export function isDeleteRequest(text: string): boolean {
  const q = text.toLowerCase().trim();
  if (q.includes('/apagar-dados') || q.includes('/excluir-dados')) return true;
  const verb = q.includes('apagar') || q.includes('excluir') || q.includes('remover');
  if (!verb) return false;
  return (
    q.includes('meus dados') ||
    q.includes('os dados') ||
    q.includes('tudo') ||
    q.includes('minha conta') ||
    q.includes('meu cadastro')
  );
}

/** "sim, apagar" (and natural variants) — confirms a pending deletion. */
export function isDeleteConfirm(text: string): boolean {
  const q = text
    .toLowerCase()
    .replace(/\s+/g, ' ')
    .trim();
  return /^sim[,.]?\s*(apagar|excluir|remover)( meus dados| os dados| tudo)?$/.test(q);
}

/** True when the MEI asked for deletion and the request is still valid. */
export function isDeleteRequestPending(mei: MeiProfile, now: Date = new Date()): boolean {
  if (!mei.deleteRequestedAt) return false;
  return now.getTime() - new Date(mei.deleteRequestedAt).getTime() <= DELETE_CONFIRM_WINDOW_MS;
}

/**
 * Readable summary of everything stored for one MEI: profile fields,
 * receipt count and total, and the most recent receipts. Receipts
 * without a parsed amount are counted but not summed.
 */
export function buildMyDataReply(mei: MeiProfile, receipts: Receipt[]): string {
  const city = mei.municipalityIbge ? getMunicipality(mei.municipalityIbge) : undefined;
  const activity = mei.activity ? MEI_ACTIVITY_LABELS[mei.activity] : 'não informada';

  const lines: string[] = [
    '📋 *Seus dados comigo*',
    '',
    `• Telefone: ${mei.phone}`,
    `• Nome: ${mei.name}`,
    `• CNPJ: ${mei.cnpj ?? 'não informado'}`,
    `• Atividade: ${activity}`,
    `• Cidade: ${city ? `${city.city}/${city.state}` : 'não informada'}`,
    `• Comprovantes guardados: ${receipts.length}`,
  ];

  const withAmount = receipts.filter((r) => typeof r.amountBrl === 'number');
  if (withAmount.length > 0) {
    const total = withAmount.reduce((sum, r) => sum + (r.amountBrl ?? 0), 0);
    lines.push(`• Total dos comprovantes com valor: ${formatBrl(total)}`);
  }

  const sorted = [...receipts].sort((a, b) => b.createdAt.localeCompare(a.createdAt));
  const shown = sorted.slice(0, MY_DATA_RECEIPTS_SHOWN);
  if (shown.length > 0) {
    lines.push('', 'Últimos comprovantes:');
    for (const r of shown) {
      const date = new Date(r.createdAt).toLocaleDateString('pt-BR');
      const amount = typeof r.amountBrl === 'number' ? ` — ${formatBrl(r.amountBrl)}` : '';
      const what = r.extractedText ? ` — "${truncate(r.extractedText, 40)}"` : '';
      lines.push(`• ${date} — ${RECEIPT_CATEGORY_LABELS[r.category]}${amount}${what}`);
    }
    if (receipts.length > shown.length) {
      lines.push(`…e mais ${receipts.length - shown.length} comprovante(s).`);
    }
  }

  lines.push('', 'Para apagar tudo, envie "apagar meus dados".');
  return lines.join('\n');
}

/** First step of deletion: show what will be removed and ask to confirm. */
export function buildDeleteRequestReply(receiptCount: number, deadlineCount: number): string {
  return (
    '⚠️ *Apagar meus dados?*\n\n' +
    'Isso apaga para sempre:\n' +
    '• seu perfil (telefone, nome, atividade, cidade)\n' +
    `• ${receiptCount} comprovante(s) guardado(s)\n` +
    `• ${deadlineCount} prazo(s) acompanhado(s)\n\n` +
    'Para confirmar, responda "sim, apagar" em até 24 horas.\n' +
    'Se mudar de ideia, é só não responder.'
  );
}

/** Second step of deletion: what was actually removed. */
export function buildDeleteDoneReply(deleted: {
  deletedMei: boolean;
  deletedReceipts: number;
  deletedDeadlines: number;
}): string {
  return (
    '✅ Seus dados foram apagados.\n\n' +
    `• Perfil: ${deleted.deletedMei ? 'apagado' : 'não encontrado'}\n` +
    `• Comprovantes apagados: ${deleted.deletedReceipts}\n` +
    `• Prazos apagados: ${deleted.deletedDeadlines}\n\n` +
    'Não guardo mais nada seu. Se quiser voltar, é só falar comigo de novo.'
  );
}

/** "sim, apagar" arrived without a pending request. */
export function buildDeleteNotPendingReply(): string {
  return (
    'Você não pediu para apagar seus dados.\n\n' +
    'Se quiser apagar tudo, envie "apagar meus dados" primeiro, ' +
    'depois confirme com "sim, apagar".'
  );
}
