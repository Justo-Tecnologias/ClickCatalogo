# Checklist de teste em Produção — ClickCatálogo

Roteiro para execução em `https://clickcatalogo.com` em 9 de setembro de 2026. Faça na ordem. Registre cada falha com URL, horário, ação realizada, resultado, navegador e captura de tela. Não repita checkout ou cobrança diante de resposta lenta antes de conferir Asaas e Supabase.

## Preparação

- [ ] Abrir uma janela anônima no celular e outra no computador.
- [ ] Separar um e-mail real que **nunca tenha sido usado** para criar tenant neste Supabase.
- [ ] Usar dados controlados e reconhecíveis, como nome `Loja Teste Produção` e slug exclusivo.
- [ ] Confirmar no Asaas que a conta está em **Produção** antes de pagar.
- [ ] Confirmar que o webhook de Produção está ativo, com fila ativa e URL `https://clickcatalogo.com/api/webhooks/asaas`.
- [ ] Manter abertos os logs da Netlify, logs de Webhook do Asaas e o Table Editor do Supabase.
- [ ] Não usar dados de cartão em prints, gravações, logs ou mensagens.

## 1. Site, domínio e navegação pública

- [ ] `https://clickcatalogo.com` abre com HTTPS e sem aviso de certificado.
- [ ] `https://www.clickcatalogo.com` redireciona para o domínio principal.
- [ ] Header exibe **ClickCatálogo** corretamente.
- [ ] **Entrar** abre `/painel`.
- [ ] **Quero minha loja** abre `/cadastro`.
- [ ] **Ver os temas** rola até a seção correta.
- [ ] Prévia de temas troca tema sem quebrar o layout.
- [ ] Rodapé exibe copyright, Termos, Política de privacidade e Painel.
- [ ] `/termos` e `/privacidade` possuem conteúdo completo e dados legais corretos.
- [ ] Não aparece “Em breve”, “Tenho interesse”, domínio antigo ou marca antiga.
- [ ] Não há texto cortado, rolagem horizontal ou botão sobreposto em 375 px, 768 px, 1024 px e 1440 px.

## 2. Validações do cadastro sem pagar

- [ ] Tentar avançar com campos vazios e conferir mensagens claras.
- [ ] WhatsApp incompleto é rejeitado.
- [ ] E-mail inválido é rejeitado.
- [ ] Slug curto, inválido ou reservado é rejeitado.
- [ ] Slug já utilizado é rejeitado antes do checkout.
- [ ] Termos e privacidade precisam ser aceitos.
- [ ] Links de Termos e Privacidade abrem o conteúdo correto sem perder os dados digitados.
- [ ] Etapa 2 mostra nome, WhatsApp, slug e tema digitados corretamente na prévia.
- [ ] Voltar para a etapa 1 preserva os dados.
- [ ] O texto informa naturalmente pagamento mensal no cartão de crédito e cobrança segura pelo Asaas.
- [ ] O botão final mostra **Continuar para pagamento**.

## 3. Cobrança real controlada de R$ 5

Executar apenas uma vez com o e-mail novo preparado acima.

- [ ] Preencher `/cadastro` com dados controlados e slug único.
- [ ] Clicar em **Continuar para pagamento** uma única vez.
- [ ] Netlify está temporariamente com `ASAAS_CHECKOUT_TEST_VALUE=5` somente durante esta validação.
- [ ] Checkout abre no domínio oficial do Asaas e mostra ClickCatálogo, recorrência mensal, identificação de teste controlado e valor de R$ 5.
- [ ] Realizar o pagamento com um cartão real autorizado pelo titular.
- [ ] Não atualizar nem reenviar o pagamento enquanto o Asaas processa.
- [ ] Após aprovação, retornar para `/cadastro/sucesso?ref=...` no domínio ClickCatálogo.
- [ ] A tela sai de “preparando” automaticamente após o webhook.
- [ ] A URL da loja e o acesso aparecem sem erro.
- [ ] Criar uma senha forte e entrar automaticamente no painel.
- [ ] Guardar a referência `ref` apenas para esta auditoria; não publicá-la.

