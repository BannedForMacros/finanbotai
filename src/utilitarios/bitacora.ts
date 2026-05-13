type Nivel = 'info' | 'warn' | 'error' | 'debug';

function escribir(nivel: Nivel, mensaje: string, contexto?: unknown) {
  const ts = new Date().toISOString();
  const linea = `[${ts}] [${nivel.toUpperCase()}] ${mensaje}`;
  if (contexto !== undefined) {
    if (nivel === 'error') console.error(linea, contexto);
    else if (nivel === 'warn') console.warn(linea, contexto);
    else console.log(linea, contexto);
  } else {
    if (nivel === 'error') console.error(linea);
    else if (nivel === 'warn') console.warn(linea);
    else console.log(linea);
  }
}

export const bitacora = {
  info: (m: string, c?: unknown) => escribir('info', m, c),
  warn: (m: string, c?: unknown) => escribir('warn', m, c),
  error: (m: string, c?: unknown) => escribir('error', m, c),
  debug: (m: string, c?: unknown) => {
    if (process.env.NODE_ENV !== 'production') escribir('debug', m, c);
  }
};
