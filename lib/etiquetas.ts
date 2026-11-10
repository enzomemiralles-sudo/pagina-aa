// Código de colores: el color solo dice el estado y siempre va con texto.
// rojo = problema · ambar = atención · azul = en marcha · verde = listo · gris = sin empezar
export type Color = "rojo" | "ambar" | "azul" | "verde" | "gris";

type Etiqueta = { texto: string; color: Color };

export const ESTADO_TAREA: Record<string, Etiqueta> = {
  pendiente: { texto: "Pendiente", color: "gris" },
  en_curso: { texto: "En curso", color: "azul" },
  trabada: { texto: "Trabada", color: "rojo" },
  hecha: { texto: "Hecha", color: "verde" },
  cancelada: { texto: "Cancelada", color: "gris" },
};

export const ESTADO_PROYECTO: Record<string, Etiqueta> = {
  propuesta: { texto: "Propuesta", color: "gris" },
  aprobado: { texto: "Aprobado", color: "azul" },
  en_marcha: { texto: "En marcha", color: "azul" },
  pausado: { texto: "Pausado", color: "gris" },
  terminado: { texto: "Terminado", color: "verde" },
  descartado: { texto: "Descartado", color: "gris" },
};

export const ESTADO_ACTIVIDAD: Record<string, Etiqueta> = {
  propuesta: { texto: "Propuesta", color: "gris" },
  aprobada: { texto: "Aprobada", color: "azul" },
  en_organizacion: { texto: "En organización", color: "azul" },
  inscripciones_abiertas: { texto: "Inscripciones abiertas", color: "azul" },
  realizada: { texto: "Realizada", color: "verde" },
  cerrada: { texto: "Cerrada", color: "verde" },
  cancelada: { texto: "Cancelada", color: "gris" },
};

export const SEGUIMIENTO: Record<string, Etiqueta> = {
  no_requiere: { texto: "No requiere seguimiento", color: "gris" },
  pendiente: { texto: "Esperando seguimiento", color: "ambar" },
  validado: { texto: "Validado con seguimiento", color: "verde" },
  devuelto: { texto: "Devuelto por seguimiento", color: "rojo" },
};

export const ESTADO_IDEA: Record<string, Etiqueta> = {
  nueva: { texto: "Nueva", color: "gris" },
  en_punteo: { texto: "En el punteo", color: "azul" },
  propuesta: { texto: "Pasó a propuesta", color: "verde" },
  postergada: { texto: "Postergada", color: "gris" },
  descartada: { texto: "Descartada", color: "gris" },
};

export const ESTADO_REUNION: Record<string, Etiqueta> = {
  preparacion: { texto: "En preparación", color: "gris" },
  en_curso: { texto: "En curso", color: "azul" },
  cerrada: { texto: "Acta publicada", color: "verde" },
};

export const ROL: Record<string, string> = {
  integrante: "Integrante",
  responsable: "Responsable de AA",
  seguimiento: "Seguimiento",
  columna: "Columna",
};

// Asistencia a la reunión: lo que responde antes y cómo llegó el día.
export const RESPUESTA: Record<string, Etiqueta> = {
  sin_respuesta: { texto: "Sin respuesta", color: "gris" },
  viene: { texto: "Viene", color: "verde" },
  no_sabe: { texto: "No sabe", color: "ambar" },
  no_viene: { texto: "No viene", color: "rojo" },
};

export const LLEGADA: Record<string, Etiqueta> = {
  a_horario: { texto: "Llegó a horario", color: "verde" },
  tarde: { texto: "Llegó tarde", color: "ambar" },
  no_vino: { texto: "No vino", color: "rojo" },
};

// Para qué sirve cada enlace. Los mensajes modelo usan el de cada tipo.
export const TIPO_ENLACE: Record<string, { texto: string; ayuda: string }> = {
  inscripcion: { texto: "Form de inscripción", ayuda: "Google Forms donde se anota la gente" },
  planilla: { texto: "Planilla de inscriptos", ayuda: "Google Sheets con las respuestas y el reparto" },
  grupo: { texto: "Grupo de WhatsApp", ayuda: "Link de invitación al grupo de la actividad" },
  zoom: { texto: "Zoom", ayuda: "Link de la reunión de Zoom" },
  encuesta: { texto: "Encuesta posterior", ayuda: "Google Forms para después de la actividad" },
  carpeta: { texto: "Carpeta de Drive", ayuda: "Documentos, fotos y videos" },
  difusion: { texto: "Difusión", ayuda: "Posteo, historia, reel o diseño en Canva" },
  otro: { texto: "Otro", ayuda: "" },
};

// Piezas de comunicación (son tareas con canal).
export const CANAL: Record<string, string> = {
  form: "Form",
  posteo: "Posteo",
  historia: "Historia",
  reel: "Reel",
  otro: "Difusión",
};

export const PARA_MENSAJE: Record<string, string> = {
  visita: "Visitas",
  charla: "Charlas",
  reunion: "Reunión de comisión",
  general: "General",
};

export const ESTADO_INTEGRANTE: Record<string, Etiqueta> = {
  pendiente: { texto: "Pendiente de aprobación", color: "ambar" },
  activo: { texto: "Activo", color: "verde" },
  en_pausa: { texto: "En pausa", color: "gris" },
  baja: { texto: "Baja", color: "gris" },
};

export const IDENTIDAD: Record<string, string> = {
  nexo: "Nexo",
  jup: "JUP",
  ambas: "Nexo y JUP",
  interna: "Uso interno",
};

