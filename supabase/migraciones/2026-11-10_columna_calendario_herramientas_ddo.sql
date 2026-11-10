-- =====================================================================
-- 10/11/2026 · Columna (asistencia a reuniones), herramientas, mensajes modelo, guía de actividad y DDO
-- =====================================================================

-- ---------- Rol Columna ----------
alter table public.integrantes drop constraint integrantes_rol_check;
alter table public.integrantes add constraint integrantes_rol_check
  check (rol in ('integrante','responsable','seguimiento','columna'));

create function private.es_columna() returns boolean language sql stable security definer set search_path = '' as $$
  select exists (select 1 from public.integrantes where id = auth.uid() and estado = 'activo' and rol = 'columna')
$$;
-- Quién lleva la asistencia: coordinación o Columna.
create function private.gestiona_asistencia() returns boolean language sql stable security definer set search_path = '' as $$
  select private.es_coord() or private.es_columna()
$$;

-- Columna también puede crear la reunión de la semana (para poder relevar asistencia).
drop policy "coord crea reunion" on public.reuniones;
create policy "crear reunion" on public.reuniones for insert to authenticated
  with check ((select private.gestiona_asistencia()));

-- ---------- Nómina: la lista de compañeros que se convocan (tengan o no cuenta) ----------
create table public.nomina (
  id uuid primary key default gen_random_uuid(),
  nombre text not null,
  integrante_id uuid unique references public.integrantes(id) on delete set null,
  activo boolean not null default true,
  created_at timestamptz not null default now()
);
alter table public.nomina enable row level security;
create policy "ver nomina" on public.nomina for select to authenticated using ((select private.es_miembro()));
create policy "cargar nomina" on public.nomina for insert to authenticated with check ((select private.gestiona_asistencia()));
create policy "editar nomina" on public.nomina for update to authenticated
  using ((select private.gestiona_asistencia())) with check ((select private.gestiona_asistencia()));
create policy "borrar nomina" on public.nomina for delete to authenticated using ((select private.gestiona_asistencia()));

-- ---------- Asistencia por reunión ----------
create table public.asistencias (
  reunion_id uuid not null references public.reuniones(id) on delete cascade,
  nomina_id uuid not null references public.nomina(id) on delete cascade,
  respuesta text not null default 'sin_respuesta' check (respuesta in ('sin_respuesta','viene','no_viene','no_sabe')),
  motivo text,
  insistir boolean not null default false,
  llegada text check (llegada in ('a_horario','tarde','no_vino')),
  actualizado_por uuid references public.integrantes(id) on delete set null default auth.uid(),
  updated_at timestamptz not null default now(),
  primary key (reunion_id, nomina_id)
);
create index asistencias_nomina_idx on public.asistencias (nomina_id);
create index asistencias_actualizado_por_idx on public.asistencias (actualizado_por);
alter table public.asistencias enable row level security;

create function private.es_mi_nomina(nid uuid) returns boolean language sql stable security definer set search_path = '' as $$
  select exists (select 1 from public.nomina n where n.id = nid and n.integrante_id = auth.uid())
    and private.es_miembro()
$$;

create policy "ver asistencia" on public.asistencias for select to authenticated
  using ((select private.gestiona_asistencia()) or (select private.es_mi_nomina(nomina_id)));
create policy "cargar asistencia" on public.asistencias for insert to authenticated
  with check ((select private.gestiona_asistencia()) or (select private.es_mi_nomina(nomina_id)));
create policy "editar asistencia" on public.asistencias for update to authenticated
  using ((select private.gestiona_asistencia()) or (select private.es_mi_nomina(nomina_id)))
  with check ((select private.gestiona_asistencia()) or (select private.es_mi_nomina(nomina_id)));
create policy "borrar asistencia" on public.asistencias for delete to authenticated using ((select private.gestiona_asistencia()));

