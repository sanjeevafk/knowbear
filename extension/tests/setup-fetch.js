/* Fetch mocking helpers for extension api tests. */
import { vi } from 'vitest';

export function jsonResponse(status, body) {
  return new Response(JSON.stringify(body), { status, headers: { 'content-type': 'application/json' } });
}

/** SSE response whose body is delivered in the given raw string pieces (to test split frames). */
export function sseResponse(pieces, status = 200) {
  const encoder = new TextEncoder();
  const stream = new ReadableStream({
    start(controller) {
      for (const piece of pieces) controller.enqueue(encoder.encode(piece));
      controller.close();
    },
  });
  return new Response(stream, { status, headers: { 'content-type': 'text/event-stream' } });
}

export function sseEvents(events) {
  return events.map((e) => (e === '[DONE]' ? 'data: [DONE]\n\n' : `data: ${JSON.stringify(e)}\n\n`));
}

/** Install a fetch mock routing by URL suffix; returns the vi.fn for assertions. */
export function mockFetch(routes) {
  const fn = vi.fn(async (url, init) => {
    for (const [suffix, handler] of Object.entries(routes)) {
      if (String(url).endsWith(suffix)) return typeof handler === 'function' ? handler(url, init) : handler;
    }
    throw new TypeError('Failed to fetch');
  });
  globalThis.fetch = fn;
  return fn;
}