export const TIPO_ACTIVIDAD: Record<string, string> = {
  charla: "Charla",
  visita: "Visita",
  jornada: "Jornada o congreso",
  presentacion: "Presentación",
  formativa: "Actividad formativa",
  otra: "Otra",
};

export const TIPO_IDEA: Record<string, string> = {
  idea: "Una idea",
  necesidad: "Una necesidad que detecté",
  oportunidad: "Una oportunidad",
};

// Tareas sugeridas por tipo de actividad (Documento Maestro 8.4, ajustado con cómo hacemos las visitas). Se cargan editables.
// El número es cuántos días antes de la actividad vence (si la actividad tiene fecha).
export const PLANTILLAS: Record<string, [string, number][]> = {
  charla: [
    ["Preguntar a compañeros que sepan del tema por posibles oradores", 21],
    ["Definir con el orador los temas de la charla", 14],
    ["Confirmar fecha (a la tarde), horario y datos del orador", 14],
    ["Crear el link de Zoom", 12],
    ["Repartir inscriptos y mandar el mensaje con el link (página: Contactos)", 2],
    ["Mandar el recordatorio el día de la charla", 0],
    ["Preparar la presentación del orador", 1],
    ["Grabar la charla y guardar la grabación", 0],
    ["Mandar la encuesta y cargar el cierre", -2],
  ],
  visita: [
    ["Pedir turno a la institución (2 semanas antes: qué día, mañana o tarde)", 14],
    ["Confirmar fecha, horario, cupo y requisitos de ingreso", 12],
    ["Crear el grupo de WhatsApp de la visita (con foto de perfil temática)", 8],
    ["Definir los dos responsables: contacto (habla y entra a avisar, lleva DNI) y registro (graba para Instagram)", 7],
    ["Repartir inscriptos y mandar la confirmación con el link del grupo (página: Contactos)", 5],
    ["Preparar el speech y pasárselo a los compañeros que van", 3],
    ["Recordatorio el día anterior y avisar si se liberaron lugares", 1],
    ["Pasarle el número final a la institución", 1],
    ["Mandar la encuesta de satisfacción", -1],
    ["Subir el material a Instagram y cargar el cierre", -3],
  ],
};

// Plan de comunicación de cada actividad: son tareas con canal, y se ven en la pestaña Comunicación.
export const PLAN_COMUNICACION: [string, number, string][] = [
  ["Cargar la actividad al Form de actividades", 12, "form"],
  ["Posteo de convocatoria", 10, "posteo"],
  ["Historia recordatorio", 8, "historia"],
  ["Reel (decidir si va)", 7, "reel"],
  ["Historia recordatorio", 5, "historia"],
  ["Historia: últimos lugares", 2, "historia"],
  ["Historia: es hoy", 0, "historia"],
];

// Guía para el día, editable en cada actividad. Se puede abrir en el celular.
export const GUIAS: Record<string, string> = {
  visita: `ANTES DE ENTRAR
1. Nos juntamos todos en la esquina, no en la puerta. Punto de encuentro: ___
2. Mientras esperamos, un compañero da el speech (abajo).
3. Quien hace de contacto se acerca solo a la puerta, avisa que llegó el grupo de Nexo y entra a confirmar. Lleva DNI por las dudas.
4. El resto espera en la esquina hasta que el contacto avise.

SPEECH (cada uno lo adapta y lo tiene a mano)
"Hola, soy ___ de Nexo. Venimos a conocer ___ porque ___. Mi parte favorita del recorrido es ___. Háganle preguntas a quien nos toque de guía: así la experiencia es más amena y mucho más rica."

ADENTRO
- El guía da una introducción de 20 a 30 minutos y después recorremos.
- No se pueden sacar fotos (el guía lo avisa). Lo respetamos todos.
- Animamos a la gente a preguntar.

RESPONSABLES
- Contacto (habla con la gente y entra a avisar): ___
- Registro (videos para Instagram, donde se permita): ___

DESPUÉS
- Agradecer al guía y a la institución.
- Mandar la encuesta al grupo de WhatsApp.
- Contar cuántos fuimos y cargar el cierre.`,
  charla: `ANTES
- Probar el Zoom con el orador 15 minutos antes.
- Tener a mano la presentación del orador.
- Pedirle permiso para grabar.

AL ARRANCAR (speech)
"Hola, soy ___ de Nexo. Hoy nos acompaña ___, que ___. Vamos a hablar de ___. Al final hay espacio para preguntas: déjenlas en el chat."

DURANTE
- Una persona modera el chat y junta las preguntas.
- Grabamos.

DESPUÉS
- Agradecer al orador.
- Mandar la encuesta.
- Guardar la grabación y cargar el cierre.`,
};

// Semana de la agrupación: un color por comisión (siempre con el nombre al lado).
const COLOR_COMISION: Record<string, string> = {
  "actividades academicas": "com-aa",
  aa: "com-aa",
  agrupacion: "com-agrupacion",
  jup: "com-agrupacion",
  nexo: "com-agrupacion",
  comunicacion: "com-comu",
  comu: "com-comu",
  coyuntura: "com-1",
  columna: "com-2",
  sumables: "com-3",
  tradu: "com-4",
  cgt: "com-5",
};
export function claseComision(nombre: string): string {
  const k = nombre.normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase().trim();
  if (COLOR_COMISION[k]) return COLOR_COMISION[k];
  let h = 0;
  for (const c of k) h = (h * 31 + c.charCodeAt(0)) >>> 0;
  return h % 2 ? "com-6" : "com-7";
}
