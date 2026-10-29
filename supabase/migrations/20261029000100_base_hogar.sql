-- Casa Sofía y Diego · Bloque 1 (fases A–C)
-- Perfiles, acceso, configuración, tipo de cambio, categorías, gastos,
-- aprobaciones con PIN y presupuesto mensual (fijo / variable / eventual).

create extension if not exists pgcrypto with schema extensions;

-- Fecha "hoy" en Honduras
create or replace function public.hoy_hn()
returns date
language sql
stable
set search_path = ''
as $$ select (now() at time zone 'America/Tegucigalpa')::date $$;

-- ───────────────────────── Acceso ─────────────────────────

create table public.correos_permitidos (
  email   text primary key check (email = lower(email)),
  nombre  text not null,
  rol     text not null default 'persona' check (rol in ('persona', 'casa'))
);
comment on table public.correos_permitidos is
  'Solo estos correos pueden crear cuenta. rol=casa es para la cuenta de la tablet.';

insert into public.correos_permitidos (email, nombre, rol) values
  ('davo72699@gmail.com', 'Diego', 'persona'),
  ('sofiasalgado63@gmail.com', 'Sofía', 'persona');

create table public.perfiles (
  id          uuid primary key references auth.users (id) on delete cascade,
  nombre      text not null,
  email       text not null unique,
  rol         text not null default 'persona' check (rol in ('persona', 'casa')),
  color       text not null default 'bosque',
  mesada      numeric(12, 2) check (mesada is null or mesada >= 0),
  creado_en   timestamptz not null default now()
);
comment on column public.perfiles.mesada is 'Mesada mensual en lempiras';

-- PIN separado: nunca se expone por la API, solo vía funciones
create table public.perfiles_pin (
  perfil_id         uuid primary key references public.perfiles (id) on delete cascade,
  pin_hash          text not null,
  intentos_fallidos int not null default 0,
  bloqueado_hasta   timestamptz
);

create or replace function public.manejar_nuevo_usuario()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  v public.correos_permitidos%rowtype;
begin
  select * into v from public.correos_permitidos where email = lower(new.email);
  if not found then
    raise exception 'Este correo no tiene acceso a la casa';
  end if;
  insert into public.perfiles (id, nombre, email, rol)
  values (new.id, v.nombre, lower(new.email), v.rol);
  return new;
end;
$$;

create trigger al_crear_usuario
  after insert on auth.users
  for each row execute function public.manejar_nuevo_usuario();

create or replace function public.es_miembro()
returns boolean
language sql
stable
security definer
set search_path = ''
as $$ select exists (select 1 from public.perfiles where id = auth.uid()) $$;

-- ───────────────────────── Configuración ─────────────────────────

create table public.configuracion (
  id                 smallint primary key default 1 check (id = 1),
  umbral_aprobacion  numeric(12, 2) check (umbral_aprobacion is null or umbral_aprobacion > 0),
  actualizado_en     timestamptz not null default now(),
  actualizado_por    uuid references public.perfiles (id) on delete set null
);
comment on column public.configuracion.umbral_aprobacion is
  'En lempiras. Gastos del hogar >= umbral requieren aprobación de ambos. Null = sin umbral.';
insert into public.configuracion (id) values (1);

create table public.tipo_cambio (
  id              bigint generated always as identity primary key,
  fecha           date not null unique default public.hoy_hn(),
  valor           numeric(10, 4) not null check (valor > 0),
  registrado_por  uuid references public.perfiles (id) on delete set null default auth.uid(),
  creado_en       timestamptz not null default now()
);
comment on column public.tipo_cambio.valor is 'Lempiras por 1 USD';

-- ───────────────────────── Categorías ─────────────────────────

create table public.categorias (
  id         uuid primary key default gen_random_uuid(),
  nombre     text not null,
  icono      text not null default 'Tag',
  orden      int not null default 0,
  activa     boolean not null default true,
  creado_en  timestamptz not null default now()
);
create unique index categorias_nombre_unico on public.categorias (lower(nombre));

-- ───────────────────────── Presupuesto ─────────────────────────

