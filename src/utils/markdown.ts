import { el } from './dom'

function isSafeUrl(url: string): boolean {
    try {
        const parsed = new URL(url, window.location.origin)
        return parsed.protocol === 'http:' || parsed.protocol === 'https:'
    } catch {
        return false
    }
}

function appendInline(parent: HTMLElement, text: string): void {
    const tokenRe = /(`[^`]+`|\*\*[^*]+\*\*|\*[^*]+\*|\[[^\]]+\]\([^)]+\))/g
    let last = 0
    let match: RegExpExecArray | null

    while ((match = tokenRe.exec(text)) !== null) {
        if (match.index > last) {
            parent.appendChild(document.createTextNode(text.slice(last, match.index)))
        }
        const token = match[0]
        if (token.startsWith('`') && token.endsWith('`')) {
            parent.appendChild(el('code', { className: 'bg-dark-900 rounded px-1.5 py-0.5 text-xs font-mono' }, token.slice(1, -1)))
        } else if (token.startsWith('**') && token.endsWith('**')) {
            parent.appendChild(el('strong', null, token.slice(2, -2)))
        } else if (token.startsWith('*') && token.endsWith('*')) {
            parent.appendChild(el('em', null, token.slice(1, -1)))
        } else if (token.startsWith('[')) {
            const linkMatch = /^\[([^\]]+)\]\(([^)]+)\)$/.exec(token)
            if (linkMatch && isSafeUrl(linkMatch[2])) {
                parent.appendChild(
                    el(
                        'a',
                        {
                            href: linkMatch[2],
                            target: '_blank',
                            rel: 'noopener noreferrer',
                            className: 'underline decoration-amber-500/30 underline-offset-4 hover:decoration-amber-400 transition-all font-medium',
                        },
                        linkMatch[1]
                    )
                )
            } else {
                parent.appendChild(document.createTextNode(token))
            }
        }
        last = tokenRe.lastIndex
    }
    if (last < text.length) {
        parent.appendChild(document.createTextNode(text.slice(last)))
    }
}

/** Render markdown subset safely into DOM nodes without innerHTML on untrusted content. */
export function renderMarkdown(markdown: string): DocumentFragment {
    const frag = document.createDocumentFragment()
    const lines = markdown.replace(/\r\n/g, '\n').split('\n')
    let i = 0

    while (i < lines.length) {
        const line = lines[i]
        if (!line.trim()) {
            i++
            continue
        }

        if (line.startsWith('```')) {
            const codeLines: string[] = []
            i++
            while (i < lines.length && !lines[i].startsWith('```')) {
                codeLines.push(lines[i])
                i++
            }
            if (i < lines.length) i++
            frag.appendChild(
                el(
                    'pre',
                    { className: 'bg-dark-900 p-4 rounded-xl border border-white/5 overflow-x-auto my-4' },
                    el('code', { className: 'text-xs font-mono text-amber-300' }, codeLines.join('\n'))
                )
            )
            continue
        }

        if (/^---+$/.test(line.trim())) {
            frag.appendChild(el('hr', { className: 'my-8 border-white/10' }))
            i++
            continue
        }

        if (line.startsWith('### ')) {
            const h3 = el('h3', { className: 'text-xl font-semibold mt-6 mb-3 text-amber-100' })
            appendInline(h3, line.slice(4))
            frag.appendChild(h3)
            i++
            continue
        }

        if (line.startsWith('## ')) {
            const h2 = el('h2', { className: 'text-2xl font-bold mt-8 mb-4 text-white border-b border-white/5 pb-2' })
            appendInline(h2, line.slice(3))
            frag.appendChild(h2)
            i++
            continue
        }

        if (/^[-*] /.test(line)) {
            const ul = el('ul', { className: 'list-disc pl-5 space-y-1 my-3' })
            while (i < lines.length && /^[-*] /.test(lines[i])) {
                const li = el('li')
                appendInline(li, lines[i].slice(2))
                ul.appendChild(li)
                i++
            }
            frag.appendChild(ul)
            continue
        }

        const paraLines: string[] = []
        while (
            i < lines.length &&
            lines[i].trim() &&
            !lines[i].startsWith('```') &&
            !lines[i].startsWith('## ') &&
            !lines[i].startsWith('### ') &&
            !/^---+$/.test(lines[i].trim()) &&
            !/^[-*] /.test(lines[i])
        ) {
            paraLines.push(lines[i])
            i++
        }
        const p = el('p', { className: 'mb-4 last:mb-0' })
        appendInline(p, paraLines.join(' '))
        frag.appendChild(p)
    }

    return frag
}
