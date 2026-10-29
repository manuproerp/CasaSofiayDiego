-- Bloque 2: Anuales + Metas (motor compartido "fondos"), Wishlist con aprobación.
-- Los eventuales del presupuesto pasan a ser fondos anuales.

-- ───────────────────────── Fondos (apartados) ─────────────────────────

create table public.fondos (
  id              uuid primary key default gen_random_uuid(),
  tipo            text not null check (tipo in ('anual', 'meta')),
  nombre          text not null check (trim(nombre) <> ''),
  categoria_id    uuid references public.categorias (id) on delete set null,
  monto_objetivo  numeric(12, 2) not null check (monto_objetivo > 0),
  moneda          text not null default 'HNL' check (moneda in ('HNL', 'USD')),
  fecha_objetivo  date,
  recurrente      boolean not null default false,
  ciclo           int not null default 1 check (ciclo >= 1),
  estado          text not null default 'activo' check (estado in ('activo', 'pagado', 'cancelado')),
  wishlist_id     uuid,
  nota            text,
  creado_por      uuid references public.perfiles (id) on delete set null default auth.uid(),
  creado_en       timestamptz not null default now(),
  constraint fondos_anual_con_fecha check (tipo <> 'anual' or fecha_objetivo is not null),
  constraint fondos_recurrente_solo_anual check (tipo = 'anual' or not recurrente)
);
comment on table public.fondos is 'Apartados virtuales: anuales (vencimientos) y metas. El dinero sigue en la cuenta normal.';
create index fondos_categoria_idx on public.fondos (categoria_id);
create index fondos_creado_por_idx on public.fondos (creado_por);
create index fondos_activos_idx on public.fondos (tipo) where estado = 'activo';

create table public.fondos_aportes (
  id              uuid primary key default gen_random_uuid(),
  fondo_id        uuid not null references public.fondos (id) on delete cascade,
  ciclo           int not null,
  fecha           date not null default public.hoy_hn(),
  anio            smallint not null,
  mes             smallint not null check (mes between 1 and 12),
  monto           numeric(12, 2) not null check (monto <> 0),
  nota            text,
  registrado_por  uuid references public.perfiles (id) on delete set null default auth.uid(),
  creado_en       timestamptz not null default now()
);
comment on column public.fondos_aportes.monto is 'En la moneda del fondo. Negativo = retiro o ajuste.';
create index fondos_aportes_fondo_idx on public.fondos_aportes (fondo_id, ciclo);
create index fondos_aportes_mes_idx on public.fondos_aportes (anio, mes);
create index fondos_aportes_registrado_idx on public.fondos_aportes (registrado_por);

create or replace function public.aportes_antes()
returns trigger
language plpgsql
set search_path = ''
as $$
declare
  f public.fondos%rowtype;
begin
  select * into f from public.fondos where id = new.fondo_id;
  if not found then raise exception 'Apartado no encontrado'; end if;
  if f.estado <> 'activo' and coalesce(current_setting('app.decidiendo', true), '') <> '1' then
    raise exception 'Este apartado ya está cerrado';
  end if;
  if tg_op = 'INSERT' then
    new.ciclo := coalesce(new.ciclo, f.ciclo);
    new.registrado_por := coalesce(auth.uid(), new.registrado_por);
  end if;
  new.anio := coalesce(new.anio, extract(year from new.fecha)::smallint);
  new.mes := coalesce(new.mes, extract(month from new.fecha)::smallint);
  return new;
end;
$$;

create trigger aportes_antes
  before insert or update on public.fondos_aportes
  for each row execute function public.aportes_antes();

-- ───────────────────────── Wishlist ─────────────────────────

create table public.wishlist (
  id              uuid primary key default gen_random_uuid(),
  nombre          text not null check (trim(nombre) <> ''),
  nota            text,
  enlace          text,
  monto_estimado  numeric(12, 2) not null check (monto_estimado > 0),
  moneda          text not null default 'HNL' check (moneda in ('HNL', 'USD')),
  prioridad       text not null default 'media' check (prioridad in ('alta', 'media', 'baja')),
  propuesto_por   uuid not null references public.perfiles (id) default auth.uid(),
  estado          text not null default 'pendiente'
                  check (estado in ('pendiente', 'aprobada', 'en_meta', 'comprada', 'rechazada')),
  fondo_id        uuid references public.fondos (id) on delete set null,
  gasto_id        uuid references public.gastos (id) on delete set null,
  creado_en       timestamptz not null default now(),
  decidido_en     timestamptz
);
create index wishlist_estado_idx on public.wishlist (estado);
create index wishlist_propuesto_idx on public.wishlist (propuesto_por);
create index wishlist_fondo_idx on public.wishlist (fondo_id);
create index wishlist_gasto_idx on public.wishlist (gasto_id);

