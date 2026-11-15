import test from 'node:test';
import assert from 'node:assert/strict';
import {
  StubOcrProvider,
  GeminiOcrProvider,
  createOcrProvider,
} from '../src/receipts/ocr';
import { handleReceiptPhoto } from '../src/whatsapp/webhook';

test('StubOcrProvider: returns empty text with human note', async () => {
  const provider = new StubOcrProvider();
  const res = await provider.extractText(Buffer.from('fake'));
  assert.equal(res.text, '');
  assert.equal(res.confidence, 0);
  assert.equal(res.provider, 'stub');
  assert.ok(res.note?.includes('OCR ainda não configurado'));
});

test('createOcrProvider: returns stub when GEMINI_API_KEY is unset', () => {
  const provider = createOcrProvider();
  assert.equal(provider.name, 'stub');
});

test('GeminiOcrProvider: handles empty image buffer gracefully', async () => {
  const provider = new GeminiOcrProvider('test-key', 'gemini-2.5-flash');
  const res = await provider.extractText(Buffer.alloc(0));
  assert.equal(res.text, '');
  assert.equal(res.confidence, 0);
  assert.ok(res.note?.includes('Imagem vazia'));
});

test('GeminiOcrProvider: parses valid structured response from Gemini', async () => {
  const mockPayload = {
    candidates: [
      {
        content: {
          parts: [
            {
              text: JSON.stringify({
                extractedText: 'AUTO POSTO BRASIL LTDA - TOTAL R$ 150,00',
                merchantName: 'Auto Posto Brasil',
                cnpj: '12.345.678/0001-90',
                date: '2026-11-14',
                amountBrl: 150.0,
                suggestedCategory: 'transporte',
                confidence: 0.98,
              }),
            },
          ],
        },
      },
    ],
  };

  const mockFetch: typeof fetch = async () => {
    return {
      ok: true,
      status: 200,
      json: async () => mockPayload,
      text: async () => JSON.stringify(mockPayload),
    } as unknown as Response;
  };

  const provider = new GeminiOcrProvider('test-key', 'gemini-2.5-flash', mockFetch);
  const result = await provider.extractText(Buffer.from('dummy image'));

  assert.equal(result.provider, 'gemini');
  assert.equal(result.amountBrl, 150.0);
  assert.equal(result.suggestedCategory, 'transporte');
  assert.equal(result.merchantName, 'Auto Posto Brasil');
  assert.equal(result.cnpj, '12.345.678/0001-90');
  assert.equal(result.date, '2026-11-14');
  assert.equal(result.confidence, 0.98);
});

test('GeminiOcrProvider: handles upstream API failure gracefully', async () => {
  const mockFetch: typeof fetch = async () => {
    return {
      ok: false,
      status: 401,
      text: async () => 'Unauthorized',
    } as unknown as Response;
  };

  const provider = new GeminiOcrProvider('bad-key', 'gemini-2.5-flash', mockFetch);
  const result = await provider.extractText(Buffer.from('dummy image'));

  assert.equal(result.text, '');
  assert.equal(result.confidence, 0);
  assert.ok(result.note?.includes('401'));
});

test('handleReceiptPhoto: works in stub mode with caption fallback', async () => {
  const reply = await handleReceiptPhoto({
    from: '5511999990001',
    messageId: 'wamid.123',
    type: 'image',
    caption: 'Almoço no restaurante R$ 45,00',
    receivedAt: new Date().toISOString(),
  });

  assert.ok(reply.includes('Comprovante registrado'));
  assert.ok(reply.includes('Alimentação'));
  assert.ok(reply.includes('R$'));
});
