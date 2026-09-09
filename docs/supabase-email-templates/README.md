# E-mails do Supabase Auth

O envio usa o SMTP configurado no Supabase. Estes arquivos são modelos para colar manualmente em **Supabase → Authentication → Email Templates**.

## Recuperação de senha

1. Abra **Reset Password**.
2. Use o assunto `Crie uma nova senha — ClickCatálogo`.
3. Cole o conteúdo de `recovery.html` no corpo.
4. Salve e envie uma recuperação real pelo `/painel/recuperar-senha`.

O link usa `{{ .SiteURL }}` para abrir a etapa intermediária do ClickCatálogo e preserva a variável oficial `{{ .ConfirmationURL }}` no fragmento do navegador. Não transforme o botão novamente em um link direto: a confirmação intermediária evita que scanners de e-mail consumam o token antes do usuário.

O projeto cria os usuários do checkout com o e-mail já confirmado; por isso, no fluxo atual, os modelos de confirmação de cadastro, convite e magic link não são disparados.
