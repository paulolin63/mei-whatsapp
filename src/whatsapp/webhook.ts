/**
 * WhatsApp webhook: parse the Cloud API payload and route messages.
 *
 * v0.1 scope:
 * - text  → rule-based Q&A stub (DAS due date, NFS-e, annual cap).
 * - image → receipt intake stub (OCR is a no-op, classifier is
 *   keyword-based; the receipt is saved and a summary is replied).
 * - other → a polite "not supported yet" reply.
 *
 * Everything a user sees in PT-BR. Every reply that states a tax
 * rule carries the disclaimer that a human accountant has the final word.
 */
import { KeywordClassifier, parseAmountBrl } from '../receipts/classify';
import { createOcrProvider } from '../receipts/ocr';
import { formatBrl, nextDueDate, ANNUAL_CAP_BRL } from '../mei/das';
import { getMunicipality, summarizeMunicipality } from '../mei/nfse';
import { store } from '../store/db';
import { downloadMedia } from './client';
import type { IncomingMessage, MeiProfile, ReceiptCategory } from '../types';

const DISCLAIMER =
  '\n\n⚠️ Sou um assistente, não substituo um contador. ' +
  'Confira valores e prazos no Portal do Empreendedor ou com o seu contador.';

const classifier = new KeywordClassifier();

/**
 * Extract the incoming messages from a WhatsApp Cloud API webhook body.
 * Returns an empty array for non-message events (statuses, etc.).
 */
export function parseWebhookBody(body: unknown): IncomingMessage[] {
  if (!body || typeof body !== 'object') return [];
  const entries = (body as { entry?: unknown }).entry;
  if (!Array.isArray(entries)) return [];

  const out: IncomingMessage[] = [];
  for (const entry of entries) {
    const changes = (entry as { changes?: unknown }).changes;
    if (!Array.isArray(changes)) continue;
    for (const change of changes) {
      const value = (change as { value?: unknown }).value as
        | { messages?: unknown }
        | undefined;
      if (!value || !Array.isArray(value.messages)) continue;
      for (const raw of value.messages) {
        const msg = raw as {
          from?: string;
          id?: string;
          type?: string;
          text?: { body?: string };
          image?: { id?: string; caption?: string };
          timestamp?: string;
        };
        if (!msg.from || !msg.id) continue;
        if (msg.type === 'text') {
          out.push({
            from: msg.from,
            messageId: msg.id,
            type: 'text',
            text: msg.text?.body ?? '',
            receivedAt: new Date().toISOString(),
          });
        } else if (msg.type === 'image') {
          out.push({
            from: msg.from,
            messageId: msg.id,
            type: 'image',
            mediaId: msg.image?.id,
            caption: msg.image?.caption,
            receivedAt: new Date().toISOString(),
          });
        } else {
          out.push({
            from: msg.from,
            messageId: msg.id,
            type: 'unsupported',
            receivedAt: new Date().toISOString(),
          });
        }
      }
    }
  }
  return out;
}

/** Route one message and return the text to reply with. */
export async function handleIncomingMessage(
  message: IncomingMessage,
): Promise<string> {
  switch (message.type) {
    case 'text':
      return answerQuestion(message.from, message.text ?? '');
    case 'image':
      return handleReceiptPhoto(message);
    default:
      return (
        'Por enquanto só entendo mensagens de texto e fotos de comprovantes. 🙂' +
        DISCLAIMER
      );
  }
}

function ensureMei(phone: string): MeiProfile {
  const existing = store.getMei(phone);
  if (existing) return existing;
  return store.upsertMei({ phone, name: 'Empreendedor(a)', updatedAt: '' });
}

