import type { Level, StreamStatus } from '../types'
import { el, icon } from '../utils/dom'

function extractSourceChips(content: string): string[] {
    const urlRegex = /https?:\/\/[^\s)]+/g
    const urls = Array.from(
        new Set(
            (content.match(urlRegex) || [])
                .map((url) => {
                    try {
                        return new URL(url).hostname.replace(/^www\./, '')
                    } catch {
                        return null
                    }
                })
                .filter((host): host is string => Boolean(host))
        )
    )
    return urls.slice(0, 5)
}

export function createErrorBanner(
    error: string,
    lastFailedRequest: { topic: string; level: Level } | null,
    onRetry: () => void
): HTMLDivElement {
    const errBox = el(
        'div',
        { className: 'bg-red-500/10 border border-red-500/20 rounded-lg px-4 py-3 text-red-400 space-y-3' },
        el('p', null, error)
    )
    if (lastFailedRequest) {
        errBox.appendChild(
            el(
                'div',
                { className: 'flex flex-wrap items-center gap-2' },
                el(
                    'button',
                    {
                        type: 'button',
                        className:
                            'inline-flex items-center gap-2 px-3 py-1.5 rounded-md bg-red-500/20 hover:bg-red-500/30 border border-red-500/30 text-red-100 text-sm',
                        onClick: onRetry,
                    },
                    icon('alert', 'w-4 h-4'),
                    'Retry Last Failed'
                ),
                el('span', { className: 'text-xs text-red-200/70' }, `${lastFailedRequest.topic} · ${lastFailedRequest.level}`)
            )
        )
    }
    return errBox
}

export interface ResultHeaderOptions {
    topic: string
    activeImage: string | null
    streamStatus: StreamStatus
    explanationContent: string
    onOpenImage: (src: string) => void
}

export function createResultHeader({
    topic,
    activeImage,
    streamStatus,
    explanationContent,
    onOpenImage,
}: ResultHeaderOptions): HTMLDivElement {
    const streamBadge =
        streamStatus === 'live'
            ? { label: 'Live stream', className: 'bg-emerald-500/10 text-emerald-300 border-emerald-500/30' }
            : streamStatus === 'fallback'
              ? { label: 'Fallback mode', className: 'bg-amber-500/10 text-amber-300 border-amber-500/30' }
              : streamStatus === 'degraded'
                ? { label: 'Degraded stream', className: 'bg-red-500/10 text-red-300 border-red-500/30' }
                : null

    const metaCol = el(
        'div',
        null,
        el(
            'h2',
            { className: 'text-2xl sm:text-3xl font-black text-white tracking-tight break-words' },
            topic.length > 80 ? 'Explanation for your selection' : topic
        )
    )

    if (activeImage) {
        metaCol.appendChild(
            el(
                'div',
                { className: 'mt-3 p-3 bg-dark-800/80 rounded-xl border border-amber-500/30 flex items-center gap-3.5 max-w-xl shadow-md' },
                el('img', {
                    src: activeImage,
                    alt: 'Analyzed screenshot or diagram',
                    className:
                        'w-16 h-16 rounded-lg object-cover border border-amber-500/40 shadow-sm cursor-pointer hover:opacity-90 transition-opacity shrink-0',
                    title: 'Click to view full image',
                    onClick: () => onOpenImage(activeImage),
                }),
                el(
                    'div',
                    { className: 'flex-1 min-w-0' },
                    el(
                        'span',
                        { className: 'text-[10px] uppercase font-bold text-amber-400 tracking-wider block mb-0.5' },
                        'Analyzed Image / Diagram'
                    ),
                    el('p', { className: 'text-xs text-gray-300' }, 'Visual cognitive synthesis generated from your screenshot.')
                )
            )
        )
    } else if (topic.length > 80) {
        metaCol.appendChild(
            el(
                'div',
                { className: 'mt-3 p-3.5 bg-dark-800/80 rounded-xl border border-dark-600/60 text-sm text-gray-300 leading-relaxed max-w-3xl' },
                el('span', { className: 'text-[10px] uppercase font-bold text-amber-500/80 tracking-wider block mb-1' }, 'Source Passage'),
                el(
                    'p',
                    { className: 'line-clamp-4 hover:line-clamp-none transition-all cursor-pointer italic text-xs sm:text-sm text-gray-300/90' },
                    `"${topic}"`
                )
            )
        )
    }

    const modelRow = el(
        'div',
        { className: 'mt-2 flex flex-wrap items-center gap-2' },
        el(
            'p',
            { className: 'text-sm text-gray-500' },
            'Model: ',
            el('span', { className: 'text-amber-400 font-medium' }, activeImage ? 'OpenRouter Vision' : 'GPT-OSS 20B')
        )
    )
    if (streamBadge) {
        modelRow.appendChild(
            el('span', { className: `text-[11px] px-2 py-0.5 rounded-full border ${streamBadge.className}` }, streamBadge.label)
        )
    }
    metaCol.appendChild(modelRow)

    const chips = extractSourceChips(explanationContent)
    if (chips.length > 0) {
        metaCol.appendChild(
            el(
                'div',
                { className: 'mt-2 flex flex-wrap items-center gap-1.5' },
                ...chips.map((source) =>
                    el(
                        'span',
                        { className: 'text-[10px] px-2 py-0.5 rounded-full border border-amber-500/30 text-amber-200 bg-amber-500/10' },
                        source
                    )
                )
            )
        )
    }

    return metaCol
}