### Conferência no Asaas

- [ ] Cliente foi criado uma única vez.
- [ ] Assinatura mensal de R$ 5 aparece ativa.
- [ ] Cobrança aparece confirmada/recebida.
- [ ] Webhook correspondente aparece entregue com resposta HTTP 2xx.
- [ ] Não há eventos presos, falhas consecutivas ou assinatura duplicada.

### Conferência no Supabase

- [ ] `signup_intents`: uma intenção com a referência correta, status `pago` e `provisioned_tenant_id` preenchido.
- [ ] `tenants`: um único tenant com slug correto, proprietário correto e status `ativo`.
- [ ] `subscriptions`: uma assinatura vinculada, status `ativo`, valor `5.00` e IDs do Asaas preenchidos.
- [ ] `asaas_webhook_events`: evento processado, `processed_at` preenchido e `processing_error` vazio.
- [ ] `auth.users`: usuário correto e confirmado, sem usuário duplicado.

## 4. Idempotência e duplicação

- [ ] Reabrir a URL de sucesso não cria outro tenant, usuário ou assinatura.
- [ ] Atualizar a página de sucesso não cria registros duplicados.
- [ ] Tentar novo cadastro com o mesmo e-mail informa que ele já possui loja e não abre outro checkout.
- [ ] Tentar novo cadastro com o mesmo slug informa indisponibilidade.
- [ ] Se usar a função de reenvio do webhook no Asaas, o evento não duplica tenant ou assinatura.

Não criar uma segunda cobrança real apenas para testar duplicação.

## 5. Login e recuperação de senha

- [ ] Sair do painel e entrar novamente com e-mail e senha.
- [ ] Senha errada mostra erro claro e não revela detalhes técnicos.
- [ ] Abrir rota protegida sem sessão redireciona para o login.
- [ ] Solicitar recuperação de senha.
- [ ] Mensagem de confirmação não revela se um e-mail existe ou não.
- [ ] E-mail chega em português, com remetente/domínio corretos e sem cair em spam no Gmail.
- [ ] Link abre a confirmação, permite continuar e chega à criação de nova senha.
- [ ] Nova senha funciona; senha anterior deixa de funcionar.
- [ ] Reutilizar o mesmo link mostra expiração de maneira clara.
- [ ] Repetir recebimento e fluxo completo em um endereço Outlook.

## 6. Painel — Minha loja

- [ ] Dados do cadastro aparecem corretamente.
- [ ] Alterar nome, descrição, WhatsApp, Instagram e endereço e salvar.
- [ ] Instagram aceita nome ou URL e mostra orientação compreensível.
- [ ] Trocar o tema e conferir atualização da prévia.
- [ ] Enviar logo JPG, PNG ou WebP válida.
- [ ] Enviar banner JPG, PNG ou WebP válido.
- [ ] Trocar logo e banner existentes.
- [ ] Arquivo maior que 2 MB é rejeitado com mensagem clara.
- [ ] Arquivo que finge ser imagem é rejeitado.
- [ ] Logo fica 1:1; banner fica 21:9 e não distorce.
- [ ] Header estreito põe o botão do WhatsApp na linha seguinte.
- [ ] **Abrir loja** leva ao slug correto.
- [ ] Alterações aparecem na loja depois da janela de revalidação, sem necessidade de novo deploy.

## 7. Painel — Categorias

- [ ] Criar uma categoria.
- [ ] Criar outra categoria com nome diferente.
- [ ] Nome duplicado no mesmo tenant é rejeitado.
- [ ] Editar o nome de uma categoria.
- [ ] Reordenar por setas.
- [ ] Reordenar por arrastar no desktop.
- [ ] No touch, as setas oferecem alternativa funcional ao arraste.
- [ ] A ordem salva aparece igual na loja pública.
- [ ] Excluir categoria vazia funciona.
- [ ] Excluir categoria com produto vinculado é bloqueado e orienta mover ou excluir o produto.
- [ ] Não aparece “Cadastre uma categoria primeiro” enquanto ainda existir categoria válida.

