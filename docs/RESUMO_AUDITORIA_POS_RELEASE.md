# ClickCatálogo — resumo para auditoria externa pós-release

Data: 12/09/2026
Produção: https://clickcatalogo.com
Commit publicado: df1aaba

> Estado local em 12/09/2026: existe um lote posterior ainda não publicado,
> com conciliação das cobranças futuras no cancelamento, rate limit fail-closed
> nas operações sensíveis, política de privacidade atualizada e novos testes.
> A migration `202609120013_cancellation_payment_reconciliation.sql` foi
> confirmada como aplicada no Supabase antes desta revisão final.
> As migrations 014 e 015 foram criadas nesta revisão e precisam ser aplicadas
> antes do deploy. A 014 protege a finalização; a 015 serializa a conciliação.

## Produto e arquitetura

O ClickCatálogo é um SaaS brasileiro para pequenos lojistas publicarem um
catálogo e receberem pedidos organizados pelo WhatsApp. Ele não processa o
pagamento dos produtos da loja. O plano do SaaS custa R$ 27/mês, com assinatura
recorrente no cartão pelo Asaas.

Stack preservada: Next.js 16.3.3, App Router, React 19, TypeScript, Tailwind,
Supabase Postgres/Auth/Storage/RLS, Netlify, Asaas, Resend, Zod e ISR.

## Implementado nesta release

### Cadastro e recuperação

- validação antecipada de e-mail e slug;
- signup intent criado antes do checkout;
- webhook do Asaas permanece como única confirmação de pagamento;
- retomada por cookie HTTP-only;
- recuperação do cadastro em outro dispositivo pelo e-mail da contratação;
- resposta genérica, sem revelar se e-mail, checkout ou conta existem;
- token aleatório de 256 bits, uso único e validade de 20 minutos;
- somente hash do token armazenado no banco;
- token bruto no fragmento da URL, fora dos logs HTTP;
- fragmento apagado imediatamente do endereço depois de capturado pelo cliente;
- rate limit por IP e hash do e-mail;
- invalidação de tokens anteriores;
- reutilização de checkout ainda válido;
- falha de conexão não aparece como envio de e-mail concluído.

### Assinatura e webhook

- checkout mensal recorrente de R$ 27 no cartão;
- callbacks construídos com NEXT_PUBLIC_SITE_URL;
- token do webhook comparado de forma segura;
- eventos persistidos e reivindicados atomicamente;
- idempotência para reentregas;
- lease para retomar processamento interrompido;
- evento concorrente recebe resposta recuperável para retry;
- evento antigo de inadimplência não substitui renovação mais nova;
- cancelamento novo usa ACTIVE para INACTIVE, sem excluir a recorrência;
- o corte vem da próxima cobrança já gerada; na ausência dela, usa o
  `nextDueDate` remoto validado, sem cálculo próprio de calendário;
- apenas `CREDIT_CARD` em estado atual `CONFIRMED`/`RECEIVED` comprova pagamento;
- cobranças futuras já geradas são listadas depois da inativação e somente as
  que continuam `PENDING` a partir do fim do período pago são removidas;
- uma segunda listagem verifica a pós-condição e transforma corrida de status,
  404 ambíguo ou cobrança remanescente em `attention`;
- a Scheduled Function tenta novamente conciliações `pending`/`attention` a
  cada hora, mesmo se o titular não voltar ao painel;
- a finalização local exige estado `complete`, impedindo que uma falha de
  conciliação seja escondida apenas porque o período de acesso venceu;
- o agendador usa claim/lease, estado `processing`, CAS e orçamento de execução,
  impedindo que uma tarefa antiga reinative uma assinatura reativada;
- o resultado da conciliação fica persistido e falhas aparecem no painel, com
  tentativa self-service e bloqueio de nova contratação enquanto houver dúvida;
- loja permanece disponível até o fim do período pago;
- cancelamento pode ser desfeito antes do vencimento, sem nova cobrança;
- assinatura legada excluída usa checkout de reativação ligado ao tenant
  existente, sem criar outra loja ou usuário;
- reativação, finalização e expurgo possuem proteção contra concorrência.

### Banco e segurança