-- Cada uno puede decir si viene y por qué no; "insistir" y la llegada las marca Columna o coordinación.
create function public.proteger_asistencia() returns trigger language plpgsql security definer set search_path = '' as $$
begin
  new.updated_at := now();
  if auth.uid() is null then return new; end if;
  new.actualizado_por := auth.uid();
  if not private.gestiona_asistencia() then
    if tg_op = 'INSERT' then
      new.insistir := false; new.llegada := null;
    else
      new.insistir := old.insistir; new.llegada := old.llegada;
    end if;
  end if;
  return new;
end $$;
create trigger proteger before insert or update on public.asistencias for each row execute function public.proteger_asistencia();

-- Conteo para que todos vean cuántos confirmaron (sin ver quiénes ni por qué).
create function public.conteo_asistencia(rid uuid) returns table (respuesta text, cantidad int)
language sql stable security definer set search_path = '' as $$
  select a.respuesta, count(*)::int
  from public.asistencias a join public.nomina n on n.id = a.nomina_id
  where a.reunion_id = rid and n.activo and private.es_miembro()
  group by a.respuesta
$$;
revoke execute on function public.conteo_asistencia(uuid) from public, anon;
grant execute on function public.conteo_asistencia(uuid) to authenticated;

-- ---------- Logística de la reunión ----------
create table public.reunion_logistica (
  reunion_id uuid primary key references public.reuniones(id) on delete cascade,
  aula text,
  busca_aula_id uuid references public.nomina(id) on delete set null,
  nota text,
  updated_at timestamptz not null default now()
);
create index reunion_logistica_busca_idx on public.reunion_logistica (busca_aula_id);
alter table public.reunion_logistica enable row level security;
create policy "ver logistica" on public.reunion_logistica for select to authenticated using ((select private.es_miembro()));
create policy "cargar logistica" on public.reunion_logistica for insert to authenticated with check ((select private.gestiona_asistencia()));
create policy "editar logistica" on public.reunion_logistica for update to authenticated
  using ((select private.gestiona_asistencia())) with check ((select private.gestiona_asistencia()));
create policy "borrar logistica" on public.reunion_logistica for delete to authenticated using ((select private.es_coord()));
create trigger tocar before update on public.reunion_logistica for each row execute function public.tocar_updated_at();

-- ---------- Enlaces: tipo y nota; sin proyecto ni actividad = herramienta general ----------
alter table public.documentos
  add column tipo text not null default 'otro'
    check (tipo in ('inscripcion','planilla','grupo','zoom','encuesta','carpeta','difusion','otro')),
  add column nota text;
create policy "editar documento" on public.documentos for update to authenticated
  using ((select private.es_coord()) or created_by = (select auth.uid()))
  with check ((select private.es_coord()) or created_by = (select auth.uid()));

-- ---------- Actividades: guía para el día y cupo ----------
alter table public.actividades add column guia text, add column cupo int check (cupo is null or cupo > 0);