create table public.presupuesto (
  id            uuid primary key default gen_random_uuid(),
  categoria_id  uuid not null references public.categorias (id) on delete cascade,
  tipo          text not null check (tipo in ('fijo', 'variable', 'eventual')),
  descripcion   text,
  monto         numeric(12, 2) not null check (monto > 0),
  moneda        text not null default 'HNL' check (moneda in ('HNL', 'USD')),
  mes           smallint check (mes between 1 and 12),
  anio          smallint check (anio between 2020 and 2100),
  recurrente    boolean not null default false,
  activo        boolean not null default true,
  creado_en     timestamptz not null default now(),
  -- fijo/variable: aplican todos los meses
  constraint presupuesto_mes_segun_tipo check (
    (tipo = 'eventual' and mes is not null) or (tipo <> 'eventual' and mes is null and anio is null)
  ),
  -- eventual: o se repite cada año o es de un año específico
  constraint presupuesto_eventual_anio check (
    tipo <> 'eventual' or recurrente or anio is not null
  ),
  constraint presupuesto_eventual_descripcion check (
    tipo <> 'eventual' or coalesce(trim(descripcion), '') <> ''
  )
);
create index presupuesto_categoria_idx on public.presupuesto (categoria_id);

-- ───────────────────────── Gastos ─────────────────────────

create table public.gastos (
  id              uuid primary key default gen_random_uuid(),
  fecha           date not null default public.hoy_hn(),
  monto           numeric(12, 2) not null check (monto > 0),
  moneda          text not null default 'HNL' check (moneda in ('HNL', 'USD')),
  tipo_cambio     numeric(10, 4) check (tipo_cambio is null or tipo_cambio > 0),
  monto_lempiras  numeric(12, 2) generated always as (
    case when moneda = 'USD' then round(monto * tipo_cambio, 2) else monto end
  ) stored,
  tipo            text not null default 'hogar' check (tipo in ('hogar', 'mesada')),
  categoria_id    uuid references public.categorias (id) on delete restrict,
  persona_id      uuid not null references public.perfiles (id),
  registrado_por  uuid references public.perfiles (id) on delete set null default auth.uid(),
  estado          text not null default 'aprobado' check (estado in ('aprobado', 'pendiente', 'rechazado')),
  descripcion     text,
  presupuesto_id  uuid references public.presupuesto (id) on delete set null,
  creado_en       timestamptz not null default now(),
  constraint gastos_tc_usd check (moneda = 'HNL' or tipo_cambio is not null),
  constraint gastos_categoria_hogar check (tipo = 'mesada' or categoria_id is not null)
);
create index gastos_fecha_idx on public.gastos (fecha desc);
create index gastos_categoria_idx on public.gastos (categoria_id);
create index gastos_persona_idx on public.gastos (persona_id);
create index gastos_registrado_idx on public.gastos (registrado_por);
create index gastos_presupuesto_idx on public.gastos (presupuesto_id);
create index gastos_pendientes_idx on public.gastos (estado) where estado = 'pendiente';

create table public.aprobaciones (
  gasto_id     uuid not null references public.gastos (id) on delete cascade,
  persona_id   uuid not null references public.perfiles (id) on delete cascade,
  decision     text not null check (decision in ('aprobado', 'rechazado')),
  decidido_en  timestamptz not null default now(),
  primary key (gasto_id, persona_id)
);
create index aprobaciones_persona_idx on public.aprobaciones (persona_id);

-- ¿Este gasto necesita aprobación de ambos?
create or replace function public.requiere_aprobacion(p_tipo text, p_monto_l numeric)
returns boolean
language sql
stable
set search_path = ''
as $$
  select p_tipo = 'hogar'
     and coalesce((select umbral_aprobacion from public.configuracion where id = 1), 0) > 0
     and p_monto_l >= (select umbral_aprobacion from public.configuracion where id = 1)
$$;

-- Quién aprueba implícitamente al registrar: quien registra si es persona; si no, la persona del gasto
create or replace function public.aprobador_implicito(p_persona uuid)
returns uuid
language sql
stable
security definer
set search_path = ''
as $$
  select coalesce(
    (select id from public.perfiles where id = auth.uid() and rol = 'persona'),
    p_persona
  )
$$;

create or replace function public.gastos_antes()
returns trigger
language plpgsql
set search_path = ''
as $$
declare
  v_monto_l numeric;
