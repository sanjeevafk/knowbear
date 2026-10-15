import { afterEach, describe, expect, it, vi } from 'vitest'
import { queryTopicStream } from './api'

describe('api client', () => {
    afterEach(() => {
        vi.restoreAllMocks()
    })

    it('propagates request id when stream and fallback fail', async () => {
        const fetchMock = vi.fn().mockResolvedValue(
            new Response(JSON.stringify({ error: 'boom' }), {
                status: 500,
                headers: { 'x-request-id': 'req-123' },
            })
        )
        vi.stubGlobal('fetch', fetchMock)

        const onError = vi.fn()
        await queryTopicStream(
            { topic: 'test', levels: ['eli5'], mode: 'fast' },
            vi.fn(),
            vi.fn(),
            onError
        )

        expect(onError).toHaveBeenCalledWith(
            expect.objectContaining({
                message: expect.stringContaining('(request id: req-123)'),
            })
        )
    })

    it('falls back to non-stream query when stream content-type is invalid', async () => {
        const fetchMock = vi
            .fn()
            .mockResolvedValueOnce(
                new Response(JSON.stringify({ ok: true }), {
                    status: 200,
                    headers: { 'content-type': 'application/json' },
                })
            )
            .mockResolvedValueOnce(
                new Response(
                    JSON.stringify({
                        topic: 'fallback topic',
                        explanations: { eli5: 'Fallback content' },
                    }),
                    { status: 200, headers: { 'content-type': 'application/json' } }
                )
            )

        vi.stubGlobal('fetch', fetchMock)

        const chunks: string[] = []
        const done = vi.fn()
        const onError = vi.fn()

        await queryTopicStream(
            { topic: 'fallback topic', levels: ['eli5'], mode: 'fast' },
            (chunk) => chunks.push(chunk),
            done,
            onError
        )

        expect(chunks).toEqual(['Fallback content'])
        expect(done).toHaveBeenCalledTimes(1)
        expect(onError).not.toHaveBeenCalled()
        expect(fetchMock).toHaveBeenCalledTimes(2)
    })
})
