-- Bloque 4: Tareas (chores) fijas y rotativas, ausencias y rachas con cierre diario.

create extension if not exists pg_cron;

-- ───────────────────────── Tablas ─────────────────────────

create table public.tareas (
  id             uuid primary key default gen_random_uuid(),
  nombre         text not null check (trim(nombre) <> ''),
  cada_dias      smallint not null default 7 check (cada_dias between 1 and 365),
  modo           text not null default 'rotativa' check (modo in ('fija', 'rotativa')),
  asignada_a     uuid references public.perfiles (id) on delete set null,
  le_toca        uuid references public.perfiles (id) on delete set null,
  proxima_fecha  date not null default public.hoy_hn(),
  activa         boolean not null default true,
  orden          smallint not null default 0,
  creado_por     uuid references public.perfiles (id) on delete set null default auth.uid(),
  creado_en      timestamptz not null default now(),
  constraint tareas_fija_con_duena check (modo <> 'fija' or asignada_a is not null)
);
comment on column public.tareas.asignada_a is 'Solo tareas fijas: siempre la hace esta persona (salvo ausencia).';
comment on column public.tareas.le_toca is 'Tareas rotativas: a quién le toca la próxima vez.';
create unique index tareas_nombre_unico on public.tareas (lower(nombre));
create index tareas_asignada_idx on public.tareas (asignada_a);
create index tareas_le_toca_idx on public.tareas (le_toca);
create index tareas_creado_por_idx on public.tareas (creado_por);

create table public.tareas_hechas (
  id                  uuid primary key default gen_random_uuid(),
  tarea_id            uuid not null references public.tareas (id) on delete cascade,
  fecha               date not null,
  hecha_por           uuid references public.perfiles (id) on delete set null,
  registrado_por      uuid references public.perfiles (id) on delete set null,
  proxima_anterior    date not null,
  le_tocaba_anterior  uuid references public.perfiles (id) on delete set null,
  creado_en           timestamptz not null default now()
);
comment on column public.tareas_hechas.proxima_anterior is 'Estado previo, para deshacer y reconstruir días pasados.';
create index tareas_hechas_tarea_idx on public.tareas_hechas (tarea_id, creado_en desc);
create index tareas_hechas_fecha_idx on public.tareas_hechas (fecha);
create index tareas_hechas_hecha_por_idx on public.tareas_hechas (hecha_por);
create index tareas_hechas_registrado_idx on public.tareas_hechas (registrado_por);
create index tareas_hechas_le_tocaba_idx on public.tareas_hechas (le_tocaba_anterior);

create table public.ausencias (
  id          uuid primary key default gen_random_uuid(),
  persona_id  uuid not null references public.perfiles (id) on delete cascade,
  desde       date not null,
  hasta       date not null,
  motivo      text,
  creado_por  uuid references public.perfiles (id) on delete set null default auth.uid(),
  creado_en   timestamptz not null default now(),
  constraint ausencias_rango check (hasta >= desde)
);
create index ausencias_persona_idx on public.ausencias (persona_id, desde, hasta);
create index ausencias_creado_por_idx on public.ausencias (creado_por);

create table public.tareas_dias (
  persona_id  uuid not null references public.perfiles (id) on delete cascade,
  fecha       date not null,
  estado      text not null check (estado in ('cumplido', 'fallado', 'congelado')),
  pendientes  smallint not null default 0,
  hechas      smallint not null default 0,
  cerrado_en  timestamptz not null default now(),
  primary key (persona_id, fecha)
);
comment on table public.tareas_dias is 'Cierre diario por persona; de aquí salen las rachas.';
create index tareas_dias_fecha_idx on public.tareas_dias (fecha);

-- ───────────────────────── Reglas ─────────────────────────

create or replace function public.tareas_antes()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  if tg_op = 'INSERT' then
    new.creado_por := auth.uid();
    new.creado_en := now();
  end if;
  if new.modo = 'fija' then
    new.le_toca := new.asignada_a;
  else
    new.asignada_a := null;
    if new.le_toca is null then
      new.le_toca := (select id from public.perfiles where rol = 'persona' order by creado_en limit 1);
    end if;
  end if;
  return new;
end;
$$;

create trigger tareas_antes
  before insert or update on public.tareas
  for each row execute function public.tareas_antes();

create or replace function public.esta_ausente(p_persona uuid, p_fecha date)
returns boolean
language sql
stable
set search_path = ''
as $$
  select exists (
    select 1 from public.ausencias a
     where a.persona_id = p_persona and p_fecha between a.desde and a.hasta
  )
$$;

create or replace function public.otra_persona(p_persona uuid)
returns uuid
language sql
stable
set search_path = ''
as $$
  select id from public.perfiles
   where rol = 'persona' and id is distinct from p_persona
   order by creado_en
   limit 1
$$;

