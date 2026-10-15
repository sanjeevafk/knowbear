import { useEffect, useCallback } from 'react'
import { useSearchParams } from 'react-router-dom'
import { motion, AnimatePresence } from 'framer-motion'
import { RotateCcw, AlertTriangle } from 'lucide-react'
import { useShallow } from 'zustand/react/shallow'
import type { Level, PinnedTopic } from '../types'
import SearchBar from '../components/SearchBar'
import LevelDropdown from '../components/LevelDropdown'
import ExplanationCard from '../components/ExplanationCard'
import Sidebar from '../components/Sidebar'
import MobileBottomNav from '../components/MobileBottomNav'
import MobileHeader from '../components/MobileHeader'
import { LoadingState } from '../components/LoadingState'
import PinnedTopics from '../components/PinnedTopics'
import { useKnowBearStore } from '../store/useKnowBearStore'
import ThemeToggle from '../components/ThemeToggle'

const FALLBACK_PINNED_TOPICS: PinnedTopic[] = [
    { id: 'tcp-ip', title: 'TCP/IP Layers', description: 'Protocols and responsibilities by layer.' },
    { id: 'osi', title: 'OSI Model', description: 'A clean reference for network fundamentals.' },
    { id: 'climate-change', title: 'Climate Change', description: 'Causes, impacts, and practical responses.' },
    { id: 'rag', title: 'How LLM RAG Works', description: 'Retrieval + generation in practice.' },
]

