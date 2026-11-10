-- =====================================================================
-- 10/11/2026 (b) · Contactos (grilla y repartos), comunicación, fechas de la agrupación
-- =====================================================================

-- ---------- Tareas: enlace interno y canal de comunicación ----------
alter table public.tareas
  add column enlace text,
  add column canal text check (canal in ('form','posteo','historia','reel','otro'));

-- ---------- Actividades: texto de la opción en el Form de actividades ----------
alter table public.actividades add column opcion_form text;

-- ---------- Grilla de mensajes (quién contacta cada día) ----------
create table public.grilla_mensajes (
  dia smallint not null check (dia between 0 and 6),   -- 0 domingo … 6 sábado
  nomina_id uuid not null references public.nomina(id) on delete cascade,
  suplente boolean not null default false,
  orden int not null default 0,
  primary key (dia, nomina_id, suplente)
);
create index grilla_mensajes_nomina_idx on public.grilla_mensajes (nomina_id);
alter table public.grilla_mensajes enable row level security;
create policy "ver grilla" on public.grilla_mensajes for select to authenticated using ((select private.es_miembro()));
create policy "cargar grilla" on public.grilla_mensajes for insert to authenticated with check ((select private.gestiona_asistencia()));
create policy "editar grilla" on public.grilla_mensajes for update to authenticated
  using ((select private.gestiona_asistencia())) with check ((select private.gestiona_asistencia()));
create policy "borrar grilla" on public.grilla_mensajes for delete to authenticated using ((select private.gestiona_asistencia()));

-- ---------- Repartos de contactos ----------
create table public.repartos (
  id uuid primary key default gen_random_uuid(),
  actividad_id uuid references public.actividades(id) on delete cascade,
  titulo text not null,
  fecha_contacto date not null,
  mensaje text not null,
  total int not null default 0,
  creado_por uuid references public.integrantes(id) on delete set null default auth.uid(),
  purgado boolean not null default false,
  created_at timestamptz not null default now()
);
create index repartos_actividad_idx on public.repartos (actividad_id);
create index repartos_creado_por_idx on public.repartos (creado_por);
alter table public.repartos enable row level security;
create policy "ver repartos" on public.repartos for select to authenticated using ((select private.es_miembro()));
create policy "crear reparto" on public.repartos for insert to authenticated
  with check ((select private.es_miembro()) and creado_por = (select auth.uid()));
create policy "editar reparto" on public.repartos for update to authenticated
  using ((select private.es_coord()) or creado_por = (select auth.uid()))
  with check ((select private.es_coord()) or creado_por = (select auth.uid()));
create policy "borrar reparto" on public.repartos for delete to authenticated
  using ((select private.es_coord()) or creado_por = (select auth.uid()));

create function private.reparti(rid uuid) returns boolean language sql stable security definer set search_path = '' as $$
  select exists (select 1 from public.repartos r where r.id = rid and r.creado_por = auth.uid()) and private.es_miembro()
$$;

-- Bloques: solo nombre y teléfono de cada inscripto. Los ven coordinación, quien repartió y el compañero asignado.
create table public.bloques (
  id uuid primary key default gen_random_uuid(),
  reparto_id uuid not null references public.repartos(id) on delete cascade,
  numero int not null,
  nomina_id uuid references public.nomina(id) on delete set null,
  contactos jsonb not null default '[]',
  cantidad int not null default 0,
  enviados int[] not null default '{}',
  listo boolean not null default false,
  listo_at timestamptz,
  tarea_id uuid references public.tareas(id) on delete set null,
  unique (reparto_id, numero)
);
create index bloques_nomina_idx on public.bloques (nomina_id);
create index bloques_tarea_idx on public.bloques (tarea_id);
alter table public.bloques enable row level security;
create policy "ver bloques" on public.bloques for select to authenticated
  using ((select private.es_coord()) or (select private.reparti(reparto_id)) or (select private.es_mi_nomina(nomina_id)));
create policy "crear bloques" on public.bloques for insert to authenticated
  with check ((select private.es_coord()) or (select private.reparti(reparto_id)));
