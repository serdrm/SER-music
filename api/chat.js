export const config = { runtime: 'edge' };

const SYSTEM = `Eres el manager virtual de SER, artista venezolano de Post Pop afincado en Barcelona.
Tu misión es ayudar a promotores, venues y fans a gestionar fechas y bookings.

Al hablar con alguien interesado en contratar a SER, recoge de forma natural en este orden:
1. Nombre y empresa o promotora
2. Email de contacto
3. Teléfono (opcional)
4. Tipo de evento (concierto, festival, privado, corporativo, etc.)
5. Fecha aproximada o rango de fechas
6. Ciudad y nombre del venue (si lo saben)
7. Capacidad estimada del venue
8. Presupuesto aproximado (si lo mencionan)

Cuando tengas al menos nombre, email, tipo de evento y fecha — diles que has enviado la información al equipo y que se pondrán en contacto pronto.
En ese mismo mensaje, añade al final, en una línea nueva, este bloque exacto (no se lo muestres al usuario, es para el sistema):
BOOKING_DATA:{"nombre":"VALOR","email":"VALOR","telefono":"VALOR","evento":"VALOR","fecha":"VALOR","ciudad":"VALOR","capacidad":"VALOR","presupuesto":"VALOR"}

Si te preguntan algo que no tiene que ver con booking, redirige amablemente.
Habla siempre en el mismo idioma que el usuario (español o inglés).
Respuestas cortas, directas y con buena onda.`;

async function sendBookingEmail(data, resendKey) {
  const html = `
    <div style="font-family:sans-serif;max-width:520px;margin:0 auto">
      <h2 style="color:#D97820;margin-bottom:4px">🎤 Nueva consulta de booking</h2>
      <p style="color:#888;font-size:13px;margin-top:0">Recibida a través del chat de ser-music.com</p>
      <table style="width:100%;border-collapse:collapse;margin-top:16px;font-size:14px">
        <tr style="background:#f9f6f1"><td style="padding:10px 14px;font-weight:600;width:40%">Nombre / Empresa</td><td style="padding:10px 14px">${data.nombre}</td></tr>
        <tr><td style="padding:10px 14px;font-weight:600">Email de contacto</td><td style="padding:10px 14px"><a href="mailto:${data.email}">${data.email}</a></td></tr>
        <tr style="background:#f9f6f1"><td style="padding:10px 14px;font-weight:600">Teléfono</td><td style="padding:10px 14px">${data.telefono || '—'}</td></tr>
        <tr><td style="padding:10px 14px;font-weight:600">Tipo de evento</td><td style="padding:10px 14px">${data.evento}</td></tr>
        <tr style="background:#f9f6f1"><td style="padding:10px 14px;font-weight:600">Fecha</td><td style="padding:10px 14px">${data.fecha}</td></tr>
        <tr><td style="padding:10px 14px;font-weight:600">Ciudad / Venue</td><td style="padding:10px 14px">${data.ciudad || '—'}</td></tr>
        <tr style="background:#f9f6f1"><td style="padding:10px 14px;font-weight:600">Capacidad</td><td style="padding:10px 14px">${data.capacidad || '—'}</td></tr>
        <tr><td style="padding:10px 14px;font-weight:600">Presupuesto</td><td style="padding:10px 14px">${data.presupuesto || '—'}</td></tr>
      </table>
    </div>`;

  return fetch('https://api.resend.com/emails', {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${resendKey}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      from: 'SER Booking <onboarding@resend.dev>',
      to: ['unsergioromero@gmail.com'],
      subject: `🎤 Booking — ${data.nombre} · ${data.evento}`,
      html,
    }),
  });
}

export default async function handler(req) {
  if (req.method !== 'POST') {
    return new Response('Method not allowed', { status: 405 });
  }

  const { messages } = await req.json();

  if (!messages || !Array.isArray(messages)) {
    return new Response('Bad request', { status: 400 });
  }

  const anthropicKey = process.env.ANTHROPIC_API_KEY;
  if (!anthropicKey) {
    return new Response(
      JSON.stringify({ reply: 'El chat no está disponible en este momento. Escríbenos por Instagram @unsergioromero.' }),
      { status: 200, headers: { 'Content-Type': 'application/json' } }
    );
  }

  const response = await fetch('https://api.anthropic.com/v1/messages', {
    method: 'POST',
    headers: {
      'x-api-key': anthropicKey,
      'anthropic-version': '2023-06-01',
      'content-type': 'application/json',
    },
    body: JSON.stringify({
      model: 'claude-3-haiku-20240307',
      max_tokens: 500,
      system: SYSTEM,
      messages: messages.slice(-10),
    }),
  });

  if (!response.ok) {
    const err = await response.text();
    console.error('Anthropic error:', response.status, err);
    return new Response(
      JSON.stringify({ reply: `Error ${response.status}: ${err}` }),
      { status: 200, headers: { 'Content-Type': 'application/json' } }
    );
  }

  const data = await response.json();
  let reply = data.content?.[0]?.text ?? 'Recibido, el equipo se pone en contacto pronto.';

  // Detect booking data signal and send email
  const bookingMatch = reply.match(/BOOKING_DATA:(\{[^\n]+\})/);
  if (bookingMatch) {
    // Strip the marker from the reply shown to the user
    reply = reply.replace(/\n?BOOKING_DATA:\{[^\n]+\}/, '').trim();

    const resendKey = process.env.RESEND_API_KEY;
    if (resendKey) {
      try {
        const bookingData = JSON.parse(bookingMatch[1]);
        await sendBookingEmail(bookingData, resendKey);
      } catch (e) {
        console.error('Booking email error:', e);
      }
    }
  }

  return new Response(JSON.stringify({ reply }), {
    status: 200,
    headers: { 'Content-Type': 'application/json' },
  });
}
