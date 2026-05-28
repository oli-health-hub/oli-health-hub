/**
 * Edge Function: nps
 *
 * Pesquisa NPS nativa OLI — acessada diretamente pelo paciente via WhatsApp.
 * Não requer autenticação Supabase (paciente não tem conta).
 *
 * GET  /nps?token=UUID          → página HTML de avaliação 0-10
 * POST /nps                     → { token, score, comment? } → salva nota
 */

import { createClient } from 'npm:@supabase/supabase-js@2';

const corsHeaders = {
  'Access-Control-Allow-Origin':  '*',
  'Access-Control-Allow-Headers': 'content-type',
};

const html = (body: string, title = 'Avaliação OLI') => new Response(
  `<!DOCTYPE html><html lang="pt-BR"><head>
  <meta charset="UTF-8"/>
  <meta name="viewport" content="width=device-width,initial-scale=1"/>
  <title>${title}</title>
  <style>
    *{box-sizing:border-box;margin:0;padding:0}
    body{font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif;
         background:#F4EFEA;min-height:100vh;display:flex;align-items:center;justify-content:center;padding:20px}
    .card{background:#fff;border-radius:20px;padding:32px 24px;max-width:420px;width:100%;
          box-shadow:0 4px 24px rgba(0,0,0,.08);text-align:center}
    .logo{width:48px;height:48px;background:#5F7D67;border-radius:14px;margin:0 auto 20px;
          display:flex;align-items:center;justify-content:center}
    h1{font-size:20px;font-weight:700;color:#2F2F2F;margin-bottom:8px}
    p{font-size:14px;color:#6B6B6B;line-height:1.5;margin-bottom:24px}
    .scale{display:flex;gap:6px;flex-wrap:wrap;justify-content:center;margin-bottom:8px}
    .scale button{width:44px;height:44px;border:2px solid #E8E2DC;border-radius:12px;
                  font-size:15px;font-weight:700;cursor:pointer;background:#fff;
                  color:#2F2F2F;transition:all .15s}
    .scale button:hover{border-color:#5F7D67;color:#5F7D67}
    .scale button.sel{background:#5F7D67;border-color:#5F7D67;color:#fff}
    .scale button[data-v="0"],.scale button[data-v="1"],.scale button[data-v="2"],
    .scale button[data-v="3"],.scale button[data-v="4"],.scale button[data-v="5"],
    .scale button[data-v="6"]{--c:#D9534F}
    .scale button[data-v="7"],.scale button[data-v="8"]{--c:#B8893C}
    .scale button[data-v="9"],.scale button[data-v="10"]{--c:#5F7D67}
    .scale button:hover{border-color:var(--c);color:var(--c)}
    .scale button.sel{background:var(--c,#5F7D67);border-color:var(--c,#5F7D67);color:#fff}
    .labels{display:flex;justify-content:space-between;font-size:11px;color:#9E9E9E;margin-bottom:20px}
    textarea{width:100%;border:1.5px solid #E8E2DC;border-radius:12px;padding:12px;
             font-size:14px;color:#2F2F2F;resize:none;outline:none;font-family:inherit;
             margin-bottom:20px}
    textarea:focus{border-color:#5F7D67}
    button.submit{width:100%;background:#5F7D67;color:#fff;border:none;border-radius:12px;
                  padding:14px;font-size:16px;font-weight:700;cursor:pointer;opacity:.4;
                  pointer-events:none;transition:opacity .2s}
    button.submit.active{opacity:1;pointer-events:auto}
    .msg{font-size:16px;color:#2F2F2F;font-weight:600;margin-top:8px}
    .sub{font-size:13px;color:#6B6B6B;margin-top:6px}
  </style>
  </head><body>${body}</body></html>`,
  { headers: { ...corsHeaders, 'Content-Type': 'text/html; charset=utf-8' } },
);

const json = (body: unknown, status = 200) => new Response(JSON.stringify(body), {
  status,
  headers: { ...corsHeaders, 'Content-Type': 'application/json' },
});

