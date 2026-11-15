# WhatsApp Template — lembrete do DAS

Template de mensagem ativa (fora da janela de 24h) para os lembretes
de vencimento do DAS. Categoria **Utility** — o envio só é permitido
depois que a Meta aprovar o template.

## Template

| Campo | Valor |
|---|---|
| Nome | `lembrete_das_vencimento` |
| Categoria | Utility |
| Idioma | pt_BR |
| Corpo | `Olá, {{1}}! O DAS do seu MEI vence em {{2}} e o valor é {{3}}. Pague até a data de vencimento para evitar multa e juros. Dúvidas? Fale comigo aqui mesmo.` |

Variáveis:

| Variável | Conteúdo | Exemplo |
|---|---|---|
| `{{1}}` | Primeiro nome do MEI | `Paulo` |
| `{{2}}` | Data de vencimento (dd/mm/aaaa) | `23/11/2026` |
| `{{3}}` | Valor do DAS | `R$ 86,05` |

Exemplo preenchido:

> Olá, Paulo! O DAS do seu MEI vence em 23/11/2026 e o valor é R$ 86,05. Pague até a data de vencimento para evitar multa e juros. Dúvidas? Fale comigo aqui mesmo.

## Botão (opcional, v1)

- Tipo: URL
- Texto: `Pagar o DAS`
- URL: `https://www.gov.br/empresas-e-negocios/pt-br/empreendedor`
- Confirmar o link na hora de submeter — o Portal do Empreendedor muda
  de URL com frequência.

## Como submeter

1. Meta Business Manager → WhatsApp Manager → Message templates.
2. Create template → categoria **Utility** → idioma **pt_BR**.
3. Colar o corpo acima, sem alterar as variáveis `{{1}}`, `{{2}}`, `{{3}}`.
4. Enviar para aprovação. A análise costuma levar de algumas horas a
   poucos dias.
5. Quando aprovado, anotar aqui o status e a data — o endpoint de
   envio (cron) só pode usar o template aprovado.

## Regras da janela de 24h

- Dentro de 24h da última mensagem do usuário: mensagem de sessão
  (texto livre, sem template).
- Depois de 24h: só é possível enviar com template aprovado (este).
- O template não pode ter conteúdo de marketing — só o lembrete.

## Status

- [ ] Submetido para aprovação (data: ___)
- [ ] Aprovado (data: ___)
- [ ] Endpoint de envio (cron) implementado — próximo passo (B)
