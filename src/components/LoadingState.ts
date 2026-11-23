import type { Level } from '../types'
import { el, icon } from '../utils/dom'
import { createKnowBearAvatar } from './KnowBearAvatar'

const FALLBACK_QUOTES = [
    'The mind is not a vessel to be filled, but a fire to be kindled. — Plutarch',
    'An investment in knowledge pays the best interest. — Benjamin Franklin',
    'Wisdom is not a product of schooling but of the lifelong attempt to acquire it. — Albert Einstein',
    'The important thing is not to stop questioning. Curiosity has its own reason for existence. — Albert Einstein',
    'Live as if you were to die tomorrow. Learn as if you were to live forever. — Mahatma Gandhi',
]

export interface LoadingStateOptions {
    level: Level
    topic: string
}

export function createLoadingState({ level, topic }: LoadingStateOptions): {
    el: HTMLDivElement
    destroy: () => void
} {
    let cancelled = false

    let baseMessage = 'Crafting your explanation...'
    if (level === 'eli5') {
        baseMessage = 'Brewing your ELI5 explanation...'
    } else if (level === 'eli12') {
        baseMessage = 'Preparing a clear middle-school friendly explanation...'
    }

    const lowerTopic = topic.toLowerCase()
    if (lowerTopic.includes('diagram') || lowerTopic.includes('architecture') || lowerTopic.includes('flow') || lowerTopic.includes('sequence')) {
        baseMessage += ' and generating diagrams'
    } else if (lowerTopic.includes('code') || lowerTopic.includes('python') || lowerTopic.includes('javascript') || lowerTopic.includes('algorithm')) {
        baseMessage += ' including code examples'
    }

    const quoteText = el('p', { className: 'text-gray-300 italic leading-relaxed text-sm md:text-base font-medium' })
    const quoteBox = el(
        'div',
        { className: 'relative p-6 bg-white/[0.03] border border-white/10 rounded-2xl hidden' },
        icon('quote', 'absolute -top-3 -left-3 w-8 h-8 text-white/5 rotate-180'),
        quoteText,
        icon('quote', 'absolute -bottom-3 -right-3 w-8 h-8 text-white/5')
    )

    const setQuote = (q: string) => {
        if (cancelled) return
        quoteText.textContent = q
        quoteBox.classList.remove('hidden')
    }

    ;(async () => {
        try {
            const response = await fetch(
                'https://api.quotable.io/random?tags=education|knowledge|learning|science|wisdom|research|effort|creativity&maxLength=100'
            )
            if (!response.ok) throw new Error('Quote API failed')
            const data = await response.json()
            if (data.content && data.author) {
                setQuote(`«${data.content}» — ${data.author}`)
                return
            }
            throw new Error('Invalid quote data')
        } catch {
            setQuote(FALLBACK_QUOTES[Math.floor(Math.random() * FALLBACK_QUOTES.length)])
        }
    })()

    const root = el(
        'div',
        { className: 'flex flex-col items-center justify-center p-12 min-h-[400px]' },
        el(
            'div',
            { className: 'relative mb-6' },
            el('div', { className: 'absolute inset-0 bg-amber-500/20 blur-3xl rounded-full scale-150 animate-pulse' }),
            createKnowBearAvatar({ expression: 'loading', size: '2xl', pulse: true, className: 'relative z-10' })
        ),
        el(
            'div',
            { className: 'text-center space-y-6 max-w-lg' },
            el(
                'div',
                { className: 'space-y-2' },
                el(
                    'p',
                    { className: 'text-2xl font-black text-white tracking-tight animate-pulse' },
                    baseMessage,
                    el('span', { className: 'inline-flex w-8 text-left ml-0.5' }, '...')
                ),
                el('p', { className: 'text-sm text-amber-500/70 font-medium uppercase tracking-[0.2em]' }, 'Meanwhile')
            ),
            quoteBox,
            el(
                'p',
                { className: 'text-xs text-gray-500 max-w-sm mx-auto leading-relaxed border-t border-white/5 pt-4' },
                'Synthesizing knowledge for the perfect explanation.'
            )
        )
    )

    return {
        el: root,
        destroy: () => {
            cancelled = true
        },
    }
}