begin
  if new.moneda = 'HNL' then
    new.tipo_cambio := null;
  end if;
  if new.tipo = 'mesada' then
    new.presupuesto_id := null;
  end if;

  v_monto_l := case when new.moneda = 'USD' then round(new.monto * new.tipo_cambio, 2) else new.monto end;

  if not exists (select 1 from public.perfiles where id = new.persona_id and rol = 'persona') then
    raise exception 'El gasto debe ser de Diego o de Sofía';
  end if;

  if tg_op = 'INSERT' then
    new.registrado_por := auth.uid();
    new.estado := case when public.requiere_aprobacion(new.tipo, v_monto_l) then 'pendiente' else 'aprobado' end;
    return new;
  end if;

  -- UPDATE: el estado solo cambia vía decidir_gasto(), o al re-evaluar por cambio de monto
  if new.estado is distinct from old.estado
     and coalesce(current_setting('app.decidiendo', true), '') <> '1' then
    new.estado := old.estado;
  end if;

  if (new.monto, new.moneda, new.tipo_cambio, new.tipo) is distinct from
     (old.monto, old.moneda, old.tipo_cambio, old.tipo)
     and coalesce(current_setting('app.decidiendo', true), '') <> '1' then
    if public.requiere_aprobacion(new.tipo, v_monto_l)
       and (old.estado <> 'pendiente')
       and (v_monto_l > old.monto_lempiras or not public.requiere_aprobacion(old.tipo, old.monto_lempiras)) then
      new.estado := 'pendiente';
    elsif not public.requiere_aprobacion(new.tipo, v_monto_l) and old.estado = 'pendiente' then
      new.estado := 'aprobado';
    end if;
  end if;
  return new;
end;
$$;

create trigger gastos_antes
  before insert or update on public.gastos
  for each row execute function public.gastos_antes();

create or replace function public.gastos_despues()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if new.estado = 'pendiente'
     and (tg_op = 'INSERT' or old.estado <> 'pendiente') then
    delete from public.aprobaciones where gasto_id = new.id;
    insert into public.aprobaciones (gasto_id, persona_id, decision)
    values (new.id, public.aprobador_implicito(new.persona_id), 'aprobado')
    on conflict do nothing;
  end if;
  return null;
end;
$$;

create trigger gastos_despues
  after insert or update on public.gastos
  for each row execute function public.gastos_despues();

-- ───────────────────────── PIN ─────────────────────────

create or replace function public.establecer_pin(p_pin text)
returns void
language plpgsql
security definer
set search_path = ''
as $$
begin
  if not public.es_miembro() then raise exception 'Sin acceso'; end if;
  if p_pin !~ '^[0-9]{4,6}$' then raise exception 'El PIN debe tener de 4 a 6 dígitos'; end if;
  if not exists (select 1 from public.perfiles where id = auth.uid() and rol = 'persona') then
    raise exception 'Solo Diego y Sofía tienen PIN';
  end if;
  insert into public.perfiles_pin (perfil_id, pin_hash)
  values (auth.uid(), extensions.crypt(p_pin, extensions.gen_salt('bf')))
  on conflict (perfil_id) do update
    set pin_hash = excluded.pin_hash, intentos_fallidos = 0, bloqueado_hasta = null;
end;
$$;

create or replace function public.personas_con_pin()
returns setof uuid
language sql
stable
security definer
set search_path = ''
as $$
  select perfil_id from public.perfiles_pin where public.es_miembro()
$$;

-- Verifica el PIN con bloqueo de 5 min tras 5 intentos fallidos
create or replace function public.verificar_pin(p_persona uuid, p_pin text)
returns boolean
language plpgsql
security definer
set search_path = ''
as $$
declare
  r public.perfiles_pin%rowtype;
begin
  if not public.es_miembro() then raise exception 'Sin acceso'; end if;
  select * into r from public.perfiles_pin where perfil_id = p_persona for update;
  if not found then raise exception 'Esa persona todavía no tiene PIN. Se configura en Ajustes.'; end if;
  if r.bloqueado_hasta is not null and r.bloqueado_hasta > now() then
    raise exception 'Demasiados intentos. Prueba de nuevo en unos minutos.';
  end if;
  if r.pin_hash = extensions.crypt(coalesce(p_pin, ''), r.pin_hash) then
    update public.perfiles_pin set intentos_fallidos = 0, bloqueado_hasta = null where perfil_id = p_persona;
    return true;
  end if;
  update public.perfiles_pin
     set intentos_fallidos = r.intentos_fallidos + 1,
         bloqueado_hasta = case when r.intentos_fallidos + 1 >= 5 then now() + interval '5 minutes' end
   where perfil_id = p_persona;
  return false;
end;
$$;

-- ───────────────────────── Aprobar / rechazar ─────────────────────────

create or replace function public.decidir_gasto(
  p_gasto uuid,
  p_persona uuid,
  p_decision text,
  p_pin text default null
)
returns text
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_estado    text;
  v_personas  int;
  v_aprobados int;
  v_nuevo     text;
