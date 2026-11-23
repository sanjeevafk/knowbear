export type Child = Node | string | number | null | undefined | false

export function el<K extends keyof HTMLElementTagNameMap>(
    tag: K,
    attrs?: Record<string, unknown> | null,
    ...children: Child[]
): HTMLElementTagNameMap[K] {
    const node = document.createElement(tag)
    if (attrs) {
        for (const [key, val] of Object.entries(attrs)) {
            if (val === undefined || val === null || val === false) continue
            if (key === 'className') {
                node.className = String(val)
            } else if (key === 'style' && typeof val === 'object') {
                Object.assign(node.style, val)
            } else if (key.startsWith('on') && typeof val === 'function') {
                const event = key.slice(2).toLowerCase()
                node.addEventListener(event, val as EventListener)
            } else if (key in node && key !== 'list' && key !== 'type' && key !== 'draggable') {
                try {
                    ;(node as unknown as Record<string, unknown>)[key] = val
                } catch {
                    node.setAttribute(key, String(val))
                }
            } else if (val === true) {
                node.setAttribute(key, '')
            } else {
                node.setAttribute(key, String(val))
            }
        }
    }
    appendChildren(node, children)
    return node
}

function appendChildren(parent: Node, children: Child[]): void {
    for (const child of children) {
        if (child === null || child === undefined || child === false) continue
        if (child instanceof Node) {
            parent.appendChild(child)
        } else {
            parent.appendChild(document.createTextNode(String(child)))
        }
    }
}

export type IconName =
    | 'search'
    | 'loader'
    | 'image'
    | 'x'
    | 'rotate'
    | 'alert'
    | 'github'
    | 'sun'
    | 'moon'
    | 'copy'
    | 'check'
    | 'download'
    | 'share'
    | 'fileText'
    | 'quote'
    | 'chevronDown'

const ICON_PATHS: Record<IconName, string> = {
    search: '<circle cx="11" cy="11" r="8"/><path d="m21 21-4.3-4.3"/>',
    loader: '<path d="M21 12a9 9 0 1 1-6.219-8.56"/>',
    image: '<rect width="18" height="18" x="3" y="3" rx="2" ry="2"/><circle cx="9" cy="9" r="2"/><path d="m21 15-3.086-3.086a2 2 0 0 0-2.828 0L6 21"/>',
    x: '<path d="M18 6 6 18"/><path d="m6 6 12 12"/>',
    rotate: '<path d="M3 12a9 9 0 1 0 9-9 9.75 9.75 0 0 0-6.74 2.74L3 8"/><path d="M3 3v5h5"/>',
    alert: '<path d="m21.73 18-8-14a2 2 0 0 0-3.48 0l-8 14A2 2 0 0 0 4 21h16a2 2 0 0 0 1.73-3"/><path d="M12 9v4"/><path d="M12 17h.01"/>',
    github: '<path d="M15 22v-4a4.8 4.8 0 0 0-1-3.5c3 0 6-2 6-5.5.08-1.25-.27-2.48-1-3.5.28-1.15.28-2.35 0-3.5 0 0-1 0-3 1.5-2.64-.5-5.36-.5-8 0C6 2 5 2 5 2c-.3 1.15-.3 2.35 0 3.5A5.403 5.403 0 0 0 4 9c0 3.5 3 5.5 6 5.5-.39.49-.68 1.05-.85 1.65-.17.6-.22 1.23-.15 1.85v4"/><path d="M9 18c-4.51 2-5-2-7-2"/>',
    sun: '<circle cx="12" cy="12" r="4"/><path d="M12 2v2"/><path d="M12 20v2"/><path d="m4.93 4.93 1.41 1.41"/><path d="m17.66 17.66 1.41 1.41"/><path d="M2 12h2"/><path d="M20 12h2"/><path d="m6.34 17.66-1.41 1.41"/><path d="m19.07 4.93-1.41 1.41"/>',
    moon: '<path d="M12 3a6 6 0 0 0 9 9 9 9 0 1 1-9-9Z"/>',
    copy: '<rect width="14" height="14" x="8" y="8" rx="2" ry="2"/><path d="M4 16c-1.1 0-2-.9-2-2V4c0-1.1.9-2 2-2h10c1.1 0 2 .9 2 2"/>',
    check: '<path d="M20 6 9 17l-5-5"/>',
    download: '<path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="7 10 12 15 17 10"/><line x1="12" x2="12" y1="15" y2="3"/>',
    share: '<circle cx="18" cy="5" r="3"/><circle cx="6" cy="12" r="3"/><circle cx="18" cy="19" r="3"/><line x1="8.59" x2="15.42" y1="13.51" y2="17.49"/><line x1="15.41" x2="8.59" y1="6.51" y2="10.49"/>',
    fileText: '<path d="M15 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V7Z"/><path d="M14 2v4a2 2 0 0 0 2 2h4"/><path d="M10 9H8"/><path d="M16 13H8"/><path d="M16 17H8"/>',
    quote: '<path d="M16 3a2 2 0 0 0-2 2v6a2 2 0 0 0 2 2 1 1 0 0 1 1 1v1a2 2 0 0 1-2 2 1 1 0 0 0-1 1v2a1 1 0 0 0 1 1 6 6 0 0 0 6-6V5a2 2 0 0 0-2-2z"/><path d="M5 3a2 2 0 0 0-2 2v6a2 2 0 0 0 2 2 1 1 0 0 1 1 1v1a2 2 0 0 1-2 2 1 1 0 0 0-1 1v2a1 1 0 0 0 1 1 6 6 0 0 0 6-6V5a2 2 0 0 0-2-2z"/>',
    chevronDown: '<path d="m6 9 6 6 6-6"/>',
}

export function icon(name: IconName, className = 'w-4 h-4'): SVGSVGElement {
    const svg = document.createElementNS('http://www.w3.org/2000/svg', 'svg')
    svg.setAttribute('viewBox', '0 0 24 24')
    svg.setAttribute('fill', 'none')
    svg.setAttribute('stroke', 'currentColor')
    svg.setAttribute('stroke-width', '2')
    svg.setAttribute('stroke-linecap', 'round')
    svg.setAttribute('stroke-linejoin', 'round')
    svg.setAttribute('aria-hidden', 'true')
    if (className) svg.setAttribute('class', className)
    svg.innerHTML = ICON_PATHS[name]
    return svg
}
