-- Bloque 3: Cocina — recetas, menú semanal y lista de súper compartida.

-- ───────────────────────── Porción por persona ─────────────────────────

alter table public.perfiles
  add column porcion text not null default 'estandar' check (porcion in ('estandar', 'alta_proteina'));
comment on column public.perfiles.porcion is 'estandar = baja en grasa; alta_proteina suma cantidad_extra de cada ingrediente';
grant update (porcion) on public.perfiles to authenticated;

update public.perfiles set porcion = 'alta_proteina' where email = 'davo72699@gmail.com';

-- ───────────────────────── Recetas ─────────────────────────

create table public.recetas (
  id           uuid primary key default gen_random_uuid(),
  nombre       text not null check (trim(nombre) <> ''),
  descripcion  text,
  comidas      text[] not null default '{}'
               check (comidas <@ array['desayuno', 'almuerzo', 'cena', 'lonchera']::text[]),
  tiempo_min   smallint check (tiempo_min is null or tiempo_min between 1 and 600),
  etiquetas    text[] not null default '{}',
  pasos        text[] not null default '{}',
  creado_por   uuid references public.perfiles (id) on delete set null default auth.uid(),
  creado_en    timestamptz not null default now(),
  actualizado_en timestamptz not null default now()
);
create unique index recetas_nombre_unico on public.recetas (lower(nombre));
create index recetas_creado_por_idx on public.recetas (creado_por);

create table public.receta_ingredientes (
  id              uuid primary key default gen_random_uuid(),
  receta_id       uuid not null references public.recetas (id) on delete cascade,
  orden           smallint not null default 0,
  nombre          text not null check (trim(nombre) <> ''),
  cantidad        numeric(10, 2) check (cantidad is null or cantidad > 0),
  cantidad_extra  numeric(10, 2) not null default 0 check (cantidad_extra >= 0),
  unidad          text,
  seccion         text not null default 'Otros',
  basico          boolean not null default false
);
comment on column public.receta_ingredientes.cantidad is 'Por plato, porción estándar. Null = al gusto.';
comment on column public.receta_ingredientes.cantidad_extra is 'Se suma por plato con porción alta en proteína.';
comment on column public.receta_ingredientes.basico is 'Básico de despensa: no se agrega a la lista del súper.';
create index receta_ingredientes_receta_idx on public.receta_ingredientes (receta_id, orden);

-- ───────────────────────── Menú semanal ─────────────────────────

create table public.menu (
  id               uuid primary key default gen_random_uuid(),
  fecha            date not null,
  comida           text not null check (comida in ('desayuno', 'almuerzo', 'cena', 'lonchera')),
  receta_id        uuid references public.recetas (id) on delete set null,
  texto            text,
  para_persona     uuid references public.perfiles (id) on delete set null,
  porciones_extra  smallint not null default 0 check (porciones_extra between 0 and 10),
  nota             text,
  creado_por       uuid references public.perfiles (id) on delete set null default auth.uid(),
  creado_en        timestamptz not null default now(),
  constraint menu_receta_o_texto check (receta_id is not null or coalesce(trim(texto), '') <> '')
);
comment on column public.menu.para_persona is 'Null = para ambos';
create index menu_fecha_idx on public.menu (fecha, comida);
create index menu_receta_idx on public.menu (receta_id);
create index menu_para_idx on public.menu (para_persona);
create index menu_creado_por_idx on public.menu (creado_por);

-- ───────────────────────── Lista de súper ─────────────────────────

