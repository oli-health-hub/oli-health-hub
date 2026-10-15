-- Admin enxerga todas as reservas (agenda /salas do admin).
-- Antes só existia "Reservas próprias" (auth.uid() = professional_id), então o admin
-- só via as reservas do próprio usuário logado. Aplicada em produção em 15/10/2026.
create policy "reservations_admin_select" on public.reservations
  for select using (public.is_oli_admin());