begin
  if not public.es_miembro() then raise exception 'Sin acceso'; end if;
  if p_decision not in ('aprobado', 'rechazado') then raise exception 'Decisión inválida'; end if;
  if not exists (select 1 from public.perfiles where id = p_persona and rol = 'persona') then
    raise exception 'Persona inválida';
  end if;

  -- Decidir por otra persona (o desde la cuenta Casa) exige su PIN
  -- Devuelve 'pin_incorrecto' sin abortar, para que el contador de intentos quede guardado
  if p_persona <> auth.uid() then
    if not public.verificar_pin(p_persona, p_pin) then
      return 'pin_incorrecto';
    end if;
  end if;

  select estado into v_estado from public.gastos where id = p_gasto for update;
  if not found then raise exception 'Gasto no encontrado'; end if;
  if v_estado <> 'pendiente' then raise exception 'Este gasto ya no está pendiente'; end if;

  insert into public.aprobaciones (gasto_id, persona_id, decision)
  values (p_gasto, p_persona, p_decision)
  on conflict (gasto_id, persona_id) do update set decision = excluded.decision, decidido_en = now();

  select count(*) into v_personas from public.perfiles where rol = 'persona';
  select count(*) into v_aprobados from public.aprobaciones where gasto_id = p_gasto and decision = 'aprobado';

  v_nuevo := case
    when p_decision = 'rechazado' then 'rechazado'
    when v_aprobados >= v_personas then 'aprobado'
    else 'pendiente'
  end;

  if v_nuevo <> 'pendiente' then
    perform set_config('app.decidiendo', '1', true);
    update public.gastos set estado = v_nuevo where id = p_gasto;
    perform set_config('app.decidiendo', '', true);
  end if;
  return v_nuevo;
end;
$$;

-- ───────────────────────── Seguridad (RLS) ─────────────────────────

alter table public.correos_permitidos enable row level security;
alter table public.perfiles           enable row level security;
alter table public.perfiles_pin       enable row level security;
alter table public.configuracion      enable row level security;
alter table public.tipo_cambio        enable row level security;
alter table public.categorias         enable row level security;
alter table public.presupuesto        enable row level security;
alter table public.gastos             enable row level security;
alter table public.aprobaciones       enable row level security;

-- perfiles_pin: sin políticas → inaccesible desde la API

create policy "miembros leen correos" on public.correos_permitidos
  for select to authenticated using ((select public.es_miembro()));
create policy "miembros agregan correos" on public.correos_permitidos
  for insert to authenticated with check ((select public.es_miembro()));
create policy "miembros quitan correos" on public.correos_permitidos
  for delete to authenticated using ((select public.es_miembro()));

create policy "miembros leen perfiles" on public.perfiles
  for select to authenticated using ((select public.es_miembro()));
create policy "miembros editan perfiles" on public.perfiles
  for update to authenticated using ((select public.es_miembro())) with check ((select public.es_miembro()));
revoke update on public.perfiles from authenticated, anon;
grant update (nombre, color, mesada) on public.perfiles to authenticated;

create policy "miembros leen config" on public.configuracion
  for select to authenticated using ((select public.es_miembro()));
create policy "miembros editan config" on public.configuracion
  for update to authenticated using ((select public.es_miembro())) with check ((select public.es_miembro()));

create policy "miembros gestionan tipo_cambio" on public.tipo_cambio
  for all to authenticated using ((select public.es_miembro())) with check ((select public.es_miembro()));
create policy "miembros gestionan categorias" on public.categorias
  for all to authenticated using ((select public.es_miembro())) with check ((select public.es_miembro()));
create policy "miembros gestionan presupuesto" on public.presupuesto
  for all to authenticated using ((select public.es_miembro())) with check ((select public.es_miembro()));
create policy "miembros gestionan gastos" on public.gastos
  for all to authenticated using ((select public.es_miembro())) with check ((select public.es_miembro()));
create policy "miembros leen aprobaciones" on public.aprobaciones
  for select to authenticated using ((select public.es_miembro()));

-- Funciones: solo usuarios autenticados
revoke execute on function public.establecer_pin(text) from public, anon;
revoke execute on function public.personas_con_pin() from public, anon;
revoke execute on function public.verificar_pin(uuid, text) from public, anon;
revoke execute on function public.decidir_gasto(uuid, uuid, text, text) from public, anon;
revoke execute on function public.manejar_nuevo_usuario() from public, anon, authenticated;
revoke execute on function public.gastos_despues() from public, anon, authenticated;
grant execute on function public.establecer_pin(text) to authenticated;
grant execute on function public.personas_con_pin() to authenticated;
grant execute on function public.verificar_pin(uuid, text) to authenticated;
grant execute on function public.decidir_gasto(uuid, uuid, text, text) to authenticated;

-- ───────────────────────── Realtime ─────────────────────────

alter publication supabase_realtime add table
  public.gastos, public.aprobaciones, public.presupuesto, public.categorias,
  public.configuracion, public.tipo_cambio, public.perfiles;