Deno.serve(async (req: Request) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders });

  const supabase = createClient(
    Deno.env.get('SUPABASE_URL')!,
    Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!,
  );

  const url   = new URL(req.url);
  const token = url.searchParams.get('token') ?? '';

  // ── GET: serve página de avaliação ───────────────────────────────────────────
  if (req.method === 'GET') {
    if (!token) return html(successPage('Link inválido.', false));

    // Valida token e verifica expiração
    const { data, error } = await supabase
      .from('nps_responses')
      .select('id, answered_at, expires_at, patient_name')
      .eq('nps_token', token)
      .single();

    if (error || !data) return html(successPage('Este link não é válido ou já expirou.', false));
    if (data.answered_at) return html(successPage('Obrigado! Sua avaliação já foi registrada. 🙏', true));
    if (new Date(data.expires_at) < new Date()) return html(successPage('Este link expirou.', false));

    const firstName = (data.patient_name as string | null)?.split(' ')[0] ?? '';

    return html(`
      <div class="card">
        <div class="logo">
          <svg width="24" height="24" viewBox="0 0 24 24" fill="none">
            <path d="M12 2C8.69 2 6 4.69 6 8c0 2.97 2.03 5.44 4.75 6.2L12 22l1.25-7.8C15.97 13.44 18 10.97 18 8c0-3.31-2.69-6-6-6z" fill="white" opacity=".9"/>
            <circle cx="12" cy="8" r="2.5" fill="white" opacity=".5"/>
          </svg>
        </div>
        <h1>Olá${firstName ? ', ' + firstName : ''}! 👋</h1>
        <p>De 0 a 10, qual a probabilidade de você recomendar nosso atendimento a um amigo ou colega?</p>
        <div class="scale" id="scale">
          ${Array.from({ length: 11 }, (_, i) => `<button type="button" data-v="${i}" onclick="pick(${i})">${i}</button>`).join('')}
        </div>
        <div class="labels"><span>😞 Nada provável</span><span>😍 Muito provável</span></div>
        <textarea id="comment" rows="3" placeholder="Comentário opcional…"></textarea>
        <button class="submit" id="submit" onclick="submit()">Enviar avaliação</button>
      </div>
      <script>
        var sel = null;
        function pick(v){
          sel = v;
          document.querySelectorAll('.scale button').forEach(function(b){b.classList.remove('sel')});
          document.querySelector('[data-v="'+v+'"]').classList.add('sel');
          document.getElementById('submit').classList.add('active');
        }
        function submit(){
          if(sel===null) return;
          var btn = document.getElementById('submit');
          btn.textContent = 'Enviando…';
          btn.classList.remove('active');
          fetch(location.href, {
            method: 'POST',
            headers: {'Content-Type':'application/json'},
            body: JSON.stringify({token:'${token}', score: sel, comment: document.getElementById('comment').value})
          }).then(function(r){ return r.json(); }).then(function(d){
            document.body.innerHTML = '<div class="card"><div class="logo"><svg width="24" height="24" viewBox="0 0 24 24" fill="none"><path d="M12 2C8.69 2 6 4.69 6 8c0 2.97 2.03 5.44 4.75 6.2L12 22l1.25-7.8C15.97 13.44 18 10.97 18 8c0-3.31-2.69-6-6-6z" fill="white" opacity=".9"/><circle cx="12" cy="8" r="2.5" fill="white" opacity=".5"/></svg></div><p class="msg">Obrigado pela sua avaliação! 🙏</p><p class="sub">Seu feedback nos ajuda a melhorar cada vez mais.</p></div>';
          }).catch(function(){ btn.textContent='Tentar novamente'; btn.classList.add('active'); });
        }
      </script>
    `);
  }

  // ── POST: salva avaliação ─────────────────────────────────────────────────────
  if (req.method === 'POST') {
    let body: { token?: string; score?: unknown; comment?: string };
    try { body = await req.json(); } catch { return json({ error: 'JSON inválido' }, 400); }

    const t     = (body.token ?? token) as string;
    const score = Number(body.score);

    if (!t) return json({ error: 'token obrigatório' }, 400);
    if (isNaN(score) || score < 0 || score > 10) return json({ error: 'score deve ser 0-10' }, 400);

    // Valida e atualiza
    const { data: row, error: fetchErr } = await supabase
      .from('nps_responses')
      .select('id, answered_at, expires_at')
      .eq('nps_token', t)
      .single();

    if (fetchErr || !row) return json({ error: 'Token inválido' }, 404);
    if (row.answered_at) return json({ ok: true, already: true });
    if (new Date(row.expires_at as string) < new Date()) return json({ error: 'Link expirado' }, 410);

    const { error: updErr } = await supabase
      .from('nps_responses')
      .update({
        score,
        comment:     body.comment?.trim() || null,
        answered_at: new Date().toISOString(),
      })
      .eq('id', row.id as string);

    if (updErr) return json({ error: updErr.message }, 500);
    return json({ ok: true });
  }

  return json({ error: 'Method not allowed' }, 405);
});

function successPage(msg: string, success: boolean) {
  const icon = success ? '🙏' : '⚠️';
  return `<div class="card">
    <div class="logo"><svg width="24" height="24" viewBox="0 0 24 24" fill="none">
      <path d="M12 2C8.69 2 6 4.69 6 8c0 2.97 2.03 5.44 4.75 6.2L12 22l1.25-7.8C15.97 13.44 18 10.97 18 8c0-3.31-2.69-6-6-6z" fill="white" opacity=".9"/>
      <circle cx="12" cy="8" r="2.5" fill="white" opacity=".5"/></svg></div>
    <p class="msg">${icon} ${msg}</p>
  </div>`;
}
