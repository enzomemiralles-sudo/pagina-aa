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
2. **Roles**: `integrante`, `responsable` (administra integrantes) y `seguimiento`. Coordinación = responsable + seguimiento activos. Estados de cuenta: `pendiente` (no ve nada), `activo`, `en_pausa` (entra pero no cuenta en las actualizaciones que faltan), `baja`.
3. **La primera cuenta que se registra queda como responsable activa**; el resto entra pendiente hasta que la responsable la aprueba en `/integrantes`.
4. **Aprobaciones**: un integrante propone (proyecto o actividad) y queda `propuesta`; solo coordinación aprueba. Dentro de un proyecto aprobado, su responsable o la gente de su mesa pueden crear actividades ya aprobadas. El seguimiento (`pendiente` / `validado` / `devuelto`) solo lo registra coordinación.
5. **Las actualizaciones semanales** solo las ven su autor y coordinación.
6. **Datos personales**: no se guardan DNI ni evaluaciones de personas. Las evaluaciones van en un documento privado entre responsable y seguimiento, fuera de la página.
7. **Código de colores** (solo indica estado, siempre con texto): rojo = problema (trabado, vencido, sin movimiento) · ámbar = atención (vence hoy, esperando seguimiento, falta cerrar) · azul = en marcha · verde = listo · gris = sin empezar. Azul oscuro `#1b2a4a` = menú y botones principales. Las etiquetas están en `lib/etiquetas.ts`.
8. Interfaz en español rioplatense, con voseo. Fechas en hora de Buenos Aires (`lib/fechas.ts`).
9. WhatsApp sigue siendo el canal: la página genera textos para copiar (punteo, acta, recordatorio); no publica sola.

## Ciclo semanal

- La semana termina en la reunión de los miércoles a las 18:30. La clave de la semana es la fecha de ese miércoles (`semanaActual()`).
- La actualización semanal cierra el martes a las 22 h (`estadoCierre()`). Lo hecho y lo pendiente salen de las tareas; la persona solo agrega "¿Necesitás algo?".
- El informe de coordinación (`/coordinacion`) junta actualizaciones, pedidos, trabadas, seguimiento, ideas, proyectos sin movimiento y arma el punteo.
- En la reunión (`/reuniones/[id]`), quien toma el acta carga notas, decisiones y tareas por tema; las tareas le aparecen enseguida a su responsable.

## Mapa del código

- `proxy.ts`: refresca la sesión y manda a `/login` si no hay usuario.
- `lib/sesion.ts`: `requerirMiembro()` / `requerirCoord()` devuelven el cliente de Supabase y a la persona logueada.
- `app/(app)/acciones.ts`: todas las Server Actions. Ante un error guardan un aviso en la cookie `aviso`, que muestra el layout.
- `app/(app)/`: `page.tsx` (Inicio), `comision/` (proyectos y actividades por mesa, mesas, ideas, líneas), `proyectos/`, `actividades/`, `cargar/`, `reuniones/`, `actualizacion/`, `coordinacion/`, `integrantes/`.
- `components/`: menú, tabla de tareas, formularios, botones de seguimiento, componentes cliente (`Cliente.tsx`).
- `supabase/esquema.sql`: esquema completo, políticas y triggers (referencia; los cambios se aplican como migraciones nuevas).

## Pendiente (próximas versiones)

- Inscriptos: importar planilla, repartir contactos entre compañeros, mensajes listos para copiar, confirmación y asistencia, pasar a Sumables.
- DDO semanal con texto para WhatsApp.
- Contactos institucionales y oradores; archivo audiovisual (YouTube).
- Recordatorios (mail o push) y vista de celular más trabajada.
- Indicadores, cuando haya datos de base.

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
