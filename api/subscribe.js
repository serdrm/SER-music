export const config = { runtime: 'edge' };

const FORMSPREE = 'https://formspree.io/f/xykabnza';
const RESPONDER_A = 'unsergioromero@gmail.com';
const CICLOS_ARTWORK = 'https://i.scdn.co/image/ab67616d0000b2737b53010fcb2c3e1c269bc7c2';

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

// Fila de "lo que viene", con tablas en vez de flex para que se vea bien
// incluso en clientes de correo que no soportan CSS moderno (Outlook)
function filaSomos(color, icono, titulo, sub) {
  return `
    <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:#161616;border:1px solid rgba(255,255,255,0.08);border-radius:13px;margin-bottom:8px">
      <tr>
        <td style="padding:14px 15px;width:44px;vertical-align:top">
          <div style="width:30px;height:30px;border-radius:50%;background:${color.bg};color:${color.fg};font-size:14px;font-weight:bold;text-align:center;line-height:30px">${icono}</div>
        </td>
        <td style="padding:14px 15px 14px 0;vertical-align:top">
          <p style="margin:0 0 2px;font-size:14px;font-weight:bold;color:#ffffff;font-family:Helvetica,Arial,sans-serif">${titulo}</p>
          <p style="margin:0;font-size:12.5px;line-height:1.4;color:rgba(245,243,239,0.55);font-family:Helvetica,Arial,sans-serif">${sub}</p>
        </td>
      </tr>
    </table>`;
}

function correoBienvenida(email) {
  const fila = filaSomos;
  return `
  <div style="background:#ececea;padding:32px 12px">
    <div style="max-width:480px;margin:0 auto;background:#0a0a0a;border-radius:14px;overflow:hidden;font-family:Helvetica,Arial,sans-serif;color:#f5f3ef">

      <div style="height:4px;line-height:4px;font-size:0;background:#ff7a45;background:linear-gradient(90deg,#ff7a45,#f2578b,#6a4fc4,#00b4d8)">&nbsp;</div>

      <img src="${CICLOS_ARTWORK}" width="480" alt="CICLOS" style="width:100%;display:block" />

      <div style="padding:22px 28px 32px">
        <span style="display:inline-block;font-size:11px;font-weight:bold;letter-spacing:0.22em;color:#ff7a45">SOMOS</span>

        <h1 style="margin:10px 0 0;font-family:'Arial Narrow',Arial,sans-serif;font-weight:bold;text-transform:uppercase;font-size:32px;line-height:1.05;letter-spacing:0.01em;color:#ffffff">Ya eres parte de esto</h1>

        <p style="margin:16px 0 0;font-size:15px;line-height:1.62;color:rgba(245,243,239,0.86)">Salí de Venezuela con una maleta y volví a nacer en Barcelona. De ese cruce salió CICLOS — y de aquí en adelante, todo lo que venga después.</p>
        <p style="margin:12px 0 0;font-size:15px;line-height:1.62;color:rgba(245,243,239,0.86)">Este correo te lo escribo yo, con mis manos, sin equipo ni plantilla detrás. Allá de donde vengo uno aprende rápido quién se queda cerca — y tú decidiste hacerlo. Eso, para mí, ya es SOMOS.</p>

        <div style="margin:26px 0 0">
          ${fila({ bg: 'rgba(255,122,69,0.16)', fg: '#ff9a6e' }, '&#9835;', 'Lo nuevo, antes que nadie', 'Estrenos y adelantos apenas estén listos, sin esperar al algoritmo.')}
          ${fila({ bg: 'rgba(106,79,196,0.20)', fg: '#b09eea' }, '&#9679;', 'Fechas y shows', 'Te aviso primero si toco cerca de ti.')}
          ${fila({ bg: 'rgba(0,180,216,0.16)', fg: '#00c2ea' }, '&#9825;', 'Lo que no sale en Instagram', 'Detrás de cámara, ideas a medio hacer, lo real.')}
        </div>

        <div style="margin:26px 0 0">
          <a href="https://www.ser-music.com/ciclos" style="display:block;padding:14px 17px;border-radius:14px;text-decoration:none;font-size:14.5px;font-weight:bold;background:#00B4D8;color:#04222a;margin-bottom:9px">Escuchar CICLOS &#8594;</a>
          <a href="https://www.instagram.com/unsergioromero" style="display:block;padding:14px 17px;border-radius:14px;text-decoration:none;font-size:14.5px;font-weight:bold;background:#161616;color:#ffffff;border:1px solid rgba(255,255,255,0.1)">Seguir en Instagram &#8594;</a>
        </div>

        <p style="margin:30px 0 0;font-size:15px;line-height:1.6;color:rgba(245,243,239,0.86)">Nos vemos por ahí.<br><b style="color:#ffffff">— Sergio</b> (SER)</p>

        <p style="margin:18px 0 0;padding:13px 15px;border-left:2px solid #ff7a45;font-size:12.5px;line-height:1.55;color:rgba(245,243,239,0.62);background:rgba(255,122,69,0.06);border-radius:0 10px 10px 0">P.D. — si me quieres contar desde dónde escuchas esto, solo responde este correo. Lo leo todo.</p>
      </div>

      <div style="padding:18px 28px 26px;border-top:1px solid rgba(255,255,255,0.07);font-size:11px;letter-spacing:0.03em;color:rgba(245,243,239,0.32);text-align:center">
        Recibes esto porque te uniste a SOMOS en <a href="https://www.ser-music.com" style="color:rgba(245,243,239,0.5);text-decoration:none">ser-music.com</a>
      </div>
    </div>
  </div>`;
}

// Solo se envía la primera vez que alguien se suscribe, no en cada reintento
async function enviarBienvenida(email) {
  const resendKey = process.env.RESEND_API_KEY;
  if (!resendKey) return;

  try {
    await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${resendKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        from: 'SER <hola@ser-music.com>',
        to: [email],
        reply_to: RESPONDER_A,
        subject: 'Ya eres parte de esto 🌊',
        html: correoBienvenida(email),
      }),
    });
  } catch (e) {
    console.error('Welcome email error:', e);
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
  const esNuevo = guardado.nuevo === true;

  // Solo se manda la bienvenida en el alta real, no si ya estaba suscrito
  if (esNuevo) await enviarBienvenida(email);

  // El alta se considera correcta si al menos un destino la recibió
  return json({ ok: true, guardado: guardado.ok, nuevo: esNuevo });
}