alter table public.fondos
  add constraint fondos_wishlist_id_fkey foreign key (wishlist_id) references public.wishlist (id) on delete set null;
create index fondos_wishlist_idx on public.fondos (wishlist_id);

create table public.wishlist_aprobaciones (
  item_id      uuid not null references public.wishlist (id) on delete cascade,
  persona_id   uuid not null references public.perfiles (id) on delete cascade,
  decision     text not null check (decision in ('aprobado', 'rechazado')),
  decidido_en  timestamptz not null default now(),
  primary key (item_id, persona_id)
);
create index wishlist_aprobaciones_persona_idx on public.wishlist_aprobaciones (persona_id);

-- Monto en lempiras con el tipo de cambio más reciente (null si es USD y no hay TC)
create or replace function public.a_lempiras_hoy(p_monto numeric, p_moneda text)
returns numeric
language sql
stable
set search_path = ''
as $$
  select case
    when p_moneda = 'HNL' then p_monto
    else p_monto * (select valor from public.tipo_cambio order by fecha desc limit 1)
  end
$$;

create or replace function public.wishlist_antes()
returns trigger
language plpgsql
set search_path = ''
as $$
declare
  v_l numeric;
  v_requiere boolean;
begin
  if exists (select 1 from public.perfiles where id = auth.uid() and rol = 'persona') and tg_op = 'INSERT' then
    new.propuesto_por := auth.uid();
  end if;
  if not exists (select 1 from public.perfiles where id = new.propuesto_por and rol = 'persona') then
    raise exception 'El item debe proponerlo Diego o Sofía';
  end if;

  v_l := public.a_lempiras_hoy(new.monto_estimado, new.moneda);
  -- Sin tipo de cambio para un monto en USD: si hay umbral, se pide aprobación por seguridad
  v_requiere := case
    when v_l is null then coalesce((select umbral_aprobacion from public.configuracion where id = 1), 0) > 0
    else public.requiere_aprobacion('hogar', v_l)
  end;

  if tg_op = 'INSERT' then
    new.estado := case when v_requiere then 'pendiente' else 'aprobada' end;
    new.decidido_en := case when v_requiere then null else now() end;
    new.fondo_id := null;
    new.gasto_id := null;
    return new;
  end if;

  if coalesce(current_setting('app.decidiendo', true), '') = '1' then
    return new;
  end if;

  -- Fuera de las funciones, el estado y los vínculos no se tocan a mano
  new.estado := old.estado;
  new.fondo_id := old.fondo_id;
  new.gasto_id := old.gasto_id;
  new.decidido_en := old.decidido_en;

  -- Si cambia el monto antes de convertirse en meta o compra, se vuelve a evaluar
  if (new.monto_estimado, new.moneda) is distinct from (old.monto_estimado, old.moneda)
     and old.estado in ('pendiente', 'aprobada') then
    new.estado := case when v_requiere then 'pendiente' else 'aprobada' end;
    new.decidido_en := case when v_requiere then null else now() end;
  end if;
  return new;
end;
$$;

create trigger wishlist_antes
  before insert or update on public.wishlist
  for each row execute function public.wishlist_antes();

create or replace function public.wishlist_despues()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if new.estado = 'pendiente' and (tg_op = 'INSERT' or old.estado <> 'pendiente'
     or (new.monto_estimado, new.moneda) is distinct from (old.monto_estimado, old.moneda)) then
    delete from public.wishlist_aprobaciones where item_id = new.id;
    insert into public.wishlist_aprobaciones (item_id, persona_id, decision)
    values (new.id, public.aprobador_implicito(new.propuesto_por), 'aprobado')
    on conflict do nothing;
  end if;
  return null;
end;
$$;

