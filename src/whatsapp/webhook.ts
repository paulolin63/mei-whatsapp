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
import {
  MEI_ACTIVITY_LABELS,
  describeDasAmount,
  tryDasAmount,
  tryDasAmountTable,
} from '../mei/dasAmount';
import { getMunicipality, summarizeMunicipality, extractCityFromText, listMunicipalities, PORTAL_NACIONAL_URL } from '../mei/nfse';
import { store } from '../store/db';
import { downloadMedia } from './client';
import type {
  IncomingMessage,
  MeiActivity,
  MeiProfile,
  ReceiptCategory,
} from '../types';

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

/**
 * Parse the MEI's activity from free text, e.g. "minha atividade é
 * serviços", "sou comércio", "atividade: ambos". Returns undefined
 * when no activity is named. Order matters: "comércio e serviços"
 * must be detected before plain "serviços".
 */
export function parseActivityFromText(text: string): MeiActivity | undefined {
  const q = text.toLowerCase();
  if (/\b(caminhoneiro|caminhão|caminhao|transportador)\b/.test(q)) {
    return 'caminhoneiro';
  }
  if (/\b(ambos|os dois|comércio e serviços|comercio e servicos|misto|mista)\b/.test(q)) {
    return 'comercio_servicos';
  }
  if (/\b(serviços|servicos|prestador|prestadora)\b/.test(q)) {
    return 'servicos';
  }
  if (/\b(comércio|comercio|indústria|industria)\b/.test(q)) {
    return 'comercio';
  }
  return undefined;
}

/**
 * Pure DAS reply for one MEI: due date + exact amount when the
 * activity is known, the 3-row table when it is not. No store
 * access — unit-testable (see tests/webhook.test.ts).
 */
export function buildDasReply(mei: MeiProfile, now: Date = new Date()): string {
  const due = nextDueDate(now);
  const dueStr = due.toLocaleDateString('pt-BR');
  const year = due.getFullYear();
  const noTable =
    `O próximo DAS vence em ${dueStr} (dia 20, ou o próximo dia útil). ` +
    `A tabela de valores de ${year} ainda não foi publicada — confira no Portal do Empreendedor.` +
    DISCLAIMER;

  if (mei.activity) {
    const amount = tryDasAmount(mei.activity, year);
    if (!amount) return noTable;
    return (
      `O próximo DAS (${MEI_ACTIVITY_LABELS[mei.activity]}) vence em ${dueStr} (dia 20, ou o próximo dia útil). ` +
      `Valor: ${describeDasAmount(amount)}. ` +
      `Confirme a guia no Portal do Empreendedor antes de pagar.` +
      DISCLAIMER
    );
  }

  const rows = tryDasAmountTable(year);
  if (!rows) return noTable;
  const table = rows
    .map((a) => `• ${MEI_ACTIVITY_LABELS[a.activity]}: ${formatBrl(a.totalBrl)}`)
    .join('\n');
  return (
    `O próximo DAS vence em ${dueStr} (dia 20, ou o próximo dia útil).\n` +
    `O valor depende da sua atividade (${year}):\n${table}\n` +
    `Me diga a sua atividade — por exemplo: "minha atividade é serviços" — que eu te passo o valor exato.` +
    DISCLAIMER
  );
}

/** Rule-based answers. This is the hook where an LLM Q&A plugs in later. */
export function answerQuestion(phone: string, text: string): string {
  const mei = ensureMei(phone);
  const q = text.toLowerCase();

  // Setting the activity: "minha atividade é serviços", "sou comércio",
  // "atividade: ambos". Checked first so the word "atividade" does not
  // fall through to the DAS Q&A below.
  if (q.includes('atividade') || q.includes('sou ')) {
    const activity = parseActivityFromText(text);
    if (activity) {
      store.upsertMei({ ...mei, activity });
      const amount = tryDasAmount(activity, new Date().getFullYear());
      const amountLine = amount
        ? ` Seu DAS é ${formatBrl(amount.totalBrl)} por mês (${describeDasAmount(amount)}).`
        : '';
      return (
        `Anotado: sua atividade é ${MEI_ACTIVITY_LABELS[activity]}.${amountLine}` +
        DISCLAIMER
      );
    }
  }

  if (q.includes('teto') || q.includes('limite') || q.includes('81')) {
    return (
      `O teto de faturamento do MEI é ${formatBrl(ANNUAL_CAP_BRL)} por ano ` +
      `(R$ 6.750 por mês, proporcional aos meses de atividade). ` +
      `Acima disso é preciso desenquadrar — fale com um contador antes de passar do limite.` +
      DISCLAIMER
    );
  }

  if (
    q.includes('das') ||
    q.includes('vencimento') ||
    q.includes('prazo') ||
    q.includes('valor') ||
    q.includes('quanto') ||
    q.includes('custa') ||
    q.includes('pagar')
  ) {
    return buildDasReply(mei);
  }

  if (q.includes('nota') || q.includes('nfs') || q.includes('nota fiscal')) {
    // 1. Try to extract city from the message itself ("NFS-e em Curitiba?", "nota de Salvador")
    const mentioned = extractCityFromText(text);
    if (mentioned) {
      return summarizeMunicipality(mentioned) + DISCLAIMER;
    }

    // 2. Fall back to the MEI's registered municipality
    const profileCity = mei.municipalityIbge
      ? getMunicipality(mei.municipalityIbge)
      : undefined;
    if (profileCity) {
      return (
        `Aqui está a informação da NFS-e para a sua cidade cadastrada:\n\n` +
        summarizeMunicipality(profileCity) +
        DISCLAIMER
      );
    }

    // 3. Generic reply with Portal Nacional highlight + invite to say city
    const totalCities = listMunicipalities().length;
    return (
      `📄 *NFS-e (Nota Fiscal de Serviços)*\n\n` +
      `A emissão depende da sua cidade. Muitas já usam o *Portal Nacional do MEI* (Receita Federal):\n` +
      `• ${PORTAL_NACIONAL_URL}\n\n` +
      `Me diga a sua cidade que eu te passo o portal certo. ` +
      `Tenho ${totalCities} cidades cadastradas (SP, RJ, BH, Curitiba, Porto Alegre, Florianópolis e mais).` +
      DISCLAIMER
    );
  }

  if (q.includes('oi') || q.includes('olá') || q.includes('ola') || q.includes('bom dia')) {
    return (
      'Olá! 👋 Sou o assistente do MEI no WhatsApp.\n\n' +
      'O que eu já faço:\n' +
      '• Foto de comprovante → classifico a despesa\n' +
      '• Pergunte quanto é o DAS e quando vence\n' +
      '• Pergunte sobre NFS-e e teto do MEI\n' +
      '• Lembro você do vencimento do DAS\n\n' +
      'Envie uma foto de um comprovante ou pergunte, por exemplo: "quanto é o DAS?"' +
      DISCLAIMER
    );
  }

  return (
    'Ainda não sei responder isso — meu conhecimento cobre DAS (valor e vencimento), NFS-e e o teto do MEI. ' +
    'Tente perguntar, por exemplo: "quanto é o DAS?" ou "qual é o teto do MEI?".' +
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
