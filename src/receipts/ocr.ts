/**
 * OCR (text extraction from receipt photos) — interface + stub (v0.1).
 *
 * No OCR provider is wired in yet: downloading a receipt photo and
 * sending it to a provider costs money and needs credentials, so v0.1
 * ships the interface and a no-op implementation. A real provider
 * (e.g. Google Cloud Vision, AWS Textract, or an on-device model)
 * only needs to implement `OcrProvider`; nothing else changes.
 */

export interface OcrResult {
  text: string;
  /** 0..1 confidence of the extraction, when the provider reports one. */
  confidence: number;
  provider: string;
  /** Human-readable note shown to the user when text is empty. */
  note?: string;
}

export interface OcrProvider {
  readonly name: string;
  extractText(image: Buffer): Promise<OcrResult>;
}

/**
 * Placeholder provider: returns no text and says so. The webhook
 * replies to the user asking for a typed summary instead of failing
 * silently — a photo with no readable text is a normal case in v0.1.
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
