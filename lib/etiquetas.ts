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

// Tareas sugeridas por tipo de actividad (Documento Maestro, 8.4). Se cargan editables.
export const PLANTILLAS: Record<string, string[]> = {
  charla: [
    "Definir temática y criterio del ciclo",
    "Identificar y contactar orador",
    "Confirmar disponibilidad y datos del expositor",
    "Crear enlace de Zoom",
    "Preparar mensaje de difusión y mensaje con enlace",
    "Organizar grilla de distribución de contactos",
    "Preparar presentación del orador",
    "Obtener y organizar grabación",
    "Publicar en YouTube cuando corresponda",
    "Registrar contacto, participantes y balance",
  ],
  visita: [
    "Definir institución, objetivo y fecha",
    "Contactar institución y confirmar condiciones",
    "Relevar requisitos de ingreso",
    "Crear formulario y controlar inscriptos",
    "Distribuir contactos y confirmar asistencia",
    "Preparar lista de ingreso",
    "Definir punto de encuentro y horarios",
    "Designar responsables de coordinación presencial",
    "Registrar asistencia efectiva",
    "Agradecer, conservar el vínculo y cerrar la actividad",
  ],
};
