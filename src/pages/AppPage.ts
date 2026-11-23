import type { Level } from '../types'
import { el, icon } from '../utils/dom'
import { useKnowBearStore } from '../store/useKnowBearStore'
import { createNavbar } from '../components/Navbar'
import { createSearchBar } from '../components/SearchBar'
import { createLevelDropdown } from '../components/LevelDropdown'
import { createExplanationCard } from '../components/ExplanationCard'
import { createLoadingState } from '../components/LoadingState'
import { createPinnedTopics, FALLBACK_PINNED_TOPICS } from '../components/PinnedTopics'
import { openImageLightbox } from '../components/ImageLightbox'
import { createErrorBanner, createResultHeader } from '../components/ResultHeader'

export function mountAppPage(container: HTMLElement): () => void {
    const store = useKnowBearStore
    let cleanups: Array<() => void> = []
    let activeDialog: HTMLDialogElement | null = null

    const clearCleanups = () => {
        for (const fn of cleanups) fn()
        cleanups = []
    }

    const handleSearch = (topic: string, forceRefresh = false, requestedLevel?: Level, image?: string | null) => {
        void store.getState().startSearch(topic, forceRefresh, requestedLevel, image)
    }

    const handleLevelClick = (level: Level) => {
        const state = store.getState()
        if (!state.result) return
        const currentExplanation = state.result.explanations[level]
        if (currentExplanation && !state.fetchingLevels.has(level) && !state.failedLevels.has(level)) {
            state.setSelectedLevel(level)
            return
        }
        state.setSelectedLevel(level)
        if (!currentExplanation && !state.fetchingLevels.has(level)) {
            void state.fetchLevel(state.result.topic, level)
        }
    }

    const handleRegenerateSelectedLevel = () => {
        const state = store.getState()
        if (!state.result || !state.activeTopic) return
        const randomTemp = Math.random() * (1.1 - 0.95) + 0.95
        void state.fetchLevel(state.activeTopic, state.selectedLevel, { regenerate: true, temperature: randomTemp })
    }

    const navbar = createNavbar({ onNewSearch: () => store.getState().reset() })
    const inner = el('div', { className: 'max-w-5xl mx-auto px-3 sm:px-6 lg:px-8 pt-6 pb-12 sm:pt-8 sm:pb-16 space-y-4 sm:space-y-6' })
    const main = el('main', { className: 'flex-1 overflow-y-auto' }, inner)
    const root = el('div', { className: 'min-h-screen bg-dark-900 text-white flex flex-col' }, navbar, main)
    container.replaceChildren(root)

    let lastStructureKey = ''
    let cardMount: HTMLDivElement | null = null

    const render = () => {
        const s = store.getState()
        const structureKey = JSON.stringify({
            hasResult: Boolean(s.result),
            loading: s.loading,
            hasLoadingMeta: Boolean(s.loadingMeta),
            topic: s.result?.topic ?? '',
            activeTopic: s.activeTopic,
            activeImage: Boolean(s.activeImage),
            selectedLevel: s.selectedLevel,
            error: s.error,
            streamStatus: s.streamStatusByLevel[s.selectedLevel] ?? 'idle',
            pinnedCount: s.pinnedTopics.length,
            isFetchingSelected: s.fetchingLevels.has(s.selectedLevel),
        })

        if (structureKey === lastStructureKey && cardMount && s.result) {
            cardMount.replaceChildren(
                createExplanationCard({
                    level: s.selectedLevel,
                    content: s.result.explanations[s.selectedLevel] || '',
                    topic: s.activeTopic || s.result.topic,
                    streaming: s.fetchingLevels.has(s.selectedLevel),
                })
            )
            return
        }

        lastStructureKey = structureKey
        clearCleanups()
        cardMount = null

        const nodes: HTMLElement[] = []

        if (s.result || s.loading) {
            const topBar = el('div', { className: 'space-y-4 pt-2 sm:pt-3' })
            const sb = createSearchBar({
                onSearch: (topic, image) => handleSearch(topic, false, undefined, image),
                loading: s.loading,
                value: s.activeTopic,
                initialImage: s.activeImage,
            })
            cleanups.push(sb.destroy)
            topBar.appendChild(sb.el)

            if (s.error) {
                topBar.appendChild(
                    createErrorBanner(s.error, s.lastFailedRequest, () => void store.getState().retryLastFailed())
                )
            }
            nodes.push(topBar)
        }

        if (s.loading && s.loadingMeta) {
            const ls = createLoadingState({ level: s.loadingMeta.level, topic: s.loadingMeta.topic })
            cleanups.push(ls.destroy)
            nodes.push(ls.el)
        } else if (s.result) {
            const metaCol = createResultHeader({
                topic: s.result.topic,
                activeImage: s.activeImage,
                streamStatus: s.streamStatusByLevel[s.selectedLevel] ?? 'idle',
                explanationContent: s.result.explanations?.[s.selectedLevel] || '',
                onOpenImage: (src) => {
                    activeDialog?.close()
                    activeDialog = openImageLightbox(src, (d) => {
                        if (activeDialog === d) activeDialog = null
                    })
                },
            })

            const dropdown = createLevelDropdown({ selected: s.selectedLevel, onChange: handleLevelClick })
            cleanups.push(dropdown.destroy)

            const controlsCol = el(
                'div',
                { className: 'flex flex-col sm:flex-row flex-wrap items-stretch sm:items-center gap-3' },
                dropdown.el,
                el(
                    'button',
                    {
                        type: 'button',
                        disabled: s.fetchingLevels.has(s.selectedLevel) || s.loading,
                        className:
                            'inline-flex items-center justify-center gap-2 px-3 py-2 rounded-lg border border-amber-500/30 bg-amber-500/10 text-amber-200 hover:bg-amber-500/20 disabled:opacity-50 disabled:cursor-not-allowed',
                        onClick: handleRegenerateSelectedLevel,
                    },
                    icon('rotate', 'w-4 h-4'),
                    'Regenerate Level'
                )
            )

            cardMount = el(
                'div',
                null,
                createExplanationCard({
                    level: s.selectedLevel,
                    content: s.result.explanations[s.selectedLevel] || '',
                    topic: s.activeTopic || s.result.topic,
                    streaming: s.fetchingLevels.has(s.selectedLevel),
                })
            )

            nodes.push(
                el(
                    'section',
                    { className: 'space-y-6' },
                    el('div', { className: 'flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4' }, metaCol, controlsCol),
                    cardMount
                )
            )
        } else {
            const sb = createSearchBar({
                onSearch: (topic, image) => handleSearch(topic, false, undefined, image),
                loading: s.loading,
            })
            cleanups.push(sb.destroy)

            const visiblePinnedTopics = s.pinnedTopics.length > 0 ? s.pinnedTopics : FALLBACK_PINNED_TOPICS

            nodes.push(
                el(
                    'div',
                    { className: 'flex flex-col items-center justify-center min-h-[60vh] text-center max-w-3xl mx-auto space-y-10 py-8 px-4' },
                    el(
                        'div',
                        { className: 'flex flex-col items-center gap-3 select-none' },
                        el(
                            'div',
                            {
                                className:
                                    'w-16 h-16 rounded-3xl bg-amber-500/10 border border-amber-500/30 flex items-center justify-center shadow-lg shadow-amber-500/5 animate-pulse-slow',
                            },
                            el('img', { src: '/favicon.svg', alt: 'KnowBear', className: 'w-9 h-9' })
                        ),
                        el('h2', { className: 'text-3xl font-extrabold tracking-tight text-white mt-2' }, 'What passes for knowledge...?'),
                        el('p', { className: 'text-gray-400 max-w-md text-sm sm:text-base leading-relaxed' }, 'Understand anything, simply.')
                    ),
                    el('div', { className: 'w-full' }, sb.el),
                    visiblePinnedTopics.length > 0
                        ? el('div', { className: 'w-full pt-4' }, createPinnedTopics({ topics: visiblePinnedTopics, onSelect: (t) => handleSearch(t, false) }))
                        : null
                )
            )
        }

        inner.replaceChildren(...nodes)
    }

    const unsubscribe = store.subscribe(render)
    render()

    const params = new URLSearchParams(window.location.search)
    const query = params.get('q')
    if (query && query.trim()) {
        params.delete('q')
        const nextUrl = params.toString() ? `${window.location.pathname}?${params.toString()}` : window.location.pathname
        window.history.replaceState({}, '', nextUrl)
        handleSearch(query.trim(), false)
    }

    void store.getState().fetchPinnedTopics()

    return () => {
        unsubscribe()
        clearCleanups()
        activeDialog?.close()
        container.replaceChildren()
    }
}
