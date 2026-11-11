-- =====================================================================
-- Página de Actividades Académicas — esquema de la base (Supabase)
-- Estado consolidado de las migraciones aplicadas el 3/11/2026:
--   esquema_inicial · helpers_a_esquema_privado · permitir_mantenimiento_sin_sesion
-- Agregados el 10/11/2026 (ver supabase/migraciones/2026-11-10_*.sql y el resumen al final):
--   columna_herramientas_mensajes_ddo · revocar_proteger_asistencia
-- Es referencia: los cambios nuevos se aplican como migraciones nuevas.
-- =====================================================================

-- ---------- Integrantes ----------
create table public.integrantes (
  id uuid primary key references auth.users(id) on delete cascade,
  nombre text not null,
  rol text not null default 'integrante' check (rol in ('integrante','responsable','seguimiento')),
  estado text not null default 'pendiente' check (estado in ('pendiente','activo','en_pausa','baja')),
  created_at timestamptz not null default now()
);

-- ---------- Funciones auxiliares (esquema privado, fuera de la API) ----------
create schema if not exists private;
grant usage on schema private to authenticated;

create function private.es_miembro() returns boolean language sql stable security definer set search_path = '' as $$
  select exists (select 1 from public.integrantes where id = auth.uid() and estado in ('activo','en_pausa'))
$$;
create function private.es_coord() returns boolean language sql stable security definer set search_path = '' as $$
  select exists (select 1 from public.integrantes where id = auth.uid() and estado = 'activo' and rol in ('responsable','seguimiento'))
$$;
create function private.es_responsable() returns boolean language sql stable security definer set search_path = '' as $$
  select exists (select 1 from public.integrantes where id = auth.uid() and estado = 'activo' and rol = 'responsable')
$$;

-- Alta automática: la primera cuenta es responsable activa; el resto entra pendiente.
create function public.crear_integrante() returns trigger language plpgsql security definer set search_path = '' as $$
declare primero boolean;
begin
  select not exists (select 1 from public.integrantes) into primero;
  insert into public.integrantes (id, nombre, rol, estado)
  values (new.id,
          coalesce(nullif(trim(new.raw_user_meta_data->>'nombre'), ''), split_part(new.email, '@', 1)),
          case when primero then 'responsable' else 'integrante' end,
          case when primero then 'activo' else 'pendiente' end);
  return new;
end $$;
create trigger al_crear_usuario after insert on auth.users for each row execute function public.crear_integrante();

-- Solo la responsable cambia roles o estados (sin sesión = mantenimiento desde la consola).
create function public.proteger_integrante() returns trigger language plpgsql security definer set search_path = '' as $$
begin
  if auth.uid() is null then return new; end if;
  if not private.es_responsable() then
    if new.rol is distinct from old.rol or new.estado is distinct from old.estado then
      raise exception 'Solo la persona responsable puede cambiar roles o estados';
    end if;
  end if;
  return new;
end $$;
create trigger proteger_integrante before update on public.integrantes for each row execute function public.proteger_integrante();

-- ---------- Estructura ----------
create table public.lineas (
  id uuid primary key default gen_random_uuid(),
  nombre text not null, fundamento text, orden int not null default 0,
  created_at timestamptz not null default now()
);
create table public.mesas (
  id uuid primary key default gen_random_uuid(),
  nombre text not null, mision text,
  referente_id uuid references public.integrantes(id) on delete set null,
  estado text not null default 'activa' check (estado in ('activa','pausada','cerrada')),
  created_at timestamptz not null default now()
);
create table public.mesa_integrantes (
  mesa_id uuid not null references public.mesas(id) on delete cascade,
  integrante_id uuid not null references public.integrantes(id) on delete cascade,
  primary key (mesa_id, integrante_id)
);

