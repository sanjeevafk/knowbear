import { useMemo } from 'react'
import { useNavigate } from 'react-router-dom'
import type { PinnedTopic } from '../types'

export default function LandingPage() {
    const navigate = useNavigate()

    const curatedPinned: PinnedTopic[] = useMemo(
        () => [
            { id: 'tcp-ip', title: 'TCP/IP Layers', description: 'Protocols and responsibilities by layer.' },
            { id: 'osi', title: 'OSI Model', description: 'A clean reference for network fundamentals.' },
            { id: 'linux-windows', title: 'Linux vs Windows for Dev', description: 'Tradeoffs for daily development.' },
        ],
        []
    )

    return (
        <div className="landing-root min-h-screen flex flex-col justify-between">
            <div className="landing-noise" />

            <header className="landing-header">
                <div className="landing-header-logo">
                    <img src="/favicon.svg" alt="KnowBear" className="w-5 h-5" />
                    <span>KnowBear</span>
                </div>
            </header>

            <main className="landing-main max-w-4xl text-center items-center py-12 flex flex-col justify-center gap-16 flex-1">
                <div className="space-y-8 flex flex-col items-center text-center max-w-2xl z-10">
                    <section className="hero p-0 text-center items-center">
                        <p className="eyebrow font-mono">Knowledge Engine</p>
                        <h1 className="hero-headline text-center">
                            Complexity,<br />made <em>clear.</em>
                        </h1>
                        <p className="hero-sub text-center mx-auto">
                            Explain any topic in multiple levels of depth. Harness live web search and multi-model synthesis to bypass the noise.
                        </p>
                    </section>

                    <div className="flex flex-col sm:flex-row gap-4 justify-center w-full sm:w-auto">
                        <button
                            onClick={() => navigate('/app')}
                            className="px-8 py-4 bg-[#e8e4dc] hover:opacity-90 text-[#1a1918] rounded-xl font-bold text-lg transition-all transform active:scale-95 text-center shadow-lg"
                        >
                            Start Explaining
                        </button>
                    </div>
                </div>

                <section className="w-full max-w-3xl z-10">
                    <h3 className="text-sm font-semibold text-gray-500 uppercase tracking-widest mb-6 text-center">Popular Topics</h3>
                    <div className="grid grid-cols-1 sm:grid-cols-3 gap-6">
                        {curatedPinned.map((item, index) => (
                            <button
                                key={item.id}
                                onClick={() => navigate(`/app?q=${encodeURIComponent(item.title)}`)}
                                className="p-6 bg-dark-800 border border-dark-600 rounded-2xl hover:border-amber-500 hover:bg-dark-700 transition-all text-left group flex flex-col gap-3"
                            >
                                <span className="text-xs font-bold text-amber-500/70 font-mono">0{index + 1}</span>
                                <h3 className="font-semibold text-white group-hover:text-amber-400 transition-colors text-lg">
                                    {item.title}
                                </h3>
                                <p className="text-sm text-gray-400 leading-relaxed">
                                    {item.description}
                                </p>
                            </button>
                        ))}
                    </div>
                </section>

                <footer className="landing-footer w-full pt-8 border-t border-white/5 z-10">
                    <span className="footer-text">© {new Date().getFullYear()} KnowBear</span>
                    <a href="/app" className="footer-link">Enter Workspace →</a>
                </footer>
            </main>
        </div>
    )
}