- três migrations incrementais e não destrutivas;
- novas colunas para tipo de intenção, checkout recuperável e estado remoto;
- tabela isolada de tokens de recuperação, com RLS e service role;
- RPC de consumo atômico do token;
- índices únicos contra intenção ou reativação pendente duplicada;
- RLS preservada em tenants, categorias, produtos e assinaturas;
- Storage continua separado pelo diretório do tenant;
- service role somente no backend;
- proteção de origem, Zod, rate limiting distribuído e cookies seguros;
- nenhuma chave real encontrada nos arquivos versionados;
- arquivo .env.local ignorado pelo Git;
- npm audit retornou zero vulnerabilidades.

### Catálogo, conversão e operação

- Open Graph dinâmico 1200 × 630 por loja;
- title, description, canonical e Twitter Card;
- geração de OG sem buscar URL arbitrária, evitando SSRF;
- compartilhamento por Web Share, copiar link e WhatsApp;
- QR Code gerado localmente;
- checklist não bloqueante para publicar a loja;
- carrinho client-side e pedido consolidado pelo WhatsApp;
- máscara brasileira de preço, mantendo numeric no banco;
- FAQ comercial na landing, sem depoimentos ou números inventados;
- logs JSON com IDs técnicos e erros sanitizados;
- métricas diárias agregadas, com allowlist e sem IP, e-mail ou PII.

## Validações realizadas

- ESLint aprovado;
- TypeScript aprovado;
- contraste AA aprovado nos seis temas;
- 35 testes automatizados aprovados;
- build Next.js aprovado, com 27 páginas e rotas;
- teste SQL transacional para claim, concorrência, 10 reentregas e rate limit;
- migrations 011/012/013 confirmadas no Supabase; migrations 014 e 015 são os
  SQLs adicionais obrigatórios antes deste lote;
- produção conferida após o deploy: landing, recuperação, catálogo real e
  metadados Open Graph carregaram corretamente.

## Novas variáveis

- RESEND_API_KEY;
- RESEND_FROM_EMAIL.

Nenhum valor deve ser solicitado ou incluído na análise.

## Pendências conhecidas

### Validar antes de divulgação ampla

- executar uma cobrança real controlada;
- confirmar exatamente um usuário aplicável, um tenant e uma assinatura;
- testar cancelamento e desfazer cancelamento em Produção;
- testar recuperação em aba anônima e rejeição do segundo uso do link;
- reentregar um webhook e confirmar ausência de duplicação;
- acompanhar logs da Netlify e do Asaas durante os testes.

### Fazer logo após o lançamento controlado

- validar entrega de recuperação também no Outlook;
- ampliar testes de integração com Supabase efêmero e fixtures sanitizadas;
- criar painel administrativo global e alertas operacionais básicos;
- obter revisão jurídica profissional de Termos e Privacidade;
- monitorar erros, latência e métricas por pelo menos 48 horas.

### Pode esperar validação comercial

- alteração de slug com histórico, redirecionamento e quarentena;
- página detalhada de produto e vitrine pública de lojas;
- central de ajuda ou blog;
- Google Login;
- Google Analytics e Meta Pixel com consentimento;
- integração com Instagram;
- trial gratuito;
- troca de cartão, upgrade, downgrade e painel financeiro avançado.

## Limitações conscientes do MVP

- uma loja por usuário/e-mail e um plano mensal;
- sem Pix recorrente;
- sem persistência de pedidos ou confirmação de venda;
- sem ERP, estoque, PDV, marketplace ou checkout dos produtos;
- webhook processado de forma síncrona antes do HTTP 200;
- operações públicas de custo/risco alto falham fechadas quando o limitador
  distribuído estiver indisponível; webhook e operações leves mantêm fallback;
- testes automáticos não realizam cobrança real.

## O que a próxima auditoria deve responder

1. Há risco concreto restante de perder pagamento, duplicar tenant/assinatura ou
   vazar dados entre tenants?
2. Quais testes adicionais são indispensáveis antes do primeiro cliente?
3. Falta alguma transição na máquina de cancelamento e reativação?
4. Recuperação, webhook ou rate limiting possuem abuso provável não coberto?
5. Qual pendência realmente bloqueia um lançamento controlado?
6. O que deve ser adiado para evitar overengineering?

Evitar recomendar reescrita geral, mudança de stack, microsserviços, Kubernetes,
Redis pago ou fila externa sem demonstrar um risco concreto que não possa ser
resolvido de forma simples e barata na arquitetura atual.
