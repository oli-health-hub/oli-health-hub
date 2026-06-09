/**
 * Edge Function: auth-confirm
 * ─────────────────────────────────────────────────────────────────────────────
 * Página de destino (redirect_to) após o usuário clicar no link de confirmação
 * de e-mail. O Supabase já verificou o token em /auth/v1/verify e redireciona
 * para cá. Esta página apenas:
 *   - mostra "E-mail confirmado" (ou erro, se o link expirou)
 *   - oferece abrir o app via deep link olihealthhub://
 *
 * Pública (verify_jwt = false) — o browser chega sem JWT.
 *
 * Configurar no Supabase Dashboard:
 *   Authentication → URL Configuration:
 *     - Site URL: https://xwcarrurjvfxisuaihid.supabase.co/functions/v1/auth-confirm
 *     - Redirect URLs (allowlist): adicionar
 *         https://xwcarrurjvfxisuaihid.supabase.co/functions/v1/auth-confirm
 *         olihealthhub://*
 */

const APP_SCHEME = 'olihealthhub://login';

function page(opts: { ok: boolean; title: string; body: string }): string {
  const barColor  = opts.ok ? '#5F7D67' : '#D9534F';
  const icon      = opts.ok ? '✅' : '⚠️';
  const showBtn   = opts.ok;
  return `<!DOCTYPE html>
<html lang="pt-BR">
<head>
<meta charset="UTF-8" />
<meta name="viewport" content="width=device-width, initial-scale=1.0" />
<title>${opts.title} — OLI Health Hub</title>
<style>
  *,*::before,*::after{box-sizing:border-box;margin:0;padding:0}
  body{font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif;background:#F4EFEA;min-height:100vh;display:flex;flex-direction:column;align-items:center;justify-content:center;padding:40px 16px}
  .logo{font-size:24px;font-weight:800;color:#5F7D67;letter-spacing:-.5px;margin-bottom:4px}
  .logo-sub{font-size:11px;color:#6B6B6B;letter-spacing:1.5px;text-transform:uppercase;margin-bottom:24px}
  .card{background:#fff;border-radius:16px;max-width:440px;width:100%;box-shadow:0 2px 20px rgba(0,0,0,.08);overflow:hidden}
  .bar{height:6px;background:${barColor}}
  .body{padding:36px 28px;text-align:center}
  .icon{font-size:56px;line-height:1;margin-bottom:16px}
  h1{font-size:22px;font-weight:800;color:#2F2F2F;margin-bottom:10px}
  p{font-size:14px;color:#6B6B6B;line-height:1.7;margin-bottom:24px}
  .btn{display:inline-block;width:100%;background:#5F7D67;color:#fff;font-size:16px;font-weight:700;text-decoration:none;padding:16px;border-radius:12px}
  .footer{margin-top:20px;font-size:11px;color:#9B9B9B;text-align:center;line-height:1.8}
  .footer a{color:#5F7D67;text-decoration:none}
</style>
</head>
<body>
  <div class="logo">OLI Health Hub</div>
  <div class="logo-sub">Plataforma Médica</div>
  <div class="card">
    <div class="bar"></div>
    <div class="body">
      <div class="icon">${icon}</div>
      <h1>${opts.title}</h1>
      <p>${opts.body}</p>
      ${showBtn ? `<a class="btn" href="${APP_SCHEME}">Abrir o app</a>` : ''}
    </div>
  </div>
  <p class="footer">OLI Health Hub · <a href="https://xwcarrurjvfxisuaihid.supabase.co/functions/v1/privacy">Política de Privacidade</a> · LGPD</p>
  ${opts.ok ? `<script>
    // Tenta abrir o app automaticamente (best-effort; ignora se não instalado)
    setTimeout(function(){ try { window.location.href = '${APP_SCHEME}'; } catch(e){} }, 800);
  </script>` : ''}
</body>
</html>`;
}

Deno.serve((req: Request) => {
  const url = new URL(req.url);
  // Supabase devolve erros via query OU hash. Hash não chega ao servidor,
  // então tratamos o caso de query. Se vier erro explícito → página de erro.
  const error = url.searchParams.get('error') ?? url.searchParams.get('error_code');
  const errorDesc = url.searchParams.get('error_description');

  const html = error
    ? page({
        ok: false,
        title: 'Link inválido ou expirado',
        body: (errorDesc ? errorDesc.replace(/\+/g, ' ') : 'Este link de confirmação não é mais válido.') +
          ' Abra o app e solicite um novo e-mail de confirmação.',
      })
    : page({
        ok: true,
        title: 'E-mail confirmado!',
        body: 'Sua conta foi ativada com sucesso. Toque no botão abaixo para abrir o OLI Health Hub e fazer login.',
      });

  return new Response(html, {
    status: 200,
    headers: { 'Content-Type': 'text/html; charset=utf-8' },
  });
});
