# ARQUITETURA — Contador MEI no WhatsApp (v0.1)

## 1. Visão geral

```
Usuário (WhatsApp)
      │  mensagem (texto / foto)
      ▼
Meta — WhatsApp Cloud API
      │  POST /webhook
      ▼
┌─────────────┐   parse    ┌──────────────┐
│  index.ts   │ ─────────► │ webhook.ts   │  roteador
│  (Express)  │            │  (router)    │
└─────────────┘            └──────┬───────┘
                                  │ texto → Q&A stub
                                  │ foto  → OCR stub + classificador
                    ┌─────────────┼──────────────┐
                    ▼             ▼              ▼
              ┌──────────┐  ┌──────────┐  ┌──────────┐
              │ mei/     │  │ receipts/│  │ store/   │
              │ das.ts   │  │ classify │  │ db.ts    │
              │ nfse.ts  │  │ ocr.ts   │  │ (JSON)   │
              └──────────┘  └──────────┘  └──────────┘
                                  │
                                  ▼
                           ┌──────────────┐
                           │ client.ts    │ ──► Meta Graph API
                           │ (envio)      │     (resposta)
                           └──────────────┘
```

Separação de responsabilidades: o `webhook.ts` nunca fala com a API da
Meta diretamente (só via `client.ts`); as regras de MEI nunca importam
Express; o store nunca é acessado fora de `store/db.ts`.

## 2. Componentes

| Módulo | Papel | Dependências |
|---|---|---|
| `src/index.ts` | Servidor Express; verificação do webhook; ack rápido (200) antes de processar | express, config, webhook, client |
| `src/config.ts` | Variáveis de ambiente com defaults seguros | dotenv |
| `src/types.ts` | Tipos de domínio (sem imports de framework) | — |
| `src/whatsapp/client.ts` | Envio de texto via Graph API; no-op com log se não configurado | fetch global, config |
| `src/whatsapp/webhook.ts` | Parse do payload da Meta; roteamento texto/foto; Q&A por palavras-chave (inclui valor do DAS, gravação da atividade e da cidade, e direitos LGPD: ver e apagar dados) | classify, ocr, das, dasAmount, nfse, lgpd, store |
| `src/mei/das.ts` | Regras do DAS: dia 20, dia útil, teto R$ 81 mil, proporcional | — |
| `src/mei/dasAmount.ts` | Valor do DAS por atividade (tabela oficial anual, mínimo por decreto) | das, types |
| `src/mei/nfse.ts` | Cadastro de NFS-e por município (20 cidades; MEI sempre no Emissor Nacional, portal municipal p/ cadastro e consulta) | — |
| `src/receipts/classify.ts` | Classificador por palavras-chave + interface `ReceiptClassifier` | types |
| `src/receipts/ocr.ts` | GeminiOcrProvider (multimodal) + stub quando não há chave | config |
| `src/store/db.ts` | JSON store em `data/store.json`; interface de repositório | config, types |
| `src/jobs/reminders.ts` | Geração pura de lembretes (DAS ≤ 7 dias, com o valor quando a atividade é conhecida; alerta de teto ≥ 90%) | das, dasAmount |

## 3. Fluxo do webhook (WhatsApp Cloud API)

1. **Verificação** — Meta envia `GET /webhook?hub.mode=subscribe&
   hub.verify_token=...&hub.challenge=...`. O servidor devolve o
   `challenge` somente se o token conferir com `WHATSAPP_VERIFY_TOKEN`.
2. **Recebimento** — Meta envia `POST /webhook` com o evento. O
   servidor responde `200` imediatamente (a Meta exige resposta rápida)
   e processa em seguida, sem bloquear a resposta.
3. **Parse** — `parseWebhookBody()` extrai `entry[].changes[].value.
   messages[]` e normaliza para `IncomingMessage` (texto, imagem ou
   `unsupported`). Eventos de status (entregue/lido) são ignorados.
4. **Roteamento** — texto vai para `answerQuestion()`; foto vai para
   `handleReceiptPhoto()`; outros tipos recebem uma resposta educada.
