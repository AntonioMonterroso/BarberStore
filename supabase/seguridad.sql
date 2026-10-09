-- ==========================================================================================
-- IMPERIO STORE BARBER — SEGURIDAD (RLS + funciones RPC)
-- Ejecuta DESPUÉS de schema.sql, en el SQL Editor de Supabase. Se puede repetir sin problema.
--
-- Qué cambia respecto a la versión anterior:
--   * Los clientes (anónimos) YA NO leen ni modifican directamente clientes, citas, visitas,
--     lista de espera, reseñas ni ventas. Todo pasa por funciones controladas (RPC).
--   * El panel solo lo usa quien esté en la tabla "admins" (no cualquier usuario autenticado).
--   * Los precios de productos los pone el servidor; el cliente ya no puede manipularlos.
--   * "Mis citas" exige teléfono + token del dispositivo (se guarda al agendar).
--
-- IMPORTANTE en el panel de Supabase: Authentication > Providers > Email > desactiva
-- "Allow new users to sign up". Así nadie puede crearse una cuenta por su cuenta.
-- ==========================================================================================

-- ---------------------------------------------------------------------------------------
-- 1. Administradores
-- ---------------------------------------------------------------------------------------
create table if not exists admins (email text primary key);
alter table admins enable row level security;
revoke all on admins from anon, authenticated;

-- Los usuarios que existen HOY en Authentication > Users pasan a ser administradores.
insert into admins (email)
  select lower(email) from auth.users where email is not null
  on conflict do nothing;

create or replace function es_admin() returns boolean
language sql stable security definer set search_path = public as $$
  select exists (select 1 from admins where email = lower(coalesce(auth.jwt() ->> 'email', '')));
$$;
revoke all on function es_admin() from public;
grant execute on function es_admin() to anon, authenticated;

-- ---------------------------------------------------------------------------------------
-- 2. Anti-traslape de citas (dos clientes no pueden tomar el mismo horario)
-- ---------------------------------------------------------------------------------------
alter table citas drop constraint if exists citas_sin_traslape;
alter table citas add constraint citas_sin_traslape
  exclude using gist (tsrange(fecha + hora_inicio, fecha + hora_fin) with &&)
  where (estado in ('confirmada','completada'));

-- ---------------------------------------------------------------------------------------
-- 3. Políticas: se borran TODAS las existentes y se recrean (así no queda ninguna abierta)
-- ---------------------------------------------------------------------------------------
do $$
declare r record;
begin
  for r in
    select policyname, tablename from pg_policies
    where schemaname = 'public' and tablename in
      ('config_negocio','horarios','bloqueos','servicios','estilos_corte','clientes','visitas',
       'citas','waitlist','resenas','productos','ventas_producto','gastos')
  loop
    execute format('drop policy %I on public.%I', r.policyname, r.tablename);
  end loop;
end $$;

alter table config_negocio  enable row level security;
alter table horarios        enable row level security;
alter table bloqueos        enable row level security;
alter table servicios       enable row level security;
alter table estilos_corte   enable row level security;
alter table clientes        enable row level security;
alter table visitas         enable row level security;
alter table citas           enable row level security;
alter table waitlist        enable row level security;
alter table resenas         enable row level security;
alter table productos       enable row level security;
alter table ventas_producto enable row level security;
alter table gastos          enable row level security;

-- Lectura pública SOLO de lo que la página muestra
create policy "publico lee config"    on config_negocio for select using (true);
create policy "publico lee horarios"  on horarios       for select using (true);
create policy "publico lee bloqueos"  on bloqueos       for select using (true);
create policy "publico lee servicios" on servicios      for select using (true);
create policy "publico lee estilos"   on estilos_corte  for select using (true);
create policy "publico lee productos" on productos      for select using (true);

-- El motivo de un bloqueo ("médico", "viaje"...) es privado: el público solo ve fecha y horas.
revoke select on bloqueos from anon;
grant select (id, fecha, hora_inicio, hora_fin, todo_el_dia) on bloqueos to anon;