## 8. Painel — Produtos

- [ ] Criar produto com nome, preço, descrição, variação, categoria e imagem.
- [ ] Preço inválido, zero, negativo ou com mais de duas casas é rejeitado.
- [ ] Campo obrigatório vazio mostra mensagem útil.
- [ ] Produto aparece imediatamente na lista após salvar.
- [ ] Editar nome, preço, descrição, variação e categoria.
- [ ] Trocar a imagem e confirmar que a nova aparece.
- [ ] Remover imagem e conferir fallback visual.
- [ ] Ocultar produto e confirmar que some da loja pública.
- [ ] Reativar produto e confirmar que volta.
- [ ] Excluir produto de teste e confirmar remoção.
- [ ] Nenhuma ação de um tenant altera produto de outro tenant.

## 9. Loja pública

- [ ] Abrir `/loja/[slug]` deslogado no celular e no desktop.
- [ ] Nome, descrição, logo, banner, Instagram e endereço estão corretos.
- [ ] Banner possui overlay suficiente para leitura.
- [ ] Fallbacks funcionam sem logo, banner e imagem de produto.
- [ ] Grid mostra duas colunas no mobile quando há espaço previsto e não deixa vazio lateral indevido.
- [ ] Cards ocupam 100% da célula e imagens ficam 1:1 sem distorção.
- [ ] Categorias não mostram contador.
- [ ] Navegação de categorias leva à seção correta.
- [ ] Com até 12 produtos, busca fica oculta.
- [ ] Com mais de 12 produtos, busca aparece e filtra nome e descrição.
- [ ] Com mais de 20 produtos em uma categoria, **Carregar mais** funciona.
- [ ] Sticky de categorias só aparece com mais de 8 categorias ou mais de 12 produtos.
- [ ] Botão individual **Pedir** abre o WhatsApp correto com o nome do produto correto.
- [ ] Botão **Chamar no WhatsApp** abre o número correto.
- [ ] Instagram abre o perfil correto.
- [ ] Loja inexistente não exibe dados e não deve ser indexada.

## 10. Carrinho e pedido consolidado

- [ ] Adicionar um produto.
- [ ] Adicionar produtos diferentes.
- [ ] Aumentar e diminuir quantidade.
- [ ] Quantidade nunca fica abaixo de 1 enquanto o item está no carrinho.
- [ ] Remover item.
- [ ] Limpar carrinho.
- [ ] Painel do carrinho abre, fecha, prende o foco e funciona por teclado.
- [ ] Total por item e total geral calculam corretamente.
- [ ] Testar quantidades altas e conferir moeda, quebra de linha e ausência de overflow.
- [ ] Enviar pedido consolidado abre WhatsApp com loja, produtos, quantidade, valor unitário, subtotal e total corretos.
- [ ] Caracteres especiais e acentos chegam corretamente na mensagem.
- [ ] Recarregar a página limpa o carrinho, conforme o comportamento atual sem persistência.

## 11. Demonstração pública

- [ ] **Ver demonstração** entra no painel demonstrativo.
- [ ] Dados demonstrativos são claramente separados da conta real.
- [ ] Todas as ações de gravação permanecem bloqueadas.
- [ ] Demonstração não expõe dados, IDs ou arquivos de clientes reais.
- [ ] Sair da demonstração retorna ao login corretamente.

## 12. Assinatura e privacidade — verificar antes de cancelar

- [ ] `/painel/assinatura` mostra status ativo, R$ 27 e próxima cobrança coerente.
- [ ] Link da cobrança/fatura, quando disponível, abre o destino correto.
- [ ] `/painel/privacidade` explica cancelamento, retenção e exclusão sem prometer eliminação imediata indevida.
- [ ] Termos e Política exibem identificação legal e `contato@clickcatalogo.com`.

## 13. Cancelamento real — executar por último

Esta ação encerra a recorrência e deixa a loja indisponível. Só faça na conta controlada quando todos os testes anteriores terminarem.

