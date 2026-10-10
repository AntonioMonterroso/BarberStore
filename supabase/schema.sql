-- IMPERIO STORE BARBER — ESQUEMA (tablas). Ejecuta este archivo primero y luego seguridad.sql.
-- Es seguro volver a ejecutarlo: si algo ya existe, lo deja igual.

create extension if not exists "pgcrypto";

create table if not exists config_negocio (
  id int primary key default 1,
  nombre text default 'Imperio Store Barber',
  direccion text default '',
  maps_link text default '',
  whatsapp text default '',
  fidelidad_activa boolean default false,
  puntos_por_visita int default 1,
  puntos_para_premio int default 10,
  referidos_activo boolean default true,
  constraint single_row check (id = 1)
);
insert into config_negocio (id) values (1) on conflict (id) do nothing;

create table if not exists horarios (
  id serial primary key,
  dia_semana int not null unique,           -- 0=domingo ... 6=sábado
  activo boolean default false,
  hora_inicio time default '09:00',
  hora_fin time default '18:00',
  intervalo_minutos int default 30
);
insert into horarios (dia_semana, activo) values (0,false),(1,true),(2,true),(3,true),(4,true),(5,true),(6,true)
  on conflict (dia_semana) do nothing;

create table if not exists bloqueos (
  id serial primary key,
  fecha date not null,
  hora_inicio time,
  hora_fin time,
  todo_el_dia boolean default true,
  motivo text
);

create table if not exists servicios (
  id serial primary key,
  nombre text not null,
  descripcion text default '',
  precio numeric(10,2) not null default 0,
  duracion_minutos int not null default 30,
  foto_url text default '',
  activo boolean default true,
  orden int default 0,
  categoria text default ''
);

create table if not exists estilos_corte (
  id serial primary key,
  nombre text not null,
  categoria text default '',
  foto_url text default '',
  activo boolean default true,
  orden int default 0
);

create table if not exists clientes (
  id uuid primary key default gen_random_uuid(),
  nombre text not null,
  telefono text not null unique,
  estilo_preferido_id int references estilos_corte(id) on delete set null,
  notas text default '',
  puntos_actuales int default 0,
  codigo_referido text unique,
  referido_por uuid references clientes(id),
  creado_en timestamptz default now()
);

create table if not exists visitas (
  id uuid primary key default gen_random_uuid(),
  cliente_id uuid references clientes(id),
  fecha date not null,
  anticipo_monto numeric(10,2) default 0,
  anticipo_recibido boolean default false,
  recibo_enviado boolean default false,
  creado_en timestamptz default now()
);

create table if not exists citas (
  id uuid primary key default gen_random_uuid(),
  cliente_id uuid references clientes(id),
  servicio_id int references servicios(id),
  estilo_id int references estilos_corte(id) on delete set null,
  visita_id uuid references visitas(id),
  etiqueta text default '',
  fecha date not null,
  hora_inicio time not null,
  hora_fin time not null,
  estado text default 'confirmada',          -- confirmada | completada | cancelada | no_asistio
  notas text default '',
  creado_en timestamptz default now()
);
alter table citas add column if not exists visita_id uuid references visitas(id);
alter table citas add column if not exists etiqueta text default '';

create table if not exists waitlist (
  id uuid primary key default gen_random_uuid(),
  cliente_id uuid references clientes(id),
  fecha_deseada date not null,
  hora_desde time,
  hora_hasta time,
  estado text default 'esperando',           -- esperando | notificado | tomado | expirado
  creado_en timestamptz default now()
);

create table if not exists resenas (
  id uuid primary key default gen_random_uuid(),
  cita_id uuid references citas(id) on delete set null,
  calificacion int check (calificacion between 1 and 5),
  comentario text default '',
  nombre text default '',
  creado_en timestamptz default now()
);

create table if not exists productos (
  id serial primary key,
  nombre text not null,
  precio numeric(10,2) not null default 0,
  foto_url text default '',
  stock int,                      -- vacío (null) = no se controla inventario
  activo boolean default true,
  orden int default 0
);

create table if not exists ventas_producto (
  id uuid primary key default gen_random_uuid(),
  producto_id int references productos(id),
  visita_id uuid references visitas(id),     -- null = venta de mostrador, sin cita
  cliente_id uuid references clientes(id),   -- null = cliente ocasional
  cantidad int not null default 1,
  precio_unit numeric(10,2) not null default 0,
  fecha date not null default current_date,
  creado_en timestamptz default now()
);

create table if not exists gastos (
  id uuid primary key default gen_random_uuid(),
  concepto text not null,
  categoria text default '',
  monto numeric(10,2) not null default 0,
  fecha date not null default current_date,
  notas text default '',
  creado_en timestamptz default now()
);

-- columnas de la landing page configurable (por si vienes de una versión anterior)
alter table config_negocio
  add column if not exists hero_eyebrow text default '',
  add column if not exists hero_titulo text default '',
  add column if not exists hero_subtitulo text default '',
  add column if not exists hero_imagen_url text default '',
  add column if not exists hero_recorte boolean default false,
  add column if not exists barbero_nombre text default '',
  add column if not exists barbero_titulo text default '',
  add column if not exists barbero_frase text default '',
  add column if not exists barbero_bio text default '',
  add column if not exists barbero_foto_url text default '',
  add column if not exists anios_experiencia text default '',
  add column if not exists clientes_atendidos text default '',
  add column if not exists maps_embed_url text default '',
  add column if not exists instagram text default '',
  add column if not exists facebook text default '',
  add column if not exists tiktok text default '',
  add column if not exists mostrar_galeria boolean default true,
  add column if not exists mostrar_resenas boolean default true,
  add column if not exists frase_cierre text default '',
  add column if not exists premio_texto text default '',
  add column if not exists msg_recordatorio text default '',
  add column if not exists msg_espera text default '',
  add column if not exists msg_reactivar text default '',
  add column if not exists mostrar_paso_productos boolean default false,
  add column if not exists texto_paso_productos text default '',
  add column if not exists qr_llegada_activo boolean default false;   -- registro de llegada con QR (opcional)
alter table citas add column if not exists llego_en timestamptz;     -- cuándo llegó el cliente (registro de llegada)
alter table servicios add column if not exists categoria text default '';
alter table resenas add column if not exists nombre text default '';

-- Necesario para la regla anti-traslape de citas
create extension if not exists btree_gist;
alter table clientes add column if not exists token_acceso uuid not null default gen_random_uuid();