create table public.super_items (
  id            uuid primary key default gen_random_uuid(),
  nombre        text not null check (trim(nombre) <> ''),
  cantidad      numeric(10, 2) check (cantidad is null or cantidad > 0),
  unidad        text,
  seccion       text not null default 'Otros',
  comprado      boolean not null default false,
  comprado_en   timestamptz,
  comprado_por  uuid references public.perfiles (id) on delete set null,
  origen        text not null default 'manual' check (origen in ('manual', 'menu')),
  semana        date,
  recetas       text,
  nota          text,
  agregado_por  uuid references public.perfiles (id) on delete set null default auth.uid(),
  creado_en     timestamptz not null default now()
);
create index super_items_pendientes_idx on public.super_items (comprado, seccion);
create index super_items_semana_idx on public.super_items (semana) where origen = 'menu';
create index super_items_comprado_por_idx on public.super_items (comprado_por);
create index super_items_agregado_por_idx on public.super_items (agregado_por);

create or replace function public.super_antes()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  if tg_op = 'INSERT' then
    new.agregado_por := coalesce(auth.uid(), new.agregado_por);
  end if;
  if new.comprado and (tg_op = 'INSERT' or not old.comprado) then
    new.comprado_en := now();
    new.comprado_por := auth.uid();
  elsif not new.comprado then
    new.comprado_en := null;
    new.comprado_por := null;
  end if;
  return new;
end;
$$;

create trigger super_antes
  before insert or update on public.super_items
  for each row execute function public.super_antes();

-- Genera la lista desde el menú de una semana (lunes a domingo).
-- Reemplaza solo lo generado antes para esa semana que aún no se compró.
create or replace function public.generar_super(p_lunes date)
returns int
language plpgsql
set search_path = ''
as $$
declare
  v_n int;
begin
  if not public.es_miembro() then raise exception 'Sin acceso'; end if;

  delete from public.super_items
   where origen = 'menu' and semana = p_lunes and not comprado;

  with platos as (
    -- Un plato por persona a la que va el menú, más las porciones extra (estándar)
    select m.receta_id, p.porcion
      from public.menu m
      join public.perfiles p
        on p.rol = 'persona' and (m.para_persona is null or m.para_persona = p.id)
     where m.fecha between p_lunes and p_lunes + 6 and m.receta_id is not null
    union all
    select m.receta_id, 'estandar'
      from public.menu m
      cross join generate_series(1, greatest(m.porciones_extra, 0)) g
     where m.fecha between p_lunes and p_lunes + 6 and m.receta_id is not null and m.porciones_extra > 0
  ),
  necesidades as (
    select
      lower(trim(i.nombre)) as clave,
      coalesce(i.unidad, '') as unidad,
      i.seccion,
      min(i.nombre) as nombre,
      sum(i.cantidad + case when pl.porcion = 'alta_proteina' then i.cantidad_extra else 0 end) as cantidad,
      string_agg(distinct r.nombre, ', ') as recetas
    from platos pl
    join public.receta_ingredientes i on i.receta_id = pl.receta_id and not i.basico
    join public.recetas r on r.id = pl.receta_id
    group by 1, 2, 3
  )
  insert into public.super_items (nombre, cantidad, unidad, seccion, origen, semana, recetas)
  select n.nombre, round(n.cantidad, 2), nullif(n.unidad, ''), n.seccion, 'menu', p_lunes, n.recetas
    from necesidades n
   -- Lo que ya se compró de esta semana no se vuelve a pedir
   where not exists (
     select 1 from public.super_items s
      where s.origen = 'menu' and s.semana = p_lunes and s.comprado
        and lower(trim(s.nombre)) = n.clave and coalesce(s.unidad, '') = n.unidad
   );

  get diagnostics v_n = row_count;
  return v_n;
end;
$$;

-- ───────────────────────── Seguridad y tiempo real ─────────────────────────

alter table public.recetas             enable row level security;
alter table public.receta_ingredientes enable row level security;
alter table public.menu                enable row level security;
alter table public.super_items         enable row level security;

create policy "miembros gestionan recetas" on public.recetas
  for all to authenticated using ((select public.es_miembro())) with check ((select public.es_miembro()));
create policy "miembros gestionan ingredientes" on public.receta_ingredientes
  for all to authenticated using ((select public.es_miembro())) with check ((select public.es_miembro()));
