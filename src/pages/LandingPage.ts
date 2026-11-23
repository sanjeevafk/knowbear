import { el } from '../utils/dom'
import { navigate } from '../router'
import { createKnowBearPose } from '../components/KnowBearPose'
import { FALLBACK_PINNED_TOPICS } from '../components/PinnedTopics'

export function mountLandingPage(container: HTMLElement): () => void {
    const root = el(
        'div',
        { className: 'landing-root min-h-screen flex flex-col justify-between' },
        el('div', { className: 'landing-noise' }),
        el('header', { className: 'landing-header' }),
        el(
            'main',
            { className: 'landing-main max-w-4xl text-center items-center py-12 flex flex-col justify-center gap-16 flex-1' },
            el(
                'div',
                { className: 'space-y-6 flex flex-col items-center text-center max-w-2xl z-10' },
                el(
                    'section',
                    { className: 'hero p-0 text-center items-center flex flex-col' },
                    createKnowBearPose({ pose: 'wave', size: 'md', floating: true, className: 'mb-2' }),
                    el('p', { className: 'eyebrow font-mono' }, 'Knowledge Engine'),
                    el('h1', { className: 'hero-headline text-center' }, 'Complexity,', el('br'), 'made ', el('em', null, 'clear.')),
                    el('p', { className: 'hero-sub text-center mx-auto' }, 'Explain any topic in multiple levels of depth.')
                ),
                el(
                    'div',
                    { className: 'flex flex-col sm:flex-row gap-4 justify-center w-full sm:w-auto' },
                    el(
                        'button',
                        {
                            type: 'button',
                            className:
                                'px-8 py-4 bg-[#e8e4dc] hover:opacity-90 text-[#1a1918] rounded-xl font-bold text-lg transition-all transform active:scale-95 text-center shadow-lg',
                            onClick: () => navigate('/app'),
                        },
                        'Start Explaining'
                    )
                )
            ),
            el(
                'section',
                { className: 'w-full max-w-3xl z-10' },
                el('h3', { className: 'text-sm font-semibold text-gray-500 uppercase tracking-widest mb-6 text-center' }, 'Popular Topics'),
                el(
                    'div',
                    { className: 'grid grid-cols-1 sm:grid-cols-3 gap-6' },
                    ...FALLBACK_PINNED_TOPICS.map((item, index) =>
                        el(
                            'button',
                            {
                                type: 'button',
                                className:
                                    'p-6 bg-dark-800 border border-dark-600 rounded-2xl hover:border-amber-500 hover:bg-dark-700 transition-all text-left group flex flex-col gap-3',
                                onClick: () => navigate(`/app?q=${encodeURIComponent(item.title)}`),
                            },
                            el('span', { className: 'text-xs font-bold text-amber-500/70 font-mono' }, `0${index + 1}`),
                            el(
                                'h3',
                                { className: 'font-semibold text-white group-hover:text-amber-400 transition-colors text-lg' },
                                item.title
                            ),
                            el('p', { className: 'text-sm text-gray-400 leading-relaxed' }, item.description)
                        )
                    )
                )
            ),
            el(
                'footer',
                { className: 'landing-footer w-full pt-8 border-t border-white/5 z-10' },
                el('span', { className: 'footer-text' }, `© ${new Date().getFullYear()} KnowBear`),
                el(
                    'a',
                    {
                        href: '/app',
                        className: 'footer-link',
                        onClick: (e: MouseEvent) => {
                            e.preventDefault()
                            navigate('/app')
                        },
                    },
                    'Enter Workspace →'
                )
            )
        )
    )

    container.replaceChildren(root)
    return () => {
        container.replaceChildren()
    }
}
