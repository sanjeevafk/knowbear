import { create } from 'zustand'
import { createJSONStorage, persist } from 'zustand/middleware'
import type { QueryResponse, Level, PinnedTopic, StreamStatus } from '../types'
import { queryTopicStream } from '../api'

const MAX_TOPIC_HISTORY = 12
const STORE_KEY = 'knowbear-store'

interface KnowBearState {
    loading: boolean
    result: QueryResponse | null
    selectedLevel: Level
    error: string | null
    fetchingLevels: Set<Level>
    failedLevels: Set<Level>
    isSidebarOpen: boolean
    activeTopic: string
    loadingMeta: { level: Level; topic: string } | null
    abortController: AbortController | null
    pinnedTopics: PinnedTopic[]
    pinnedTopicsLoaded: boolean
    streamStatus: StreamStatus
    favoriteTopics: string[]
    lastFailedRequest: { topic: string; level: Level } | null

    setLoading: (loading: boolean) => void
    setResult: (result: QueryResponse | null) => void
    setSelectedLevel: (level: Level) => void
    setError: (error: string | null) => void
    setFetchingLevels: (levels: Set<Level>) => void
    setFailedLevels: (levels: Set<Level>) => void
    setIsSidebarOpen: (open: boolean) => void
    setActiveTopic: (topic: string) => void
    setLoadingMeta: (meta: { level: Level; topic: string } | null) => void
    setStreamStatus: (status: StreamStatus) => void
    toggleFavoriteTopic: (topic: string) => void
    fetchPinnedTopics: () => Promise<void>
    retryLastFailed: () => Promise<void>

    startSearch: (topic: string, forceRefresh?: boolean, requestedLevel?: Level) => Promise<void>
    fetchLevel: (topic: string, level: Level, options?: { temperature?: number; regenerate?: boolean }) => Promise<void>
    abortCurrentStream: () => void
    reset: () => void
}

const initialState = {
    loading: false,
    result: null,
    selectedLevel: 'eli5' as Level,
    error: null,
    fetchingLevels: new Set<Level>(),
    failedLevels: new Set<Level>(),
    isSidebarOpen: true,
    activeTopic: '',
    loadingMeta: null,
    abortController: null,
    pinnedTopics: [],
    pinnedTopicsLoaded: false,
    streamStatus: 'idle' as StreamStatus,
    favoriteTopics: [],
    lastFailedRequest: null,
}