-- Administradores: acceso total a todo
create policy "admin todo config"    on config_negocio  for all using (es_admin()) with check (es_admin());
create policy "admin todo horarios"  on horarios        for all using (es_admin()) with check (es_admin());
create policy "admin todo bloqueos"  on bloqueos        for all using (es_admin()) with check (es_admin());
create policy "admin todo servicios" on servicios       for all using (es_admin()) with check (es_admin());
create policy "admin todo estilos"   on estilos_corte   for all using (es_admin()) with check (es_admin());
create policy "admin todo productos" on productos       for all using (es_admin()) with check (es_admin());
create policy "admin todo clientes"  on clientes        for all using (es_admin()) with check (es_admin());
create policy "admin todo visitas"   on visitas         for all using (es_admin()) with check (es_admin());
create policy "admin todo citas"     on citas           for all using (es_admin()) with check (es_admin());
create policy "admin todo waitlist"  on waitlist        for all using (es_admin()) with check (es_admin());
create policy "admin todo resenas"   on resenas         for all using (es_admin()) with check (es_admin());
create policy "admin todo ventas"    on ventas_producto for all using (es_admin()) with check (es_admin());
create policy "admin todo gastos"    on gastos          for all using (es_admin()) with check (es_admin());
-- (clientes, citas, visitas, waitlist, reseñas, ventas y gastos: el público NO tiene acceso directo)

-- ---------------------------------------------------------------------------------------
-- 4. Fotos (bucket "imagenes"): lectura pública, subir/borrar solo administradores
-- ---------------------------------------------------------------------------------------
insert into storage.buckets (id, name, public) values ('imagenes','imagenes', true)
  on conflict (id) do nothing;
update storage.buckets set file_size_limit = 15728640 where id = 'imagenes';

drop policy if exists "imagenes lectura publica" on storage.objects;
drop policy if exists "imagenes admin sube"      on storage.objects;
drop policy if exists "imagenes admin borra"     on storage.objects;
create policy "imagenes lectura publica" on storage.objects for select
  using (bucket_id = 'imagenes');
create policy "imagenes admin sube" on storage.objects for insert
  with check (bucket_id = 'imagenes' and es_admin());
create policy "imagenes admin borra" on storage.objects for delete
  using (bucket_id = 'imagenes' and es_admin());

-- ---------------------------------------------------------------------------------------
-- 5. Funciones internas (no se exponen)
-- ---------------------------------------------------------------------------------------
create or replace function _tel(p text) returns text
language sql immutable as $$ select regexp_replace(coalesce(p, ''), '\D', '', 'g') $$;

-- Busca al cliente por teléfono o lo crea. Devuelve jsonb; el token solo se entrega si el
-- cliente es nuevo o si quien llama ya lo tenía (así conocer un teléfono no da acceso).
create or replace function _cliente_obtener(p_nombre text, p_telefono text, p_ref text, p_token uuid)
returns jsonb
language plpgsql security definer set search_path = public as $$
declare
  v_tel text := _tel(p_telefono);
  v_nom text := left(btrim(coalesce(p_nombre, '')), 80);
  v_c clientes; v_ref uuid; v_cod text; v_base text; v_try int := 0; v_nuevo boolean := false;
