# ESPEC — Contador MEI no WhatsApp (v0.1)

## 1. Problema

O MEI brasileiro precisa, todo mês:

1. **Pagar o DAS** até o dia 20 (ou o próximo dia útil);
2. **Emitir NFS-e** no portal da sua cidade — e cada cidade tem o seu
   portal, com regras próprias;
3. **Controlar o faturamento** para não estourar o teto de R$ 81 mil/ano
   e ser desenquadrado;
4. **Guardar comprovantes** para a declaração anual (DASN-SIMEI).

Hoje isso é feito em planilhas, papel e portais de prefeitura. Os
softwares de contabilidade existentes foram feitos para contadores, não
para o MEI. Resultado: DAS pago com atraso (multa + juros), nota
emitida no portal errado e teto estourado sem aviso.

## 2. Público

- **Quem:** MEI ativo no Brasil — ~15 milhões de pessoas.
- **Perfil:** trabalha sozinho ou com 1 funcionário; usa WhatsApp todos
  os dias; não tem contador fixo; fatura até R$ 81 mil/ano.
- **Dor que paga:** medo de multa, de perder o CNPJ e de desenquadrar.
  A motivação de compra é evitar problema, não otimizar imposto.

## 3. Solução

Um assistente que vive no WhatsApp do MEI. Nada de app novo para
instalar, nada de login: foto, texto e lembrete.

## 4. Funcionalidades do MVP

| # | Funcionalidade | Status v0.1 |
|---|---|---|
| 1 | **Recebimento de foto de comprovante** + classificação por palavras-chave (stub) | ✅ estrutura pronta; OCR é stub |
| 2 | **Cálculo do vencimento do DAS** — dia 20, adia para o próximo dia útil quando cai no fim de semana | ✅ com testes |
| 3 | **Lembretes de DAS** — gera aviso quando o vencimento está a até 7 dias | ✅ geração (envio depende de token) |
| 4 | **Cadastro de NFS-e por município** (semente: SP, Marília, Campinas, RJ, BH) + portal oficial | ✅ estrutura pronta |
| 5 | **Perguntas e respostas** sobre regras (DAS, NFS-e, teto) via WhatsApp | ✅ stub por palavras-chave |
| 6 | **Teto anual R$ 81 mil + alerta de desenquadramento** (aviso a partir de 90%) | ✅ cálculo; emissão do alerta depende do faturamento informado |
| 7 | **Relatório mensal simples** — despesas por categoria no mês | 🔜 v0.2 (dados já são salvos) |

### O que o MVP explicitamente NÃO faz

- Não calcula o **valor** do DAS (depende da atividade: comércio,
  serviços ou ambos) — apenas o vencimento.
- Não emite NFS-e nem acessa portal de prefeitura.
- Não faz a DASN-SIMEI (declaração anual) — roadmap v0.3.
- Não dá consultoria fiscal: toda resposta carrega o aviso de que um
  contador tem a palavra final.

## 5. Preço

**R$ 19–29/mês** por MEI.

- R$ 19 — plano básico: classificação de comprovantes + lembretes + Q&A.
- R$ 29 — plano completo: + relatório mensal + alerta de teto com
  acompanhamento de faturamento.
- O preço ainda será validado no piloto (seção 7). A régua: 1 DAS pago
  em atraso custa em média mais que 1 mês de assinatura — o produto se
  paga evitando uma única multa.

## 6. Diferencial (moat)

- **Base de regras municipais de NFS-e**, cidade por cidade — é o
  ativo mais difícil de copiar e o que nenhum concorrente global tem.
- **WhatsApp-first** — o MEI não instala nada; aquisição por grupos de
  WhatsApp e boca a boca, não por loja de apps.
- **Português simples e operação de baixo custo** — o piloto é
  operável por 1 pessoa.

## 7. Plano de validação

**Piloto: 10 MEIs reais, 30 dias.**

Recrutamento: grupos de WhatsApp de MEIs da região de Marília/SP +
indicações. Critério: MEI ativo há pelo menos 3 meses, usa WhatsApp
diariamente, emite NFS-e pelo menos 1x/mês.

O que medir (semanal):

| Métrica | Meta de sucesso |
|---|---|
| MEIs ativos no piloto (enviaram ≥1 foto ou pergunta/semana) | ≥ 7 de 10 |
| DAS do mês pago em dia pelos participantes | ≥ 9 de 10 |
| Classificações de comprovante consideradas corretas pelo usuário | ≥ 80% |
| Usuários que dizem que pagariam R$ 19–29/mês | ≥ 5 de 10 |
| Tempo médio de resposta a uma pergunta | < 1 minuto |

Critério de seguir ou pivotar: se menos de 5 dos 10 disserem que
pagariam, o problema é preço ou valor percebido — entrevistar os 10
antes de escrever mais código.

## 8. Riscos

| Risco | Mitigação |
|---|---|
| Regra fiscal errada → multa para o usuário | Aviso em toda resposta; valores e prazos remetem ao Portal do Empreendedor; revisão humana obrigatória para qualquer número que envolva dinheiro |
| Regras municipais desatualizadas | Cadastro versionado por cidade, com fonte e data; alerta quando a regra não foi revisada há > 90 dias |
| WhatsApp Cloud API: custo por conversa e limites de template após 24h | Orçamento por conversa no piloto; mensagens fora da janela de 24h usam template aprovado |
| LGPD: fotos de comprovantes contêm dados pessoais/fiscais | Dados em store local no piloto; plano: criptografia, exportação e exclusão sob pedido; nunca treinar modelo com dados do usuário sem consentimento |
| Feriados não modelados no cálculo do vencimento | Documentado em `src/mei/das.ts`; feriados entram antes da produção (calendário oficial) |
| Baixa disposição de pagar (R$ 9–19 observado em produtos vizinhos) | Validar preço no piloto antes de precificar; testar R$ 19 vs R$ 29 |

## 9. Métricas de produto (pós-piloto)

- MRR e churn mensal; custo por conversa no WhatsApp;
- % de DAS pagos em dia entre assinantes vs. baseline do piloto;
- cobertura da base municipal (cidades com regra revisada / cidades com usuários).