export const useKnowBearStore = create<KnowBearState>()(
    persist(
        (set, get) => ({
            ...initialState,

            setLoading: (loading) => set({ loading }),
            setResult: (result) => set({ result }),
            setSelectedLevel: (selectedLevel) => set({ selectedLevel }),
            setError: (error) => set({ error }),
            setFetchingLevels: (fetchingLevels) => set({ fetchingLevels }),
            setFailedLevels: (failedLevels) => set({ failedLevels }),
            setIsSidebarOpen: (isSidebarOpen) => set({ isSidebarOpen }),
            setActiveTopic: (activeTopic) => set({ activeTopic }),
            setLoadingMeta: (loadingMeta) => set({ loadingMeta }),
            setStreamStatus: (streamStatus) => set({ streamStatus }),
            toggleFavoriteTopic: (topic) => {
                const cleanTopic = topic.trim()
                if (!cleanTopic) return
                const current = get().favoriteTopics
                const exists = current.some((item) => item.toLowerCase() === cleanTopic.toLowerCase())
                const next = exists
                    ? current.filter((item) => item.toLowerCase() !== cleanTopic.toLowerCase())
                    : [cleanTopic, ...current].slice(0, MAX_TOPIC_HISTORY)
                set({ favoriteTopics: next })
            },

            abortCurrentStream: () => {
                const { abortController } = get()
                if (abortController) abortController.abort()
                const newController = new AbortController()
                set({ abortController: newController })
            },

            fetchPinnedTopics: async () => {
                if (get().pinnedTopicsLoaded) return
                try {
                    const { getPinnedTopics } = await import('../api')
                    const topics = await getPinnedTopics()
                    set({ pinnedTopics: topics, pinnedTopicsLoaded: true })
                } catch (err) {
                    console.error('Failed to load pinned topics:', err)
                    set({ pinnedTopicsLoaded: true })
                }
            },

            fetchLevel: async (topic: string, level: Level, options?: { temperature?: number; regenerate?: boolean }) => {
                const state = get()
                const newFetching = new Set(state.fetchingLevels)
                newFetching.add(level)
                set({ fetchingLevels: newFetching })

                const controller = state.abortController || new AbortController()
                if (!state.abortController) set({ abortController: controller })

                try {
                    let streamedText = ''
                    set({ streamStatus: 'idle' })

                    await queryTopicStream(
                        {
                            topic,
                            levels: [level],
                            temperature: options?.temperature,
                            regenerate: options?.regenerate || false,
                        },
                        (chunk: string) => {
                            streamedText += chunk
                            const currentState = get()
                            if (!currentState.result) {
                                controller.abort()
                                return
                            }

                            set({
                                result: {
                                    ...currentState.result,
                                    explanations: {
                                        ...currentState.result.explanations,
                                        [level]: streamedText,
                                    },
                                },
                            })
                        },
                        () => undefined,
                        (error: unknown) => {
                            const failed = new Set(get().failedLevels)
                            failed.add(level)
                            const message = error instanceof Error ? error.message : 'Request failed'
                            set({
                                failedLevels: failed,
                                error: message,
                                streamStatus: 'degraded',
                                lastFailedRequest: { topic, level },
                            })
                        },
                        controller.signal,
                        (status) => {
                            set({ streamStatus: status })
                        }
                    )
                } catch (err: unknown) {
                    if (!(err instanceof Error) || err.name !== 'AbortError') {
                        const failed = new Set(get().failedLevels)
                        failed.add(level)
                        set({
                            failedLevels: failed,
                            error: err instanceof Error ? err.message : 'Request failed',
                            streamStatus: 'degraded',
                            lastFailedRequest: { topic, level },
                        })
                    }
                } finally {
                    const remaining = new Set(get().fetchingLevels)
                    remaining.delete(level)
                    if (remaining.size === 0 && get().streamStatus === 'live') {
                        set({ fetchingLevels: remaining, streamStatus: 'idle' })
                    } else {
                        set({ fetchingLevels: remaining })
                    }
                }
            },

            startSearch: async (topic: string, forceRefresh = false, requestedLevel?: Level) => {
                if (!topic.trim()) return

                const state = get()
                state.abortCurrentStream()

                const activeLevel = requestedLevel || state.selectedLevel

                if (!forceRefresh) {
                    set({ result: null, error: null, lastFailedRequest: null })
                }

                if (requestedLevel && requestedLevel !== state.selectedLevel) set({ selectedLevel: activeLevel })

                set({
                    activeTopic: topic,
                    loadingMeta: { level: activeLevel, topic },
                    loading: true,
                    error: null,
                    streamStatus: 'idle',
                })

                if (forceRefresh) {
                    const currentResult = get().result
                    if (currentResult) {
                        set({
                            result: {
                                ...currentResult,
                                explanations: { ...currentResult.explanations, [activeLevel]: '' },
                            },
                        })
                    } else {
                        set({
                            result: { topic, explanations: {} },
                        })
                    }

                    const randomTemp = Math.random() * (1.1 - 0.95) + 0.95
                    set({ fetchingLevels: new Set(), failedLevels: new Set() })

                    await get().fetchLevel(topic, activeLevel, {
                        temperature: randomTemp,
                        regenerate: true,
                    })
                    set({ loading: false, loadingMeta: null })
                    return
                }

                set({
                    result: { topic, explanations: {} },
                    fetchingLevels: new Set(),
                    failedLevels: new Set(),
                })

                await get().fetchLevel(topic, activeLevel)
                set({ loading: false, loadingMeta: null })
            },

            retryLastFailed: async () => {
                const failed = get().lastFailedRequest
                if (!failed) return
                await get().startSearch(failed.topic, true, failed.level)
            },

            reset: () => set({ ...initialState }),
        }),
        {
            name: STORE_KEY,
            storage: createJSONStorage(() => localStorage),
            partialize: (state) => ({
                selectedLevel: state.selectedLevel,
                isSidebarOpen: state.isSidebarOpen,
                favoriteTopics: state.favoriteTopics,
            }),
            merge: (persistedState, currentState) => {
                const persisted = (persistedState ?? {}) as Partial<KnowBearState>
                const safeFavorites = Array.isArray(persisted.favoriteTopics)
                    ? persisted.favoriteTopics.filter((item): item is string => typeof item === 'string')
                    : currentState.favoriteTopics

                return {
                    ...currentState,
                    ...persisted,
                    favoriteTopics: safeFavorites,
                }
            },
        }
    )
)
