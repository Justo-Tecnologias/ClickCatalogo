# Planejamento de evolução do ClickCatálogo

Atualizado em 9 de setembro de 2026. Este documento registra ideias aprovadas para planejamento. Nenhum item abaixo está autorizado para publicação automática; cada fase deve passar por implementação, validação local e uma única release em lote.

## Objetivo

Evoluir o ClickCatálogo de uma ferramenta de catálogo por link para uma plataforma que também:

- ajuda o lojista a divulgar sua loja;
- permite descobrir lojas que autorizaram exposição pública;
- explica o produto e reduz dúvidas antes da assinatura;
- ensina tarefas do painel sem depender de atendimento;
- constrói aquisição orgânica com conteúdo útil e indexável.

## Princípios do produto

1. **Consentimento antes da descoberta:** ter um catálogo público por URL não autoriza sua inclusão automática em `/lojas`.
2. **Compartilhar deve funcionar sem cadastro do cliente:** usar recursos nativos do navegador e oferecer alternativa de copiar o link.
3. **Conteúdo ajuda a concluir uma tarefa:** priorizar guias objetivos antes de criar um blog amplo.
4. **Sem marketplace disfarçado:** a vitrine leva o visitante à loja; pedido, atendimento e pagamento dos produtos continuam sendo responsabilidade do lojista pelo WhatsApp.
5. **Privacidade por padrão:** não expor e-mail, telefone, endereço completo, status financeiro ou métricas internas no diretório.
6. **Uma release por fase:** acumular código, validar e publicar em lote para reduzir consumo de build da Netlify.

## Referência analisada

A referência `catalogoja.com` combina uma vitrine de lojas reais, páginas de explicação e uma central de ajuda orientada a tarefas. Os conceitos aproveitáveis são descoberta por exemplos reais, prova social e conteúdo que responde dúvidas antes e depois do cadastro.

O ClickCatálogo deve preservar identidade e escopo próprios. Não copiar textos, layout, nomes de rotas internas ou funcionalidades de orçamento da referência. Nosso diferencial atual continua sendo catálogo simples, carrinho no navegador e pedido consolidado no WhatsApp.

## Ordem de prioridade

| Prioridade | Entrega | Valor | Dependências |
|---|---|---|---|
| P0 | Finalizar testes controlados de produção já planejados | Protege cobrança, cancelamento e acesso antes de atrair tráfego | Checklist de pré-lançamento |
| P1 | Compartilhar loja + Open Graph completo | Divulgação imediata para cada lojista | Nenhuma migration obrigatória |
| P2 | Vitrine pública `/lojas` com adesão voluntária | Descoberta e prova social | Migration, opção no painel e RPC pública segura |
| P3 | FAQ e página `/como-funciona` | Conversão e redução de dúvidas | Conteúdo revisado e componentes existentes |
| P4 | Central `/ajuda` com guias por tarefa | Menos suporte e melhor ativação | Estrutura de conteúdo, busca futura |
| P5 | Blog editorial | Aquisição orgânica de longo prazo | Calendário, revisão e responsabilidade de manutenção |

## Fase P1 — Compartilhar loja e apresentação social

### Experiência

- adicionar **Compartilhar loja** no painel, próximo de **Abrir loja**;
- adicionar uma ação discreta de compartilhamento na loja pública, sem competir com **Chamar no WhatsApp** e o carrinho;
- no celular, usar `navigator.share()` quando disponível;
- em desktop ou navegador incompatível, copiar a URL para a área de transferência;
- mostrar confirmação acessível: **Link da loja copiado**;
- nunca solicitar permissões, contatos ou login social para compartilhar;
- preservar um link visível/copíavel caso a Clipboard API falhe.

### Open Graph e SEO

A rota `/loja/[slug]` já gera título, descrição, URL canônica e dados básicos de Open Graph. Falta completar a apresentação visual compartilhada:

- `openGraph.images` com imagem em proporção social;
- `twitter.card = summary_large_image` e respectivos título, descrição e imagem;
- imagem dinâmica por loja, preferencialmente em `/loja/[slug]/opengraph-image`;
- dimensões-alvo de 1200 × 630 px;
- composição com nome, descrição curta, logo e identidade do tema;
- fallback integral quando logo ou banner não existirem;
- texto com limite e quebra segura para nomes longos;
- nenhuma informação financeira, telefone ou endereço na imagem;
- usar `NEXT_PUBLIC_SITE_URL` para URLs absolutas, sem domínio fixo no código.

### Validação

