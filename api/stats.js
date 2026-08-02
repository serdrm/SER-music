export const config = { runtime: 'edge' };

const TEAM_ID = process.env.VERCEL_TEAM_ID || 'team_fojfF06NH731EbYGETxrrMkq';
const PROJECT_ID = process.env.VERCEL_PROJECT_ID || 'prj_pCAh9n7zBgIL1cNQwnT5sIfL5dNR';
const API = 'https://api.vercel.com/v1/query/web-analytics';

// Comparación en tiempo constante para no filtrar la clave por el tiempo de respuesta
function safeEqual(a, b) {
  if (typeof a !== 'string' || typeof b !== 'string' || a.length !== b.length) return false;
  let diff = 0;
  for (let i = 0; i < a.length; i++) diff |= a.charCodeAt(i) ^ b.charCodeAt(i);
  return diff === 0;
}

function json(body, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'Content-Type': 'application/json', 'Cache-Control': 'no-store' },
  });
}

// Una consulta a la API de Web Analytics de Vercel
async function query(token, dataset, mode, params) {
  const qs = new URLSearchParams({ teamId: TEAM_ID, projectId: PROJECT_ID, ...params });
  const res = await fetch(`${API}/${dataset}/${mode}?${qs}`, {
    headers: { Authorization: `Bearer ${token}` },
  });
  if (!res.ok) {
    const detail = await res.text();
    const err = new Error(`${dataset}/${mode} → ${res.status} ${detail.slice(0, 200)}`);
    err.status = res.status;
    throw err;
  }
  return res.json();
}

// Los eventos personalizados (platform_click, subscribe, etc.) requieren plan Pro/Enterprise.
// En el plan gratis Vercel devuelve 402 — se trata como "no disponible", no como error.
async function queryEventos(token, mode, params) {
  try {
    return { data: (await query(token, 'events', mode, params)).data || [], disponible: true };
  } catch (e) {
    if (e.status === 402) return { data: [], disponible: false };
    throw e;
  }
}

export default async function handler(req) {
  const token = process.env.VERCEL_ANALYTICS_TOKEN;
  const password = process.env.PANEL_PASSWORD;

  // Se avisa de todas las que falten a la vez, para no descubrirlas de una en una
  const faltan = [];
  if (!password) faltan.push('PANEL_PASSWORD');
  if (!token) faltan.push('VERCEL_ANALYTICS_TOKEN');
  if (faltan.length) {
    return json({ error: `Faltan variables en Vercel: ${faltan.join(', ')}.`, faltan }, 500);
  }

  const url = new URL(req.url);
  const given = req.headers.get('x-panel-key') || url.searchParams.get('key') || '';
  if (!safeEqual(given, password)) {
    return json({ error: 'Clave incorrecta.' }, 401);
  }

  // Rango de fechas: por defecto los últimos 30 días
  const days = Math.min(Math.max(parseInt(url.searchParams.get('days') || '30', 10) || 30, 1), 365);
  const until = new Date();
  const since = new Date(until.getTime() - days * 86400000);
  const range = { since: since.toISOString().slice(0, 10), until: until.toISOString().slice(0, 10) };

  const CLICKS = "eventName eq 'platform_click'";

  try {
    // Visitas: disponible en el plan gratis. Si esto falla, sí es un error real.
    const [porDia, porPagina, porPais, porOrigen, porDispositivo] = await Promise.all([
      query(token, 'visits', 'aggregate', { ...range, by: 'day' }),
      query(token, 'visits', 'aggregate', { ...range, by: 'requestPath', limit: '15' }),
      query(token, 'visits', 'aggregate', { ...range, by: 'country', limit: '8' }),
      query(token, 'visits', 'aggregate', { ...range, by: 'referrerHostname', limit: '8' }),
      query(token, 'visits', 'aggregate', { ...range, by: 'deviceType', limit: '5' }),
    ]);

    // Eventos personalizados: requieren plan Pro/Enterprise. Se degrada sin romper el panel.
    const [porEvento, porPlataforma, porLanzamiento] = await Promise.all([
      queryEventos(token, 'aggregate', { ...range, by: 'eventName', limit: '15' }),
      queryEventos(token, 'aggregate', { ...range, by: 'eventData/platform', limit: '10', filter: CLICKS }),
      queryEventos(token, 'aggregate', { ...range, by: 'eventData/release', limit: '15', filter: CLICKS }),
    ]);
    const eventosDisponibles = porEvento.disponible;

    const dias = porDia.data || [];
    const totalVisitas = dias.reduce((s, d) => s + (d.pageviews || 0), 0);
    const totalPersonas = dias.reduce((s, d) => s + (d.visitors || 0), 0);
    const clicks = porPlataforma.data.reduce((s, d) => s + (d.count || 0), 0);

    return json({
      rango: { ...range, dias: days },
      eventosDisponibles,
      resumen: {
        visitas: totalVisitas,
        personas: totalPersonas,
        clicksPlataforma: eventosDisponibles ? clicks : null,
        // Qué porcentaje de quienes entran acaban pulsando una plataforma
        conversion: eventosDisponibles && totalPersonas ? Math.round((clicks / totalPersonas) * 100) : null,
      },
      porDia: dias,
      porPagina: porPagina.data || [],
      porPais: porPais.data || [],
      porOrigen: porOrigen.data || [],
      porDispositivo: porDispositivo.data || [],
      porEvento: porEvento.data,
      porPlataforma: porPlataforma.data,
      porLanzamiento: porLanzamiento.data,
    });
  } catch (e) {
    return json({ error: String(e.message || e) }, 502);
  }
}