- [ ] Abrir cancelamento e conferir que a tela exige o nome exato da loja.
- [ ] Nome incorreto não cancela.
- [ ] Confirmar com o nome correto uma única vez.
- [ ] Painel mostra assinatura cancelada.
- [ ] Asaas mostra assinatura cancelada e não agenda nova recorrência.
- [ ] `subscriptions.status` fica `cancelado`.
- [ ] `tenants.status` fica `cancelado` e `canceled_at` é preenchido.
- [ ] Loja pública passa a mostrar indisponibilidade sem revelar motivo financeiro.
- [ ] Reentrega de evento financeiro antigo não reativa tenant cancelado.
- [ ] Área de privacidade mostra o prazo de retenção e a opção de antecipação conforme implementado.
- [ ] Não executar o expurgo real de dados durante este teste, a menos que exista uma conta descartável e uma auditoria separada.

## 14. Operação e observabilidade após os testes

- [ ] Conferir Netlify Functions sem erros 5xx, timeout ou repetição anormal.
- [ ] Conferir logs do Supabase sem violações ou erros inesperados.
- [ ] Conferir fila do webhook Asaas sem eventos interrompidos.
- [ ] Executar localmente `npm run audit:production -- <slug-da-loja-ativa>`.
- [ ] Executar localmente `npm run audit:live`.
- [ ] Executar localmente `npm run audit:asaas` com extremo cuidado para não imprimir segredos.
- [ ] Registrar o resultado da cobrança e do cancelamento em `docs/PRE_LANCAMENTO.md`.
- [ ] Configurar alertas de consumo/orçamento em Netlify, Supabase, Resend e Asaas.
- [ ] Rotacionar e inutilizar a antiga chave Sandbox do Asaas que foi compartilhada durante o desenvolvimento.
- [ ] Remover `ASAAS_CHECKOUT_TEST_VALUE` da Netlify e de `.env.local`.
- [ ] Republicar uma única vez e abrir um checkout sem pagar para confirmar o retorno ao valor oficial de R$ 27.
- [ ] Cancelar/expirar esse checkout de conferência sem efetuar uma segunda cobrança.
- [ ] Fazer backup conforme `docs/OPERACAO.md` antes de alterações estruturais futuras.

## 15. Responsividade e acessibilidade

Repetir as telas principais em 375, 768, 1024 e 1440 px:

- [ ] Landing;
- [ ] cadastro nas duas etapas;
- [ ] sucesso;
- [ ] login e recuperação;
- [ ] Minha loja e prévia;
- [ ] categorias;
- [ ] produtos;
- [ ] assinatura e privacidade;
- [ ] loja pública e carrinho;
- [ ] termos e privacidade.

Em cada tela:

- [ ] sem rolagem horizontal;
- [ ] sem texto cortado ou sobreposto;
- [ ] botões e links com alvo confortável de aproximadamente 44 × 44 px;
- [ ] foco visível por teclado;
- [ ] formulários possuem rótulos e mensagens associadas;
- [ ] ações que aparecem no hover também funcionam por toque e teclado;
- [ ] contraste legível nos seis temas.

## Itens que não pertencem ao teste de hoje

Os itens abaixo estão planejados, mas ainda não foram implementados. Não registrar como bug nesta rodada:

- botão **Compartilhar loja**;
- imagem Open Graph personalizada por loja;
- vitrine pública `/lojas`;
- autorização para aparecer na vitrine;
- `/como-funciona`, FAQ ampliada, central `/ajuda` e blog.

Esses itens estão detalhados em `docs/PLANEJAMENTO_PRODUTO.md` e devem entrar em releases futuras agrupadas.

## Critério de aprovação de hoje

O teste é aprovado somente se:

- a cobrança real ocorrer uma única vez;
- webhook, tenant, usuário e assinatura forem criados sem duplicidade;
- login, recuperação, CRUD, uploads, catálogo, carrinho e WhatsApp funcionarem;
- cancelamento real sincronizar Asaas e Supabase;
- não houver erro 5xx, vazamento de segredo ou acesso cruzado entre tenants;
- as falhas encontradas forem registradas antes de qualquer correção ou novo deploy.
