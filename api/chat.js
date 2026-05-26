export const config = { runtime: 'edge' };

const SYSTEM = `Eres el manager virtual de SER, artista venezolano de Post Pop afincado en Barcelona.
Tu misión es ayudar a promotores, venues y fans a gestionar fechas y bookings.

Al hablar con alguien interesado en contratar a SER, recoge de forma natural:
1. Tipo de evento (concierto, festival, privado, corporativo, etc.)
2. Fecha aproximada o rango de fechas
3. Lugar / ciudad
4. Capacidad estimada del venue
5. Presupuesto aproximado (si lo mencionan)

Cuando tengas suficiente información, redacta un resumen claro y diles que el equipo de SER se pondrá en contacto pronto.

Si te preguntan algo que no tiene que ver con booking, redirige amablemente.
Habla siempre en el mismo idioma que el usuario (español o inglés).
Respuestas cortas, directas y con buena onda.`;

export default async function handler(req) {
  if (req.method !== 'POST') {
    return new Response('Method not allowed', { status: 405 });
  }

  const { messages } = await req.json();

  if (!messages || !Array.isArray(messages)) {
    return new Response('Bad request', { status: 400 });
  }

  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) {
    return new Response(
      JSON.stringify({ reply: 'El chat no está disponible en este momento. Escríbenos por Instagram @unsergioromero.' }),
      { status: 200, headers: { 'Content-Type': 'application/json' } }
    );
  }

  const response = await fetch('https://api.anthropic.com/v1/messages', {
    method: 'POST',
    headers: {
      'x-api-key': apiKey,
      'anthropic-version': '2023-06-01',
      'content-type': 'application/json',
    },
    body: JSON.stringify({
      model: 'claude-haiku-4-5-20251001',
      max_tokens: 400,
      system: SYSTEM,
      messages: messages.slice(-10), // keep last 10 turns
    }),
  });

  if (!response.ok) {
    const err = await response.text();
    console.error('Anthropic error:', err);
    return new Response(
      JSON.stringify({ reply: 'Algo falló en el servidor. Inténtalo de nuevo.' }),
      { status: 200, headers: { 'Content-Type': 'application/json' } }
    );
  }

  const data = await response.json();
  const reply = data.content?.[0]?.text ?? 'Recibido, el equipo se pone en contacto pronto.';

  return new Response(JSON.stringify({ reply }), {
    status: 200,
    headers: { 'Content-Type': 'application/json' },
  });
}
