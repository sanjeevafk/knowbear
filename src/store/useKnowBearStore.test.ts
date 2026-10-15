import { describe, it, expect, beforeEach, vi } from 'vitest'
import { renderHook, act, waitFor } from '@testing-library/react'
import { useKnowBearStore } from './useKnowBearStore'
import { queryTopicStream } from '../api'

vi.mock('../api', () => ({
    queryTopicStream: vi.fn((req, onChunk, onDone, _onError, signal?: AbortSignal) => {
        return new Promise<void>((resolve, reject) => {
            const timeout = setTimeout(() => {
                onChunk(`${req.topic} content`)
                onDone({})
                resolve()
            }, 20)

            signal?.addEventListener('abort', () => {
                clearTimeout(timeout)
                reject(new DOMException('The operation was aborted.', 'AbortError'))
            })
        })
    }),
}))

describe('useKnowBearStore', () => {
    beforeEach(() => {
        const { result } = renderHook(() => useKnowBearStore())
        act(() => {
            result.current.reset()
        })
        vi.clearAllMocks()
    })

    it('has expected initial state', () => {
        const { result } = renderHook(() => useKnowBearStore())
        expect(result.current.loading).toBe(false)
        expect(result.current.result).toBeNull()
        expect(result.current.selectedLevel).toBe('eli5')
    })

    it('loads fresh result in startSearch', async () => {
        const { result } = renderHook(() => useKnowBearStore())
        await act(async () => {
            await result.current.startSearch('blockchain')
        })

        await waitFor(() => {
            expect(result.current.result?.explanations.eli5).toBe('blockchain content')
        })
    })

    it('aborts an active stream when a new search starts', async () => {
        const streamMock = vi.mocked(queryTopicStream)
        const { result } = renderHook(() => useKnowBearStore())

        await act(async () => {
            const firstSearch = result.current.startSearch('first topic')
            await result.current.startSearch('second topic')
            await firstSearch
        })

        await waitFor(() => {
            expect(result.current.activeTopic).toBe('second topic')
            expect(result.current.result?.topic).toBe('second topic')
            expect(result.current.result?.explanations.eli5).toBe('second topic content')
        })

        expect(streamMock).toHaveBeenCalledTimes(2)
    })

    it('passes regenerate flag and temperature for level regeneration', async () => {
        const streamMock = vi.mocked(queryTopicStream)
        const { result } = renderHook(() => useKnowBearStore())

        await act(async () => {
            await result.current.startSearch('thermodynamics')
            await result.current.fetchLevel('thermodynamics', 'eli5', { regenerate: true, temperature: 1.03 })
        })

        const regenerateCall = streamMock.mock.calls[1]
        expect(regenerateCall?.[0]).toMatchObject({
            topic: 'thermodynamics',
            levels: ['eli5'],
            regenerate: true,
            temperature: 1.03,
        })
    })

    it('handles image input and propagates image to queryTopicStream', async () => {
        const streamMock = vi.mocked(queryTopicStream)
        const { result } = renderHook(() => useKnowBearStore())
        const dummyImage = 'data:image/png;base64,sample'

        await act(async () => {
            await result.current.startSearch('', false, undefined, dummyImage)
        })

        await waitFor(() => {
            expect(result.current.activeImage).toBe(dummyImage)
            expect(result.current.activeTopic).toBe('Explain this image or diagram')
        })

        const firstCall = streamMock.mock.calls[0]
        expect(firstCall?.[0]).toMatchObject({
            topic: 'Explain this image or diagram',
            image: dummyImage,
            levels: ['eli5'],
        })
    })
})
