select cron.schedule(
  'whatsapp-nudge-silencio',
  '*/30 12-21 * * *', -- a cada 30 min, 9h-19h BRT (12h-21h UTC)
  $$
  select net.http_post(
    url     := (select decrypted_secret from vault.decrypted_secrets where name='supabase_url' limit 1)
               || '/functions/v1/whatsapp-nudge-silencio',
    headers := jsonb_build_object(
                 'Authorization', 'Bearer ' || (select decrypted_secret from vault.decrypted_secrets where name='service_role_key' limit 1),
                 'Content-Type', 'application/json'),
    body    := '{}'::jsonb,
    timeout_milliseconds := 120000
  );
  $$
);
