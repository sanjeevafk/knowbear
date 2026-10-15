import type { PinnedTopic, QueryRequest, QueryResponse, StreamStatus } from './types'
import { ZodError } from 'zod'
import {
    pinnedTopicsSchema,
    queryRequestSchema,
    queryResponseSchema,
    streamChunkSchema,
} from './schemas'

const API_URL = import.meta.env.VITE_API_URL || ''
const IS_DEV = import.meta.env.DEV
const PINNED_CACHE_KEY = 'knowbear-pinned-topics-cache-v2'
const PINNED_CACHE_TTL_MS = 24 * 60 * 60 * 1000

function appendRequestId(message: string, requestId: string | null): string {
    if (!requestId) return message
    return `${message} (request id: ${requestId})`
}

function getRequestIdFromResponse(res: Response): string | null {
    return res.headers.get('x-request-id')
}

function createRequestId(): string {
    if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') {
        return crypto.randomUUID()
    }
    return `req-${Date.now()}-${Math.random().toString(16).slice(2)}`
}

async function getRequestIdFromErrorBody(res: Response): Promise<string | null> {
    try {
        const body = await res.clone().json()
        return body?.request_id ?? null
    } catch {
        return null
    }
}

async function fetchAPI<T>(path: string, options?: RequestInit & { responseType?: 'json' | 'blob'; timeoutMs?: number }): Promise<T> {
    const headers: HeadersInit = {
        'Content-Type': 'application/json',
        ...options?.headers,
    }

    const controller = new AbortController()
    const timeoutMs = options?.timeoutMs ?? 45000
    const timeoutId = setTimeout(() => controller.abort(), timeoutMs)

    try {
        const res = await fetch(`${API_URL}${path}`, {
            ...options,
            headers,
            signal: controller.signal,
        })
        clearTimeout(timeoutId)

        if (res.status === 429) {
            let detail = 'Too many requests. Please try again later.'
            try {
                const body = await res.json()
                const message = body?.detail?.message || body?.detail
                if (typeof message === 'string') detail = message
                const bodyRequestId = typeof body?.request_id === 'string' ? body.request_id : null
                detail = appendRequestId(detail, bodyRequestId || getRequestIdFromResponse(res))
            } catch {
                // ignore parse error and keep default message
                detail = appendRequestId(detail, getRequestIdFromResponse(res))
            }
            throw new Error(detail)
        }

        if (!res.ok) {
            const requestId = getRequestIdFromResponse(res) || await getRequestIdFromErrorBody(res)
            throw new Error(appendRequestId(`API error: ${res.status}`, requestId))
        }

        if (options?.responseType === 'blob') {
            return await res.blob() as unknown as T
        }
        return await res.json()
    } catch (err: unknown) {
        clearTimeout(timeoutId)
        if (err instanceof Error && err.name === 'AbortError') {
            throw new Error('Request timed out. Please try again.')
        }
        throw err
    }
}

function formatValidationError(prefix: string, err: ZodError): Error {
    const details = err.issues.map((issue) => `${issue.path.join('.') || 'root'}: ${issue.message}`).join('; ')
    return new Error(`${prefix} (${details})`)
}

export async function getPinnedTopics(): Promise<PinnedTopic[]> {
    if (typeof window !== 'undefined') {
        try {
            const cachedRaw = window.localStorage.getItem(PINNED_CACHE_KEY)
            if (cachedRaw) {
                const cached = JSON.parse(cachedRaw) as { timestamp: number; topics: unknown }
                const fresh = Date.now() - cached.timestamp < PINNED_CACHE_TTL_MS
                const parsedCached = pinnedTopicsSchema.safeParse(cached.topics)
                if (fresh && parsedCached.success) return parsedCached.data
            }
        } catch {
            // ignore cache parse failures
        }
    }

    const data = await fetchAPI<unknown>('/api/pinned', { timeoutMs: 4000 })
    const parsed = pinnedTopicsSchema.safeParse(data)
    if (!parsed.success) throw formatValidationError('Invalid pinned topics response', parsed.error)

    if (typeof window !== 'undefined') {
        try {
            window.localStorage.setItem(
                PINNED_CACHE_KEY,
                JSON.stringify({ timestamp: Date.now(), topics: parsed.data })
            )
        } catch {
            // ignore storage failures
        }
    }

    return parsed.data
}

async function queryTopicWithTimeout(req: QueryRequest, timeoutMs: number): Promise<QueryResponse> {
    const request = queryRequestSchema.safeParse(req)
    if (!request.success) throw formatValidationError('Invalid query request', request.error)

    const data = await fetchAPI<unknown>('/api/query', {
        method: 'POST',
        body: JSON.stringify(request.data),
        timeoutMs,
    })
    const parsed = queryResponseSchema.safeParse(data)
    if (!parsed.success) throw formatValidationError('Invalid query response', parsed.error)
    return parsed.data
}

