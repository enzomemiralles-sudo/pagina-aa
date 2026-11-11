-- 11/11/2026 · PROVISORIO (mientras no todos tengan cuenta): una tarea puede quedar a nombre de alguien
-- de la lista de compañeros (nomina) que no tiene cuenta. Para sacarlo: borrar el trigger, la función y la columna.
alter table public.tareas
  add column responsable_nomina_id uuid references public.nomina(id) on delete set null,
  add constraint tareas_un_solo_responsable check (responsable_id is null or responsable_nomina_id is null);
create index tareas_responsable_nomina_idx on public.tareas (responsable_nomina_id);

-- Cuando esa persona se registra y se vincula en la lista, sus tareas pasan a su cuenta.
create function public.pasar_tareas_a_cuenta() returns trigger language plpgsql security definer set search_path = '' as $$
begin
  if new.integrante_id is not null and new.integrante_id is distinct from old.integrante_id then
    update public.tareas set responsable_id = new.integrante_id, responsable_nomina_id = null
    where responsable_nomina_id = new.id;
  end if;
  return new;
end $$;
create trigger pasar_tareas after update of integrante_id on public.nomina for each row execute function public.pasar_tareas_a_cuenta();
revoke execute on function public.pasar_tareas_a_cuenta() from public, anon, authenticated;
