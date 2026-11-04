type P = { size?: number };

function Base({ size = 18, children }: P & { children: React.ReactNode }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      {children}
    </svg>
  );
}

export const IconoInicio = (p: P) => (<Base {...p}><path d="M3 10.5 12 3l9 7.5V20a1 1 0 0 1-1 1h-5v-6h-6v6H4a1 1 0 0 1-1-1z" /></Base>);
export const IconoComision = (p: P) => (<Base {...p}><circle cx="9" cy="8" r="3.2" /><path d="M3 20c0-3.3 2.7-6 6-6s6 2.7 6 6" /><path d="M16 5.2a3 3 0 0 1 0 5.6M21 20c0-2.6-1.6-4.8-4-5.6" /></Base>);
export const IconoReunion = (p: P) => (<Base {...p}><rect x="3.5" y="5" width="17" height="15.5" rx="2" /><path d="M3.5 10h17M8 3v4M16 3v4" /></Base>);
export const IconoCandado = (p: P) => (<Base {...p}><rect x="5" y="11" width="14" height="10" rx="2" /><path d="M8 11V8a4 4 0 0 1 8 0v3" /></Base>);
export const IconoMas = (p: P) => (<Base {...p}><path d="M12 5v14M5 12h14" /></Base>);
export const IconoCheck = (p: P) => (<Base {...p}><path d="m5 12.5 4.5 4.5L19 7.5" /></Base>);
export const IconoReloj = (p: P) => (<Base {...p}><circle cx="12" cy="12" r="9" /><path d="M12 7v5l3 2" /></Base>);
export const IconoAlerta = (p: P) => (<Base {...p}><circle cx="12" cy="12" r="9" /><path d="M12 7.5v5.5M12 16.5v.01" /></Base>);
export const IconoCopiar = (p: P) => (<Base {...p}><rect x="8" y="8" width="12" height="12" rx="2" /><path d="M16 8V5a1 1 0 0 0-1-1H5a1 1 0 0 0-1 1v10a1 1 0 0 0 1 1h3" /></Base>);
export const IconoEscudo = (p: P) => (<Base {...p}><path d="M12 3 5 6v5c0 4.5 3 8 7 10 4-2 7-5.5 7-10V6z" /><path d="m9 12 2 2 4-4" /></Base>);
export const IconoPersonas = (p: P) => (<Base {...p}><circle cx="12" cy="8" r="4" /><path d="M4 21c0-4.4 3.6-8 8-8s8 3.6 8 8" /></Base>);
export const IconoLista = (p: P) => (<Base {...p}><rect x="5" y="4" width="14" height="17" rx="2" /><path d="M9 4h6v3H9zM9 12h6M9 16h4" /></Base>);
export const IconoMensaje = (p: P) => (<Base {...p}><path d="M4 5h16v11H9l-5 4z" /></Base>);
export const IconoDocumento = (p: P) => (<Base {...p}><path d="M7 3h7l5 5v13H7z" /><path d="M14 3v5h5" /></Base>);
