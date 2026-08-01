export const config = { runtime: 'edge' };

const FORMSPREE = 'https://formspree.io/f/xykabnza';

const json = (body, status = 200) =>
  new Response(JSON.stringify(body), {
    status,
    headers: { 'Content-Type': 'application/json', 'Cache-Control': 'no-store' },
  });

// Guarda el alta en Supabase. Un correo repetido no es un error: ya estaba.
async function guardar(email, origen) {
  const url = process.env.SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_KEY;
  if (!url || !key) return { ok: false, motivo: 'sin configurar' };

  const res = await fetch(`${url}/rest/v1/suscriptores`, {
    method: 'POST',
    headers: {
      apikey: key,
      Authorization: `Bearer ${key}`,
      'Content-Type': 'application/json',
      Prefer: 'return=minimal',
    },
    body: JSON.stringify({ email, origen }),
  });

  if (res.ok) return { ok: true, nuevo: true };

  const detalle = await res.text();
  // 23505 = violación de índice único → el correo ya estaba en la lista
  if (res.status === 409 || detalle.includes('23505')) return { ok: true, nuevo: false };

  return { ok: false, motivo: `${res.status} ${detalle.slice(0, 120)}` };
}

// Se sigue enviando a Formspree para conservar las notificaciones por correo
async function avisarFormspree(email) {
  try {
    const body = new FormData();
    body.append('email', email);
    await fetch(FORMSPREE, { method: 'POST', body, headers: { Accept: 'application/json' } });
  } catch (_) {
    // Si Formspree falla, el alta ya está guardada en la base de datos
  }
}

export default async function handler(req) {
  if (req.method !== 'POST') return json({ error: 'Method not allowed' }, 405);

  let email = '';
  try {
    const ct = req.headers.get('content-type') || '';
    if (ct.includes('application/json')) {
      email = (await req.json()).email || '';
    } else {
      email = (await req.formData()).get('email') || '';
    }
  } catch (_) {
    return json({ error: 'Petición inválida' }, 400);
  }

  email = String(email).trim().toLowerCase();
  if (!/^[^@\s]+@[^@\s.]+\.[^@\s]{2,}$/.test(email) || email.length > 254) {
    return json({ error: 'Correo no válido' }, 400);
  }

  const [guardado] = await Promise.all([guardar(email, 'web'), avisarFormspree(email)]);

  // El alta se considera correcta si al menos un destino la recibió
  return json({ ok: true, guardado: guardado.ok, nuevo: guardado.nuevo === true });
}