begin
  if length(v_nom) < 2 then raise exception 'nombre_invalido'; end if;
  if length(v_tel) < 8 or length(v_tel) > 15 then raise exception 'telefono_invalido'; end if;

  select * into v_c from clientes where telefono = v_tel;
  if not found then
    if btrim(coalesce(p_ref, '')) <> '' then
      select cl.id into v_ref from clientes cl where cl.codigo_referido = upper(btrim(p_ref));
    end if;
    v_base := upper(left(regexp_replace(
                translate(v_nom, 'áéíóúüñÁÉÍÓÚÜÑ', 'aeiouunAEIOUUN'), '[^A-Za-z]', '', 'g'), 4));
    if v_base = '' then v_base := 'CLI'; end if;
    loop
      v_cod := v_base || (1000 + floor(random() * 9000))::int;
      begin
        insert into clientes (nombre, telefono, codigo_referido, referido_por)
          values (v_nom, v_tel, v_cod, v_ref) returning * into v_c;
        v_nuevo := true;
        exit;
      exception when unique_violation then
        select * into v_c from clientes where telefono = v_tel;   -- otro lo creó al mismo tiempo
        if found then exit; end if;
        v_try := v_try + 1;
        if v_try > 8 then raise; end if;                          -- colisión de código repetida
      end;
    end loop;
  end if;

  return jsonb_build_object(
    'id', v_c.id, 'nombre', v_c.nombre, 'codigo_referido', v_c.codigo_referido, 'nuevo', v_nuevo,
    'token', case when v_nuevo or p_token = v_c.token_acceso then v_c.token_acceso end);
end $$;

-- id del cliente si teléfono + token coinciden; si no, null
create or replace function _cliente_auth(p_telefono text, p_token uuid) returns uuid
language sql stable security definer set search_path = public as $$
  select id from clientes
  where telefono = _tel(p_telefono) and p_token is not null and token_acceso = p_token
$$;

revoke all on function _tel(text) from public, anon, authenticated;
revoke all on function _cliente_obtener(text, text, text, uuid) from public, anon, authenticated;
revoke all on function _cliente_auth(text, uuid) from public, anon, authenticated;

-- ---------------------------------------------------------------------------------------
-- 6. Funciones públicas (lo único que puede hacer un visitante)
-- ---------------------------------------------------------------------------------------

-- Horarios ocupados (sin datos de clientes) para pintar la disponibilidad
create or replace function horarios_ocupados(p_desde date, p_hasta date)
returns table (fecha date, hora_inicio time, hora_fin time, estado text)
language sql stable security definer set search_path = public as $$
  select c.fecha, c.hora_inicio, c.hora_fin, c.estado
  from citas c
  where c.fecha between p_desde and least(p_hasta, p_desde + 90) and c.estado <> 'cancelada'
$$;

-- Reseñas para la página (sin exponer clientes)
create or replace function resenas_publicas()
returns table (calificacion int, comentario text, nombre text, creado_en timestamptz)
language sql stable security definer set search_path = public as $$
  select r.calificacion, r.comentario,
         coalesce(nullif(btrim(r.nombre), ''), split_part(cl.nombre, ' ', 1)) as nombre,
         r.creado_en
  from resenas r
  left join citas c on c.id = r.cita_id
  left join clientes cl on cl.id = c.cliente_id
  order by r.creado_en desc
$$;

create or replace function enviar_resena(p_calificacion int, p_comentario text, p_nombre text)
returns void
language plpgsql security definer set search_path = public as $$
begin
  if p_calificacion is null or p_calificacion not between 1 and 5 then raise exception 'calificacion_invalida'; end if;
  insert into resenas (calificacion, comentario, nombre)
    values (p_calificacion, left(btrim(coalesce(p_comentario, '')), 600), left(btrim(coalesce(p_nombre, '')), 40));
end $$;