- Web Share API em Android/iOS compatíveis;
- cópia do link em Chrome, Edge e Firefox desktop;
- teclado e leitor de tela;
- WhatsApp, Facebook Sharing Debugger e LinkedIn Post Inspector;
- imagem correta com e sem logo/banner;
- loja cancelada ou inexistente continua sem indexação e sem cartão promocional enganoso.

## Fase P2 — Vitrine pública de lojas

### Rotas propostas

- `/lojas`: vitrine indexável de lojas participantes;
- `/lojas?busca=...`: filtro por nome, descrição, segmento e cidade quando esses dados existirem;
- os cards apontam para a rota atual `/loja/[slug]`; não criar uma segunda página da mesma loja.

### Conteúdo inicial do card

- logo ou fallback temático;
- nome da loja;
- descrição curta;
- segmento e cidade apenas se o lojista preencher e autorizar;
- chamada **Ver catálogo**;
- nunca exibir WhatsApp, e-mail, endereço completo, quantidade de pedidos ou situação da assinatura.

### Consentimento e qualidade

- nova opção no painel: **Quero que minha loja apareça na vitrine pública do ClickCatálogo**;
- desmarcada por padrão;
- explicar que a loja poderá aparecer em buscas e mecanismos de pesquisa;
- permitir retirada imediata pelo próprio painel;
- incluir somente tenants `ativo`, com consentimento vigente e pelo menos um produto ativo;
- prever `listed_at`/data de adesão para auditoria;
- não usar `status = inadimplente` como dado público nem revelar o motivo de uma remoção;
- inicialmente usar ordenação neutra ou rotação determinística; não prometer “destaque” pago sem regra comercial definida;
- reservar moderação administrativa para abuso, fraude, conteúdo proibido e violação de direitos.

### Alteração de banco proposta

Criar migration versionada, refletida também em `supabase/schema.sql` e nos tipos TypeScript:

- `tenants.public_listing_enabled boolean not null default false`;
- `tenants.public_listing_enabled_at timestamptz null`;
- opcional após decisão de produto: `segmento text null` e `cidade text null` com limites e normalização;
- índice parcial para lojas listadas e ativas;
- RPC `get_public_store_directory(...)` que devolva somente campos aprovados, com paginação e busca limitada;
- nenhuma consulta pública direta à tabela `tenants`.

O consentimento de vitrine é diferente do consentimento legal do cadastro. A alteração deve ficar registrada e ser reversível pelo titular.

### Performance

- página server-rendered com revalidação;
- paginação real no servidor, não carregar todas as lojas no navegador;
- imagens via `next/image` e tamanhos explícitos;
- busca com debounce e parâmetros de URL compartilháveis;
- começar sem geolocalização, distância ou mapa;
- medir antes de adicionar ranking complexo.

### Antispam e segurança

- validação de tamanho e conteúdo dos campos públicos;
- rate limit para a RPC/endpoint de busca, se necessário após medição;
- botão **Denunciar loja** apenas quando houver processo real de atendimento/moderação;
- política de uso deve definir itens e atividades proibidos antes de abrir listagem em escala;
- logs não devem registrar consultas com IP bruto nem dados pessoais desnecessários.

### Critérios de aceite

- uma loja nova não aparece automaticamente;
- ativar a opção inclui a loja após a janela de revalidação;
- desativar remove a loja da vitrine;
- loja cancelada não aparece;
- loja sem produto ativo não aparece;
- busca e paginação não vazam campos privados;
- layout validado em 375, 768, 1024 e 1440 px;
- sitemap inclui `/lojas` e mantém as lojas individuais conforme a política de indexação.

## Fase P3 — FAQ e “Como funciona”

### `/como-funciona`

Explicar o percurso real, sem prometer recurso inexistente:

1. criar a loja e concluir a assinatura;
2. cadastrar categorias e produtos;
3. personalizar identidade e informações;
4. compartilhar o link;
5. cliente monta o pedido e envia pelo WhatsApp.

Incluir chamadas para demonstração, cadastro e painel. Reutilizar tokens, cards, botões e tipografia existentes.

### FAQ inicial

- O cliente precisa criar conta?
- Como o pedido chega no WhatsApp?
- O ClickCatálogo recebe comissão sobre minhas vendas?
- Posso alterar preços e fotos depois?
- Posso cancelar quando quiser?
- Quais imagens posso enviar?
- Minha loja pode aparecer na vitrine pública?
- O pagamento da assinatura é seguro?
- O que acontece se a assinatura atrasar ou for cancelada?

Usar acordeão acessível, funcional por teclado e toque. Dados estruturados `FAQPage` só devem representar perguntas e respostas realmente visíveis na página e devem ser reavaliados conforme as regras atuais dos mecanismos de busca na implementação.

## Fase P4 — Central de ajuda

### Estrutura