-- A quién le cae una tarea un día dado: su dueña/o, o la otra persona si está ausente.
create or replace function public.cubrir(p_base uuid, p_fecha date)
returns uuid
language plpgsql
stable
set search_path = ''
as $$
declare
  v_otra uuid;
begin
  if p_base is null then
    p_base := (select id from public.perfiles where rol = 'persona' order by creado_en limit 1);
  end if;
  if not public.esta_ausente(p_base, p_fecha) then
    return p_base;
  end if;
  v_otra := public.otra_persona(p_base);
  if v_otra is null or public.esta_ausente(v_otra, p_fecha) then
    return null;
  end if;
  return v_otra;
end;
$$;

create or replace function public.responsable_tarea(p_tarea uuid, p_fecha date default null)
returns uuid
language sql
stable
set search_path = ''
as $$
  select public.cubrir(case when t.modo = 'fija' then t.asignada_a else t.le_toca end,
                       coalesce(p_fecha, public.hoy_hn()))
    from public.tareas t
   where t.id = p_tarea
$$;

create or replace function public.completar_tarea(p_tarea uuid, p_persona uuid default null, p_fecha date default null)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  t       public.tareas;
  v_fecha date := coalesce(p_fecha, public.hoy_hn());
  v_quien uuid;
  v_id    uuid;
begin
  if not public.es_miembro() then
    raise exception 'No autorizado';
  end if;

  select * into t from public.tareas where id = p_tarea for update;
  if not found then
    raise exception 'La tarea ya no existe';
  end if;
  if v_fecha > public.hoy_hn() then
    raise exception 'No se puede marcar una tarea en el futuro';
  end if;
  if t.proxima_fecha > v_fecha and exists (
    select 1 from public.tareas_hechas where tarea_id = t.id and fecha = v_fecha
  ) then
    raise exception 'Esta tarea ya se hizo hoy';
  end if;

  v_quien := coalesce(
    p_persona,
    public.cubrir(case when t.modo = 'fija' then t.asignada_a else t.le_toca end, v_fecha),
    auth.uid()
  );
  if not exists (select 1 from public.perfiles where id = v_quien and rol = 'persona') then
    raise exception 'Elige quién la hizo';
  end if;

  insert into public.tareas_hechas (tarea_id, fecha, hecha_por, registrado_por, proxima_anterior, le_tocaba_anterior)
  values (t.id, v_fecha, v_quien, auth.uid(), t.proxima_fecha, t.le_toca)
  returning id into v_id;

  -- Rotativa: el siguiente turno es de la otra persona (si alguien hizo una que no
  -- le tocaba, el turno vuelve a quien se la debía).
  update public.tareas
     set proxima_fecha = v_fecha + t.cada_dias,
         le_toca = case when t.modo = 'rotativa'
                        then coalesce(public.otra_persona(v_quien), v_quien)
                        else t.le_toca end
   where id = t.id;

  return v_id;
end;
$$;

create or replace function public.deshacer_tarea(p_hecha uuid)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  h public.tareas_hechas;
begin
  if not public.es_miembro() then
    raise exception 'No autorizado';
  end if;
  select * into h from public.tareas_hechas where id = p_hecha;
  if not found then
    raise exception 'Ese registro ya no existe';
  end if;
  if exists (select 1 from public.tareas_hechas where tarea_id = h.tarea_id and creado_en > h.creado_en) then
    raise exception 'Solo se puede deshacer la última vez que se hizo';
  end if;

  update public.tareas
     set proxima_fecha = h.proxima_anterior,
         le_toca = coalesce(h.le_tocaba_anterior, le_toca)
   where id = h.tarea_id;
  delete from public.tareas_hechas where id = h.id;
end;
$$;

-- Cierra los días vencidos por persona. Idempotente. El estado al final de cada día
-- se reconstruye con el historial (proxima_anterior / le_tocaba_anterior de la
-- primera vez que se hizo después de ese día), así que cerrar tarde da lo mismo.
create or replace function public.cerrar_dias_tareas()
returns integer
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_hasta  date := public.hoy_hn() - 1;
  v_desde  date;
  d        date;
  p        record;
  v_fin    timestamptz;
  v_pend   integer;
  v_hechas integer;
  v_n      integer := 0;