-- Reservar: valida todo en el servidor y crea cliente + visita + citas + productos de una vez.
-- p_items:     [{"servicio_id": 1, "etiqueta": "Papá"}, ...]   (se agendan uno tras otro)
-- p_productos: [{"producto_id": 3, "cantidad": 2}, ...]
-- Devuelve {ok:true,...}, {conflicto:{...}} si ya tiene cita ese día, o {error:"codigo"}.
create or replace function reservar(
  p_nombre text, p_telefono text, p_codigo_ref text, p_token uuid,
  p_estilo_id int, p_fecha date, p_hora time, p_items jsonb,
  p_productos jsonb default '[]'::jsonb, p_forzar boolean default false
) returns jsonb
language plpgsql security definer set search_path = public as $$
declare
  v_tz constant text := 'America/Guatemala';
  v_ahora timestamp := now() at time zone v_tz;
  v_h horarios; v_s servicios; v_p productos; v_it jsonb;
  v_ini int; v_total int := 0; v_cursor int; v_fin_i int; v_cant int;
  v_cli jsonb; v_cid uuid; v_visita uuid; v_cita uuid; v_citas uuid[] := '{}';
  v_ex record; v_n int; v_estilo int; v_prods jsonb := '[]'::jsonb;
begin
  if p_fecha is null or p_hora is null or p_items is null
     or jsonb_typeof(p_items) <> 'array' or jsonb_array_length(p_items) not between 1 and 8 then
    return jsonb_build_object('error', 'datos_invalidos');
  end if;
  if p_productos is null or jsonb_typeof(p_productos) <> 'array' or jsonb_array_length(p_productos) > 20 then
    return jsonb_build_object('error', 'datos_invalidos');
  end if;
  if p_fecha < v_ahora::date or p_fecha > v_ahora::date + 60 then
    return jsonb_build_object('error', 'fecha_invalida');
  end if;

  select * into v_h from horarios where dia_semana = extract(dow from p_fecha)::int;
  if not found or not v_h.activo then return jsonb_build_object('error', 'cerrado'); end if;

  v_ini := extract(hour from p_hora)::int * 60 + extract(minute from p_hora)::int;
  if p_fecha = v_ahora::date and v_ini < extract(hour from v_ahora)::int * 60 + extract(minute from v_ahora)::int then
    return jsonb_build_object('error', 'hora_pasada');
  end if;

  -- duración total según los servicios REALES (no lo que diga el navegador)
  for v_it in select * from jsonb_array_elements(p_items) loop
    select * into v_s from servicios where id = (v_it ->> 'servicio_id')::int and activo;
    if not found then return jsonb_build_object('error', 'servicio_invalido'); end if;
    v_total := v_total + v_s.duracion_minutos;
  end loop;

  if v_ini < extract(hour from v_h.hora_inicio)::int * 60 + extract(minute from v_h.hora_inicio)::int
     or v_ini + v_total > extract(hour from v_h.hora_fin)::int * 60 + extract(minute from v_h.hora_fin)::int then
    return jsonb_build_object('error', 'fuera_de_horario');
  end if;

  if exists (select 1 from bloqueos b where b.fecha = p_fecha and (
        b.todo_el_dia
        or (b.hora_inicio is not null and b.hora_fin is not null
            and v_ini < extract(hour from b.hora_fin)::int * 60 + extract(minute from b.hora_fin)::int
            and v_ini + v_total > extract(hour from b.hora_inicio)::int * 60 + extract(minute from b.hora_inicio)::int)
     )) then
    return jsonb_build_object('error', 'bloqueado');
  end if;

  v_cli := _cliente_obtener(p_nombre, p_telefono, p_codigo_ref, p_token);
  v_cid := (v_cli ->> 'id')::uuid;

  -- tope contra abuso: máximo 10 citas futuras confirmadas por cliente
  select count(*) into v_n from citas where cliente_id = v_cid and estado = 'confirmada' and fecha >= v_ahora::date;
  if v_n >= 10 then return jsonb_build_object('error', 'limite_citas'); end if;

  if not p_forzar then
    select c.hora_inicio, s.nombre, count(*) over () as n into v_ex
    from citas c left join servicios s on s.id = c.servicio_id
    where c.cliente_id = v_cid and c.fecha = p_fecha and c.estado = 'confirmada'
    order by c.hora_inicio limit 1;
    if found then
      return jsonb_build_object('conflicto', jsonb_build_object(
        'hora_inicio', v_ex.hora_inicio, 'servicio', v_ex.nombre, 'cantidad', v_ex.n));
    end if;
  end if;

  begin  -- si algo falla aquí dentro, se deshace TODO (visita, citas, stock)
    if p_estilo_id is not null and exists (select 1 from estilos_corte where id = p_estilo_id and activo) then
      v_estilo := p_estilo_id;
      update clientes set estilo_preferido_id = v_estilo where id = v_cid;
    end if;

    insert into visitas (cliente_id, fecha) values (v_cid, p_fecha) returning id into v_visita;

    v_cursor := v_ini;
    for v_it in select * from jsonb_array_elements(p_items) loop
      select * into v_s from servicios where id = (v_it ->> 'servicio_id')::int;
      v_fin_i := v_cursor + v_s.duracion_minutos;
      insert into citas (cliente_id, servicio_id, estilo_id, visita_id, etiqueta, fecha, hora_inicio, hora_fin, estado)
        values (v_cid, v_s.id, v_estilo, v_visita, left(btrim(coalesce(v_it ->> 'etiqueta', '')), 30), p_fecha,
                make_time(v_cursor / 60, v_cursor % 60, 0), make_time(v_fin_i / 60, v_fin_i % 60, 0), 'confirmada')
        returning id into v_cita;
      v_citas := v_citas || v_cita;
      v_cursor := v_fin_i;
    end loop;

    for v_it in select * from jsonb_array_elements(p_productos) loop
      v_cant := coalesce((v_it ->> 'cantidad')::int, 0);
      if v_cant < 1 then continue; end if;
      if v_cant > 20 then raise exception 'datos_invalidos'; end if;
      select * into v_p from productos where id = (v_it ->> 'producto_id')::int and activo;
      if not found then raise exception 'producto_invalido'; end if;
      if v_p.stock is not null then
        update productos set stock = stock - v_cant where id = v_p.id and stock >= v_cant;
        if not found then raise exception 'sin_stock'; end if;
      end if;
      insert into ventas_producto (producto_id, visita_id, cliente_id, cantidad, precio_unit, fecha)
        values (v_p.id, v_visita, v_cid, v_cant, v_p.precio, p_fecha);
      v_prods := v_prods || jsonb_build_object('producto_id', v_p.id, 'cantidad', v_cant, 'precio_unit', v_p.precio);
    end loop;
  exception
    when exclusion_violation then return jsonb_build_object('error', 'ocupado');
    when raise_exception then return jsonb_build_object('error', sqlerrm);
  end;

  return jsonb_build_object(
    'ok', true,
    'cliente', jsonb_build_object('id', v_cid, 'nombre', v_cli ->> 'nombre', 'codigo_referido', v_cli ->> 'codigo_referido'),
    'token', v_cli -> 'token',
    'visita_id', v_visita, 'cita_id', v_citas[1], 'citas', to_jsonb(v_citas),
    'hora_fin', make_time(v_cursor / 60, v_cursor % 60, 0), 'productos', v_prods);
