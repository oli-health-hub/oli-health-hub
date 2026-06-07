# ✅ Checklist de Release — OLI Health Hub

> Ler ANTES de publicar para produção (App Store / Google Play público).

---

## 🔴 BLOQUEADOR — Simulador Communicare

**O canal `production` está com o SIMULADOR CC LIGADO (mock) para testes
no TestFlight.** Os pacientes "Maria Oliveira", "João Santos", etc. são
FIXTURES, não dados reais.

**Antes de qualquer release público, OBRIGATÓRIO desligar o mock:**

```bash
# 1. Garantir que .env NÃO tem mock (já deve estar limpo)
grep COMMUNICARE_MOCK .env   # não deve retornar nada

# 2. Publicar OTA limpo nos dois canais
eas update --branch production --message "Mock CC desligado — produção"
eas update --branch preview    --message "Mock CC desligado"

# 3. Confirmar no app: card "Agenda de Pacientes" some (CC não configurado)
#    e dropdown de convênio volta a texto livre.
```

**Estado esperado em produção real:**
- `EXPO_PUBLIC_COMMUNICARE_MOCK` ausente/false
- `EXPO_PUBLIC_COMMUNICARE_PROXY_URL` setado SOMENTE quando token CC chegar
- Sem token e sem mock → integração inerte (app funciona normal, sync oculto)

---

## Quando o token do Communicare chegar

```bash
# Supabase secrets
supabase secrets set CC_BASE_URL=...
supabase secrets set CC_PATIENTS_BASE_URL=...
supabase secrets set CC_API_KEY=...
supabase secrets set CC_WEBHOOK_SECRET=...

# Deploy functions
supabase functions deploy communicare-proxy
supabase functions deploy communicare-sync-worker
supabase functions deploy communicare-webhook
supabase functions deploy communicare-migrate-patients

# Aplicar migração
supabase db push

# App: setar proxy (NÃO mock)
echo "EXPO_PUBLIC_COMMUNICARE_PROXY_URL=https://<proj>.supabase.co/functions/v1/communicare-proxy" >> .env

# OTA produção
eas update --branch production --message "Communicare CC real ativado"

# Cron do worker (Supabase Dashboard → Database → Cron, a cada 5 min)
# Migração pacientes existentes:
curl -X POST https://<proj>.supabase.co/functions/v1/communicare-migrate-patients \
  -H "Authorization: Bearer <jwt_admin>"
```

---

## Checklist geral de release

- [ ] **Mock CC desligado** (ver acima) 🔴
- [ ] `npx tsc --noEmit` sem erros
- [ ] Versão/build incrementados em `app.json` se build nativo
- [ ] OTA publicado em `production` E `preview`
- [ ] Testar cold start + Face ID no device
- [ ] Conferir rodapé do perfil mostra versão/canal corretos