5. **Resposta** — `sendTextMessage()` posta na Graph API. Sem token
   configurado, apenas loga (modo desenvolvimento).

## 4. Fluxo de mensagem (texto)

```
"quanto é o DAS?"
  → Q&A detecta "das"/"valor"/"quanto"
  → nextDueDate() (dia 20 ou próximo dia útil) + calculateDasAmount()
    (atividade do perfil, se conhecida)
  → resposta com a data e o valor exato; sem atividade, responde a
    tabela de 3 valores e pede a atividade ("minha atividade é serviços")
  + disclaimer (contador tem a palavra final)
```

```
"nota em São Paulo?"
  → Q&A detecta "nota"/"nfs"
  → extractCityFromText() encontra São Paulo → grava municipalityIbge no perfil
  → summarizeMunicipality(): Emissor Nacional primeiro (regra do MEI,
    CGSN 169/2022) + portal municipal (cadastro/consulta) + como emitir
  + disclaimer (contador tem a palavra final)

"minha cidade é Marília"
  → parseSetCityCommand() → grava municipalityIbge → confirma + resumo da cidade
  (cidade fora do cadastro: responde o Emissor Nacional mesmo assim,
  pois a emissão do MEI não depende da cidade)
```

```
"meus dados"
  → buildMyDataReply(perfil, comprovantes): resumo do que está guardado

"apagar meus dados"
  → grava deleteRequestedAt no perfil → pede confirmação ("sim, apagar", 24h)

"sim, apagar"
  → deleteMeiByPhone(): apaga perfil + comprovantes + prazos num só write
```

## 5. Fluxo de mensagem (foto de comprovante)

```
foto (+ legenda opcional)
  → download da imagem via Meta Graph API (client.downloadMedia)
  → extração multimodal (GeminiOcrProvider com fallback para StubOcrProvider)
  → dados estruturados: valor, categoria, CNPJ, estabelecimento, data
  → salva em store.addReceipt()
  → responde: categoria, valor, estabelecimento, CNPJ, data e confiança
```

Configuração: defina `GEMINI_API_KEY` no `.env` para OCR real. Sem chave,
o sistema roda em modo stub/legenda sem quebrar.

## 6. Modelo de dados

Arquivo único `data/store.json` (gitignorado), 3 coleções:

```jsonc
{
  "meis": [
    {
      "phone": "5514999998888",
      "name": "Maria",
      "cnpj": "12345678000199",        // opcional
      "municipalityIbge": "3529005",   // Marília
      "activity": "servicos",          // decide o valor do DAS
      "openedAt": "2024-03-01",
      "updatedAt": "2026-11-14T10:00:00.000Z"
    }
  ],
  "receipts": [
    {
      "id": "uuid",
      "phone": "5514999998888",
      "mediaId": "wamid.xxx",
      "extractedText": "supermercado ... R$ 123,45",
      "category": "alimentacao",
      "confidence": 0.75,
      "matchedKeywords": ["supermercado"],
      "amountBrl": 123.45,
      "createdAt": "2026-11-14T10:00:00.000Z"
    }
  ],
  "deadlines": [
    {
      "id": "uuid",
      "phone": "5514999998888",
      "kind": "DAS",
      "dueDate": "2026-11-20",
      "description": "DAS referente a outubro/2026"
    }
  ]
}
```

Escrita atômica o suficiente para o piloto (temp file + rename).
Concorrência multi-instância **não** é suportada — ver migração abaixo.

## 7. Migração para Postgres (quando sair do piloto)

O `JsonStore` já é um repositório: a troca é implementar a mesma
interface sobre o `pg` (`@types/pg` + `pg`) e trocar a instância
exportada em `store/db.ts`. Nenhum outro arquivo muda.

Tabelas (rascunho):

