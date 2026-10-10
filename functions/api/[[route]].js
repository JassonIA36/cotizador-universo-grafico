// Cloudflare Pages Function: API Backend con Cloudflare D1
// Maneja Autenticación y Sincronización Multidispositivo en el Edge

// Helper para respuestas JSON con CORS
function jsonResponse(data, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: {
      'Content-Type': 'application/json',
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type, Authorization',
      'Cache-Control': 'no-store'
    }
  });
}

// Hashing con Web Crypto API (SHA-256 con salt)
async function hashPassword(password, salt = 'universo_grafico_salt_2026') {
  const enc = new TextEncoder();
  const data = enc.encode(password + ':' + salt);
  const hashBuffer = await crypto.subtle.digest('SHA-256', data);
  const hashArray = Array.from(new Uint8Array(hashBuffer));
  return hashArray.map(b => b.toString(16).padStart(2, '0')).join('');
}

// Generación y verificación simple de Token (Base64 HMAC o Token Seguro)
async function createToken(payload, secret = 'ug_secret_jwt_key_2026') {
  const enc = new TextEncoder();
  const header = btoa(JSON.stringify({ alg: 'HS256', typ: 'JWT' }));
  const body = btoa(JSON.stringify({ ...payload, exp: Date.now() + (365 * 24 * 60 * 60 * 1000) })); // 1 año
  const signatureInput = `${header}.${body}`;
  const key = await crypto.subtle.importKey(
    'raw',
    enc.encode(secret),
    { name: 'HMAC', hash: 'SHA-256' },
    false,
    ['sign']
  );
  const sigBuffer = await crypto.subtle.sign('HMAC', key, enc.encode(signatureInput));
  const sigArray = Array.from(new Uint8Array(sigBuffer));
  const signature = btoa(String.fromCharCode(...sigArray)).replace(/=/g, '').replace(/\+/g, '-').replace(/\//g, '_');
  return `${signatureInput}.${signature}`;
}

async function verifyToken(token, secret = 'ug_secret_jwt_key_2026') {
  try {
    if (!token) return null;
    const parts = token.split('.');
    if (parts.length !== 3) return null;
    const [header, body, sig] = parts;
    const enc = new TextEncoder();
    const signatureInput = `${header}.${body}`;
    const key = await crypto.subtle.importKey(
      'raw',
      enc.encode(secret),
      { name: 'HMAC', hash: 'SHA-256' },
      false,
      ['verify']
    );
    // Decodificar firma base64url
    let base64 = sig.replace(/-/g, '+').replace(/_/g, '/');
    while (base64.length % 4) base64 += '=';
    const sigBytes = Uint8Array.from(atob(base64), c => c.charCodeAt(0));
    const valid = await crypto.subtle.verify('HMAC', key, sigBytes, enc.encode(signatureInput));
    if (!valid) return null;
    const payload = JSON.parse(atob(body));
    if (payload.exp && Date.now() > payload.exp) return null;
    return payload;
  } catch (err) {
    return null;
  }
}

// Extraer usuario del header Authorization
async function authenticateRequest(request, env) {
  const authHeader = request.headers.get('Authorization') || '';
  const token = authHeader.replace(/^Bearer\s+/i, '').trim();
  const secret = env.JWT_SECRET || 'ug_secret_jwt_key_2026';
  return await verifyToken(token, secret);
}

// Router principal para Cloudflare Pages Functions
export async function onRequest(context) {
  const { request, env } = context;
  const url = new URL(request.url);
  const path = url.pathname.replace(/^\/api\/?/, '');

  // Manejo de preflight CORS
  if (request.method === 'OPTIONS') {
    return new Response(null, {
      status: 204,
      headers: {
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
        'Access-Control-Allow-Headers': 'Content-Type, Authorization'
      }
    });
  }

  // Verificar si la base de datos D1 está enlazada
  const db = env.DB;
  if (!db) {
    return jsonResponse({
      error: 'Base de datos D1 no enlazada en Cloudflare Pages.',
      hint: 'Agrega el binding "DB" en la configuración de Pages > Settings > Functions > D1 database bindings.'
    }, 500);
  }

  // Endpoint: Health Check y Estado
  if (path === 'status' || path === '') {
    return jsonResponse({
      status: 'ok',
      service: 'Universo Gráfico – API Cloudflare D1',
      version: '1.0.0',
      time: new Date().toISOString()
    });
  }

  // Endpoint: Registro de Usuario
  if (path === 'auth/register' && request.method === 'POST') {
    try {
      const { email, password, nombre } = await request.json();
      if (!email || !password) {
        return jsonResponse({ error: 'Email y contraseña requeridos' }, 400);
      }
      const cleanEmail = email.trim().toLowerCase();
      const existing = await db.prepare('SELECT id FROM usuarios WHERE email = ?').bind(cleanEmail).first();
      if (existing) {
        return jsonResponse({ error: 'El usuario ya existe' }, 409);
      }
      const id = crypto.randomUUID();
      const passwordHash = await hashPassword(password);
      await db.prepare(
        'INSERT INTO usuarios (id, email, password_hash, nombre, created_at) VALUES (?, ?, ?, ?, datetime("now"))'
      ).bind(id, cleanEmail, passwordHash, nombre || 'Administrador').run();

      const secret = env.JWT_SECRET || 'ug_secret_jwt_key_2026';
      const token = await createToken({ id, email: cleanEmail, nombre: nombre || 'Administrador' }, secret);
      return jsonResponse({
        success: true,
        token,
        user: { id, email: cleanEmail, nombre: nombre || 'Administrador' }
      });
    } catch (err) {
      return jsonResponse({ error: 'Error al registrar usuario: ' + err.message }, 500);
    }
  }

  // Endpoint: Inicio de Sesión
  if (path === 'auth/login' && request.method === 'POST') {
    try {
      const { email, password } = await request.json();
      if (!email || !password) {
        return jsonResponse({ error: 'Email y contraseña requeridos' }, 400);
      }
      const cleanEmail = email.trim().toLowerCase();
      const user = await db.prepare('SELECT * FROM usuarios WHERE email = ?').bind(cleanEmail).first();
      
      // Si la base de datos está vacía, registrar automáticamente como primer usuario admin
      if (!user) {
        const totalUsers = await db.prepare('SELECT count(*) as count FROM usuarios').first();
        if (!totalUsers || totalUsers.count === 0) {
          const id = crypto.randomUUID();
          const passwordHash = await hashPassword(password);
          await db.prepare(
            'INSERT INTO usuarios (id, email, password_hash, nombre, created_at) VALUES (?, ?, ?, ?, datetime("now"))'
          ).bind(id, cleanEmail, passwordHash, 'Administrador Universo Gráfico').run();

          const secret = env.JWT_SECRET || 'ug_secret_jwt_key_2026';
          const token = await createToken({ id, email: cleanEmail, nombre: 'Administrador Universo Gráfico' }, secret);
          return jsonResponse({
            success: true,
            isNewAccount: true,
            token,
            user: { id, email: cleanEmail, nombre: 'Administrador Universo Gráfico' }
          });
        }
        return jsonResponse({ error: 'Credenciales inválidas' }, 401);
      }

      const inputHash = await hashPassword(password);
      if (inputHash !== user.password_hash) {
        return jsonResponse({ error: 'Credenciales inválidas' }, 401);
      }

      const secret = env.JWT_SECRET || 'ug_secret_jwt_key_2026';
      const token = await createToken({ id: user.id, email: user.email, nombre: user.nombre }, secret);
      return jsonResponse({
        success: true,
        token,
        user: { id: user.id, email: user.email, nombre: user.nombre }
      });
    } catch (err) {
      return jsonResponse({ error: 'Error en autenticación: ' + err.message }, 500);
    }
  }

  // Endpoint: Restablecer / Recuperar Contraseña
  if (path === 'auth/reset' && request.method === 'POST') {
    try {
      const { email, newPassword } = await request.json();
      if (!email || !newPassword) {
        return jsonResponse({ error: 'Email y nueva contraseña requeridos' }, 400);
      }
      const cleanEmail = email.trim().toLowerCase();
      const user = await db.prepare('SELECT id, nombre FROM usuarios WHERE email = ?').bind(cleanEmail).first();
      if (!user) {
        return jsonResponse({ error: 'No se encontró ningún usuario con ese correo electrónico' }, 404);
      }
      const newHash = await hashPassword(newPassword);
      await db.prepare('UPDATE usuarios SET password_hash = ? WHERE id = ?').bind(newHash, user.id).run();

      const secret = env.JWT_SECRET || 'ug_secret_jwt_key_2026';
      const token = await createToken({ id: user.id, email: cleanEmail, nombre: user.nombre }, secret);
      return jsonResponse({
        success: true,
        message: 'Contraseña actualizada correctamente',
        token,
        user: { id: user.id, email: cleanEmail, nombre: user.nombre }
      });
    } catch (err) {
      return jsonResponse({ error: 'Error al restablecer contraseña: ' + err.message }, 500);
    }
  }

  // Endpoints protegidos: Sincronización
  const authUser = await authenticateRequest(request, env);
  if (!authUser) {
    return jsonResponse({ error: 'No autorizado. Token inválido o ausente.' }, 401);
  }

  // GET /api/sync : Descarga de registros del usuario
  if (path === 'sync' && request.method === 'GET') {
    try {
      const since = url.searchParams.get('since') || '';
      let query = 'SELECT id, tipo, datos, deleted, updated_at FROM registros WHERE user_id = ?';
      const params = [authUser.id];

      if (since) {
        query += ' AND updated_at > ?';
        params.push(since);
      }
      query += ' ORDER BY updated_at ASC LIMIT 1000';

      const stmt = db.prepare(query).bind(...params);
      const { results } = await stmt.all();

      return jsonResponse({
        success: true,
        items: results || [],
        serverTime: new Date().toISOString()
      });
    } catch (err) {
      return jsonResponse({ error: 'Error al consultar registros: ' + err.message }, 500);
    }
  }

  // POST /api/sync : Subida y fusión por ID con winning timestamp
  if (path === 'sync' && request.method === 'POST') {
    try {
      const body = await request.json();
      const items = Array.isArray(body.items) ? body.items : [];
      let upsertCount = 0;

      for (const item of items) {
        try {
          if (!item || !item.id || !item.tipo) continue;

          const id = String(item.id);
          const tipo = String(item.tipo);
          const datos = typeof item.datos === 'string' ? item.datos : JSON.stringify(item.datos || {});
          const deleted = item.deleted ? 1 : 0;
          const updatedAt = item.updated_at || new Date().toISOString();

          // Consultar registro existente en D1
          const existing = await db.prepare(
            'SELECT updated_at, deleted FROM registros WHERE id = ? AND user_id = ?'
          ).bind(id, authUser.id).first();

          if (!existing) {
            // Insertar nuevo
            await db.prepare(
              'INSERT INTO registros (id, user_id, tipo, datos, deleted, updated_at) VALUES (?, ?, ?, ?, ?, ?)'
            ).bind(id, authUser.id, tipo, datos, deleted, updatedAt).run();
            upsertCount++;
          } else {
            // Fusión: deleted=true gana en empate
            const clientTime = new Date(updatedAt).getTime();
            const serverTime = new Date(existing.updated_at).getTime();

            let shouldUpdate = false;
            if (deleted === 1) {
              // Si el cliente lo borró, gana si su timestamp es igual o más reciente
              if (clientTime >= serverTime) shouldUpdate = true;
            } else {
              // Cliente activo: si el servidor ya lo tenía borrado, solo gana si es estrictamente posterior
              if (existing.deleted === 1) {
                if (clientTime > serverTime) shouldUpdate = true;
              } else {
                if (clientTime >= serverTime) shouldUpdate = true;
              }
            }

            if (shouldUpdate) {
              await db.prepare(
                'UPDATE registros SET tipo = ?, datos = ?, deleted = ?, updated_at = ? WHERE id = ? AND user_id = ?'
              ).bind(tipo, datos, deleted, updatedAt, id, authUser.id).run();
              upsertCount++;
            }
          }
        } catch (itemErr) {
          console.error(`[D1 Sync Error] Error en item ${item?.id}:`, itemErr);
        }
      }

      // Devolver todos los registros actualizados para que el cliente reciba cambios remotos
      const { results } = await db.prepare(
        'SELECT id, tipo, datos, deleted, updated_at FROM registros WHERE user_id = ?'
      ).bind(authUser.id).all();

      return jsonResponse({
        success: true,
        processed: upsertCount,
        serverTime: new Date().toISOString(),
        items: results || []
      });
    } catch (err) {
      return jsonResponse({ error: 'Error al sincronizar datos: ' + err.message }, 500);
    }
  }

  return jsonResponse({ error: 'Ruta no encontrada' }, 404);
}