export async function queryTopicStream(
    req: QueryRequest,
    onChunk: (chunk: string) => void,
    onDone: (data: unknown) => void,
    onError: (err: unknown) => void,
    signal?: AbortSignal,
    onStatus?: (status: StreamStatus) => void
) {
    const request = queryRequestSchema.safeParse(req)
    if (!request.success) throw formatValidationError('Invalid stream request', request.error)

    const headers: HeadersInit = {
        'Content-Type': 'application/json',
        'X-Request-ID': createRequestId(),
    }

    const fallbackToNonStream = async (reason: string): Promise<void> => {
        try {
            onStatus?.('fallback')
            if (IS_DEV) {
                console.warn('Streaming unavailable, falling back to non-stream response:', reason)
            }
            const data = await queryTopicWithTimeout(request.data, 25000)
            const preferredLevel = request.data.levels?.[0]
            const levelKey = preferredLevel && data.explanations?.[preferredLevel]
                ? preferredLevel
                : Object.keys(data.explanations || {})[0]
            const fullText = levelKey ? data.explanations[levelKey] : ''
            if (fullText) onChunk(fullText)
            onDone(data)
        } catch (err) {
            onError(err)
        }
    }

    const attemptStream = async (): Promise<void> => {
        const STREAM_REQUEST_TIMEOUT_MS = 25000
        const streamController = new AbortController()
        const timeoutId = setTimeout(() => streamController.abort(), STREAM_REQUEST_TIMEOUT_MS)
        const onAbort = () => streamController.abort()
        if (signal) {
            if (signal.aborted) streamController.abort()
            else signal.addEventListener('abort', onAbort, { once: true })
        }

        try {
            const response = await fetch(`${API_URL}/api/query/stream`, {
                method: 'POST',
                headers,
                body: JSON.stringify(request.data),
                signal: streamController.signal,
            })
            clearTimeout(timeoutId)
            if (signal) signal.removeEventListener('abort', onAbort)

            if (response.status === 429) {
                let detail = 'Too many requests. Please try again later.'
                try {
                    const body = await response.json()
                    const message = body?.detail?.message || body?.detail
                    if (typeof message === 'string') detail = message
                    const bodyRequestId = typeof body?.request_id === 'string' ? body.request_id : null
                    detail = appendRequestId(detail, bodyRequestId || getRequestIdFromResponse(response))
                } catch {
                    // ignore
                    detail = appendRequestId(detail, getRequestIdFromResponse(response))
                }
                throw new Error(detail)
            }

            if (!response.ok) {
                const requestId = getRequestIdFromResponse(response) || await getRequestIdFromErrorBody(response)
                throw new Error(appendRequestId(`API error: ${response.status}`, requestId))
            }

            const contentType = response.headers.get('content-type')
            if (!contentType?.includes('text/event-stream')) {
                onStatus?.('degraded')
                return fallbackToNonStream(`Invalid content-type: ${contentType || 'unknown'}`)
            }
            onStatus?.('live')

            const reader = response.body?.getReader()
            const decoder = new TextDecoder()
            if (!reader) return fallbackToNonStream('ReadableStream not supported')

            let buffer = ''
            const READ_TIMEOUT_MS = 20000

            while (true) {
                const { done, value } = await Promise.race([
                    reader.read(),
                    new Promise<ReadableStreamReadResult<Uint8Array>>((_, reject) =>
                        setTimeout(() => reject(new Error('Stream read timed out')), READ_TIMEOUT_MS)
                    )
                ])
                if (done) break

                buffer += decoder.decode(value, { stream: true })
                const lines = buffer.split('\n')
                buffer = lines.pop() || ''

                for (const line of lines) {
                    if (!line.startsWith('data: ')) continue
                    const data = line.slice(6).trim()
                    if (data === '[DONE]') {
                        onDone({})
                        return
                    }
                    try {
                        const raw = JSON.parse(data)
                        const parsed = streamChunkSchema.safeParse(raw)
                        if (!parsed.success) {
                            if (IS_DEV) console.warn('Invalid SSE payload shape:', raw)
                            continue
                        }

                        if (parsed.data.chunk) onChunk(parsed.data.chunk)
                        else if (parsed.data.warning) onChunk(`\n\n${parsed.data.warning}`)
                        else if (parsed.data.error) {
                            onError(new Error(parsed.data.error))
                            return
                        }
                    } catch (e) {
                        if (IS_DEV) {
                            console.warn('Failed to parse SSE chunk:', data.substring(0, 100), e)
                        }
                    }
                }
            }
        } catch (err: unknown) {
            clearTimeout(timeoutId)
            if (signal) signal.removeEventListener('abort', onAbort)

            if (err instanceof Error && err.name === 'AbortError') {
                if (signal?.aborted) return
                onStatus?.('degraded')
                return fallbackToNonStream('Stream request timed out')
            }

            if (err instanceof Error && err.message === 'Stream read timed out') {
                try {
                    onStatus?.('degraded')
                    return await fallbackToNonStream(err.message)
                } catch {
                    // continue to retry/error flow
                }
            }

            await fallbackToNonStream(err instanceof Error ? err.message : 'Stream failed')
        }
    }

    await attemptStream()
}