end $$;

-- "Mis citas": solo con teléfono + token del dispositivo
create or replace function mis_datos(p_telefono text, p_token uuid) returns jsonb
language plpgsql stable security definer set search_path = public as $$
declare v_cid uuid := _cliente_auth(p_telefono, p_token);
begin
  if v_cid is null then return null; end if;
  return jsonb_build_object(
    'cliente', (select jsonb_build_object('id', id, 'nombre', nombre, 'telefono', telefono,
                  'puntos_actuales', puntos_actuales, 'estilo_preferido_id', estilo_preferido_id,
                  'codigo_referido', codigo_referido) from clientes where id = v_cid),
    'citas', coalesce((
      select jsonb_agg(jsonb_build_object(
        'id', c.id, 'visita_id', c.visita_id, 'servicio_id', c.servicio_id, 'estilo_id', c.estilo_id,
        'etiqueta', c.etiqueta, 'fecha', c.fecha, 'hora_inicio', c.hora_inicio, 'hora_fin', c.hora_fin,
        'estado', c.estado,
        'servicios', jsonb_build_object('nombre', s.nombre, 'precio', s.precio),
        'estilos_corte', case when e.id is null then null else jsonb_build_object('nombre', e.nombre) end)
        order by c.fecha desc, c.hora_inicio)
      from citas c
      left join servicios s on s.id = c.servicio_id
      left join estilos_corte e on e.id = c.estilo_id
      where c.cliente_id = v_cid), '[]'::jsonb),
    'waitlist', coalesce((
      select jsonb_agg(jsonb_build_object('id', w.id, 'fecha_deseada', w.fecha_deseada, 'estado', w.estado))
      from waitlist w where w.cliente_id = v_cid), '[]'::jsonb));
