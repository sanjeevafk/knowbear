import { ChevronLeft, ChevronRight, Github, Pin, Star } from 'lucide-react'
import { useNavigate } from 'react-router-dom'
import { motion, AnimatePresence } from 'framer-motion'
import { useEffect, useState } from 'react'

interface SidebarProps {
    isOpen: boolean
    onToggle: () => void
    onSelectTopic: (topic: string) => void
    favoriteTopics: string[]
    onToggleFavorite: (topic: string) => void
}

const QUICK_TOPICS = [
    'Artificial Intelligence',
    'Quantum Computing',
    'Blockchain',
    'Climate Change',
    'Photosynthesis',
]

export default function Sidebar({ isOpen, onToggle, onSelectTopic, favoriteTopics, onToggleFavorite }: SidebarProps) {
    const navigate = useNavigate()
    const [isMobile, setIsMobile] = useState(false)

    useEffect(() => {
        const checkMobile = () => setIsMobile(window.innerWidth < 768)
        checkMobile()
        window.addEventListener('resize', checkMobile)
        return () => window.removeEventListener('resize', checkMobile)
    }, [])

    return (
        <>
            <AnimatePresence>
                {isOpen && isMobile && (
                    <motion.div
                        initial={{ opacity: 0 }}
                        animate={{ opacity: 1 }}
                        exit={{ opacity: 0 }}
                        transition={{ duration: 0.2 }}
                        className="fixed inset-0 bg-black/60 backdrop-blur-sm z-40 md:hidden"
                        onClick={onToggle}
                    />
                )}
            </AnimatePresence>

            <motion.aside
                className={`fixed left-0 top-0 h-full bg-dark-900 border-r border-dark-700 transition-all duration-300 z-50 flex flex-col ${isOpen ? 'w-[15rem] sm:w-64 translate-x-0 shadow-2xl shadow-cyan-900/10' : 'w-[15rem] sm:w-64 -translate-x-full md:translate-x-0 md:w-16'}`}
                drag={isMobile && isOpen ? "x" : false}
                dragConstraints={{ left: 0, right: 0 }}
                dragElastic={0.2}
                onDragEnd={(_e, info) => {
                    if (isMobile && isOpen && (info.offset.x < -50 || info.velocity.x < -500)) {
                        onToggle()
                    }
                }}
            >
                <button
                    onClick={onToggle}
                    className="absolute -right-4 top-1/2 -translate-y-1/2 bg-dark-800 border border-dark-600 rounded-full p-1 text-gray-400 hover:text-white transition-colors hidden md:block"
                    aria-label={isOpen ? 'Close Sidebar' : 'Open Sidebar'}
                >
                    {isOpen ? <ChevronLeft size={16} /> : <ChevronRight size={16} />}
                </button>

                <div className={`p-4 flex flex-wrap items-center gap-3 border-b border-dark-700 ${!isOpen && 'justify-center'}`}>
                    <button
                        onClick={() => navigate('/')}
                        className="cursor-pointer focus:outline-none focus:ring-2 focus:ring-amber-500 rounded"
                        aria-label="Go to home"
                    >
                        <img src="/favicon.svg" alt="Logo" className="w-8 h-8" />
                    </button>
                    {isOpen && <span className="text-white font-bold text-lg tracking-tight">Know<span className="text-amber-500">Bear</span></span>}
                </div>

                <nav className="flex-grow overflow-y-auto custom-scrollbar p-3">
                    {isOpen ? (
                        <div className="space-y-4">
                            <h3 className="text-xs font-semibold text-gray-500 uppercase tracking-widest px-1">Quick Topics</h3>
                            {QUICK_TOPICS.map((topic) => (
                                <div key={topic} className="group flex items-center gap-1">
                                    <button
                                        onClick={() => onSelectTopic(topic)}
                                        className="flex-1 text-left px-3 py-2 text-sm rounded-lg text-gray-300 hover:bg-dark-800 hover:text-white transition-colors focus:outline-none focus:ring-2 focus:ring-cyan-500/60"
                                    >
                                        {topic}
                                    </button>
                                    <button
                                        onClick={() => onToggleFavorite(topic)}
                                        className="p-1.5 rounded text-gray-500 hover:text-yellow-400 hover:bg-dark-800 transition-colors focus:outline-none focus:ring-2 focus:ring-cyan-500/60"
                                        aria-label={`Pin ${topic}`}
                                    >
                                        <Pin className={`w-4 h-4 ${favoriteTopics.includes(topic) ? 'text-yellow-400' : ''}`} />
                                    </button>
                                </div>
                            ))}

                            {favoriteTopics.length > 0 && (
                                <div className="pt-2">
                                    <h3 className="text-xs font-semibold text-gray-500 uppercase tracking-widest px-1 mb-2 flex items-center gap-2">
                                        <Star className="w-3 h-3" />
                                        Pinned
                                    </h3>
                                    <div className="space-y-1">
                                        {favoriteTopics.slice(0, 6).map((topic) => (
                                            <button
                                                key={`fav-${topic}`}
                                                onClick={() => onSelectTopic(topic)}
                                                className="w-full text-left px-3 py-2 text-sm rounded-lg text-yellow-200 hover:bg-dark-800 hover:text-yellow-100 transition-colors focus:outline-none focus:ring-2 focus:ring-cyan-500/60"
                                            >
                                                {topic}
                                            </button>
                                        ))}
                                    </div>
                                </div>
                            )}

                        </div>
                    ) : null}
                </nav>

                <div className={`p-4 border-t border-dark-700 flex flex-col gap-4 ${isOpen ? 'items-start' : 'items-center'}`}>
                    <div className={`flex w-full items-center ${isOpen ? 'justify-between' : 'justify-center'}`}>
                        {isOpen && <span className="text-[10px] text-gray-600 font-mono">Demo Mode</span>}
                        <a
                            href="https://github.com/sanjeevafk/knowbear"
                            target="_blank"
                            rel="noopener noreferrer"
                            className="text-gray-400 hover:text-amber-400 transition-colors"
                            aria-label="GitHub repository"
                        >
                            <Github className="w-5 h-5" />
                        </a>
                    </div>
                </div>
            </motion.aside>
        </>
    )
}