- `/ajuda`: categorias e busca;
- `/ajuda/[slug]`: artigos individuais;
- navegação **Anterior/Próximo** e artigos relacionados;
- indicação de última atualização;
- CTA contextual para abrir o painel ou criar uma loja;
- feedback simples **Este artigo ajudou?**, sem coletar dado pessoal no MVP.

### Primeiros guias

1. Como criar sua loja;
2. Como escolher o endereço da loja;
3. Como cadastrar uma categoria;
4. Como cadastrar um produto com foto e preço;
5. Como trocar logo e banner;
6. Como configurar o WhatsApp corretamente;
7. Como adicionar o Instagram;
8. Como ocultar ou reativar um produto;
9. Como compartilhar sua loja;
10. Como funciona o carrinho e o pedido pelo WhatsApp;
11. Como recuperar a senha;
12. Como consultar e cancelar a assinatura;
13. Como solicitar exclusão dos dados;
14. Como aparecer ou deixar de aparecer na vitrine pública.

### Tecnologia recomendada

Começar com conteúdo versionado no repositório, em MDX ou estrutura TypeScript tipada. Isso mantém custo zero, revisão por Git, build previsível e nenhum novo painel administrativo. Só adotar CMS quando uma pessoa não técnica precisar publicar com frequência suficiente para justificar custo e superfície de segurança adicionais.

Cada artigo deve ter `title`, `description`, `category`, `updatedAt`, `order` e conteúdo. Links quebrados, títulos duplicados e metadados ausentes devem entrar na rotina de verificação do projeto.

## Fase P5 — Blog editorial

O blog entra depois da central de ajuda porque exige frequência, revisão e manutenção. Separar intenção:

- `/ajuda`: ensina a usar o produto;
- `/blog`: ajuda o pequeno negócio a vender e organizar o catálogo;
- `/como-funciona`: explica a proposta comercial.

### Ideias iniciais

- Como montar um catálogo para vender pelo WhatsApp;
- Como fotografar produtos com o celular;
- O que escrever na descrição de um produto;
- Como organizar categorias sem confundir o cliente;
- Como divulgar o link do catálogo no Instagram;
- Como reduzir perguntas repetidas no WhatsApp;
- Exemplos de mensagem para compartilhar sua loja;
- Catálogo digital ou PDF: quando usar cada um;
- Checklist para publicar sua primeira loja;
- Histórias de lojistas, somente com autorização expressa.

Não criar artigos automáticos ou páginas por cidade/segmento com pouco conteúdo. Evitar conteúdo duplicado, promessas de vendas e depoimentos fictícios.

## Perguntas e respostas: escopo recomendado

Nesta etapa, **perguntas e respostas** significa FAQ editorial e central de ajuda. Não abrir comentários, fórum ou perguntas públicas de usuários no MVP, pois isso exige moderação, proteção contra spam, tratamento de dados pessoais, notificações e regras de remoção.

Um formulário de contato pode ser planejado separadamente quando existir rotina de atendimento, prazo de resposta e proteção antispam. O canal atual `contato@clickcatalogo.com` pode continuar como destino de suporte.

## Métricas mínimas, com privacidade

Antes de escolher uma ferramenta de analytics, definir os eventos úteis:

- clique em **Compartilhar loja**;
- compartilhamento nativo concluído ou link copiado;
- abertura de loja a partir de `/lojas`;
- clique em **Criar minha loja** após FAQ/ajuda;
- artigo visualizado e feedback de utilidade;
- busca sem resultado na vitrine ou ajuda.

Não enviar nome da loja, e-mail, WhatsApp, conteúdo do carrinho ou termos de busca potencialmente pessoais para analytics sem avaliação de privacidade e consentimento aplicável.

## Pacotes de entrega sugeridos

### Release A — divulgação

- botão de compartilhar no painel e catálogo;
- Open Graph/Twitter completo por loja;
- testes e auditoria de previews sociais.

### Release B — descoberta

- migration de consentimento;
- controle no painel;
- RPC paginada;
- `/lojas` e atualização do sitemap;
- revisão legal e moderação mínima.

### Release C — conteúdo essencial

- `/como-funciona`;
- FAQ na landing e página apropriada;
- `/ajuda` com os primeiros artigos;
- sitemap, metadados e verificação de links.

### Release D — crescimento editorial

- blog;
- calendário de conteúdo;
- métricas de aquisição e conversão;
- estudos de caso autorizados.

## Próxima decisão

Depois dos testes de produção atuais, iniciar pela **Release A**. Ela entrega valor para todas as lojas existentes, não precisa expor novos dados no banco e prepara os cartões sociais usados tanto pelos lojistas quanto pela futura vitrine.
