# Criterio de punteo de Enzo

El objetivo es que la página arme el punteo como lo arma Enzo. Para aprenderlo, cada reunión deja registrado qué propuso el borrador, qué corrigió Enzo y qué corrigió Sofi. De esas diferencias salen las reglas de `lib/punteo.ts`.

## Cómo circula el punteo

1. **Borrador**: lo arma la página (`/reuniones/[id]/armar`, `lib/punteo.ts`) o Claude. Se guarda en `reuniones.borrador_punteo.sugeridos`.
2. **Versión con tiempos (coordinación)**: el borrador con la línea de horarios y la hora y los minutos de cada tema. Es para Enzo y no se corrige.
3. **Versión de Enzo para Sofi**: Enzo lee el borrador, lo corrige y se lo pasa a Sofi (seguimiento) sin tiempos. Se guarda en `borrador_punteo.version_enzo_para_sofi`.
4. **Versión de Sofi**: Sofi corrige. Es el punteo final: va a `reunion_temas` y se guarda en `borrador_punteo.version_sofi`.

En la página: "Copiar punteo para WhatsApp" da la versión sin tiempos; "Copiar con tiempos" da la de coordinación.

## Reglas vigentes

Cada regla lleva la reunión de la que salió.

- **Orden** (Enzo, 11/11): acta → operativas y fechas → lo que quedó de la reunión anterior → avance de cada proyecto → pendientes y pedidos → ideas → repaso de tareas y tareas libres.
- **Duración** (Enzo, 11/11): de 18:35 a 19:40. Lo que no entra queda para la próxima.
- **Versión para Sofi y el grupo sin tiempos** (18/11): sin la línea "🕕 18:15 en la puerta…" y sin hora ni minutos por tema. Los tiempos quedan solo en la versión de coordinación.
- **Encabezado** (18/11): `*Punteo – Reunión de AA · miércoles 18/11*`.
- **"Operativas y fechas"** (18/11), no "Operativas y fechas de la agrupación".
- **Fechas de la agrupación** (18/11):
  - Si son de esa semana: "¿Quiénes están?". Se cuenta quién va; la logística ("cómo vamos") no se trata en la reunión.
  - Si son más adelante: "Confirmar con tiempo.". Por eso entran las de hasta un mes (`DIAS_EVENTOS`).
- **Cierre del año** (18/11): "Repasar fecha y confirmación". Es una fecha que hay que confirmar, no la última reunión.

## Preguntas abiertas

Diferencias que todavía no tienen regla:

- 18/11: Enzo sacó de la versión para Sofi tres cosas del borrador:
  - la Reunión General ("hoy, 20 hs");
  - el contacto de inscriptos, que había quedado de la reunión anterior;
  - la actividad con Nati Salvo (27/11, a confirmar).
  
  ¿Por qué? Cuando lo diga, va acá como regla.

## Registro por reunión

### Miércoles 18/11/2026

**Borrador (versión con tiempos, la que Enzo usa para él)**

```
*Punteo – Reunión de AA · miércoles 18/11*
🕕 18:15 en la puerta del aula · 18:35 arrancamos · 19:40 terminamos

1. 📝 Acta: quién la toma y se la pasa a Enzo (18:35 · 2')
2. Operativas y fechas de la agrupación (18:37 · 8')
   – Vuelta de Obligado: viernes 20/11, 11:30 hs. ¿Quiénes van y cómo vamos?
   – Congreso Nacional de la JUP en Córdoba: 4 y 5/12. Confirmar con tiempo
   – Reunión General: hoy, 20 hs
3. Contacto de inscriptos, que quedó de la reunión pasada (18:45 · 8')
   – Grilla de mensajes: quién contacta cada día y suplentes
   – Reparto de contactos: Zoe
4. Ciclo de penal: charla + visita (18:53 · 20')
   – Visita al Museo de la Policía Federal: fecha (Iara)
   – Charla virtual sobre la cuestión policial y la prueba en el proceso penal: orador/a, fecha y título
   – Primero la charla, después la visita
   – Speech (Fiona) y forms post actividad (Cata)
   – Comunicación: posteo, historias y reel. ¿Quién se encarga?
5. Actividad con Nati Salvo: viernes 27/11 (19:13 · 8')
   – Confirmación y responsables
   – Plan B
6. Cierre del año (19:21 · 10')
   – Cómo seguimos coordinando hasta el 4/12
7. Repaso de tareas y tareas libres (19:31 · 9')
```

**Versión de Enzo para Sofi**

```
*Punteo – Reunión de AA · miércoles 18/11*
1. 📝 Acta: quién la toma y se la pasa a Enzo.
2. Operativas y fechas.
   – Vuelta de Obligado: viernes 20/11, 11:30 hs. ¿Quiénes estan? (por si alguno mas se suma)
   – Congreso Nacional de la JUP en Córdoba: 4 y 5/12. Confirmar con tiempo.
3. Ciclo de penal: charla + visita
   – Visita al Museo de la Policía Federal: fecha (Iara)
   – Charla virtual sobre la cuestión policial y la prueba en el proceso penal: orador/a, fecha y título
   – Primero la charla, después la visita
   – Speech (Fiona) y forms post actividad (Cata)
   – Comunicación: posteo, historias y reel. Pensar
5. Cierre del año
   – Repasar fecha y cnfirmacion.
7. Repaso de tareas y tareas libres
```

La numeración salteada (5, 7) es de la edición del borrador, no un criterio. La página numera corrido.

**Qué cambió del borrador a la versión de Enzo**

| Cambio | Regla |
|---|---|
| Sin línea de horarios ni tiempos por tema | Versión para Sofi sin tiempos |
| "Operativas y fechas de la agrupación" pasa a "Operativas y fechas" | Título corto |
| "¿Quiénes van y cómo vamos?" pasa a "¿Quiénes están? (por si alguno más se suma)" | Fechas de la semana: contar quién va |
| Saca "Reunión General: hoy, 20 hs" | Pregunta abierta |
| Saca "Contacto de inscriptos" | Pregunta abierta |
| Saca "Actividad con Nati Salvo" | Pregunta abierta |
| "¿Quién se encarga?" pasa a "Pensar" (comunicación) | Una sola vez: todavía no es regla |
| "Cómo seguimos coordinando hasta el 4/12" pasa a "Repasar fecha y confirmación" | El cierre del año es una fecha a confirmar |

**Versión de Sofi**: pendiente.
