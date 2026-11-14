/**
 * Shared domain types for the MEI WhatsApp accountant (v0.1).
 *
 * Keep this file free of framework imports: it is the contract between
 * the WhatsApp layer, the MEI rules layer and the store.
 */

/** A registered MEI (Microempreendedor Individual) user. */
export interface MeiProfile {
  /** WhatsApp phone number in E.164 format, e.g. "5514999998888". */
  phone: string;
  /** Display name, as the user gave it. */
  name: string;
  /** CNPJ, digits only, when the user has shared it. Optional in v0.1. */
  cnpj?: string;
  /** IBGE code of the municipality (see src/mei/nfse.ts). */
  municipalityIbge?: string;
  /** When the MEI was opened (ISO date). Used for the proportional cap. */
  openedAt?: string;
  /** ISO timestamp of the last interaction. */
  updatedAt: string;
}

/** Receipt (comprovante / nota) categories used by the classifier. */
export type ReceiptCategory =
  | 'alimentacao'
  | 'transporte'
  | 'material'
  | 'servico'
  | 'imposto'
  | 'outros';

/** A receipt captured from a WhatsApp photo. */
export interface Receipt {
  id: string;
  /** Phone of the MEI who sent it. */
  phone: string;
  /** WhatsApp media id, when available. */
  mediaId?: string;
  /** Text extracted from the photo (OCR). Empty while the OCR stub is used. */
  extractedText: string;
  category: ReceiptCategory;
  /** 0..1 confidence reported by the classifier. */
  confidence: number;
  /** Keywords/rules that decided the category (auditability). */
  matchedKeywords: string[];
  /** Best-effort amount in BRL parsed from the text, when found. */
  amountBrl?: number;
  createdAt: string;
}

/** Kinds of deadline the assistant tracks. */
export type DeadlineKind = 'DAS' | 'NFS-e' | 'DASN-SIMEI';

/** A tax deadline for one MEI. */
export interface Deadline {
  id: string;
  phone: string;
  kind: DeadlineKind;
  /** ISO date (YYYY-MM-DD) the payment/ filing is due. */
  dueDate: string;
  description: string;
  remindedAt?: string;
}

/** Minimal shape of an incoming WhatsApp message (after webhook parsing). */
export interface IncomingMessage {
  from: string;
  /** WhatsApp message id (for de-duplication later). */
  messageId: string;
  type: 'text' | 'image' | 'unsupported';
  /** Text body, for type === 'text'. */
  text?: string;
  /** Media id, for type === 'image'. */
  mediaId?: string;
  /** Caption of the image, when present. */
  caption?: string;
  receivedAt: string;
}