export default function AppPage() {
    const [searchParams, setSearchParams] = useSearchParams()
    
    const {
        loading,
        result,
        selectedLevel,
        error,
        fetchingLevels,
        failedLevels,
        activeTopic,
        activeImage,
        loadingMeta,
        streamStatus,
        lastFailedRequest,
        pinnedTopics,
        isSidebarOpen,
        favoriteTopics,
    } = useKnowBearStore(useShallow((state) => ({
        loading: state.loading,
        result: state.result,
        selectedLevel: state.selectedLevel,
        error: state.error,
        fetchingLevels: state.fetchingLevels,
        failedLevels: state.failedLevels,
        activeTopic: state.activeTopic,
        activeImage: state.activeImage,
        loadingMeta: state.loadingMeta,
        streamStatus: state.streamStatus,
        lastFailedRequest: state.lastFailedRequest,
        pinnedTopics: state.pinnedTopics,
        isSidebarOpen: state.isSidebarOpen,
        favoriteTopics: state.favoriteTopics,
    })))

    const {
        setSelectedLevel,
        startSearch,
        fetchLevel,
        retryLastFailed,
        fetchPinnedTopics,
        setIsSidebarOpen,
        toggleFavoriteTopic,
    } = useKnowBearStore(useShallow((state) => ({
        setSelectedLevel: state.setSelectedLevel,
        startSearch: state.startSearch,
        fetchLevel: state.fetchLevel,
        retryLastFailed: state.retryLastFailed,
        fetchPinnedTopics: state.fetchPinnedTopics,
        setIsSidebarOpen: state.setIsSidebarOpen,
        toggleFavoriteTopic: state.toggleFavoriteTopic,
    })))

    const handleSearch = useCallback(
        async (topic: string, forceRefresh = false, requestedLevel?: Level, image?: string | null) => {
            await startSearch(topic, forceRefresh, requestedLevel, image)
        },
        [startSearch]
    )

    useEffect(() => {
        const query = searchParams.get('q')
        if (query && query.trim()) {
            searchParams.delete('q')
            setSearchParams(searchParams, { replace: true })
            handleSearch(query.trim(), false)
        }
    }, [searchParams, setSearchParams, handleSearch])

    useEffect(() => {
        fetchPinnedTopics()
    }, [fetchPinnedTopics])

    const handleLevelClick = async (level: Level) => {
        if (!result) return

        const currentExplanation = result.explanations[level]
        if (currentExplanation && !fetchingLevels.has(level) && !failedLevels.has(level)) {
            setSelectedLevel(level)
            return
        }

        setSelectedLevel(level)

        if (!currentExplanation && !fetchingLevels.has(level)) {
            await fetchLevel(result.topic, level)
        }
    }

    const handleRegenerateSelectedLevel = async () => {
        if (!result || !activeTopic) return
        const randomTemp = Math.random() * (1.1 - 0.95) + 0.95
        await fetchLevel(activeTopic, selectedLevel, { regenerate: true, temperature: randomTemp })
    }

    const streamBadge =
        streamStatus === 'live'
            ? { label: 'Live stream', className: 'bg-emerald-500/10 text-emerald-300 border-emerald-500/30' }
            : streamStatus === 'fallback'
                ? { label: 'Fallback mode', className: 'bg-amber-500/10 text-amber-300 border-amber-500/30' }
                : streamStatus === 'degraded'
                    ? { label: 'Degraded stream', className: 'bg-red-500/10 text-red-300 border-red-500/30' }
                    : null

    const sourceChips = (() => {
        const content = result?.explanations?.[selectedLevel] || ''
        const urlRegex = /https?:\/\/[^\s)]+/g
        const urls = Array.from(new Set((content.match(urlRegex) || []).map((url: string) => {
            try {
                const parsed = new URL(url)
                return parsed.hostname.replace(/^www\./, '')
            } catch {
                return null
            }
        }).filter((host: string | null): host is string => Boolean(host))))
        return urls.slice(0, 5)
    })()

    const visiblePinnedTopics = pinnedTopics.length > 0 ? pinnedTopics : FALLBACK_PINNED_TOPICS

    return (
        <div className="flex h-screen bg-dark-900 text-white overflow-hidden">
            <Sidebar
                isOpen={isSidebarOpen}
                onToggle={() => setIsSidebarOpen(!isSidebarOpen)}
                onSelectTopic={(topic) => handleSearch(topic, false)}
                favoriteTopics={favoriteTopics}
                onToggleFavorite={toggleFavoriteTopic}
            />

            <main className={`flex-grow flex flex-col overflow-hidden transition-all duration-300 ${isSidebarOpen ? 'md:pl-64' : 'md:pl-16'}`}>
                <MobileHeader isOpen={isSidebarOpen} onToggle={() => setIsSidebarOpen(!isSidebarOpen)} />

                {/* Top Action Bar for Desktop */}
                <div className="hidden md:flex items-center justify-between px-8 py-3 border-b border-dark-700 bg-dark-900/40 backdrop-blur-md select-none shrink-0">
                    <div>
                        {!result && (
                            <span className="text-xs font-semibold uppercase tracking-widest text-gray-500 font-mono">
                                Workspace
                            </span>
                        )}
                    </div>
                    <div className="flex items-center gap-3">
                        <ThemeToggle />
                    </div>
                </div>

                <div className="flex-1 overflow-y-auto">
                    <div className="max-w-5xl mx-auto px-3 sm:px-6 lg:px-8 pt-10 pb-6 sm:pt-12 sm:pb-8 space-y-4 sm:space-y-6">
                        {/* Render SearchBar at top ONLY if result is present or loading */}
                        {(result || loading) && (
                            <div className="space-y-4 pt-2 sm:pt-3">
                                <SearchBar
                                    onSearch={(topic, image) => handleSearch(topic, false, undefined, image)}
                                    loading={loading}
                                    value={activeTopic}
                                    initialImage={activeImage}
                                />

                                {error && (
                                    <motion.div
                                        initial={{ opacity: 0, y: -10 }}
                                        animate={{ opacity: 1, y: 0 }}
                                        className="bg-red-500/10 border border-red-500/20 rounded-lg px-4 py-3 text-red-400 space-y-3"
                                    >
                                        <p>{error}</p>
                                        {lastFailedRequest && (
                                            <div className="flex flex-wrap items-center gap-2">
                                                <button
                                                    onClick={() => retryLastFailed()}
                                                    className="inline-flex items-center gap-2 px-3 py-1.5 rounded-md bg-red-500/20 hover:bg-red-500/30 border border-red-500/30 text-red-100 text-sm"
                                                >
                                                    <AlertTriangle className="w-4 h-4" />
                                                    Retry Last Failed
                                                </button>
                                                <span className="text-xs text-red-200/70">
                                                    {lastFailedRequest.topic} · {lastFailedRequest.level}
                                                </span>
                                            </div>
                                        )}
                                    </motion.div>
                                )}
                            </div>
                        )}
                        <AnimatePresence mode="wait">
                            {loading && loadingMeta ? (
                                <motion.div key="loading" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}>
                                    <LoadingState level={loadingMeta.level} topic={loadingMeta.topic} />
                                </motion.div>
                            ) : result ? (
                                <motion.section
                                    key={`result-${result.topic}`}
                                    initial={{ opacity: 0, y: 20 }}
                                    animate={{ opacity: 1, y: 0 }}
                                    transition={{ duration: 0.5, ease: 'easeOut' }}
                                    className="space-y-6"
                                >
                                    <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
                                        <div>
                                            <h2 className="text-2xl sm:text-3xl font-black text-white tracking-tight break-words">
                                                {result.topic.length > 80 ? 'Explanation for your selection' : result.topic}
                                            </h2>
                                            {activeImage && (
                                                <div className="mt-3 p-3 bg-dark-800/80 rounded-xl border border-amber-500/30 flex items-center gap-3.5 max-w-xl shadow-md">
                                                    <img
                                                        src={activeImage}
                                                        alt="Analyzed screenshot or diagram"
                                                        className="w-16 h-16 rounded-lg object-cover border border-amber-500/40 shadow-sm cursor-pointer hover:opacity-90 transition-opacity shrink-0"
                                                        onClick={() => window.open(activeImage, '_blank')}
                                                        title="Click to view full image in new tab"
                                                    />
                                                    <div className="flex-1 min-w-0">
                                                        <span className="text-[10px] uppercase font-bold text-amber-400 tracking-wider block mb-0.5">
                                                            Analyzed Image / Diagram
                                                        </span>
                                                        <p className="text-xs text-gray-300">
                                                            Visual cognitive synthesis generated from your screenshot.
                                                        </p>
                                                    </div>
                                                </div>
                                            )}
                                            {result.topic.length > 80 && !activeImage && (
                                                <div className="mt-3 p-3.5 bg-dark-800/80 rounded-xl border border-dark-600/60 text-sm text-gray-300 leading-relaxed max-w-3xl">
                                                    <span className="text-[10px] uppercase font-bold text-amber-500/80 tracking-wider block mb-1">
                                                        Source Passage
                                                    </span>
                                                    <p className="line-clamp-4 hover:line-clamp-none transition-all cursor-pointer italic text-xs sm:text-sm text-gray-300/90">
                                                        "{result.topic}"
                                                    </p>
                                                </div>
                                            )}
                                            <div className="mt-2 flex flex-wrap items-center gap-2">
                                                <p className="text-sm text-gray-500">
                                                    Model: <span className="text-amber-400 font-medium">{activeImage ? 'Gemini 3 Flash (Vision)' : 'GPT-OSS 20B'}</span>
                                                </p>
                                                {streamBadge && (
                                                    <span className={`text-[11px] px-2 py-0.5 rounded-full border ${streamBadge.className}`}>
                                                        {streamBadge.label}
                                                    </span>
                                                )}
                                            </div>
                                            {sourceChips.length > 0 && (
                                                <div className="mt-2 flex flex-wrap items-center gap-1.5">
                                                    {sourceChips.map((source) => (
                                                        <span
                                                            key={source}
                                                            className="text-[10px] px-2 py-0.5 rounded-full border border-amber-500/30 text-amber-200 bg-amber-500/10"
                                                        >
                                                            {source}
                                                        </span>
                                                    ))}
                                                </div>
                                            )}
                                        </div>

                                        <div className="flex flex-col sm:flex-row flex-wrap items-stretch sm:items-center gap-3">
                                            <LevelDropdown selected={selectedLevel} onChange={handleLevelClick} />
                                            <button
                                                onClick={handleRegenerateSelectedLevel}
                                                disabled={fetchingLevels.has(selectedLevel) || loading}
                                                className="inline-flex items-center justify-center gap-2 px-3 py-2 rounded-lg border border-amber-500/30 bg-amber-500/10 text-amber-200 hover:bg-amber-500/20 disabled:opacity-50 disabled:cursor-not-allowed"
                                            >
                                                <RotateCcw className="w-4 h-4" />
                                                Regenerate Level
                                            </button>
                                        </div>
                                    </div>

                                    <ExplanationCard
                                        level={selectedLevel}
                                        content={result.explanations[selectedLevel] || ''}
                                        streaming={fetchingLevels.has(selectedLevel)}
                                    />
                                </motion.section>
                            ) : (
                                <motion.div
                                    key="empty"
                                    initial={{ opacity: 0, y: 20 }}
                                    animate={{ opacity: 1, y: 0 }}
                                    exit={{ opacity: 0 }}
                                    className="flex flex-col items-center justify-center min-h-[60vh] text-center max-w-3xl mx-auto space-y-10 py-8 px-4"
                                >
                                    <div className="flex flex-col items-center gap-3 select-none">
                                        <div className="w-16 h-16 rounded-3xl bg-amber-500/10 border border-amber-500/30 flex items-center justify-center shadow-lg shadow-amber-500/5 animate-pulse-slow">
                                            <img src="/favicon.svg" alt="KnowBear" className="w-9 h-9" />
                                        </div>
                                        <h2 className="text-3xl font-extrabold tracking-tight text-white mt-2">
                                            What passes for knowledge...?
                                        </h2>
                                        <p className="text-gray-500 max-w-md text-sm sm:text-base leading-relaxed">
                                            Search for any concept, system, or protocol to generate clear, multi-level syntheses.
                                        </p>
                                    </div>

                                    <div className="w-full">
                                        <SearchBar onSearch={(topic, image) => handleSearch(topic, false, undefined, image)} loading={loading} />
                                    </div>

                                    {visiblePinnedTopics.length > 0 && (
                                        <div className="w-full pt-4">
                                            <PinnedTopics topics={visiblePinnedTopics} onSelect={(topic) => handleSearch(topic, false)} />
                                        </div>
                                    )}
                                </motion.div>
                            )}
                        </AnimatePresence>
                    </div>
                </div>

                <MobileBottomNav
                    onRegenerate={handleRegenerateSelectedLevel}
                    loading={loading}
                    hasResult={!!result}
                    isSidebarOpen={isSidebarOpen}
                    onToggleSidebar={() => setIsSidebarOpen(!isSidebarOpen)}
                />
            </main>
        </div>
    )
}
