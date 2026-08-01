export const config = { runtime: 'edge' };

const json = (body, status = 200) =>
  new Response(JSON.stringify(body), {
    status,
    headers: { 'Content-Type': 'application/json', 'Cache-Control': 'no-store' },
  });

function safeEqual(a, b) {
  if (typeof a !== 'string' || typeof b !== 'string' || a.length !== b.length) return false;
  let diff = 0;
  for (let i = 0; i < a.length; i++) diff |= a.charCodeAt(i) ^ b.charCodeAt(i);
  return diff === 0;
}

const VALIDO = /^[^@\s]+@[^@\s.]+\.[^@\s]{2,}$/;

export default async function handler(req) {
  const password = process.env.PANEL_PASSWORD;
  const url = process.env.SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_KEY;

  // Se avisa de todas las que falten a la vez, para no descubrirlas de una en una
  const faltan = [];
  if (!password) faltan.push('PANEL_PASSWORD');
  if (!url) faltan.push('SUPABASE_URL');
  if (!key) faltan.push('SUPABASE_SERVICE_KEY');
  if (faltan.length) {
    return json({ error: `Faltan variables en Vercel: ${faltan.join(', ')}.`, faltan }, 500);
  }

  const dada = req.headers.get('x-panel-key') || '';
  if (!safeEqual(dada, password)) return json({ error: 'Clave incorrecta.' }, 401);

  const cabeceras = {
    apikey: key,
    Authorization: `Bearer ${key}`,
    'Content-Type': 'application/json',
  };

  // ---- Listar suscriptores ----
  if (req.method === 'GET') {
    const res = await fetch(
      `${url}/rest/v1/suscriptores?select=email,creado_en,origen&order=creado_en.desc`,
      { headers: { ...cabeceras, Prefer: 'count=exact' } }
    );
    if (!res.ok) return json({ error: `Supabase ${res.status}: ${(await res.text()).slice(0, 160)}` }, 502);

    const filas = await res.json();
    return json({ total: filas.length, suscriptores: filas });
  }

  // ---- Importar en bloque (pegar los correos que ya existen) ----
  if (req.method === 'POST') {
    let texto = '';
    try {
      texto = (await req.json()).emails || '';
    } catch (_) {
      return json({ error: 'Petición inválida' }, 400);
    }

    // Acepta correos separados por comas, saltos de línea, espacios o punto y coma,
    // y también columnas de un CSV exportado
    const encontrados = String(texto)
      .split(/[\s,;]+/)
      .map(s => s.replace(/^["'<]+|["'>]+$/g, '').trim().toLowerCase())
      .filter(s => VALIDO.test(s) && s.length <= 254);

    const unicos = [...new Set(encontrados)];
    if (!unicos.length) return json({ error: 'No se encontró ningún correo válido.' }, 400);

    let insertados = 0, repetidos = 0;
    // De uno en uno para que un repetido no tumbe todo el lote
    for (const email of unicos) {
      const res = await fetch(`${url}/rest/v1/suscriptores`, {
        method: 'POST',
        headers: { ...cabeceras, Prefer: 'return=minimal' },
        body: JSON.stringify({ email, origen: 'importado' }),
      });
      if (res.ok) insertados++;
      else {
        const t = await res.text();
        if (res.status === 409 || t.includes('23505')) repetidos++;
        else return json({ error: `Supabase ${res.status}: ${t.slice(0, 160)}` }, 502);
      }
    }

    return json({ ok: true, encontrados: unicos.length, insertados, repetidos });
  }

  return json({ error: 'Method not allowed' }, 405);
}
