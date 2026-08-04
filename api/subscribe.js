export const config = { runtime: 'edge' };

const FORMSPREE = 'https://formspree.io/f/xykabnza';
const RESPONDER_A = 'unsergioromero@gmail.com';

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

// Diseño "Urbano" (handoff de diseño, agosto 2026): negro + acentos fríos,
// narrativa de "la banda". Construido con tablas y estilos inline porque
// los clientes de correo (Outlook sobre todo) no soportan flexbox/grid —
// el mockup original usaba CSS moderno, esto es la versión que sí funciona
// en Gmail/Outlook/Apple Mail.
function correoBienvenida(email) {
  const NEGRO = '#0C0C0D';
  const PANEL = '#131113';
  const HUESO = '#F2EFEC';
  const GRIS = '#7A7876';
  const ROSA = '#C97BA0';
  const TURQUESA = '#4FA8AB';

  const FONT_DISPLAY = "'Anton',Impact,'Arial Narrow',Arial,sans-serif";
  const FONT_BODY = "'Space Grotesk',Helvetica,Arial,sans-serif";
  const FONT_MONO = "'JetBrains Mono',Consolas,'Courier New',monospace";

  const p = (html, marginBottom) =>
    `<p style="margin:0 0 ${marginBottom}px;font-size:16px;line-height:1.75;color:${HUESO};font-family:${FONT_BODY}">${html}</p>`;

  return `<!DOCTYPE html>
<html lang="es" xmlns:v="urn:schemas-microsoft-com:vml" xmlns:o="urn:schemas-microsoft-com:office:office">
<head>
<meta charset="UTF-8" />
<meta name="viewport" content="width=device-width, initial-scale=1.0" />
<meta http-equiv="X-UA-Compatible" content="IE=edge" />
<meta name="color-scheme" content="dark light" />
<meta name="supported-color-schemes" content="dark light" />
<title>Ya eres de la banda</title>
<link rel="preconnect" href="https://fonts.googleapis.com" />
<link href="https://fonts.googleapis.com/css2?family=Anton&family=Space+Grotesk:wght@400;500;600;700&family=JetBrains+Mono:wght@400;500;700&display=swap" rel="stylesheet" />
<!--[if mso]>
<noscript>
<xml><o:OfficeDocumentSettings><o:PixelsPerInch>96</o:PixelsPerInch></o:OfficeDocumentSettings></xml>
</noscript>
<![endif]-->
<style>
  body,table,td{margin:0;padding:0}
  body{background:${NEGRO} !important}
  a{color:#5B84C4;text-decoration:none}
  a:hover{color:${HUESO}}
  @media (prefers-color-scheme: dark){
    .bg-page,.bg-header,.bg-body{background-color:${NEGRO} !important}
  }
</style>
</head>
<body style="margin:0;padding:0;background:${NEGRO}">
<!--[if mso]>
<table role="presentation" width="640" align="center" cellpadding="0" cellspacing="0" border="0"><tr><td>
<![endif]-->
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" class="bg-page" style="background:${NEGRO}">
  <tr>
    <td align="center" style="padding:60px 20px">
      <table role="presentation" width="640" cellpadding="0" cellspacing="0" border="0" style="max-width:640px;width:100%;border-radius:10px;overflow:hidden">
        <tr>
          <td class="bg-header" style="background:${PANEL};padding:20px 28px;font-family:${FONT_MONO};font-size:13px;color:${GRIS}">
            <div><strong style="color:${HUESO}">De:</strong> SOMOS &lt;hola@ser-music.com&gt;</div>
            <div style="margin-top:4px"><strong style="color:${HUESO}">Asunto:</strong> Ya eres de la banda</div>
          </td>
        </tr>
        <tr>
          <td class="bg-body" style="background:${NEGRO};padding:48px 40px;font-family:${FONT_BODY}">
            <div style="font-family:${FONT_MONO};font-size:12px;letter-spacing:0.16em;color:${TURQUESA};margin-bottom:10px">SER PRESENTA</div>
            <div style="font-family:${FONT_DISPLAY};font-size:30px;margin-bottom:24px;color:${HUESO}">SOMOS</div>
            ${p('Ey,', 18)}
            ${p('Acabas de dejar tu correo. Si ya me viste tocar en vivo, seguro terminaste cantando con nosotros — y eso, técnicamente, ya te hace banda. Si todavía no has venido, esto es la fila de entrada. No hay carnet, no hay bienvenida formal — solo esto.', 18)}
            ${p(`Soy de Venezuela. Empecé de niño, a los 14 años en Guatire, aprendiendo batería — subiendo a Caracas cada jueves por la tarde a clase. Años después subí a un escenario con banda, y dije algo sin pensarlo: <span style="color:${ROSA};font-weight:600">yo soy SER, pero juntos SOMOS</span>. Desde entonces no toco para nadie — toco con la banda.`, 18)}
            ${p('Por aquí te vas a enterar de shows, canciones nuevas y lo que se nos vaya ocurriendo. Y si quieres opinar, proponer algo o meterte de lleno, este correo también sirve para eso — leo todo lo que me escriban.', 18)}
            ${p('Nos vemos en la próxima.', 30)}
            <p style="margin:0;font-family:${FONT_MONO};font-size:14px;color:${TURQUESA}">— SER</p>
          </td>
        </tr>
      </table>
    </td>
  </tr>
</table>
<!--[if mso]>
</td></tr></table>
<![endif]-->
</body>
</html>`;
}

// Solo se envía la primera vez que alguien se suscribe, no en cada reintento
async function enviarBienvenida(email) {
  const resendKey = process.env.RESEND_API_KEY;
  if (!resendKey) return;

  try {
    const res = await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${resendKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        from: 'SOMOS <hola@ser-music.com>',
        to: [email],
        reply_to: RESPONDER_A,
        subject: 'Ya eres de la banda',
        html: correoBienvenida(email),
      }),
    });
    if (!res.ok) console.error('Welcome email rejected:', res.status, await res.text());
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
