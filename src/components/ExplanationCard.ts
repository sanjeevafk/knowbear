import type { Level } from '../types'
import { el } from '../utils/dom'
import { renderMarkdown } from '../utils/markdown'
import { createKnowBearAvatar, type BearExpression } from './KnowBearAvatar'
import { createMemeRenderer } from './MemeRenderer'

const LEVEL_EXPRESSIONS: Record<Level, BearExpression> = {
    eli5: 'happy',
    eli12: 'idea',
    eli15: 'serious',
    meme: 'meme',
}

const LEVEL_COLORS: Record<Level, string> = {
    eli5: 'level-eli5',
    eli12: 'level-eli12',
    eli15: 'level-eli15',
    meme: 'level-meme',
}

const LEVEL_NAMES: Record<Level, string> = {
    eli5: "Explain Like I'm 5",
    eli12: "Explain Like I'm 12",
    eli15: "Explain Like I'm 15",
    meme: 'Meme Explanation',
}

export interface ExplanationCardOptions {
    level: Level
    content: string
    topic?: string
    streaming?: boolean
}

export function createExplanationCard({ level, content, topic, streaming }: ExplanationCardOptions): HTMLDivElement {
    const borderColor = LEVEL_COLORS[level]
    const header = el(
        'h3',
        {
            className:
                'text-sm font-semibold text-gray-300 uppercase tracking-wide mb-4 border-b border-white/5 pb-2 flex items-center gap-2.5',
        },
        createKnowBearAvatar({ expression: LEVEL_EXPRESSIONS[level], size: 'xs' }),
        el('span', null, LEVEL_NAMES[level])
    )

    if (level === 'meme') {
        return el(
            'div',
            { className: `bg-dark-700 border-l-4 ${borderColor} rounded-lg p-6 transition-all shadow-2xl relative` },
            header,
            createMemeRenderer({ content, topic, streaming })
        )
    }

    const prose = el('div', {
        className:
            'prose prose-invert max-w-none text-gray-200 leading-relaxed prose-headings:text-white prose-a:text-amber-400 hover:prose-a:text-amber-300 prose-code:text-amber-300 prose-img:rounded-xl prose-hr:border-white/5',
    })
    prose.appendChild(renderMarkdown(content))
    if (streaming) {
        prose.appendChild(
            el('span', {
                className: 'inline-block w-2 h-5 ml-1 bg-amber-500 animate-[pulse_0.8s_infinite] vertical-middle',
                style: { verticalAlign: 'middle' },
            })
        )
    }

    return el(
        'div',
        { className: `bg-dark-700 border-l-4 ${borderColor} rounded-lg p-6 transition-all shadow-2xl relative` },
        header,
        prose
    )
}