begin
  if auth.uid() is not null and not public.es_miembro() then
    raise exception 'No autorizado';
  end if;

  select max(fecha) + 1 into v_desde from public.tareas_dias;
  if v_desde is null then
    -- El día en que se crearon las tareas no cuenta
    select (min(creado_en) at time zone 'America/Tegucigalpa')::date + 1 into v_desde from public.tareas;
  end if;
  if v_desde is null or v_desde > v_hasta then
    return 0;
  end if;
  v_desde := greatest(v_desde, v_hasta - 90);

  d := v_desde;
  while d <= v_hasta loop
    v_fin := (d + 1)::timestamp at time zone 'America/Tegucigalpa';
    for p in select id from public.perfiles where rol = 'persona' loop
      if public.esta_ausente(p.id, d) then
        insert into public.tareas_dias (persona_id, fecha, estado)
        values (p.id, d, 'congelado')
        on conflict do nothing;
      else
        select count(*) into v_pend
          from public.tareas t
          left join lateral (
            select h.proxima_anterior, h.le_tocaba_anterior
              from public.tareas_hechas h
             where h.tarea_id = t.id and h.creado_en >= v_fin
             order by h.creado_en
             limit 1
          ) h on true
         where t.activa
           and t.creado_en < v_fin
           and coalesce(h.proxima_anterior, t.proxima_fecha) <= d
           and public.cubrir(
                 case when t.modo = 'fija' then t.asignada_a
                      when h.proxima_anterior is not null then h.le_tocaba_anterior
                      else t.le_toca end,
                 d) = p.id;

        select count(*) into v_hechas
          from public.tareas_hechas
         where hecha_por = p.id and fecha = d;

        insert into public.tareas_dias (persona_id, fecha, estado, pendientes, hechas)
        values (p.id, d, case when v_pend > 0 then 'fallado' else 'cumplido' end, v_pend, v_hechas)
        on conflict do nothing;
      end if;
      v_n := v_n + 1;
    end loop;
    d := d + 1;
  end loop;
  return v_n;
end;
$$;

-- ───────────────────────── Seguridad y tiempo real ─────────────────────────

alter table public.tareas        enable row level security;
alter table public.tareas_hechas enable row level security;
alter table public.ausencias     enable row level security;
alter table public.tareas_dias   enable row level security;

create policy "miembros gestionan tareas" on public.tareas
  for all to authenticated using ((select public.es_miembro())) with check ((select public.es_miembro()));
create policy "miembros leen tareas hechas" on public.tareas_hechas
  for select to authenticated using ((select public.es_miembro()));
create policy "miembros gestionan ausencias" on public.ausencias
  for all to authenticated using ((select public.es_miembro())) with check ((select public.es_miembro()));
create policy "miembros leen dias de tareas" on public.tareas_dias
  for select to authenticated using ((select public.es_miembro()));

revoke execute on function public.tareas_antes() from public, anon, authenticated;
revoke execute on function public.completar_tarea(uuid, uuid, date) from public, anon;
revoke execute on function public.deshacer_tarea(uuid) from public, anon;
revoke execute on function public.cerrar_dias_tareas() from public, anon;
revoke execute on function public.responsable_tarea(uuid, date) from public, anon;
grant execute on function public.completar_tarea(uuid, uuid, date) to authenticated;
grant execute on function public.deshacer_tarea(uuid) to authenticated;
grant execute on function public.cerrar_dias_tareas() to authenticated;
grant execute on function public.responsable_tarea(uuid, date) to authenticated;

alter publication supabase_realtime add table
  public.tareas, public.tareas_hechas, public.ausencias, public.tareas_dias;

-- Cierre diario a las 00:10 de Honduras (06:10 UTC)
select cron.schedule('cerrar-dias-tareas', '10 6 * * *', $$select public.cerrar_dias_tareas()$$);

-- ───────────────────────── Tareas iniciales ─────────────────────────
-- Diego siempre: cocinar, sacar la basura, lavar el baño 1. Las demás rotan.

do $$
declare
  v_diego uuid := (select id from public.perfiles where email = 'davo72699@gmail.com');
  v_sofia uuid := (select id from public.perfiles where email = 'sofiasalgado63@gmail.com');
  v_hoy   date := public.hoy_hn();
begin
  if v_diego is null or v_sofia is null then
    return;
  end if;
  insert into public.tareas (nombre, cada_dias, modo, asignada_a, le_toca, proxima_fecha, orden) values
    ('Cocinar',          1,  'fija',     v_diego, null,    v_hoy,     1),
    ('Lavar platos',     1,  'rotativa', null,    v_sofia, v_hoy,     2),
    ('Sacar la basura',  2,  'fija',     v_diego, null,    v_hoy,     3),
    ('Barrer y trapear', 3,  'rotativa', null,    v_sofia, v_hoy + 1, 4),
    ('Lavar ropa',       4,  'rotativa', null,    v_diego, v_hoy + 1, 5),
    ('Lavar baño 1',     7,  'fija',     v_diego, null,    v_hoy + 3, 6),
    ('Lavar baño 2',     7,  'rotativa', null,    v_sofia, v_hoy + 3, 7),
    ('Súper',            7,  'rotativa', null,    v_diego, v_hoy + 4, 8),
    ('Cambiar sábanas',  14, 'rotativa', null,    v_sofia, v_hoy + 4, 9);
end;
$$;
