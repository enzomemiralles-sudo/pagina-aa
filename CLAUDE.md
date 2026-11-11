# Página de Actividades Académicas (AA)

Herramienta de trabajo interna de la comisión de Actividades Académicas de Derecho (UBA), que trabaja bajo las identidades Nexo Derecho y JUP. La usan todos los integrantes (unas 25 personas), la persona responsable de AA y la persona de seguimiento de la Comisión Directiva.

Leé también `AGENTS.md`: Next.js 16 tiene cambios grandes respecto de versiones anteriores (por ejemplo, `middleware` ahora se llama `proxy`).

## Stack

- Next.js 16 (App Router, Server Components, Server Actions). Sin Cache Components: todo depende de la sesión.
- Supabase: Postgres + Auth (mail y contraseña) + Row Level Security. Proyecto `actividades-academicas` (región sa-east-1).
- Vercel para publicar. Variables: `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY` (ver `.env.example`).
- CSS propio en `app/globals.css`, sin librerías de UI. Fuente Public Sans.

## Reglas que no se rompen

1. **Los permisos viven en la base**, no en la interfaz. Cada tabla tiene RLS y hay triggers que protegen la aprobación y el seguimiento (`supabase/esquema.sql`). Ocultar un botón no alcanza: si agregás una tabla, agregale RLS y políticas.
2. **Roles**: `integrante`, `responsable` (administra integrantes), `seguimiento` y `columna` (releva la asistencia a la reunión; ve la comisión, no administra, no carga actualización semanal). Coordinación = responsable + seguimiento activos. `llevaAsistencia` = coordinación o Columna. Estados de cuenta: `pendiente` (no ve nada), `activo`, `en_pausa` (entra pero no cuenta en las actualizaciones que faltan), `baja`.
3. **La primera cuenta que se registra queda como responsable activa**; el resto entra pendiente hasta que la responsable la aprueba en `/integrantes`.
4. **Aprobaciones**: un integrante propone (proyecto o actividad) y queda `propuesta`; solo coordinación aprueba. Dentro de un proyecto aprobado, su responsable o la gente de su mesa pueden crear actividades ya aprobadas. El seguimiento (`pendiente` / `validado` / `devuelto`) solo lo registra coordinación.
5. **Las actualizaciones semanales** solo las ven su autor y coordinación.
6. **Datos personales**: no se guardan DNI ni evaluaciones de personas. Las evaluaciones van en un documento privado entre responsable y seguimiento, fuera de la página.
7. **Código de colores** (solo indica estado, siempre con texto): rojo = problema (trabado, vencido, sin movimiento) · ámbar = atención (vence hoy, esperando seguimiento, falta cerrar) · azul = en marcha · verde = listo · gris = sin empezar. Azul oscuro `#1b2a4a` = menú y botones principales. Las etiquetas están en `lib/etiquetas.ts`.
8. Interfaz en español rioplatense, con voseo. Fechas en hora de Buenos Aires (`lib/fechas.ts`).
9. WhatsApp sigue siendo el canal: la página genera textos para copiar (punteo, acta, recordatorio, mensajes modelo, DDO); no publica sola.
10. **No todo vive en la página**: las inscripciones están en el Form de actividades y su planilla de Google (con DNI y datos sensibles: nunca se importan). Para repartir, se pega lo copiado de la planilla y `lib/contactos.ts` lo lee **en el navegador**: solo viajan a la base nombre y teléfono de cada inscripto (`bloques.contactos`), visibles para quien repartió, coordinación y el compañero asignado, y `pg_cron` (`purgar-contactos`) los borra 7 días después del día de contacto.
11. Color por comisión **solo** en la semana de la agrupación (`/calendario?vista=semana`, clases `com-*`), siempre con el nombre de la comisión escrito; en el resto de la página el color sigue diciendo el estado.

## Ciclo semanal

- La semana termina en la reunión de los miércoles a las 18:30. La clave de la semana es la fecha de ese miércoles (`semanaActual()`).
- La actualización semanal cierra el martes a las 22 h (`estadoCierre()`). Lo hecho y lo pendiente salen de las tareas; la persona solo agrega "¿Necesitás algo?".
- El informe de coordinación (`/coordinacion`) junta actualizaciones, pedidos, trabadas, seguimiento, ideas, proyectos sin movimiento y arma el punteo.
- En la reunión (`/reuniones/[id]`), quien toma el acta carga notas, decisiones y tareas por tema; las tareas le aparecen enseguida a su responsable.
- Punteo sugerido (`/reuniones/[id]/armar`, coordinación): `lib/punteo.ts` arma el borrador con el criterio de Enzo — acta primero; operativas que bajan de arriba y fechas de la agrupación; lo que quedó sin tratar de la reunión anterior; el avance de cada proyecto por urgencia (próxima actividad, trabadas, vencidas, sin responsable, propuesta para aprobar); pendientes y pedidos; ideas nuevas; cierra con repaso de tareas y tareas libres. Tiempo: 18:35 a 19:40 (65 min); lo que no entra queda "para la próxima". El borrador se guarda en `reuniones.borrador_punteo` para compararlo con el punteo final (`reunion_temas`) y ajustar las reglas. Cada tema tiene `puntos` (salen en el texto para WhatsApp) y `minutos`.
- Asistencia (`/columna`): Columna (Isma) marca quién viene, motivo, a quién insistir y cómo llegó (18:00 alguien busca aula, 18:15 en la puerta, 18:30 adentro, 18:35 arranca). La lista es la `nomina` (con o sin cuenta). Cada uno también responde desde Inicio.
- Contactos (`/contactos`): grilla de quién contacta cada día; "Repartir" (pegar filas → filtrar actividad → bloques de hasta 30 → tareas con enlace a `/contactos/b/[id]`); seguimiento en `/contactos/r/[id]`.
- Comunicación (`/comunicacion`): las piezas son tareas con `canal` (form, posteo, historia, reel); el plan sugerido está en `PLAN_COMUNICACION`.
- Semana de la agrupación (`/calendario?vista=semana`): AA, DDO de las comisiones (coordinación) y `eventos` (fechas de la agrupación; sin fecha = a confirmar).
- DDO (`/ddo`, coordinación): se pegan los DDO de las otras comisiones tal cual; `lib/ddo.ts` los separa por "DDO …", ubica cada día (si la fecha no coincide con el día de la semana, avisa) y separa lo de "COMU:". El DDO de AA se arma con tareas, actividades y reuniones de la semana.