create trigger wishlist_despues
  after insert or update on public.wishlist
  for each row execute function public.wishlist_despues();

-- ───────────────────────── Aprobación compartida ─────────────────────────

-- ¿Puede quien llama decidir como p_persona? Exige PIN si es otra persona.
create or replace function public.puede_decidir_como(p_persona uuid, p_pin text)
returns boolean
language plpgsql
security definer
set search_path = ''
as $$
begin
  if not public.es_miembro() then raise exception 'Sin acceso'; end if;
  if not exists (select 1 from public.perfiles where id = p_persona and rol = 'persona') then
    raise exception 'Persona inválida';
  end if;
  if p_persona = auth.uid() then return true; end if;
  return public.verificar_pin(p_persona, p_pin);
end;
$$;

create or replace function public.decidir_wishlist(
  p_item uuid,
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
  if p_decision not in ('aprobado', 'rechazado') then raise exception 'Decisión inválida'; end if;
  if not public.puede_decidir_como(p_persona, p_pin) then return 'pin_incorrecto'; end if;

  select estado into v_estado from public.wishlist where id = p_item for update;
  if not found then raise exception 'Item no encontrado'; end if;
  if v_estado <> 'pendiente' then raise exception 'Este item ya no está pendiente'; end if;

  insert into public.wishlist_aprobaciones (item_id, persona_id, decision)
  values (p_item, p_persona, p_decision)
  on conflict (item_id, persona_id) do update set decision = excluded.decision, decidido_en = now();

  select count(*) into v_personas from public.perfiles where rol = 'persona';
  select count(*) into v_aprobados from public.wishlist_aprobaciones where item_id = p_item and decision = 'aprobado';

  v_nuevo := case
    when p_decision = 'rechazado' then 'rechazada'
    when v_aprobados >= v_personas then 'aprobada'
    else 'pendiente'
  end;

  if v_nuevo <> 'pendiente' then
    perform set_config('app.decidiendo', '1', true);
    update public.wishlist set estado = v_nuevo, decidido_en = now() where id = p_item;
    perform set_config('app.decidiendo', '', true);
  end if;
  return v_nuevo;
end;
$$;

-- ───────────────────────── Gastos: vínculos nuevos ─────────────────────────

alter table public.gastos
  add column fondo_id uuid references public.fondos (id) on delete set null,
  add column wishlist_id uuid references public.wishlist (id) on delete set null;
create index gastos_fondo_idx on public.gastos (fondo_id);
create index gastos_wishlist_idx on public.gastos (wishlist_id);
comment on column public.gastos.fondo_id is 'Pagado desde un apartado: no cuenta como gasto del mes ni pide aprobación.';

-- Eventuales → fondos anuales (fecha: día 1 del mes, el próximo que toque)
insert into public.fondos (tipo, nombre, categoria_id, monto_objetivo, moneda, fecha_objetivo, recurrente)
select
  'anual',
  coalesce(nullif(trim(p.descripcion), ''), 'Gasto anual'),
  p.categoria_id,
  p.monto,
  p.moneda,
  make_date(
    coalesce(
      p.anio,
      case when p.mes >= extract(month from public.hoy_hn())::int
           then extract(year from public.hoy_hn())::int
           else extract(year from public.hoy_hn())::int + 1 end
    ),
    p.mes,
    1
  ),
  p.recurrente
from public.presupuesto p
where p.tipo = 'eventual';

delete from public.presupuesto where tipo = 'eventual';

alter table public.presupuesto
  drop constraint presupuesto_mes_segun_tipo,
  drop constraint presupuesto_eventual_anio,
  drop constraint presupuesto_eventual_descripcion,
  drop constraint presupuesto_tipo_check,
  drop column mes,
  drop column anio,
  drop column recurrente,
  add constraint presupuesto_tipo_check check (tipo in ('fijo', 'variable'));

alter table public.gastos drop column presupuesto_id;

create or replace function public.gastos_antes()
returns trigger
language plpgsql
set search_path = ''
as $$
declare
  v_monto_l numeric;
  v_preaprobado boolean;
begin
  if new.moneda = 'HNL' then
    new.tipo_cambio := null;
  end if;
  if new.tipo = 'mesada' then
    new.fondo_id := null;
    new.wishlist_id := null;
  end if;

  v_monto_l := case when new.moneda = 'USD' then round(new.monto * new.tipo_cambio, 2) else new.monto end;

  if not exists (select 1 from public.perfiles where id = new.persona_id and rol = 'persona') then
    raise exception 'El gasto debe ser de Diego o de Sofía';
  end if;

  -- Lo que sale de un apartado o de un item ya aprobado no vuelve a pedir aprobación
  v_preaprobado := new.fondo_id is not null
    or (new.wishlist_id is not null and exists (
      select 1 from public.wishlist w where w.id = new.wishlist_id and w.estado in ('aprobada', 'en_meta', 'comprada')
    ));

  if tg_op = 'INSERT' then
    new.registrado_por := auth.uid();
    new.estado := case
      when not v_preaprobado and public.requiere_aprobacion(new.tipo, v_monto_l) then 'pendiente'
      else 'aprobado'
    end;
    return new;
  end if;

  if new.estado is distinct from old.estado
     and coalesce(current_setting('app.decidiendo', true), '') <> '1' then
    new.estado := old.estado;
  end if;

  if not v_preaprobado
     and (new.monto, new.moneda, new.tipo_cambio, new.tipo) is distinct from
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

  -- Compra directa de un item de la wishlist
  if tg_op = 'INSERT' and new.wishlist_id is not null then
    perform set_config('app.decidiendo', '1', true);
    update public.wishlist
       set estado = 'comprada', gasto_id = new.id
     where id = new.wishlist_id and estado in ('aprobada', 'en_meta');
    perform set_config('app.decidiendo', '', true);
  end if;
  return null;
end;
$$;

-- ───────────────────────── Operaciones de apartados ─────────────────────────

create or replace function public.crear_meta_desde_wishlist(
  p_item uuid,
  p_fecha_objetivo date default null,
  p_categoria uuid default null
)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  w public.wishlist%rowtype;
  v_fondo uuid;
begin
  if not public.es_miembro() then raise exception 'Sin acceso'; end if;
  select * into w from public.wishlist where id = p_item for update;
  if not found then raise exception 'Item no encontrado'; end if;
  if w.estado <> 'aprobada' then raise exception 'Solo se puede ahorrar para items aprobados'; end if;

  perform set_config('app.decidiendo', '1', true);
  insert into public.fondos (tipo, nombre, categoria_id, monto_objetivo, moneda, fecha_objetivo, wishlist_id, nota, creado_por)
  values ('meta', w.nombre, p_categoria, w.monto_estimado, w.moneda, p_fecha_objetivo, w.id, w.nota, auth.uid())
  returning id into v_fondo;
  update public.wishlist set estado = 'en_meta', fondo_id = v_fondo where id = w.id;
  perform set_config('app.decidiendo', '', true);
  return v_fondo;
end;
$$;

-- Paga desde un apartado: registra el gasto y cierra o reinicia el ciclo
create or replace function public.pagar_fondo(
  p_fondo uuid,
  p_monto numeric,
  p_moneda text,
  p_tipo_cambio numeric,
  p_fecha date,
  p_persona uuid,
  p_categoria uuid default null,
  p_descripcion text default null
)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  f public.fondos%rowtype;
  v_gasto uuid;
  v_apartado numeric;
  v_pago_en_moneda_fondo numeric;
  v_sobrante numeric;
  v_tc numeric;
begin
  if not public.es_miembro() then raise exception 'Sin acceso'; end if;
  select * into f from public.fondos where id = p_fondo for update;
  if not found then raise exception 'Apartado no encontrado'; end if;
  if f.estado <> 'activo' then raise exception 'Este apartado ya está cerrado'; end if;
  if coalesce(p_categoria, f.categoria_id) is null then raise exception 'Elige una categoría para el gasto'; end if;

  insert into public.gastos (fecha, monto, moneda, tipo_cambio, tipo, categoria_id, persona_id, descripcion, fondo_id)
  values (coalesce(p_fecha, public.hoy_hn()), p_monto, p_moneda,
          case when p_moneda = 'USD' then p_tipo_cambio end,
          'hogar', coalesce(p_categoria, f.categoria_id), p_persona,
          coalesce(nullif(trim(p_descripcion), ''), f.nombre), f.id)
  returning id into v_gasto;

  select coalesce(sum(monto), 0) into v_apartado
    from public.fondos_aportes where fondo_id = f.id and ciclo = f.ciclo;

  v_tc := coalesce(p_tipo_cambio, (select valor from public.tipo_cambio order by fecha desc limit 1));
  v_pago_en_moneda_fondo := case
    when p_moneda = f.moneda then p_monto
    when f.moneda = 'HNL' then p_monto * v_tc       -- pagó en USD un apartado en L
    else p_monto / nullif(v_tc, 0)                  -- pagó en L un apartado en USD
  end;
  v_sobrante := round(v_apartado - coalesce(v_pago_en_moneda_fondo, v_apartado), 2);

  perform set_config('app.decidiendo', '1', true);
  if f.tipo = 'anual' and f.recurrente then
    update public.fondos
       set ciclo = ciclo + 1, fecha_objetivo = (fecha_objetivo + interval '1 year')::date
     where id = f.id;
    if v_sobrante > 0 then
      insert into public.fondos_aportes (fondo_id, ciclo, fecha, monto, nota)
      values (f.id, f.ciclo + 1, coalesce(p_fecha, public.hoy_hn()), v_sobrante, 'Sobrante del ciclo anterior');
    end if;
  else
    update public.fondos set estado = 'pagado' where id = f.id;
  end if;

  if f.wishlist_id is not null then
    update public.wishlist set estado = 'comprada', gasto_id = v_gasto where id = f.wishlist_id;
  end if;
  perform set_config('app.decidiendo', '', true);

  return v_gasto;
end;
$$;

-- ───────────────────────── Seguridad ─────────────────────────

alter table public.fondos                enable row level security;
alter table public.fondos_aportes        enable row level security;
alter table public.wishlist              enable row level security;
alter table public.wishlist_aprobaciones enable row level security;

create policy "miembros gestionan fondos" on public.fondos
  for all to authenticated using ((select public.es_miembro())) with check ((select public.es_miembro()));
create policy "miembros gestionan aportes" on public.fondos_aportes
  for all to authenticated using ((select public.es_miembro())) with check ((select public.es_miembro()));
create policy "miembros gestionan wishlist" on public.wishlist
  for all to authenticated using ((select public.es_miembro())) with check ((select public.es_miembro()));
create policy "miembros leen aprobaciones de wishlist" on public.wishlist_aprobaciones
  for select to authenticated using ((select public.es_miembro()));

-- El estado de un fondo solo cambia vía pagar_fondo (o al cancelarlo a mano)
create or replace function public.fondos_antes()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  if tg_op = 'INSERT' then
    new.creado_por := coalesce(auth.uid(), new.creado_por);
    new.ciclo := 1;
    if coalesce(current_setting('app.decidiendo', true), '') <> '1' then
      new.estado := 'activo';
      new.wishlist_id := null;
    end if;
    return new;
  end if;
  if coalesce(current_setting('app.decidiendo', true), '') <> '1' then
    new.ciclo := old.ciclo;
    new.wishlist_id := old.wishlist_id;
    -- A mano solo se permite cancelar o reactivar
    if new.estado = 'pagado' and old.estado <> 'pagado' then new.estado := old.estado; end if;
    if old.estado = 'pagado' then new.estado := old.estado; end if;
  end if;
  return new;
end;
$$;

create trigger fondos_antes
  before insert or update on public.fondos
  for each row execute function public.fondos_antes();

revoke execute on function public.puede_decidir_como(uuid, text) from public, anon, authenticated;
revoke execute on function public.decidir_wishlist(uuid, uuid, text, text) from public, anon;
revoke execute on function public.crear_meta_desde_wishlist(uuid, date, uuid) from public, anon;
revoke execute on function public.pagar_fondo(uuid, numeric, text, numeric, date, uuid, uuid, text) from public, anon;
revoke execute on function public.wishlist_despues() from public, anon, authenticated;
grant execute on function public.decidir_wishlist(uuid, uuid, text, text) to authenticated;
grant execute on function public.crear_meta_desde_wishlist(uuid, date, uuid) to authenticated;
grant execute on function public.pagar_fondo(uuid, numeric, text, numeric, date, uuid, uuid, text) to authenticated;

alter publication supabase_realtime add table
  public.fondos, public.fondos_aportes, public.wishlist, public.wishlist_aprobaciones;
