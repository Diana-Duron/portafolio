// Antepone el base path del sitio a una ruta absoluta (p. ej. '/perfil' -> '/portafolio/perfil').
// En GitHub Pages el workflow construye con --base "/portafolio"; en local el base es "/".
export const withBase = (path: string) => `${import.meta.env.BASE_URL.replace(/\/$/, '')}${path}`;