```sql
CREATE TABLE meis (
  phone TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  cnpj TEXT,
  municipality_ibge TEXT,
  opened_at DATE,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE TABLE receipts (
  id UUID PRIMARY KEY,
  phone TEXT NOT NULL REFERENCES meis(phone),
  media_id TEXT,
  extracted_text TEXT NOT NULL DEFAULT '',
  category TEXT NOT NULL,
  confidence REAL NOT NULL,
  matched_keywords TEXT[] NOT NULL DEFAULT '{}',
  amount_brl NUMERIC(12,2),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE TABLE deadlines (
  id UUID PRIMARY KEY,
  phone TEXT NOT NULL REFERENCES meis(phone),
  kind TEXT NOT NULL,
  due_date DATE NOT NULL,
  description TEXT NOT NULL,
  reminded_at TIMESTAMPTZ
);
```

## 8. Lembretes (jobs)

`src/jobs/reminders.ts` **gera** lembretes (funções puras, sem I/O de
rede): `dasReminder()` (vencimento a ≤ 7 dias), `capWarning()`
(faturamento ≥ 90% do teto). `runDasRemindersJob()` varre todos os
MEIs, pula quem já foi lembrado desta data (`hasBeenReminded()`), e
dispara via `sendDasReminderSmart()`: dentro de 24h da última
interação, mensagem de texto livre (grátis); fora da janela, o
template aprovado `lembrete_das_vencimento`. Depois de enviar com
sucesso, `markDeadlineReminded()` registra o envio (dedup).

O disparo é o endpoint `POST /jobs/reminders` (`src/index.ts`),
protegido por `CRON_SECRET` (`src/jobs/cronAuth.ts`, fail closed:
sem secret configurado, recusa tudo; comparação timing-safe).
`GET /jobs/reminders` só devolve o status — nunca dispara.
`?dryRun=true` pré-visualiza sem enviar nem marcar.

A janela de 24h usa `updatedAt` do perfil como última interação:
toda mensagem recebida atualiza `updatedAt` (`ensureMei()`).

## 9. Segurança e privacidade (v0.1)

- Nenhum segredo no repositório: `.env` está no `.gitignore`; o
  exemplo (`.env.example`) só tem placeholders.
- O token do WhatsApp vai em variável de ambiente, nunca em código.
- `POST /jobs/reminders` exige `CRON_SECRET` (fail closed: sem secret
  configurado, recusa tudo) e comparação timing-safe; `GET` no mesmo
  caminho só devolve o status e nunca dispara.
- `data/` é gitignorado — comprovantes e telefones não entram no git.
- Dependências mínimas (express + dotenv) para superfície de ataque
  pequena; `npm audit` no CI quando houver.
- LGPD: no piloto, dados ficam no disco do operador; exclusão e
  exportação sob pedido precisam existir antes da cobrança (roadmap).

## 10. Limitações conhecidas (honestas)

- O cálculo do vencimento cobre feriados **nacionais e bancários** (Carnaval, Sexta-feira Santa, Corpus Christi e datas fixas incluindo Consciência Negra). Feriados **municipais** específicos ainda não são modelados.
- O valor do DAS segue a tabela oficial anual (salário mínimo por
  decreto); um ano sem linha na tabela faz o código recusar o cálculo
  em vez de chutar — a tabela precisa de revisão todo janeiro.
- O cadastro de NFS-e tem 20 cidades; códigos IBGE validados contra a
  API do IBGE (2026-11-15) e travados por teste de regressão. URLs dos
  portais municipais não são re-verificadas a cada resposta — confirme
  no portal antes de emitir.
- A exclusão LGPD apaga perfil, comprovantes e prazos de store.json.
  Cópias de segurança do arquivo, se existirem fora do piloto, não
  são apagadas por este comando.
- O dedup de lembretes é check-then-mark, sem lock: duas execuções
  sobrepostas do cron podem duplicar um lembrete. No piloto (uma
  instância, uma vez por dia), o risco é baixo.
- O classificador é por palavras-chave e erra em texto ambíguo — a
  confiança e as palavras-base são mostradas ao usuário justamente
  para ele corrigir.
- Sem autenticação no `/webhook` além da verificação da Meta; sem
  rate limiting em v0.1.
