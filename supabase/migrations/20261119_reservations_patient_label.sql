-- Rótulo de paciente na reserva, para a recepção do Admin saber quem atender.
-- Texto livre (nome + inicial do sobrenome), NÃO é vínculo com `patients`: aquele exige
-- registro completo com CPF e consentimento, o que a recepção não precisa.
-- LGPD: dado mínimo, apagado 7 dias depois do fim da reserva; o texto nunca vai para audit_logs.

alter table public.reservations
  add column if not exists patient_label text
  check (patient_label is null or char_length(patient_label) <= 60);

comment on column public.reservations.patient_label is
  'Nome e inicial do sobrenome do paciente, informado pela recepção (ou pelo profissional). Máx. 60 caracteres. Apagado 7 dias após end_time pelo job limpar_patient_label_reservas.';

-- Limpeza diária (06:15 UTC = 03:15 em São Paulo). Idempotente: reagenda se já existir.
do $$
begin
  if exists (select 1 from cron.job where jobname = 'limpar_patient_label_reservas') then
    perform cron.unschedule('limpar_patient_label_reservas');
  end if;
  perform cron.schedule(
    'limpar_patient_label_reservas',
    '15 6 * * *',
    $job$update public.reservations set patient_label = null where patient_label is not null and end_time < now() - interval '7 days'$job$
  );
end
$$;
