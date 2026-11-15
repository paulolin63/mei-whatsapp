/**
 * OCR (text and structured data extraction from receipt photos).
 *
 * Supported providers:
 * - GeminiOcrProvider: multimodal vision analysis using Google Gemini API.
 *   Extracts full text, merchant name, CNPJ, date, amount, and category.
 * - StubOcrProvider: fallback stub when no API key is configured.
 */
import { config } from '../config';
import type { ReceiptCategory } from '../types';

export interface OcrResult {
  text: string;
  /** 0..1 confidence of the extraction reported by the provider. */
  confidence: number;
  provider: string;
  /** Human-readable note shown to the user when text is empty or stubbed. */
  note?: string;
  /** Extracted total amount in BRL, if detected. */
  amountBrl?: number;
  /** Suggested MEI expense category, if recognized. */
  suggestedCategory?: ReceiptCategory;
  /** Issuer / Merchant name, if detected. */
  merchantName?: string;
  /** Issuer CNPJ, if detected. */
  cnpj?: string;
  /** Date on receipt (YYYY-MM-DD), if detected. */
  date?: string;
}

export interface OcrProvider {
  readonly name: string;
  extractText(image: Buffer, mimeType?: string): Promise<OcrResult>;
}

/**
 * Placeholder provider: returns no text and advises the user.
 */
export class StubOcrProvider implements OcrProvider {
  readonly name = 'stub';

  async extractText(_image: Buffer): Promise<OcrResult> {
    return {
      text: '',
      confidence: 0,
      provider: this.name,
      note: 'OCR ainda não configurado — envie o valor e a descrição por texto.',
    };
  }
}

/**
 * Gemini-powered Multimodal OCR provider for Brazilian receipts (NFC-e, Cupom, PIX, NFS-e).
 */
export class GeminiOcrProvider implements OcrProvider {
  readonly name = 'gemini';

  constructor(
    private readonly apiKey: string,
    private readonly model: string = 'gemini-2.5-flash',
    private readonly fetchImpl: typeof fetch = fetch,
  ) {}

  async extractText(image: Buffer, mimeType = 'image/jpeg'): Promise<OcrResult> {
    if (!image || image.length === 0) {
      return {
        text: '',
        confidence: 0,
        provider: this.name,
        note: 'Imagem vazia recebida.',
      };
    }

    const base64Data = image.toString('base64');
    const prompt =
      'Você é um assistente contábil brasileiro especializado em recibos, cupons fiscais (NFC-e, SAT), ' +
      'notas fiscais de serviço (NFS-e) e comprovantes de pagamento/PIX para MEI (Microempreendedor Individual).\n\n' +
      'Analise a imagem deste comprovante e extraia as informações em formato JSON estrito com o seguinte esquema:\n' +
      '{\n' +
      '  "extractedText": "texto legível principal ou resumo dos itens",\n' +
      '  "merchantName": "razão social ou nome fantasia do estabelecimento",\n' +
      '  "cnpj": "CNPJ do emissor formatado ou apenas dígitos, se visível",\n' +
      '  "date": "data da transação no formato YYYY-MM-DD, se visível",\n' +
      '  "amountBrl": 123.45,\n' +
      '  "suggestedCategory": "alimentacao" | "transporte" | "material" | "servico" | "imposto" | "outros",\n' +
      '  "confidence": 0.95\n' +
      '}\n' +
      'Retorne SOMENTE o JSON válido, sem markdown ou explicações adicionais.';

    const endpoint = `https://generativelanguage.googleapis.com/v1beta/models/${encodeURIComponent(
      this.model,
    )}:generateContent?key=${encodeURIComponent(this.apiKey)}`;

    try {
      const response = await this.fetchImpl(endpoint, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          contents: [
            {
              parts: [
                { text: prompt },
                {
                  inline_data: {
                    mime_type: mimeType,
                    data: base64Data,
                  },
                },
              ],
            },
          ],
          generationConfig: {
            response_mime_type: 'application/json',
            temperature: 0.1,
          },
        }),
      });

      if (!response.ok) {
        const errorText = await response.text().catch(() => '');
        console.error(`[gemini-ocr] API error (${response.status}): ${errorText}`);
        return {
          text: '',
          confidence: 0,
          provider: this.name,
          note: `Falha na chamada Gemini OCR (${response.status})`,
        };
      }

      const data = (await response.json()) as {
        candidates?: Array<{
          content?: {
            parts?: Array<{ text?: string }>;
          };
        }>;
      };

      const rawJson = data.candidates?.[0]?.content?.parts?.[0]?.text?.trim() ?? '';
      if (!rawJson) {
        return {
          text: '',
          confidence: 0,
          provider: this.name,
          note: 'Não foi possível extrair texto da imagem.',
        };
      }

      const parsed = JSON.parse(rawJson) as {
        extractedText?: string;
        merchantName?: string;
        cnpj?: string;
        date?: string;
        amountBrl?: number;
        suggestedCategory?: ReceiptCategory;
        confidence?: number;
      };

      const validCategories: ReceiptCategory[] = [
        'alimentacao',
        'transporte',
        'material',
        'servico',
        'imposto',
        'outros',
      ];

      const category = validCategories.includes(parsed.suggestedCategory as ReceiptCategory)
        ? (parsed.suggestedCategory as ReceiptCategory)
        : undefined;

      return {
        text: parsed.extractedText ?? '',
        confidence: typeof parsed.confidence === 'number' ? parsed.confidence : 0.85,
        provider: this.name,
        amountBrl: typeof parsed.amountBrl === 'number' ? parsed.amountBrl : undefined,
        suggestedCategory: category,
        merchantName: parsed.merchantName || undefined,
        cnpj: parsed.cnpj || undefined,
        date: parsed.date || undefined,
      };
    } catch (err) {
      console.error('[gemini-ocr] unexpected error:', err);
      return {
        text: '',
        confidence: 0,
        provider: this.name,
        note: 'Erro ao processar imagem com Gemini.',
      };
    }
  }
}

/**
 * Creates the appropriate OCR provider according to the environment configuration.
 */
export function createOcrProvider(): OcrProvider {
  if (config.gemini.apiKey) {
    return new GeminiOcrProvider(config.gemini.apiKey, config.gemini.model);
  }
  return new StubOcrProvider();
}
