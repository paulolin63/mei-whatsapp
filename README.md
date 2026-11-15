# Contador MEI no WhatsApp

Assistente de contabilidade para MEI (Microempreendedor Individual)
**dentro do WhatsApp**: foto do comprovante → despesa classificada;
pergunta sobre DAS, NFS-e e teto → resposta na hora; lembrete do
vencimento do DAS antes do dia 20.

> **Versão 0.1 — scaffold, não é um produto pronto.** O objetivo é
> mostrar a arquitetura e o escopo do MVP. Calcula o valor fixo do DAS
> pela tabela oficial, mas não emite nota fiscal e não substitui um contador.

## Visão

O MEI brasileiro (~15 milhões de pessoas) precisa, todo mês, pagar o
DAS, emitir NFS-e pelo portal da sua cidade (cada cidade tem o seu) e
controlar o teto de R$ 81 mil/ano. As ferramentas atuais foram feitas
para contadores, não para o MEI. Este assistente vive onde o MEI já
está — o WhatsApp — e fala a língua dele: foto, áudio e texto curto.

## O que o MVP faz (v0.1)

- **Foto de comprovante** → download da mídia via WhatsApp Cloud API e
  extração inteligente com **Gemini Multimodal OCR** (lê valor, CNPJ,
  estabelecimento, data e categoria de despesa; com fallback para stub).
- **Valor do DAS por atividade** — tabela oficial anual: comércio
  R$ 82,05, serviços R$ 86,05, comércio e serviços R$ 87,05 (2026,
  salário mínimo R$ 1.621); MEI Caminhoneiro 12% (R$ 194,52 + tributos
  variáveis). Diga "minha atividade é serviços" para gravar a sua.
- **Perguntas e respostas** sobre DAS (valor e vencimento), NFS-e por cidade e
  teto anual de R$ 81 mil.
- **Lembrete e vencimento do DAS** — calcula o próximo dia 20 considerando
  fins de semana e **feriados nacionais e bancários** (adiamento para o
  próximo dia útil, incluindo a Lei 14.759/2023 - Consciência Negra);
  o lembrete traz o valor exato quando a atividade é conhecida.
- **NFS-e por cidade (20 cidades)** — MEI emite no Emissor Nacional
  (Receita Federal) em qualquer cidade, desde 09/2023 (CGSN 169/2022);
  diga "minha cidade é Marília" para gravar a sua e ver o portal da
  prefeitura (cadastro e consulta).
- **Alerta de teto** — avisa a partir de 90% do faturamento anual.

## Como rodar

Requisitos: Node.js 20+ e npm.

```bash
npm install
cp .env.example .env   # preencha WHATSAPP_TOKEN e WHATSAPP_PHONE_NUMBER_ID
npm run dev            # servidor com reload (tsx) em http://localhost:3000
```

Outros comandos:

```bash
npm run build   # compila TypeScript para dist/
npm start       # roda a versão compilada (node dist/index.js)
npm test        # compila e roda os testes (node:test)
```

Sem as credenciais do WhatsApp, o servidor sobe normalmente e os
envios viram log (`[whatsapp] not configured`) — dá para testar
`/health` e o roteador sem conta Meta.

### Webhook

1. Crie um app em [Meta for Developers](https://developers.facebook.com)
   e ative a **WhatsApp Cloud API**.
2. Exponha o servidor (ex.: `ngrok http 3000`) e cadastre a URL
   `https://<seu-dominio>/webhook` com o `WHATSAPP_VERIFY_TOKEN`.
3. Envie uma mensagem para o número de teste e veja a resposta.

## Estrutura do projeto

```
src/
  index.ts                 Servidor Express + endpoints do webhook
  config.ts                Configuração via variáveis de ambiente
  types.ts                 Tipos de domínio (MEI, recibo, prazo)
  whatsapp/
    client.ts              Envio pela WhatsApp Cloud API (no-op sem token)
    webhook.ts             Parse do payload + roteador de mensagens
  mei/
    das.ts                 Regras do DAS: dia 20, dia útil, teto R$ 81 mil
    dasAmount.ts           Valor do DAS por atividade (tabela oficial anual)
    holidays.ts            Feriados nacionais e bancários do Brasil
    nfse.ts                Cadastro de NFS-e por município
  receipts/
    classify.ts            Classificador por palavras-chave (trocável por LLM)
    ocr.ts                 Gemini OCR + stub (fallback sem chave)
  store/
    db.ts                  Store JSON em data/ (trocável por Postgres)
  jobs/
    reminders.ts           Geração de lembretes de DAS e alerta de teto
tests/
  das.test.ts              Testes das regras do DAS (node:test)
  dasAmount.test.ts        Testes do valor do DAS por atividade
  holidays.test.ts         Testes do calendário de feriados
  nfse.test.ts             Testes do cadastro de NFS-e (inclui tabela IBGE)
  ocr.test.ts              Testes do OCR (stub + Gemini)
  webhook.test.ts          Testes das respostas do DAS no WhatsApp
  reminders.test.ts        Testes do lembrete de DAS com valor
docs/
  ESPEC.md                 Especificação do produto e plano de validação
  ARQUITETURA.md           Componentes, fluxos e modelo de dados
```

## Roadmap

- **v0.2** — Classificação de despesas com LLM, histórico de despesas
  por mês. (OCR real e download de mídia já entraram via Gemini.)
- **v0.3** — DASN-SIMEI (declaração anual), pagamento via link/boleto.
- **v1.0** — Postgres, multi-tenant, fila de envio, LGPD (exportar/apagar
  dados), cobrança R$ 19–29/mês.

## Aviso legal (leia antes de usar)

Este software é um **assistente informativo**. Ele **não substitui um
contador**, não presta consultoria fiscal e não garante a exatidão de
nenhum valor, prazo ou regra tributária: as regras mudam por município
e por ano. **Todo valor ou prazo deve ser conferido no Portal do
Empreendedor (gov.br) ou com um contador antes de qualquer pagamento
ou emissão de nota.** O uso é por conta e risco do usuário.

Licença: MIT — veja [LICENSE](LICENSE).
