// Worker entrypoint para Cloudflare Workers con Static Assets y D1
import { onRequest } from './functions/api/[[route]].js';

export default {
  async fetch(request, env, ctx) {
    const url = new URL(request.url);

    // Enrutar todas las llamadas a /api/ a nuestra API de backend
    if (url.pathname.startsWith('/api')) {
      return onRequest({ request, env, params: {} });
    }

    // Para cualquier otro archivo (HTML, CSS, JS, imágenes), servir estático
    if (env.ASSETS && typeof env.ASSETS.fetch === 'function') {
      return env.ASSETS.fetch(request);
    }

    return new Response('Not Found', { status: 404 });
  }
};