-- ---------- Mensajes modelo (para copiar o usar en la planilla) ----------
create table public.mensajes_modelo (
  id uuid primary key default gen_random_uuid(),
  titulo text not null,
  para text not null default 'general' check (para in ('visita','charla','reunion','general')),
  texto text not null,
  orden int not null default 0,
  actualizado_por uuid references public.integrantes(id) on delete set null default auth.uid(),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index mensajes_modelo_actualizado_por_idx on public.mensajes_modelo (actualizado_por);
alter table public.mensajes_modelo enable row level security;
create policy "ver mensajes" on public.mensajes_modelo for select to authenticated using ((select private.es_miembro()));
create policy "cargar mensajes" on public.mensajes_modelo for insert to authenticated with check ((select private.es_miembro()));
create policy "editar mensajes" on public.mensajes_modelo for update to authenticated
  using ((select private.es_miembro())) with check ((select private.es_miembro()));
create policy "borrar mensajes" on public.mensajes_modelo for delete to authenticated using ((select private.es_coord()));
create trigger tocar before update on public.mensajes_modelo for each row execute function public.tocar_updated_at();

insert into public.mensajes_modelo (titulo, para, orden, texto) values
('Confirmación de la visita', 'visita', 1,
'Buenas {nombre}, ¿cómo andás?✨
Te confirmo para la {actividad}. Te esperamos el {dia} a las {hora} en {lugar}.

Nos juntamos en la esquina y entramos todos juntos. Traé DNI por las dudas.

Sumate al grupo de WhatsApp de la visita, ahí pasamos toda la info: {grupo}

Si al final no podés venir, avisanos hasta 24 h antes así le damos el lugar a otra persona.

Cualquier duda o consulta no dudes en decirme💚'),
('Recordatorio del día anterior', 'visita', 2,
'¡Buenas {nombre}! Te recuerdo que mañana es la {actividad}.
🕒 {hora} · nos juntamos en la esquina de {lugar}
Traé DNI por las dudas. Si al final no podés venir, avisame ahora así le doy el lugar a otra persona💚'),
('Se liberó un lugar', 'visita', 3,
'Buenas {nombre}, ¿cómo va? Acá {yo} de Nexo💚
Se liberó un lugar para la {actividad} del {dia} a las {hora}. ¿Te sumás? Respondeme hoy así te lo reservo.'),
('Encuesta después de la visita', 'visita', 4,
'¡Gracias por venir a la {actividad}! 💚
Nos ayuda mucho saber qué te pareció. Son dos minutos: {encuesta}'),
('Link de la charla', 'charla', 1,
'Buenas, ¿cómo va? Acá {yo} de Nexo💚

Te escribo porque te inscribiste a la {actividad}, que la hacemos el {dia}.

🕕 {hora}, por Zoom
🔗 Link para sumarte: {zoom}

Guardate el link así lo tenés a mano.

¡Abrazo!'),
('Recordatorio del día de la charla', 'charla', 2,
'¡Hoy es la {actividad}! 💚
🕕 {hora}, por Zoom
🔗 {zoom}
¡Te esperamos!'),
('Encuesta después de la charla', 'charla', 3,
'¡Gracias por sumarte a la {actividad}! 💚
Si nos querés contar qué te pareció, son dos minutos: {encuesta}'),
('Convocatoria a la reunión', 'reunion', 1,
'Buenas compañeros/as, ¿cómo va? 💙
El {dia} tenemos reunión de AA.
🕕 18:15 nos encontramos en la puerta del aula {aula}
🕡 18:30 arrancamos, a más tardar 18:35
Respondan si vienen 👍 y, si no pueden, avisen por qué. ¡Abrazo!'),
('Insistir para la reunión', 'reunion', 2,
'Hola {nombre}, ¿cómo va? El {dia} tenemos reunión de AA a las 18:30 y nos sirve mucho que estés. ¿Te podés sumar? Si no podés, contame y vemos cómo te ponemos al día 💙');

-- ---------- DDO de las comisiones (solo coordinación) ----------
create table public.ddo (
  id uuid primary key default gen_random_uuid(),
  comision text not null,
  semana date not null,               -- lunes de la semana en que se cargó
  texto text not null,
  cargado_por uuid references public.integrantes(id) on delete set null default auth.uid(),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (comision, semana)
);
create index ddo_semana_idx on public.ddo (semana);
create index ddo_cargado_por_idx on public.ddo (cargado_por);
alter table public.ddo enable row level security;
create policy "ver ddo" on public.ddo for select to authenticated using ((select private.es_coord()));
create policy "cargar ddo" on public.ddo for insert to authenticated with check ((select private.es_coord()));
create policy "editar ddo" on public.ddo for update to authenticated
  using ((select private.es_coord())) with check ((select private.es_coord()));
create policy "borrar ddo" on public.ddo for delete to authenticated using ((select private.es_coord()));
create trigger tocar before update on public.ddo for each row execute function public.tocar_updated_at();

-- ---------- Herramienta general inicial ----------
insert into public.documentos (titulo, url, tipo, nota, created_by)
values ('Página de Columna (grilla de turnos)', 'https://columna-nexojup.web.app/', 'otro', 'Turnos y tareas de Columna.', null);
