revoke execute on function public.es_miembro() from public, anon;
grant execute on function public.es_miembro() to authenticated;
revoke execute on function public.aprobador_implicito(uuid) from public, anon, authenticated;
create index if not exists configuracion_actualizado_por_idx on public.configuracion (actualizado_por);
create index if not exists tipo_cambio_registrado_por_idx on public.tipo_cambio (registrado_por);