create policy "editar bloques" on public.bloques for update to authenticated
  using ((select private.es_coord()) or (select private.reparti(reparto_id)) or (select private.es_mi_nomina(nomina_id)))
  with check ((select private.es_coord()) or (select private.reparti(reparto_id)) or (select private.es_mi_nomina(nomina_id)));
create policy "borrar bloques" on public.bloques for delete to authenticated
  using ((select private.es_coord()) or (select private.reparti(reparto_id)));

-- El compañero asignado solo marca lo que mandó; reasignar o cambiar la lista es de quien repartió o coordinación.
create function public.proteger_bloque() returns trigger language plpgsql security definer set search_path = '' as $$
begin
  if new.listo and not old.listo then new.listo_at := now(); end if;
  if not new.listo then new.listo_at := null; end if;
  if auth.uid() is null or private.es_coord() or private.reparti(old.reparto_id) then return new; end if;
  if new.nomina_id is distinct from old.nomina_id or new.contactos is distinct from old.contactos
     or new.numero is distinct from old.numero or new.reparto_id is distinct from old.reparto_id or new.tarea_id is distinct from old.tarea_id then
    raise exception 'Solo quien repartió puede cambiar el bloque';
  end if;
  return new;
end $$;
create trigger proteger before update on public.bloques for each row execute function public.proteger_bloque();
revoke execute on function public.proteger_bloque() from public, anon, authenticated;

-- Los teléfonos se borran solos 7 días después del día de contacto (queda la cantidad y el avance).
create extension if not exists pg_cron with schema pg_catalog;
create function private.purgar_contactos() returns void language sql security definer set search_path = '' as $$
  update public.bloques b set contactos = '[]'
  from public.repartos r
  where r.id = b.reparto_id and r.fecha_contacto < current_date - 7 and b.contactos <> '[]';
  update public.repartos set purgado = true where fecha_contacto < current_date - 7 and not purgado;
$$;
select cron.schedule('purgar-contactos', '15 9 * * *', $$select private.purgar_contactos()$$);

-- ---------- Fechas de la agrupación ----------
create table public.eventos (
  id uuid primary key default gen_random_uuid(),
  titulo text not null,
  fecha date,                 -- vacía = a confirmar
  hora text,
  lugar text,
  origen text not null default 'Agrupación',
  nota text,
  created_by uuid references public.integrantes(id) on delete set null default auth.uid(),
  created_at timestamptz not null default now()
);
create index eventos_fecha_idx on public.eventos (fecha);
create index eventos_created_by_idx on public.eventos (created_by);
alter table public.eventos enable row level security;
create policy "ver eventos" on public.eventos for select to authenticated using ((select private.es_miembro()));
create policy "cargar eventos" on public.eventos for insert to authenticated with check ((select private.es_miembro()));
create policy "editar eventos" on public.eventos for update to authenticated
  using ((select private.es_coord()) or created_by = (select auth.uid()))
  with check ((select private.es_coord()) or created_by = (select auth.uid()));
create policy "borrar eventos" on public.eventos for delete to authenticated
  using ((select private.es_coord()) or created_by = (select auth.uid()));

insert into public.eventos (titulo, fecha, hora, origen, nota, created_by) values
  ('Encuentro de jóvenes con el Papa León XIV', '2026-11-10', '20:15', 'Agrupación', null, null),
  ('Congreso de la JUP', null, null, 'JUP', 'Diciembre. Falta fecha, horario y lugar.', null);

-- ---------- Links del Form de actividades y la planilla de inscriptos ----------
insert into public.documentos (titulo, url, tipo, nota, created_by) values
  ('Form de actividades (inscripción)', 'https://docs.google.com/forms/d/1jHldh7T0kPX9U3Kk6UvpGm8pHOQm3PjPD7aCPnmrAGc/edit', 'inscripcion',
   'Cada actividad se carga como opción con el formato "5/11 • 18 HS | NOMBRE". Dar acceso a quien tenga la tarea.', null),
  ('Planilla de inscriptos (histórica)', 'https://docs.google.com/spreadsheets/d/1bG3LcX0Y5yB_T5yMEyCSTIYV7ulhVF3F90mCY-eJ7Aw/edit', 'planilla',
   'Tiene DNI y datos sensibles: para repartir, mejor compartir una planilla aparte con nombre, teléfono y actividad.', null);