create policy "miembros gestionan menu" on public.menu
  for all to authenticated using ((select public.es_miembro())) with check ((select public.es_miembro()));
create policy "miembros gestionan super" on public.super_items
  for all to authenticated using ((select public.es_miembro())) with check ((select public.es_miembro()));

revoke execute on function public.generar_super(date) from public, anon;
grant execute on function public.generar_super(date) to authenticated;

alter publication supabase_realtime add table
  public.recetas, public.receta_ingredientes, public.menu, public.super_items;

-- ───────────────────────── Recetas iniciales ─────────────────────────
-- Sin pescado ni mariscos, sin carbohidratos simples, bajas en grasa.
-- Cantidades por plato. La tercera columna es lo que se suma en la porción alta en proteína.
-- [nombre, cantidad, extra, unidad, sección, básico]

do $$
declare
  r jsonb;
  i jsonb;
  v_id uuid;
  n int;
begin
  for r in select * from jsonb_array_elements($json$[
    {"n":"Omelette de claras con espinaca","d":"Desayuno ligero y alto en proteína.","c":["desayuno"],"t":15,
     "e":["Alta en proteína","Baja en grasa"],
     "i":[["Huevo",1,2,"unidad","Lácteos y huevos"],["Claras de huevo",120,60,"ml","Lácteos y huevos"],
          ["Espinaca",1,null,"taza","Frutas y verduras"],["Chile dulce",0.25,null,"unidad","Frutas y verduras"],
          ["Cebolla",0.25,null,"unidad","Frutas y verduras"],["Queso fresco bajo en grasa",30,null,"g","Lácteos y huevos"],
          ["Tortilla de maíz",1,1,"unidad","Panadería y tortillas"],["Aceite en spray",null,null,"","Granos y abarrotes",true],
          ["Sal y pimienta",null,null,"","Especias y condimentos",true]],
     "p":["Pica el chile dulce y la cebolla; sofríe 2 minutos con un toque de spray.","Agrega la espinaca hasta que se marchite.","Bate el huevo con las claras, sal y pimienta; vierte sobre las verduras a fuego medio-bajo.","Cuando cuaje, agrega el queso, dobla y sirve con la tortilla caliente."]},

    {"n":"Avena cocida con canela y yogurt griego","d":"Sin azúcar: endulza la fruta.","c":["desayuno"],"t":10,
     "e":["Alta en proteína","Sin azúcar"],
     "i":[["Avena en hojuelas",40,20,"g","Granos y abarrotes"],["Leche descremada",200,100,"ml","Lácteos y huevos"],
          ["Yogurt griego natural sin azúcar",100,100,"g","Lácteos y huevos"],["Fresas",0.5,null,"taza","Frutas y verduras"],
          ["Semillas de chía",1,null,"cdta","Granos y abarrotes"],["Canela en polvo",null,null,"","Especias y condimentos",true]],
     "p":["Cocina la avena con la leche y la canela 5 minutos, moviendo.","Sirve tibia con el yogurt griego encima.","Termina con fresas picadas y chía."]},

    {"n":"Huevos rancheros ligeros","d":"Salsa de tomate casera, sin freír la tortilla.","c":["desayuno"],"t":20,
     "e":["Alta en proteína"],
     "i":[["Huevo",2,2,"unidad","Lácteos y huevos"],["Tomate",1,null,"unidad","Frutas y verduras"],
          ["Cebolla",0.25,null,"unidad","Frutas y verduras"],["Chile dulce",0.25,null,"unidad","Frutas y verduras"],
          ["Culantro",null,null,"","Frutas y verduras"],["Tortilla de maíz",1,1,"unidad","Panadería y tortillas"],
          ["Aguacate",30,null,"g","Frutas y verduras"],["Aceite en spray",null,null,"","Granos y abarrotes",true],
          ["Sal y pimienta",null,null,"","Especias y condimentos",true]],
     "p":["Licúa el tomate con la cebolla y el chile; cocina la salsa 8 minutos.","Calienta la tortilla en comal, sin aceite.","Cocina los huevos estrellados con spray.","Sirve los huevos sobre la tortilla, baña con salsa y termina con aguacate y culantro."]},

    {"n":"Pollo al limón con camote y vegetales al horno","d":"Una bandeja, sirve para la lonchera del día siguiente.","c":["almuerzo","lonchera"],"t":45,
     "e":["Alta en proteína","Baja en grasa","Para lonchera"],
     "i":[["Pechuga de pollo sin piel",150,100,"g","Carnes y pollo"],["Limón",1,null,"unidad","Frutas y verduras"],
          ["Ajo",1,null,"diente","Frutas y verduras"],["Camote",120,60,"g","Frutas y verduras"],
          ["Brócoli",1,null,"taza","Frutas y verduras"],["Zanahoria",0.5,null,"unidad","Frutas y verduras"],
          ["Aceite de oliva",1,null,"cdta","Granos y abarrotes"],["Orégano",null,null,"","Especias y condimentos",true],
          ["Sal y pimienta",null,null,"","Especias y condimentos",true]],
     "p":["Marina el pollo con jugo de limón, ajo, orégano, sal y pimienta (mínimo 15 minutos).","Corta el camote en cubos y la zanahoria en rodajas; mezcla con el aceite.","Hornea todo a 200 °C por 25 minutos; agrega el brócoli los últimos 10.","Deja reposar el pollo 5 minutos antes de rebanar."]},

    {"n":"Bistec encebollado con pataste y ensalada","d":"Res magra, cebolla bien suave y pataste salteado.","c":["almuerzo","lonchera"],"t":35,
     "e":["Alta en proteína","Para lonchera"],
     "i":[["Bistec de res magro (posta)",150,100,"g","Carnes y pollo"],["Cebolla",0.5,null,"unidad","Frutas y verduras"],
          ["Tomate",1,null,"unidad","Frutas y verduras"],["Chile dulce",0.5,null,"unidad","Frutas y verduras"],
          ["Pataste",1,null,"unidad","Frutas y verduras"],["Lechuga",1,null,"taza","Frutas y verduras"],
          ["Pepino",0.5,null,"unidad","Frutas y verduras"],["Aceite de oliva",1,null,"cdta","Granos y abarrotes"],
          ["Sal y pimienta",null,null,"","Especias y condimentos",true]],
     "p":["Sazona el bistec y séllalo 2 minutos por lado en sartén caliente.","En la misma sartén cocina la cebolla, el tomate y el chile en tiras con un chorrito de agua; regresa la carne 5 minutos.","Pela y corta el pataste; saltéalo hasta que esté tierno.","Sirve con ensalada de lechuga y pepino."]},

    {"n":"Fajitas de pollo con chile dulce","d":"Tortilla de maíz o, para algo más ligero, hojas de lechuga.","c":["almuerzo","cena"],"t":25,
     "e":["Alta en proteína","Baja en grasa"],
     "i":[["Pechuga de pollo sin piel",150,100,"g","Carnes y pollo"],["Chile dulce",1,null,"unidad","Frutas y verduras"],
          ["Cebolla",0.5,null,"unidad","Frutas y verduras"],["Tortilla de maíz",2,1,"unidad","Panadería y tortillas"],
          ["Limón",0.5,null,"unidad","Frutas y verduras"],["Yogurt griego natural sin azúcar",2,null,"cda","Lácteos y huevos"],
          ["Comino",null,null,"","Especias y condimentos",true],["Aceite en spray",null,null,"","Granos y abarrotes",true]],
     "p":["Corta el pollo, el chile y la cebolla en tiras.","Sazona el pollo con comino, sal y limón; cocínalo a fuego alto 6 minutos.","Agrega las verduras y saltea 4 minutos más.","Sirve en tortillas calientes con una cucharada de yogurt griego."]},

    {"n":"Albóndigas de res en salsa de tomate con ayote","d":"Avena en lugar de pan para amarrar.","c":["almuerzo","lonchera"],"t":40,
     "e":["Alta en proteína","Para lonchera"],
     "i":[["Carne molida de res 90/10",150,100,"g","Carnes y pollo"],["Claras de huevo",30,null,"ml","Lácteos y huevos"],
          ["Avena en hojuelas",15,null,"g","Granos y abarrotes"],["Tomate",2,null,"unidad","Frutas y verduras"],
          ["Cebolla",0.25,null,"unidad","Frutas y verduras"],["Ajo",1,null,"diente","Frutas y verduras"],
          ["Ayote tierno",1,null,"unidad","Frutas y verduras"],["Albahaca",null,null,"","Especias y condimentos",true],
          ["Sal y pimienta",null,null,"","Especias y condimentos",true]],
     "p":["Mezcla la carne con las claras, la avena, sal y pimienta; forma bolitas.","Licúa el tomate con la cebolla y el ajo; hierve la salsa 5 minutos.","Cocina las albóndigas en la salsa, tapadas, 15 minutos.","Agrega el ayote en medias lunas los últimos 5 minutos y termina con albahaca."]},

    {"n":"Lomo de cerdo al horno con puré de coliflor","d":"Lomo es el corte más magro del cerdo.","c":["almuerzo"],"t":50,
     "e":["Alta en proteína","Sin harinas"],
     "i":[["Lomo de cerdo",150,100,"g","Carnes y pollo"],["Coliflor",1.5,null,"taza","Frutas y verduras"],
          ["Leche descremada",50,null,"ml","Lácteos y huevos"],["Ejotes",1,null,"taza","Frutas y verduras"],
          ["Ajo",1,null,"diente","Frutas y verduras"],["Mostaza",1,null,"cdta","Granos y abarrotes"],
          ["Romero",null,null,"","Especias y condimentos",true],["Sal y pimienta",null,null,"","Especias y condimentos",true]],
     "p":["Unta el lomo con mostaza, ajo, romero, sal y pimienta.","Hornea a 200 °C por 30–35 minutos; deja reposar 5.","Hierve la coliflor 10 minutos y hazla puré con la leche.","Cocina los ejotes al vapor 6 minutos y sirve todo junto."]},

    {"n":"Tacos de carne en hojas de lechuga","d":"Cena rápida y ligera.","c":["cena"],"t":20,
     "e":["Alta en proteína","Sin harinas"],
     "i":[["Carne molida de res 90/10",120,80,"g","Carnes y pollo"],["Lechuga romana",4,null,"hoja","Frutas y verduras"],
          ["Tomate",1,null,"unidad","Frutas y verduras"],["Cebolla",0.25,null,"unidad","Frutas y verduras"],
          ["Culantro",null,null,"","Frutas y verduras"],["Limón",0.5,null,"unidad","Frutas y verduras"],
          ["Queso fresco bajo en grasa",20,null,"g","Lácteos y huevos"],["Comino",null,null,"","Especias y condimentos",true]],
     "p":["Cocina la carne con comino, sal y la mitad de la cebolla hasta dorar; escurre la grasa.","Pica el tomate con el resto de la cebolla, culantro y limón.","Arma los tacos en las hojas de lechuga y termina con queso desmoronado."]},

    {"n":"Ensalada de pollo a la plancha con garbanzos","d":"Buena para la lonchera: aliña al momento de comer.","c":["cena","lonchera"],"t":20,
     "e":["Alta en proteína","Para lonchera"],
     "i":[["Pechuga de pollo sin piel",120,80,"g","Carnes y pollo"],["Lechuga",2,null,"taza","Frutas y verduras"],
          ["Tomate cherry",0.5,null,"taza","Frutas y verduras"],["Pepino",0.5,null,"unidad","Frutas y verduras"],
          ["Aguacate",40,null,"g","Frutas y verduras"],["Garbanzos cocidos",0.25,0.25,"taza","Granos y abarrotes"],
          ["Limón",1,null,"unidad","Frutas y verduras"],["Aceite de oliva",1,null,"cdta","Granos y abarrotes"],
          ["Sal y pimienta",null,null,"","Especias y condimentos",true]],
     "p":["Sazona el pollo y cocínalo a la plancha 5–6 minutos por lado; rebánalo.","Mezcla lechuga, tomate, pepino y garbanzos.","Aliña con limón, aceite, sal y pimienta; agrega el pollo y el aguacate al servir."]},

    {"n":"Sopa de pollo con verduras","d":"Sin fideos ni arroz; llena y es ligera.","c":["cena"],"t":45,
     "e":["Alta en proteína","Baja en grasa"],
     "i":[["Pechuga de pollo sin piel",120,80,"g","Carnes y pollo"],["Pataste",0.5,null,"unidad","Frutas y verduras"],
          ["Zanahoria",1,null,"unidad","Frutas y verduras"],["Apio",1,null,"rama","Frutas y verduras"],
          ["Ayote tierno",0.5,null,"unidad","Frutas y verduras"],["Cebolla",0.25,null,"unidad","Frutas y verduras"],
          ["Ajo",1,null,"diente","Frutas y verduras"],["Culantro",null,null,"","Frutas y verduras"],
          ["Sal y pimienta",null,null,"","Especias y condimentos",true]],
     "p":["Hierve el pollo con cebolla, ajo y sal en 3 tazas de agua, 20 minutos.","Saca el pollo y desmenúzalo.","Agrega al caldo la zanahoria, el apio y el pataste; cocina 10 minutos.","Suma el ayote y el pollo 5 minutos más; termina con culantro."]},

    {"n":"Revoltillo de huevo con hongos y espinaca","d":"Cena de 15 minutos.","c":["cena","desayuno"],"t":15,
     "e":["Alta en proteína","Baja en grasa"],
     "i":[["Huevo",2,1,"unidad","Lácteos y huevos"],["Claras de huevo",60,60,"ml","Lácteos y huevos"],
          ["Hongos",0.5,null,"taza","Frutas y verduras"],["Espinaca",1,null,"taza","Frutas y verduras"],
          ["Tomate",0.5,null,"unidad","Frutas y verduras"],["Tortilla de maíz",1,null,"unidad","Panadería y tortillas"],
          ["Aceite en spray",null,null,"","Granos y abarrotes",true],["Sal y pimienta",null,null,"","Especias y condimentos",true]],
     "p":["Saltea los hongos con spray 4 minutos; agrega la espinaca y el tomate.","Bate huevos y claras con sal y pimienta; incorpóralos y mueve suave hasta que cuajen.","Sirve con la tortilla caliente."]}
  ]$json$::jsonb)
  loop
    v_id := null;
    insert into public.recetas (nombre, descripcion, comidas, tiempo_min, etiquetas, pasos)
    values (
      r->>'n', r->>'d',
      array(select jsonb_array_elements_text(r->'c')),
      (r->>'t')::smallint,
      array(select jsonb_array_elements_text(r->'e')),
      array(select jsonb_array_elements_text(r->'p'))
    )
    on conflict do nothing
    returning id into v_id;

    if v_id is null then continue; end if;
    n := 0;
    for i in select * from jsonb_array_elements(r->'i')
    loop
      n := n + 1;
      insert into public.receta_ingredientes (receta_id, orden, nombre, cantidad, cantidad_extra, unidad, seccion, basico)
      values (
        v_id, n, i->>0,
        nullif(i->>1, '')::numeric,
        coalesce(nullif(i->>2, '')::numeric, 0),
        nullif(i->>3, ''),
        i->>4,
        coalesce((i->>5)::boolean, false)
      );
    end loop;
  end loop;
end $$;
