-- 11/11/2026 · Punteo sugerido: puntos y minutos por tema; la reunión guarda el borrador para comparar con el punteo final.
alter table public.reunion_temas add column puntos text, add column minutos int check (minutos is null or minutos between 1 and 90);
alter table public.reuniones add column borrador_punteo jsonb;
