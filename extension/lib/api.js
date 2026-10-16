/* KnowBear extension — fetch wrappers: SSE stream, batch fallback, follow-up, error mapping. */
(function (KB) {
  'use strict';

  const FETCH_DEFAULTS = { credentials: 'omit', cache: 'no-store' };
  const BATCH_ERROR_RE = /^Error generating \w+:\s*/;

  KB.makeError = function (code, message, extra) {
    const err = new Error(message || code);
    err.name = 'KnowBearError';
    err.code = code;
    Object.assign(err, extra || {});
    return err;
  };

  function messageFrom(payload) {
    if (payload == null) return '';
    if (typeof payload === 'string') return payload;
    const detail = payload.detail;
    if (typeof detail === 'string') return detail;
    if (Array.isArray(detail) && detail.length) {
      return detail.map((d) => (d && d.msg) || '').filter(Boolean).join('; ');
    }
    if (detail && typeof detail === 'object' && detail.message) return detail.message;
    if (typeof payload.message === 'string') return payload.message;
    if (typeof payload.error === 'string') return payload.error;
    return '';
  }

  function retryAfterFrom(payload) {
    const detail = payload && typeof payload === 'object' ? payload.detail : null;
    const value = (detail && detail.retry_after_seconds) || (payload && payload.retry_after_seconds);
    const n = Number(value);
    return Number.isFinite(n) && n > 0 ? Math.ceil(n) : null;
  }

  /**
   * Map an HTTP status + body (JSON or text) to {code, message, retryAfter}.
   * status 0/undefined = network failure. Vision failures are content-level (HTTP 200).
   */
  KB.errorCode = function (status, payloadOrText) {
    const message = messageFrom(payloadOrText) || '';
    const retryAfter = retryAfterFrom(payloadOrText);
    if (!status) {
      return { code: 'offline', message: 'Backend not reachable — is it running?', retryAfter: null };
    }
    if (status === 429 || /rate limit/i.test(message)) {
      return { code: 'rate_limit', message: message || 'Rate limit exceeded', retryAfter };
    }
    if (KB.VISION_UNAVAILABLE_RE.test(message)) {
      return { code: 'vision_unavailable', message, retryAfter: null };
    }
    if (/Gemini streaming failed/i.test(message)) {
      return { code: 'server', message, retryAfter: null };
    }
    if (status === 400 || status === 422) {
      return { code: 'invalid', message: message || 'Invalid request', retryAfter: null };
    }
    return { code: 'server', message: message || `Server error (${status})`, retryAfter: null };
  };

  function toError(status, payload, extra) {
    const info = KB.errorCode(status, payload);
    return KB.makeError(info.code, info.message, Object.assign({ retryAfter: info.retryAfter, status }, extra));
  }

  async function readBody(res) {
    const text = await res.text();
    try {
      return JSON.parse(text);
    } catch {
      return text;
    }
  }

  async function post(url, body, signal) {
    try {
      return await fetch(url, Object.assign({}, FETCH_DEFAULTS, {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify(body),
        signal,
      }));
    } catch (e) {
      if (e && e.name === 'AbortError') throw e;
      throw toError(0, null);
    }
  }

  /** Parse an SSE body, invoking onEvent(parsedJsonOr'[DONE]') per data line. */
  async function readSse(res, onEvent) {
    const reader = res.body.getReader();
    const decoder = new TextDecoder();
    let buffer = '';
    for (;;) {
      const { value, done } = await reader.read();
      if (done) break;
      buffer += decoder.decode(value, { stream: true });
      let sep;
      while ((sep = buffer.indexOf('\n\n')) >= 0) {
        const block = buffer.slice(0, sep);
        buffer = buffer.slice(sep + 2);
        for (const line of block.split('\n')) {
          if (!line.startsWith('data:')) continue;
          const data = line.slice(5).trim();
          if (!data) continue;
          if (data === '[DONE]') {
            if (onEvent('[DONE]') === false) return;
            continue;
          }
          let parsed;
          try {
            parsed = JSON.parse(data);
          } catch {
            continue;
          }
          if (onEvent(parsed) === false) return;
        }
      }
    }
  }

  /**
   * Stream one level via POST /api/query/stream.
   * Resolves with the full text; rejects with a KnowBearError carrying .partial and
   * .startFailed (true when nothing was streamed and HTTP failed before the body).
   */
  KB.askStream = async function ({ base, body, signal, onMeta, onChunk, onWarning }) {
    const res = await post(`${base}/api/query/stream`, body, signal).catch((e) => {
      if (e && e.code) e.startFailed = true;
      throw e;
    });
    if (!res.ok) {
      throw toError(res.status, await readBody(res), { startFailed: true });
    }
    let full = '';
    let finished = false;
    let streamError = null;
    try {
      await readSse(res, (evt) => {
        if (evt === '[DONE]') {
          finished = true;
          return false;
        }
        if (typeof evt.error === 'string') {
          streamError = toError(200, evt.error, { partial: full });
          return false;
        }
        if (typeof evt.chunk === 'string') {
          full += evt.chunk;
          if (onChunk) onChunk(evt.chunk, full);
        } else if (typeof evt.warning === 'string') {
          if (onWarning) onWarning(evt.warning);
        } else if (evt.topic !== undefined && onMeta) {
          onMeta({ topic: evt.topic, level: evt.level });
        }
        return true;
      });
    } catch (e) {
      if (e && e.name === 'AbortError') throw e;
      throw KB.makeError('server', 'Stream interrupted', { partial: full });
    }
    if (streamError) throw streamError;
    if (!finished) throw KB.makeError('server', 'Stream ended unexpectedly', { partial: full });
    return full;
  };

  /** Batch POST /api/query for a single level. Content-level errors become KnowBearErrors. */
  KB.askBatch = async function ({ base, body, signal }) {
    const res = await post(`${base}/api/query`, body, signal);
    const payload = await readBody(res);
    if (!res.ok) throw toError(res.status, payload);
    const level = (body.levels && body.levels[0]) || 'eli5';
    const explanations = (payload && payload.explanations) || {};
    const text = explanations[level] || Object.values(explanations)[0] || '';
    if (/^Vision unavailable:/i.test(text)) {
      throw KB.makeError('vision_unavailable', text.replace(/^Vision unavailable:\s*/i, ''));
    }
    if (BATCH_ERROR_RE.test(text)) {
      throw toError(200, text.replace(BATCH_ERROR_RE, ''));
    }
    return { topic: payload.topic, text };
  };

  /**
   * Stream with batch fallback when the stream fails to start for offline/server reasons.
   * 4xx validation/rate-limit failures are reported directly (a batch retry would fail too).
   */
  KB.explain = async function ({ base, body, signal, onMeta, onChunk, onWarning }) {
    try {
      return await KB.askStream({ base, body, signal, onMeta, onChunk, onWarning });
    } catch (e) {
      if (!e || !e.startFailed || (e.code !== 'server' && e.code !== 'offline')) throw e;
      const { topic, text } = await KB.askBatch({ base, body, signal });
      if (onMeta) onMeta({ topic, level: body.levels && body.levels[0] });
      if (onChunk) onChunk(text, text);
      return text;
    }
  };

  KB.askFollowup = async function ({ base, body, signal }) {
    const res = await post(`${base}/api/followup`, body, signal);
    const payload = await readBody(res);
    if (!res.ok) throw toError(res.status, payload);
    return payload;
  };

  KB.checkHealth = async function (base, signal) {
    try {
      const res = await fetch(`${base}/api/health`, Object.assign({}, FETCH_DEFAULTS, { signal }));
      if (!res.ok) return { ok: false, message: `HTTP ${res.status}` };
      const payload = await res.json();
      return { ok: payload && payload.status === 'ok', message: payload && payload.status, payload };
    } catch {
      return { ok: false, message: 'Backend not reachable' };
    }
  };

  /** User-facing copy for an error code. */
  KB.errorMessage = function (err, { imageFlow = false } = {}) {
    const code = err && err.code;
    if (code === 'offline') return 'Backend not reachable — is it running?';
    if (code === 'rate_limit') {
      return err.retryAfter ? `Rate limit — retry in ~${err.retryAfter}s` : 'Rate limit — try again shortly';
    }
    if (code === 'vision_unavailable') {
      return imageFlow ? 'Vision needs GEMINI_API_KEY on the backend' : (err.message || 'Vision unavailable');
    }
    return (err && err.message) || 'Something went wrong';
  };
})((globalThis.KB = globalThis.KB || {}));