-- ---------- Trabajo ----------
create table public.proyectos (
  id uuid primary key default gen_random_uuid(),
  nombre text not null, fundamento text, objetivos text,
  linea_id uuid references public.lineas(id) on delete set null,
  mesa_id uuid references public.mesas(id) on delete set null,
  responsable_id uuid references public.integrantes(id) on delete set null,
  identidad text not null default 'nexo' check (identidad in ('nexo','jup','ambas','interna')),
  estado text not null default 'propuesta' check (estado in ('propuesta','aprobado','en_marcha','pausado','terminado','descartado')),
  seguimiento text not null default 'no_requiere' check (seguimiento in ('no_requiere','pendiente','validado','devuelto')),
  seguimiento_at timestamptz,
  created_by uuid references public.integrantes(id) on delete set null default auth.uid(),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create table public.actividades (
  id uuid primary key default gen_random_uuid(),
  nombre text not null,
  tipo text not null default 'charla' check (tipo in ('charla','visita','jornada','presentacion','formativa','otra')),
  descripcion text,
  proyecto_id uuid references public.proyectos(id) on delete set null,
  linea_id uuid references public.lineas(id) on delete set null,
  mesa_id uuid references public.mesas(id) on delete set null,
  responsable_id uuid references public.integrantes(id) on delete set null,
  fecha date, hora text, lugar text,
  identidad text not null default 'nexo' check (identidad in ('nexo','jup','ambas','interna')),
  estado text not null default 'propuesta' check (estado in ('propuesta','aprobada','en_organizacion','inscripciones_abiertas','realizada','cerrada','cancelada')),
  seguimiento text not null default 'no_requiere' check (seguimiento in ('no_requiere','pendiente','validado','devuelto')),
  seguimiento_at timestamptz,
  cierre text,
  created_by uuid references public.integrantes(id) on delete set null default auth.uid(),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create table public.reuniones (
  id uuid primary key default gen_random_uuid(),
  fecha date not null, hora text not null default '18:30',
  estado text not null default 'preparacion' check (estado in ('preparacion','en_curso','cerrada')),
  acta_por uuid references public.integrantes(id) on delete set null,
  presentes int,
  created_at timestamptz not null default now()
);
create table public.ideas (
  id uuid primary key default gen_random_uuid(),
  titulo text not null, descripcion text,
  tipo text not null default 'idea' check (tipo in ('idea','necesidad','oportunidad')),
  linea_id uuid references public.lineas(id) on delete set null,
  propuesta_por uuid references public.integrantes(id) on delete set null default auth.uid(),
  estado text not null default 'nueva' check (estado in ('nueva','en_punteo','propuesta','postergada','descartada')),
  proyecto_id uuid references public.proyectos(id) on delete set null,
  created_at timestamptz not null default now()
);
create table public.reunion_temas (
  id uuid primary key default gen_random_uuid(),
  reunion_id uuid not null references public.reuniones(id) on delete cascade,
  orden int not null default 0, titulo text not null, origen text,
  proyecto_id uuid references public.proyectos(id) on delete set null,
  actividad_id uuid references public.actividades(id) on delete set null,
  idea_id uuid references public.ideas(id) on delete set null,
  notas text,
  estado text not null default 'pendiente' check (estado in ('pendiente','tratado')),
  created_at timestamptz not null default now()
);
create table public.tareas (
  id uuid primary key default gen_random_uuid(),
  titulo text not null, descripcion text,
  proyecto_id uuid references public.proyectos(id) on delete cascade,
  actividad_id uuid references public.actividades(id) on delete cascade,
  responsable_id uuid references public.integrantes(id) on delete set null,
  vence date,
  estado text not null default 'pendiente' check (estado in ('pendiente','en_curso','trabada','hecha','cancelada')),
  nota_trabada text,
  reunion_id uuid references public.reuniones(id) on delete set null,
  tema_id uuid references public.reunion_temas(id) on delete set null,
  hecha_at timestamptz,
  created_by uuid references public.integrantes(id) on delete set null default auth.uid(),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create table public.decisiones (
  id uuid primary key default gen_random_uuid(),
  texto text not null,
  reunion_id uuid references public.reuniones(id) on delete cascade,
  tema_id uuid references public.reunion_temas(id) on delete set null,
  proyecto_id uuid references public.proyectos(id) on delete set null,
  actividad_id uuid references public.actividades(id) on delete set null,
  va_a_seguimiento boolean not null default false,
  seguimiento text not null default 'no_requiere' check (seguimiento in ('no_requiere','pendiente','validado','devuelto')),
  validado_por uuid references public.integrantes(id) on delete set null,
  validado_at timestamptz,
  created_by uuid references public.integrantes(id) on delete set null default auth.uid(),
  created_at timestamptz not null default now()
);
create table public.actualizaciones (
  id uuid primary key default gen_random_uuid(),
  integrante_id uuid not null references public.integrantes(id) on delete cascade default auth.uid(),
  semana date not null,               -- fecha del miércoles de la reunión
  necesito text,
  sin_novedades boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (integrante_id, semana)
);
create table public.documentos (
  id uuid primary key default gen_random_uuid(),
  titulo text not null, url text not null,
  proyecto_id uuid references public.proyectos(id) on delete cascade,
  actividad_id uuid references public.actividades(id) on delete cascade,
  created_by uuid references public.integrantes(id) on delete set null default auth.uid(),
  created_at timestamptz not null default now()
);
-- (Hay índices sobre todas las claves foráneas, actividades.fecha, reuniones.fecha y actualizaciones.semana.)

-- ---------- Triggers de datos ----------
create function public.tocar_updated_at() returns trigger language plpgsql set search_path = '' as $$
begin new.updated_at := now(); return new; end $$;
create trigger tocar before update on public.proyectos for each row execute function public.tocar_updated_at();
create trigger tocar before update on public.actividades for each row execute function public.tocar_updated_at();
create trigger tocar before update on public.tareas for each row execute function public.tocar_updated_at();
create trigger tocar before update on public.actualizaciones for each row execute function public.tocar_updated_at();

create function public.marcar_hecha() returns trigger language plpgsql set search_path = '' as $$
begin
  if new.estado = 'hecha' and (tg_op = 'INSERT' or old.estado is distinct from 'hecha') then new.hecha_at := now();
  elsif new.estado <> 'hecha' then new.hecha_at := null; end if;
  if new.estado <> 'trabada' then new.nota_trabada := null; end if;
  return new;
end $$;
create trigger marcar_hecha before insert or update on public.tareas for each row execute function public.marcar_hecha();

-- ---------- Aprobación y seguimiento ----------
-- Proyectos: quien no es coordinación solo propone; no aprueba ni registra seguimiento.
create function public.proteger_proyecto() returns trigger language plpgsql security definer set search_path = '' as $$
begin
  if auth.uid() is null or private.es_coord() then
    if tg_op = 'INSERT' or new.seguimiento is distinct from old.seguimiento then
      new.seguimiento_at := case when new.seguimiento = 'no_requiere' then null else now() end;
    end if;
    return new;
  end if;
  if tg_op = 'INSERT' then
    new.estado := 'propuesta'; new.seguimiento := 'no_requiere'; new.seguimiento_at := null; new.created_by := auth.uid();
    return new;
  end if;
  if new.seguimiento is distinct from old.seguimiento then raise exception 'El seguimiento lo registra coordinación'; end if;
  if old.estado in ('propuesta','descartado') and new.estado is distinct from old.estado then raise exception 'La aprobación la registra coordinación'; end if;
  return new;
end $$;
create trigger proteger before insert or update on public.proyectos for each row execute function public.proteger_proyecto();

-- Actividades: igual, salvo dentro de un proyecto aprobado (su responsable o su mesa pueden aprobarlas).
create function public.proteger_actividad() returns trigger language plpgsql security definer set search_path = '' as $$
declare en_proyecto_aprobado boolean;
begin
  if auth.uid() is null or private.es_coord() then
    if tg_op = 'INSERT' or new.seguimiento is distinct from old.seguimiento then
      new.seguimiento_at := case when new.seguimiento = 'no_requiere' then null else now() end;
    end if;
    return new;
  end if;
  select exists (
    select 1 from public.proyectos p
    where p.id = new.proyecto_id and p.estado in ('aprobado','en_marcha')
      and (p.responsable_id = auth.uid()
           or exists (select 1 from public.mesa_integrantes mi where mi.mesa_id = p.mesa_id and mi.integrante_id = auth.uid()))
  ) into en_proyecto_aprobado;
  if tg_op = 'INSERT' then
    new.created_by := auth.uid(); new.seguimiento := 'no_requiere'; new.seguimiento_at := null;
    if new.estado <> 'propuesta' and not en_proyecto_aprobado then new.estado := 'propuesta'; end if;
    return new;
  end if;
  if new.seguimiento is distinct from old.seguimiento then raise exception 'El seguimiento lo registra coordinación'; end if;
  if old.estado = 'propuesta' and new.estado is distinct from old.estado and not en_proyecto_aprobado then raise exception 'La aprobación la registra coordinación'; end if;
  return new;
end $$;
create trigger proteger before insert or update on public.actividades for each row execute function public.proteger_actividad();

-- Decisiones: "va a seguimiento" la deja pendiente; validar o devolver es de coordinación.
create function public.proteger_decision() returns trigger language plpgsql security definer set search_path = '' as $$
begin
  if tg_op = 'INSERT' then
    new.seguimiento := case when new.va_a_seguimiento then 'pendiente' else 'no_requiere' end;
    new.validado_por := null; new.validado_at := null; new.created_by := auth.uid();
    return new;
  end if;
  if new.va_a_seguimiento is distinct from old.va_a_seguimiento and new.seguimiento is not distinct from old.seguimiento then
    new.seguimiento := case when new.va_a_seguimiento then 'pendiente' else 'no_requiere' end;
  end if;
  if new.seguimiento is distinct from old.seguimiento and new.seguimiento in ('validado','devuelto') then
    if auth.uid() is not null and not private.es_coord() then raise exception 'El seguimiento lo registra coordinación'; end if;
    new.validado_por := auth.uid(); new.validado_at := now();
  end if;
  return new;
end $$;
create trigger proteger before insert or update on public.decisiones for each row execute function public.proteger_decision();

-- Quién escribe el acta: coordinación o quien la toma (mientras no esté cerrada).
create function private.puede_editar_reunion(rid uuid) returns boolean language sql stable security definer set search_path = '' as $$
  select private.es_coord() or exists (
    select 1 from public.reuniones r
    where r.id = rid and r.acta_por = auth.uid() and r.estado <> 'cerrada'
      and exists (select 1 from public.integrantes i where i.id = auth.uid() and i.estado = 'activo'))
$$;
create function private.toma_algun_acta() returns boolean language sql stable security definer set search_path = '' as $$
  select exists (select 1 from public.reuniones r where r.acta_por = auth.uid() and r.estado <> 'cerrada')
$$;

-- Listado con mail, solo para la responsable (lo usa /integrantes).
create function public.integrantes_admin()
returns table (id uuid, nombre text, email text, rol text, estado text, created_at timestamptz)
language sql stable security definer set search_path = '' as $$
  select i.id, i.nombre, u.email::text, i.rol, i.estado, i.created_at
  from public.integrantes i join auth.users u on u.id = i.id
  where private.es_responsable()
  order by i.created_at
$$;
revoke execute on function public.integrantes_admin() from public, anon;
grant execute on function public.integrantes_admin() to authenticated;

-- ---------- RLS ----------
-- Todas las tablas tienen RLS activado. Regla general: los miembros (activo / en_pausa) leen todo lo común;
-- coordinación administra; cada uno edita lo suyo. Anónimos no ven nada.
-- integrantes: ve su fila o, si es miembro, todas; edita su fila o la responsable (trigger protege rol/estado).
-- lineas, mesas, mesa_integrantes: leen miembros; escribe coordinación.
-- proyectos, actividades: leen y proponen miembros; editan coordinación, su responsable o quien lo creó; borra coordinación.
-- reuniones: leen miembros; crea coordinación; edita private.puede_editar_reunion(id).
-- reunion_temas, decisiones: leen miembros; escriben quienes pueden editar la reunión (y coordinación).
-- ideas: leen y cargan miembros; editan coordinación, quien toma un acta abierta o quien la propuso.
-- tareas: leen y crean miembros; editan coordinación, su responsable, quien la creó o el responsable del proyecto/actividad.
-- actualizaciones: cada uno la suya; coordinación ve todas.
-- documentos: leen y cargan miembros; borran coordinación o quien lo cargó.
-- (Las políticas exactas: ver la migración esquema_inicial en Supabase → Database → Migrations.)

-- ---------- Líneas iniciales (Documento Maestro, 2.2) ----------
insert into public.lineas (nombre, fundamento, orden) values
  ('Vida académica', 'Carreras, planes de estudio, orientaciones, cursadas, formación, trayectorias y necesidades académicas.', 1),
  ('Vida institucional', 'Secretarías, extensión, investigación, programas de capacitación, relaciones internacionales, actividades de los distintos claustros y oportunidades de la Facultad.', 2),
  ('Vinculación estudiantil', 'Escucha de inquietudes, detección de necesidades, consultas, contactos y conexión con oportunidades.', 3),
  ('Actividades propias', 'Charlas, visitas, jornadas, encuentros, ciclos y otras propuestas formativas.', 4),
  ('Producción académica', 'Materiales, guías, recursos digitales, investigaciones, contenidos y archivo audiovisual.', 5),
  ('Ejercicio profesional', 'Orientación sobre áreas de ejercicio, inserción laboral, vínculos profesionales y oportunidades para estudiantes y graduados.', 6);

-- =====================================================================
-- 10/11/2026 · Resumen de lo agregado (el SQL completo está en supabase/migraciones/)
-- =====================================================================
-- integrantes.rol suma 'columna'. private.es_columna(); private.gestiona_asistencia() = coordinación o Columna.
-- reuniones: las crea coordinación o Columna (política "crear reunion").
-- nomina: lista de compañeros que se convocan (con o sin cuenta; integrante_id opcional y único).
--   Leen miembros; escriben coordinación o Columna.
-- asistencias (reunion_id, nomina_id): respuesta sin_respuesta|viene|no_viene|no_sabe, motivo, insistir, llegada a_horario|tarde|no_vino.
--   Ven y editan coordinación, Columna y la persona misma (private.es_mi_nomina). Trigger proteger_asistencia:
--   la persona solo cambia respuesta y motivo; insistir y llegada son de Columna o coordinación.
-- public.conteo_asistencia(rid): cuántos respondieron cada cosa, para cualquier miembro (sin nombres).
-- reunion_logistica (reunion_id): aula, busca_aula_id (nómina), nota. Escriben coordinación o Columna.
-- documentos: + tipo (inscripcion|planilla|grupo|zoom|encuesta|carpeta|difusion|otro) + nota.
--   Sin proyecto ni actividad = herramienta general (/herramientas). Editan coordinación o quien lo cargó.
-- actividades: + guia (protocolo y speech del día) + cupo.
-- mensajes_modelo: titulo, para (visita|charla|reunion|general), texto con {variables}. Leen y editan miembros; borra coordinación.
-- ddo: comision, semana (lunes), texto pegado tal cual (único por comisión y semana). Solo coordinación.
-- ---------- 10/11/2026 (b) · contactos_comunicacion_eventos ----------
-- tareas: + enlace (ruta interna, p. ej. /contactos/b/…) + canal (form|posteo|historia|reel|otro: piezas de comunicación).
-- actividades: + opcion_form (texto de la opción en el Form de actividades: "5/11 • 18 HS | NOMBRE").
-- grilla_mensajes (dia 0-6, nomina_id, suplente): quién contacta cada día. Leen miembros; editan coordinación o Columna.
-- repartos: actividad, titulo, fecha_contacto, mensaje, total, creado_por, purgado. Leen miembros; crea cualquier miembro (como creador).
-- bloques: reparto, numero (B1…), nomina_id, contactos jsonb [{n, nombre, tel}], enviados int[], listo, tarea_id.
--   Ven y editan: coordinación, quien repartió (private.reparti) y el asignado (private.es_mi_nomina);
--   trigger proteger_bloque: el asignado solo marca enviados / listo.
-- pg_cron 'purgar-contactos' (todos los días 9:15 UTC): private.purgar_contactos() vacía los contactos 7 días después del día de contacto.
-- eventos: fechas de la agrupación (fecha vacía = a confirmar), origen (Agrupación, JUP, comisión…). Leen y cargan miembros; editan coordinación o quien la cargó.
-- ---------- 11/11/2026 · punteo_sugerido ----------
-- reunion_temas: + puntos (uno por línea, salen en el punteo) + minutos. reuniones: + borrador_punteo jsonb (lo que sugirió la página).
-- ---------- 11/11/2026 · tareas_responsable_sin_cuenta (provisorio) ----------
-- tareas: + responsable_nomina_id (alguien de la lista sin cuenta); trigger pasar_tareas en nomina.
