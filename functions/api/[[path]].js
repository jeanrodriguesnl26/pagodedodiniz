// API do site Pagode do Diniz — Cloudflare Pages Functions + D1
//
// Rotas:
//   GET  /api/data    -> dados do site (público filtrado; completo com token de admin)
//   PUT  /api/data    -> salva dados (somente admin)
//   POST /api/login   -> { password } => { token }
//
// Variáveis necessárias (Cloudflare):
//   DB              -> binding do banco D1
//   ADMIN_PASSWORD  -> senha do painel (secret)

const ALLOWED_KEYS = ['settings', 'story', 'members', 'gallery', 'shows'];
const MAX_VALUE_BYTES = 1_800_000; // limite do D1 por linha é ~2 MB
const TOKEN_TTL_MS = 12 * 60 * 60 * 1000; // 12 horas

const json = (data, status = 200) =>
  new Response(JSON.stringify(data), {
    status,
    headers: { 'Content-Type': 'application/json; charset=utf-8', 'Cache-Control': 'no-store' },
  });

const enc = new TextEncoder();

function getAdminPassword(env) {
  return (env && env.ADMIN_PASSWORD) ? String(env.ADMIN_PASSWORD).trim() : 'diniz2027';
}

async function hmacKey(env) {
  return crypto.subtle.importKey(
    'raw',
    enc.encode('pd-token:' + getAdminPassword(env)),
    { name: 'HMAC', hash: 'SHA-256' },
    false,
    ['sign', 'verify']
  );
}

const toHex = (buf) => [...new Uint8Array(buf)].map((b) => b.toString(16).padStart(2, '0')).join('');
const fromHex = (hex) => new Uint8Array(hex.match(/.{1,2}/g).map((h) => parseInt(h, 16)));

async function makeToken(env) {
  const exp = String(Date.now() + TOKEN_TTL_MS);
  const sig = await crypto.subtle.sign('HMAC', await hmacKey(env), enc.encode(exp));
  return `${exp}.${toHex(sig)}`;
}

async function isAdmin(request, env) {
  const auth = request.headers.get('Authorization') || '';
  const token = auth.startsWith('Bearer ') ? auth.slice(7) : '';
  const [exp, sig] = token.split('.');
  if (!exp || !sig || !/^[0-9a-f]+$/.test(sig) || Number(exp) < Date.now()) return false;
  try {
    return await crypto.subtle.verify('HMAC', await hmacKey(env), fromHex(sig), enc.encode(exp));
  } catch {
    return false;
  }
}

async function passwordMatches(input, env) {
  // comparação em tempo constante via HMAC
  const key = await crypto.subtle.importKey('raw', enc.encode('pd-login'), { name: 'HMAC', hash: 'SHA-256' }, false, ['sign']);
  const a = new Uint8Array(await crypto.subtle.sign('HMAC', key, enc.encode(String(input || '').trim())));
  const b = new Uint8Array(await crypto.subtle.sign('HMAC', key, enc.encode(getAdminPassword(env))));
  let diff = 0;
  for (let i = 0; i < a.length; i++) diff |= a[i] ^ b[i];
  return diff === 0;
}

async function readAll(env) {
  const { results } = await env.DB.prepare('SELECT key, value FROM kv').all();
  const data = {};
  for (const row of results) {
    if (ALLOWED_KEYS.includes(row.key)) {
      try { data[row.key] = JSON.parse(row.value); } catch { /* ignora linha inválida */ }
    }
  }
  return data;
}

// Visão pública: só shows fechados; particulares sem local; sem observações internas
function publicView(data) {
  const out = { ...data };
  if (Array.isArray(data.shows)) {
    out.shows = data.shows
      .filter((s) => s.confirmed !== false)
      .map((s) =>
        s.isPrivate
          ? { id: s.id, date: s.date, time: s.time, venue: 'Evento Particular', city: '', isPrivate: true, confirmed: true }
          : { id: s.id, date: s.date, time: s.time, venue: s.venue, city: s.city, isPrivate: false, confirmed: true }
      );
  }
  return out;
}

export async function onRequest({ request, env, params }) {
  if (!env.DB) return json({ error: 'Banco D1 não configurado (binding DB).' }, 500);
  if (!env.ADMIN_PASSWORD) return json({ error: 'ADMIN_PASSWORD não configurada.' }, 500);

  const route = Array.isArray(params.path) ? params.path.join('/') : params.path || '';

  try {
    if (route === 'login' && request.method === 'POST') {
      const body = await request.json().catch(() => ({}));
      if (await passwordMatches(body.password ?? '', env)) {
        return json({ token: await makeToken(env) });
      }
      await new Promise((r) => setTimeout(r, 800)); // dificulta tentativas em massa
      return json({ error: 'Senha incorreta.' }, 401);
    }

    if (route === 'data' && request.method === 'GET') {
      const data = await readAll(env);
      return json((await isAdmin(request, env)) ? { ...data, admin: true } : publicView(data));
    }

    if (route === 'data' && request.method === 'PUT') {
      if (!(await isAdmin(request, env))) return json({ error: 'Não autorizado.' }, 401);
      const body = await request.json().catch(() => null);
      if (!body || typeof body !== 'object') return json({ error: 'JSON inválido.' }, 400);

      const statements = [];
      for (const key of ALLOWED_KEYS) {
        if (!(key in body)) continue;
        const value = JSON.stringify(body[key]);
        if (enc.encode(value).length > MAX_VALUE_BYTES) {
          return json({ error: `Seção "${key}" muito grande (limite ~1,8 MB). Use imagens menores ou links.` }, 413);
        }
        statements.push(
          env.DB.prepare(
            'INSERT INTO kv (key, value, updated_at) VALUES (?1, ?2, ?3) ON CONFLICT(key) DO UPDATE SET value = ?2, updated_at = ?3'
          ).bind(key, value, new Date().toISOString())
        );
      }
      if (statements.length) await env.DB.batch(statements);
      return json({ ok: true });
    }

    return json({ error: 'Rota não encontrada.' }, 404);
  } catch (err) {
    return json({ error: 'Erro interno.', detail: String(err && err.message ? err.message : err) }, 500);
  }
}
