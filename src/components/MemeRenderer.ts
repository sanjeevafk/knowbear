import { el, icon } from '../utils/dom'
import { copyMemeImageToClipboard, shareMemeImage, downloadMemePng, parseMemeContent } from '../utils/memeImage'
import { createMascotMemeSvg } from './MascotMemeSvg'

export interface MemeRendererOptions {
    content: string
    topic?: string
    streaming?: boolean
}

export function createMemeRenderer({ content, topic, streaming }: MemeRendererOptions): HTMLDivElement {
    const parsed = parseMemeContent(content, topic)
    let viewMode: 'text' | 'svg' = 'text'
    let copiedText = false
    let copiedImage = false
    let isProcessing = false
    const canShare = typeof navigator !== 'undefined' && typeof navigator.share === 'function'

    const root = el('div', { className: 'flex flex-col gap-4' })

    const runWithProcessing = async (fn: () => Promise<void>) => {
        isProcessing = true
        render()
        try {
            await fn()
        } finally {
            isProcessing = false
            render()
        }
    }

    const triggerCopyImage = async () => {
        try {
            const ok = await copyMemeImageToClipboard(parsed.setup, parsed.punchline)
            if (ok) {
                copiedImage = true
                setTimeout(() => {
                    copiedImage = false
                    render()
                }, 2500)
            } else {
                await downloadMemePng(parsed.setup, parsed.punchline)
            }
        } catch {
            await downloadMemePng(parsed.setup, parsed.punchline)
        }
    }

    const render = () => {
        const textToggleBtn = el(
            'button',
            {
                type: 'button',
                className: `flex items-center gap-1.5 px-3 py-1.5 rounded-md text-xs font-medium transition-all ${
                    viewMode === 'text' ? 'bg-amber-500 text-dark-950 font-bold shadow-sm' : 'text-gray-400 hover:text-white'
                }`,
                onClick: () => {
                    viewMode = 'text'
                    render()
                },
            },
            icon('fileText', 'w-3.5 h-3.5'),
            el('span', null, 'Plain Text')
        )

        const svgToggleBtn = el(
            'button',
            {
                type: 'button',
                className: `flex items-center gap-1.5 px-3 py-1.5 rounded-md text-xs font-medium transition-all ${
                    viewMode === 'svg' ? 'bg-amber-500 text-dark-950 font-bold shadow-sm' : 'text-gray-400 hover:text-white'
                }`,
                onClick: () => {
                    viewMode = 'svg'
                    render()
                },
            },
            el('span', null, '🐻 Mascot Meme')
        )

        const actionBtns: HTMLElement[] = []
        if (viewMode === 'svg') {
            if (canShare) {
                actionBtns.push(
                    el(
                        'button',
                        {
                            type: 'button',
                            disabled: isProcessing,
                            title: 'Share image via WhatsApp, Instagram, Twitter, etc.',
                            className:
                                'flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-amber-500/10 hover:bg-amber-500/20 text-amber-300 border border-amber-500/30 text-xs font-medium transition-all active:scale-95 disabled:opacity-50',
                            onClick: () =>
                                void runWithProcessing(async () => {
                                    try {
                                        const ok = await shareMemeImage(parsed.setup, parsed.punchline)
                                        if (!ok) await triggerCopyImage()
                                    } catch {
                                        await downloadMemePng(parsed.setup, parsed.punchline)
                                    }
                                }),
                        },
                        icon('share', 'w-3.5 h-3.5 text-amber-400'),
                        el('span', null, 'Share')
                    )
                )
            }

            actionBtns.push(
                el(
                    'button',
                    {
                        type: 'button',
                        disabled: isProcessing,
                        title: 'Copy as image to paste in WhatsApp, Discord, Slack',
                        className:
                            'flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-dark-800 hover:bg-dark-700 text-gray-300 hover:text-white text-xs border border-white/10 transition-all active:scale-95 disabled:opacity-50',
                        onClick: () => void runWithProcessing(triggerCopyImage),
                    },
                    copiedImage ? icon('check', 'w-3.5 h-3.5 text-emerald-400') : icon('image', 'w-3.5 h-3.5 text-amber-400'),
                    el('span', null, copiedImage ? 'Image Copied!' : 'Copy Image')
                ),
                el(
                    'button',
                    {
                        type: 'button',
                        disabled: isProcessing,
                        title: 'Download shareable PNG image',
                        className:
                            'flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-dark-800 hover:bg-dark-700 text-gray-300 hover:text-white text-xs border border-white/10 transition-all active:scale-95 disabled:opacity-50',
                        onClick: () => void runWithProcessing(() => downloadMemePng(parsed.setup, parsed.punchline)),
                    },
                    icon('download', 'w-3.5 h-3.5 text-amber-400'),
                    el('span', null, 'Download Image')
                )
            )
        }

        actionBtns.push(
            el(
                'button',
                {
                    type: 'button',
                    title: 'Copy meme text',
                    className:
                        'flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-dark-800 hover:bg-dark-700 text-gray-300 hover:text-white text-xs border border-white/10 transition-all active:scale-95',
                    onClick: async () => {
                        const textToCopy = parsed.cleanText || parsed.punchline || content
                        await navigator.clipboard.writeText(textToCopy)
                        copiedText = true
                        render()
                        setTimeout(() => {
                            copiedText = false
                            render()
                        }, 2000)
                    },
                },
                copiedText ? icon('check', 'w-3.5 h-3.5 text-emerald-400') : icon('copy', 'w-3.5 h-3.5 text-gray-400'),
                el('span', null, copiedText ? 'Copied!' : 'Copy Text')
            )
        )

        const toolbar = el(
            'div',
            { className: 'flex flex-wrap items-center justify-between gap-3 bg-dark-900/80 p-2.5 rounded-xl border border-white/5' },
            el('div', { className: 'flex items-center gap-1.5 p-1 bg-dark-800 rounded-lg border border-white/5' }, textToggleBtn, svgToggleBtn),
            el('div', { className: 'flex flex-wrap items-center gap-2' }, ...actionBtns)
        )

        const body =
            viewMode === 'text'
                ? el(
                      'div',
                      { className: 'prose prose-invert max-w-none text-gray-200 leading-relaxed' },
                      el('p', { className: 'text-base sm:text-lg' }, parsed.cleanText || parsed.punchline || content)
                  )
                : el(
                      'div',
                      {
                          className:
                              'relative w-full rounded-2xl overflow-hidden border border-white/10 bg-dark-900 shadow-2xl flex justify-center p-2 sm:p-4',
                      },
                      createMascotMemeSvg(parsed.setup, parsed.punchline)
                  )

        const children: (HTMLElement | SVGSVGElement)[] = [toolbar, body]
        if (streaming) {
            children.push(
                el(
                    'div',
                    { className: 'flex items-center gap-2 text-xs text-amber-400 font-mono' },
                    el('span', { className: 'w-2 h-2 rounded-full bg-amber-400 animate-ping' }),
                    el('span', null, 'Generating punchline...')
                )
            )
        }
        root.replaceChildren(...children)
    }

    render()
    return root
}