## Mapa del código

- `proxy.ts`: refresca la sesión y manda a `/login` si no hay usuario.
- `lib/sesion.ts`: `requerirMiembro()` / `requerirCoord()` devuelven el cliente de Supabase y a la persona logueada.
- `app/(app)/acciones.ts`: todas las Server Actions. Ante un error guardan un aviso en la cookie `aviso`, que muestra el layout.
- `app/(app)/`: `page.tsx` (Inicio), `calendario/` (mío, general y semana de la agrupación; arrastrar para cambiar fecha), `contactos/`, `comunicacion/`, `comision/` (proyectos y actividades por mesa, mesas, ideas, líneas), `proyectos/`, `actividades/` (+ `[id]/guia` para el celular), `cargar/`, `reuniones/`, `columna/`, `herramientas/`, `actualizacion/`, `coordinacion/`, `ddo/`, `integrantes/`.
- `components/`: menú, tabla de tareas, formularios, botones de seguimiento, componentes cliente (`Cliente.tsx`, `Calendario.tsx`, `ListaAsistencia.tsx`, `Repartir.tsx`, `ListaContactos.tsx`, `DdoAA.tsx`), `Semana.tsx` (semana en columnas).
- `lib/etiquetas.ts`: también `PLANTILLAS` (tareas sugeridas con días de anticipación) y `GUIAS` (protocolo de visita y charla).
- `supabase/esquema.sql`: esquema completo, políticas y triggers (referencia; los cambios se aplican como migraciones nuevas).

## Provisorio (borrar cuando todos tengan cuenta)

- `tareas.responsable_nomina_id`: una tarea puede quedar a nombre de alguien de la lista de compañeros sin cuenta (opción "Sin cuenta en la página" del selector). En el código: `responsablesPosibles`, `claveResponsable`, `separarResponsable` (`lib/datos.ts`). Cuando la persona se vincula en Columna, el trigger `pasar_tareas` le pasa las tareas a su cuenta. Migración: `supabase/migraciones/2026-11-11_tareas_responsable_sin_cuenta.sql`.

## Pendiente (próximas versiones)

- Inscriptos: falta pasar a Sumables. Leer la planilla directo (API de Google con cuenta de servicio) evitaría el copiar y pegar, pero haría que el servidor lea DNI y datos políticos: por ahora no.
- Contactos institucionales y oradores; archivo audiovisual (YouTube).
- Recordatorios (mail o push) y vista de celular más trabajada.
- Indicadores, cuando haya datos de base.

## Pruebas locales

No hay acceso a Supabase desde la terminal de Claude: se prueba con un Supabase falso (`/home/claude/mock/server.js`, puerto 54321, aplica filtros `eq`/`in` y guarda escrituras en memoria) y `next dev -p 3200` con `NEXT_PUBLIC_SUPABASE_URL=http://localhost:54321`. Los cambios de base se aplican con el conector de Supabase y quedan en `supabase/migraciones/`.

## Puesta en marcha (estado al 4/11/2026)

- Base: proyecto de Supabase `actividades-academicas`, ref `luwdghvzabcmbpvhvxia` (organización de Enzo). Es la única base con el esquema. "Confirm email" está desactivado en Auth.
- En Vercel, `NEXT_PUBLIC_SUPABASE_URL` tiene que ser `https://luwdghvzabcmbpvhvxia.supabase.co` y `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY` la clave publicable de ese proyecto. **No usar la integración de Supabase del Marketplace de Vercel**: crea otra base vacía y pisa estas variables. Las `NEXT_PUBLIC_*` se fijan al compilar: después de cambiarlas hay que volver a desplegar.
- La base gratuita de Supabase se pausa si pasa días sin uso (pasó el 9/11 y hubo que restaurarla). `/api/latido` hace una consulta mínima todos los días (cron en `vercel.json`) y además devuelve a qué base apunta la página (`base`).
- Síntoma de base equivocada: al registrarse aparece "Tu cuenta espera aprobación" sin nombre (la tabla `integrantes` no existe en esa base).

## Comandos

```bash
npm install
npm run dev     # http://localhost:3000 (necesita .env.local)
npm run build
```