/** Rule-based answers. This is the hook where an LLM Q&A plugs in later. */
export function answerQuestion(phone: string, text: string): string {
  ensureMei(phone);
  const q = text.toLowerCase();

  if (q.includes('das') || q.includes('vencimento') || q.includes('prazo')) {
    const due = nextDueDate();
    return (
      `O próximo DAS vence em ${due.toLocaleDateString('pt-BR')} (dia 20, ou o próximo dia útil). ` +
      `O valor depende da sua atividade — comércio, serviços ou ambos — e deve ser conferido no Portal do Empreendedor.` +
      DISCLAIMER
    );
  }

  if (q.includes('teto') || q.includes('limite') || q.includes('81')) {
    return (
      `O teto de faturamento do MEI é ${formatBrl(ANNUAL_CAP_BRL)} por ano ` +
      `(R$ 6.750 por mês, proporcional aos meses de atividade). ` +
      `Acima disso é preciso desenquadrar — fale com um contador antes de passar do limite.` +
      DISCLAIMER
    );
  }

  if (q.includes('nota') || q.includes('nfs')) {
    const m = getMunicipality('São Paulo');
    const hint = m
      ? `\n\nExemplo — ${summarizeMunicipality(m)}`
      : '';
    return (
      `A NFS-e depende da sua cidade: cada prefeitura tem seu próprio portal e suas regras. ` +
      `Me diga a sua cidade que eu te passo o portal oficial.${hint}` +
      DISCLAIMER
    );
  }

  if (q.includes('oi') || q.includes('olá') || q.includes('ola') || q.includes('bom dia')) {
    return (
      'Olá! 👋 Sou o assistente do MEI no WhatsApp.\n\n' +
      'O que eu já faço:\n' +
      '• Foto de comprovante → classifico a despesa\n' +
      '• Pergunte sobre DAS, NFS-e e teto do MEI\n' +
      '• Lembro você do vencimento do DAS\n\n' +
      'Envie uma foto de um comprovante ou pergunte, por exemplo: "quando vence o DAS?"' +
      DISCLAIMER
    );
  }

  return (
    'Ainda não sei responder isso — meu conhecimento cobre DAS, NFS-e e o teto do MEI. ' +
    'Tente perguntar, por exemplo: "quando vence o DAS?" ou "qual é o teto do MEI?".' +
    DISCLAIMER
  );
}

/** Receipt intake: download image -> OCR provider -> classification -> store -> reply. */
export async function handleReceiptPhoto(
  message: IncomingMessage,
): Promise<string> {
  ensureMei(message.from);

  let mediaBuffer: Buffer = Buffer.alloc(0);
  let mimeType = 'image/jpeg';

  if (message.mediaId) {
    const downloaded = await downloadMedia(message.mediaId);
    if (downloaded) {
      mediaBuffer = downloaded.buffer;
      mimeType = downloaded.mimeType;
    }
  }

  const ocrProvider = createOcrProvider();
  const ocrResult = await ocrProvider.extractText(mediaBuffer, mimeType);

  const sourceText = message.caption ?? '';
  const text = ocrResult.text || sourceText;

  // Amount priority: structured OCR amount -> text regex parse
  const amount = ocrResult.amountBrl ?? parseAmountBrl(text);

  // Category priority: structured OCR category -> keyword classifier
  let category: ReceiptCategory = ocrResult.suggestedCategory ?? 'outros';
  let confidence = ocrResult.confidence;
  let matchedKeywords: string[] = [];

  if (!ocrResult.suggestedCategory) {
    const fallbackClassification = classifier.classify(text);
    category = fallbackClassification.category;
    confidence = fallbackClassification.confidence;
    matchedKeywords = fallbackClassification.matchedKeywords;
  } else {
    matchedKeywords = [ocrProvider.name];
  }

  const receipt = store.addReceipt({
    phone: message.from,
    mediaId: message.mediaId,
    extractedText: text,
    category,
    confidence,
    matchedKeywords,
    amountBrl: amount,
  });

  const categoryLabels: Record<string, string> = {
    alimentacao: 'Alimentação',
    transporte: 'Transporte',
    material: 'Material',
    servico: 'Serviço',
    imposto: 'Imposto',
    outros: 'Outros',
  };

  const lines = [
    `Comprovante registrado ✅`,
    `• Categoria: ${categoryLabels[receipt.category] ?? 'Outros'}`,
  ];

  if (amount) {
    lines.push(`• Valor: ${formatBrl(amount)}`);
  }
  if (ocrResult.merchantName) {
    lines.push(`• Estabelecimento: ${ocrResult.merchantName}`);
  }
  if (ocrResult.cnpj) {
    lines.push(`• CNPJ: ${ocrResult.cnpj}`);
  }
  if (ocrResult.date) {
    lines.push(`• Data: ${ocrResult.date}`);
  }
  if (matchedKeywords.length > 0 && !ocrResult.suggestedCategory) {
    lines.push(`• Palavras-chave: ${matchedKeywords.join(', ')}`);
  }
  lines.push(`• Confiança: ${Math.round(confidence * 100)}% (${ocrProvider.name})`);

  if (!text && !amount) {
    lines.push(
      '\nNão consegui ler o texto da foto (OCR ainda sem dados). Se quiser, envie o valor e a descrição por texto.',
    );
  }

  return lines.join('\n') + DISCLAIMER;
}
