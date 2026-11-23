import { describe, it, expect, beforeEach, vi } from 'vitest'
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
        useKnowBearStore.getState().reset()
        vi.clearAllMocks()
    })

    it('has expected initial state', () => {
        const state = useKnowBearStore.getState()
        expect(state.loading).toBe(false)
        expect(state.result).toBeNull()
        expect(state.selectedLevel).toBe('eli5')
    })

    it('loads fresh result in startSearch', async () => {
        await useKnowBearStore.getState().startSearch('blockchain')
        expect(useKnowBearStore.getState().result?.explanations.eli5).toBe('blockchain content')
    })

    it('aborts an active stream when a new search starts', async () => {
        const streamMock = vi.mocked(queryTopicStream)
        const firstSearch = useKnowBearStore.getState().startSearch('first topic')
        await useKnowBearStore.getState().startSearch('second topic')
        await firstSearch

        const state = useKnowBearStore.getState()
        expect(state.activeTopic).toBe('second topic')
        expect(state.result?.topic).toBe('second topic')
        expect(state.result?.explanations.eli5).toBe('second topic content')
        expect(streamMock).toHaveBeenCalledTimes(2)
    })

    it('passes regenerate flag and temperature for level regeneration', async () => {
        const streamMock = vi.mocked(queryTopicStream)
        await useKnowBearStore.getState().startSearch('thermodynamics')
        await useKnowBearStore.getState().fetchLevel('thermodynamics', 'eli5', { regenerate: true, temperature: 1.03 })

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
        const dummyImage = 'data:image/png;base64,sample'

        await useKnowBearStore.getState().startSearch('', false, undefined, dummyImage)

        const state = useKnowBearStore.getState()
        expect(state.activeImage).toBe(dummyImage)
        expect(state.activeTopic).toBe('Explain this image or diagram')

        const firstCall = streamMock.mock.calls[0]
        expect(firstCall?.[0]).toMatchObject({
            topic: 'Explain this image or diagram',
            image: dummyImage,
            levels: ['eli5'],
        })
    })
})
