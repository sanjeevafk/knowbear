import { describe, it, expect } from 'vitest';
import './chrome-stub.js';
import { jsonResponse, sseResponse, sseEvents, mockFetch } from './setup-fetch.js';
import '../lib/protocol.js';
import '../lib/api.js';

const KB = globalThis.KB;
const base = 'http://localhost:8000';
const body = { topic: 'Cats', levels: ['eli12'] };

describe('KB.errorCode', () => {
  it('maps network failure to offline', () => {
    expect(KB.errorCode(0, null).code).toBe('offline');
  });
  it('maps 429 (HTTPException and global handler shapes) with retry seconds', () => {
    const a = KB.errorCode(429, { detail: { message: 'Slow down', retry_after_seconds: 41.2 } });
    expect(a).toEqual({ code: 'rate_limit', message: 'Slow down', retryAfter: 42 });
    const b = KB.errorCode(429, { error: 'Token rate limit exceeded', detail: { message: 'Wait', retry_after_seconds: 5 } });
    expect(b.code).toBe('rate_limit');
    expect(b.retryAfter).toBe(5);
  });
  it('maps 400/422 validation to invalid', () => {
    expect(KB.errorCode(400, { detail: 'Invalid characters in topic' })).toMatchObject({ code: 'invalid', message: 'Invalid characters in topic' });
    expect(KB.errorCode(422, { detail: [{ msg: 'String should have at most 2000 characters' }] }).code).toBe('invalid');
  });
  it('maps 400 Gemini streaming failures to server, not invalid', () => {
    expect(KB.errorCode(400, { detail: 'Gemini streaming failed: boom' }).code).toBe('server');
  });
  it('maps vision messages by content even with HTTP 200', () => {
    expect(KB.errorCode(200, 'Gemini is not configured for visual tasks.').code).toBe('vision_unavailable');
  });
  it('maps 5xx to server', () => {
    expect(KB.errorCode(503, { detail: 'down' }).code).toBe('server');
  });
});

describe('KB.askStream', () => {
  it('parses meta/chunks/done across split frames with credentials omitted', async () => {
    const raw = sseEvents([{ topic: 'Cats', level: 'eli12' }, { chunk: 'Hello ' }, { chunk: 'world.' }, '[DONE]']).join('');
    const pieces = [raw.slice(0, 17), raw.slice(17, 50), raw.slice(50)];
    const fetchMock = mockFetch({ '/api/query/stream': sseResponse(pieces) });
    const metas = [];
    const chunks = [];
    const text = await KB.askStream({ base, body, onMeta: (m) => metas.push(m), onChunk: (c) => chunks.push(c) });
    expect(text).toBe('Hello world.');
    expect(chunks).toEqual(['Hello ', 'world.']);
    expect(metas).toEqual([{ topic: 'Cats', level: 'eli12' }]);
    const [, init] = fetchMock.mock.calls[0];
    expect(init.credentials).toBe('omit');
    expect(init.method).toBe('POST');
    expect(JSON.parse(init.body)).toEqual(body);
  });

  it('turns an SSE error event into a coded error keeping partial text', async () => {
    mockFetch({
      '/api/query/stream': sseResponse(sseEvents([{ topic: 'Cats', level: 'eli12' }, { chunk: 'Part' }, { error: 'Gemini is not configured for visual tasks.' }])),
    });
    await expect(KB.askStream({ base, body })).rejects.toMatchObject({ code: 'vision_unavailable', partial: 'Part' });
  });

  it('reports SSE rate-limit errors as rate_limit', async () => {
    mockFetch({ '/api/query/stream': sseResponse(sseEvents([{ error: 'Token rate limit exceeded. Try later.' }])) });
    await expect(KB.askStream({ base, body })).rejects.toMatchObject({ code: 'rate_limit' });
  });

  it('flags a stream that ends without [DONE]', async () => {
    mockFetch({ '/api/query/stream': sseResponse(sseEvents([{ chunk: 'cut' }])) });
    await expect(KB.askStream({ base, body })).rejects.toMatchObject({ code: 'server', partial: 'cut' });
  });

  it('forwards warnings', async () => {
    mockFetch({ '/api/query/stream': sseResponse(sseEvents([{ chunk: 'x' }, { warning: 'May be incomplete' }, '[DONE]'])) });
    const warnings = [];
    await KB.askStream({ base, body, onWarning: (w) => warnings.push(w) });
    expect(warnings).toEqual(['May be incomplete']);
  });
});

describe('KB.explain fallback', () => {
  it('falls back to batch when the stream fails to start with 5xx', async () => {
    const fetchMock = mockFetch({
      '/api/query/stream': jsonResponse(500, { detail: 'boom' }),
      '/api/query': jsonResponse(200, { topic: 'Cats', explanations: { eli12: 'Batch text' } }),
    });
    const chunks = [];
    const text = await KB.explain({ base, body, onChunk: (c) => chunks.push(c) });
    expect(text).toBe('Batch text');
    expect(chunks).toEqual(['Batch text']);
    expect(fetchMock).toHaveBeenCalledTimes(2);
  });

  it('does not fall back on 400 invalid input', async () => {
    const fetchMock = mockFetch({ '/api/query/stream': jsonResponse(400, { detail: 'Invalid characters in topic' }) });
    await expect(KB.explain({ base, body })).rejects.toMatchObject({ code: 'invalid' });
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });

  it('reports offline when both stream and batch are unreachable', async () => {
    mockFetch({});
    await expect(KB.explain({ base, body })).rejects.toMatchObject({ code: 'offline' });
  });
});

describe('KB.askBatch', () => {
  it('detects the Vision unavailable: content-level error', async () => {
    mockFetch({ '/api/query': jsonResponse(200, { topic: 'Explain this image or diagram', explanations: { eli12: 'Vision unavailable: Gemini is not configured' } }) });
    await expect(KB.askBatch({ base, body: { image: 'data:,', levels: ['eli12'] } })).rejects.toMatchObject({ code: 'vision_unavailable' });
  });

  it('maps per-level Error generating strings', async () => {
    mockFetch({ '/api/query': jsonResponse(200, { topic: 'Cats', explanations: { eli12: 'Error generating eli12: upstream exploded' } }) });
    await expect(KB.askBatch({ base, body })).rejects.toMatchObject({ code: 'server', message: 'upstream exploded' });
  });

  it('maps 429 batch body with retry seconds', async () => {
    mockFetch({ '/api/query': jsonResponse(429, { detail: { error: 'Token rate limit exceeded', message: 'Slow', retry_after_seconds: 30 } }) });
    const err = await KB.askBatch({ base, body }).catch((e) => e);
    expect(err.code).toBe('rate_limit');
    expect(KB.errorMessage(err)).toBe('Rate limit — retry in ~30s');
  });
});

describe('KB.askFollowup + errorMessage', () => {
  it('posts to /api/followup', async () => {
    const fetchMock = mockFetch({ '/api/followup': jsonResponse(200, { topic: 'Cats', level: 'eli12', question: 'Why?', answer: 'Because.' }) });
    const res = await KB.askFollowup({ base, body: { topic: 'Cats', question: 'Why?' } });
    expect(res.answer).toBe('Because.');
    expect(fetchMock.mock.calls[0][1].credentials).toBe('omit');
  });

  it('uses the image-flow vision copy', () => {
    const err = KB.makeError('vision_unavailable', 'x');
    expect(KB.errorMessage(err, { imageFlow: true })).toBe('Vision needs GEMINI_API_KEY on the backend');
    expect(KB.errorMessage(KB.makeError('offline'))).toBe('Backend not reachable — is it running?');
  });
});
