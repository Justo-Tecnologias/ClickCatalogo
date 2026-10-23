# Links de divulgação (`?origem=`)

Cada canal usa um link próprio. O site soma visitas, cadastros iniciados e lojas criadas por canal, sem cookies e sem dados pessoais: a etiqueta do canal fica só na aba aberta (`sessionStorage`) e a loja criada guarda o canal em `tenants.origem_cadastro`.

Relatório: `supabase/origin-report.sql` (somente leitura) no SQL Editor do Supabase.

| Canal | Link | Onde usar |
|---|---|---|
| `bio` | `https://clickcatalogo.com/?origem=bio` | Link da bio do Instagram |
| `post` | `https://clickcatalogo.com/?origem=post` | Legenda, comentário fixado ou carrossel |
| `story` | `https://clickcatalogo.com/?origem=story` | Adesivo de link nos Stories (postados pelo app) |
| `facebook` | `https://clickcatalogo.com/?origem=facebook` | Página e posts do Facebook |
| `whatsapp` | `https://clickcatalogo.com/?origem=whatsapp` | Status e conversas do WhatsApp |
| `dm` | `https://clickcatalogo.com/?origem=dm` | Abordagem direta (mensagem para um vendedor) |
| `grupo` | `https://clickcatalogo.com/?origem=grupo` | Grupos e comunidades |
| `email` | `https://clickcatalogo.com/?origem=email` | E-mails enviados por você |
| `indicacao` | `https://clickcatalogo.com/?origem=indicacao` | Quando alguém indica o ClickCatálogo |
| `loja` | automático | Clique em "ClickCatálogo" no rodapé de uma loja |

## Prévia com o nome da pessoa (abordagem direta)

A página `/exemplo` monta na hora uma loja com o nome do negócio e produtos de exemplo do nicho (`doces`, `artesanato`, `moda`, `marmitas`, `cosmeticos`). Na mensagem direta, mande a loja **dela**:

`https://clickcatalogo.com/exemplo?nome=Doces%20da%20Ana&nicho=doces&origem=dm`

- Troque `Doces%20da%20Ana` pelo nome do perfil (`%20` é o espaço; o WhatsApp e o Instagram também aceitam o link com `+` no lugar do espaço).
- Opcional: `&tema=elegante` (ou `classico`, `natural`, `tech`, `delivery`, `minimal`). Sem ele, vale o tema padrão do nicho.
- O botão "Quero essa loja" abre o cadastro já com o nome e o tema. A visita conta como `store_preview_view` no funil e no canal.

## Páginas por nicho (busca orgânica)

`/para/doces`, `/para/artesanato`, `/para/moda`, `/para/marmitas` e `/para/cosmeticos`: cada uma fala a dor do nicho e já abre a prévia nele. Estão no sitemap e no rodapé do site; as visitas contam como `landing_view`. Também servem para divulgar a um público específico, por exemplo `https://clickcatalogo.com/para/doces?origem=grupo` num grupo de confeiteiras.

Também funciona em outras páginas: `https://clickcatalogo.com/como-funciona?origem=dm` ou `https://clickcatalogo.com/cadastro?origem=dm`.

## Regras

- Só os valores da tabela são aceitos; qualquer outro é ignorado (vale o canal anterior da aba, se houver, ou `sem_origem`). Para incluir um canal novo, acrescente-o em `src/lib/analytics/origins.ts` (letras minúsculas, números e hífen).
- Vale o último link: quem chega por `?origem=bio` e depois abre `?origem=dm` na mesma aba passa a contar como `dm`.
- A etiqueta vale até a aba ser fechada. Quem volta outro dia digitando o endereço conta como `sem_origem`.
- Visitas à página de uma loja nunca são contadas por canal: elas pertencem à loja.
