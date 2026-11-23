import type { PinnedTopic } from '../types'
import { el } from '../utils/dom'

export const FALLBACK_PINNED_TOPICS: PinnedTopic[] = [
    { id: 'black-holes', title: 'How Black Holes Work', description: 'Event horizons, spacetime warping, and singularities.' },
    { id: 'sleep', title: 'Why We Need Sleep', description: 'Brain restoration, memory consolidation, and circadian rhythms.' },
    { id: 'inflation', title: 'How Inflation Works', description: 'Money supply, purchasing power, and everyday economics.' },
]

export interface PinnedTopicsOptions {
    topics: PinnedTopic[]
    onSelect: (topic: string) => void
}

export function createPinnedTopics({ topics, onSelect }: PinnedTopicsOptions): HTMLElement {
    return el(
        'section',
        { className: 'w-full max-w-3xl mx-auto mt-6' },
        el(
            'h3',
            { className: 'text-sm font-semibold text-gray-500 uppercase tracking-widest mb-6 text-center' },
            'Popular Topics'
        ),
        el(
            'div',
            { className: 'grid grid-cols-1 sm:grid-cols-3 gap-6' },
            ...topics.map((item, index) =>
                el(
                    'button',
                    {
                        type: 'button',
                        className:
                            'p-6 bg-dark-800 border border-dark-600 rounded-2xl hover:border-amber-500 hover:bg-dark-700 transition-all text-left group flex flex-col gap-3',
                        onClick: () => onSelect(item.title),
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
    )
}