end $$;

-- Cancelar: solo citas futuras y confirmadas del propio cliente
create or replace function cancelar_citas(p_telefono text, p_token uuid, p_ids uuid[]) returns int
language plpgsql security definer set search_path = public as $$
declare v_cid uuid := _cliente_auth(p_telefono, p_token); v_n int;
begin
  if v_cid is null then raise exception 'no_autorizado'; end if;
  update citas set estado = 'cancelada'
    where id = any (p_ids) and cliente_id = v_cid and estado = 'confirmada'
      and (fecha + hora_inicio) > (now() at time zone 'America/Guatemala');
  get diagnostics v_n = row_count;
  return v_n;
end $$;

-- Lista de espera
create or replace function anotar_espera(p_nombre text, p_telefono text, p_token uuid, p_fecha date) returns jsonb
language plpgsql security definer set search_path = public as $$
declare v_cli jsonb; v_cid uuid; v_ya boolean;
begin
  if p_fecha is null or p_fecha < (now() at time zone 'America/Guatemala')::date
     or p_fecha > (now() at time zone 'America/Guatemala')::date + 60 then
    raise exception 'fecha_invalida';
  end if;
  v_cli := _cliente_obtener(p_nombre, p_telefono, null, p_token);
  v_cid := (v_cli ->> 'id')::uuid;
  select exists (select 1 from waitlist where cliente_id = v_cid and fecha_deseada = p_fecha and estado = 'esperando') into v_ya;
  if not v_ya then insert into waitlist (cliente_id, fecha_deseada, estado) values (v_cid, p_fecha, 'esperando'); end if;
  return jsonb_build_object('ya', v_ya, 'token', v_cli -> 'token');
end $$;

-- Permisos: solo estas funciones son invocables desde la web
revoke all on function horarios_ocupados(date, date) from public;
revoke all on function resenas_publicas() from public;
revoke all on function enviar_resena(int, text, text) from public;
revoke all on function reservar(text, text, text, uuid, int, date, time, jsonb, jsonb, boolean) from public;
revoke all on function mis_datos(text, uuid) from public;
revoke all on function cancelar_citas(text, uuid, uuid[]) from public;
revoke all on function anotar_espera(text, text, uuid, date) from public;
grant execute on function horarios_ocupados(date, date) to anon, authenticated;
grant execute on function resenas_publicas() to anon, authenticated;
grant execute on function enviar_resena(int, text, text) to anon, authenticated;
grant execute on function reservar(text, text, text, uuid, int, date, time, jsonb, jsonb, boolean) to anon, authenticated;
grant execute on function mis_datos(text, uuid) to anon, authenticated;
grant execute on function cancelar_citas(text, uuid, uuid[]) to anon, authenticated;
grant execute on function anotar_espera(text, text, uuid, date) to anon, authenticated;

-- Fin. Después de ejecutar: crea tu usuario en Authentication > Users (si no existe) y vuelve a
-- ejecutar este archivo para que su correo quede registrado como administrador, o agrégalo a mano:
--   insert into admins (email) values ('tu@correo.com') on conflict do nothing;
