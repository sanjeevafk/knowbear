import { el } from '../utils/dom'

function getMemeFontClass(text: string): string {
    const len = text.length
    if (len > 90) return 'text-xs sm:text-sm font-extrabold leading-tight'
    if (len > 55) return 'text-sm sm:text-base font-black leading-tight'
    if (len > 30) return 'text-base sm:text-xl font-black leading-snug'
    return 'text-lg sm:text-2xl font-black leading-tight'
}

export function createMascotMemeSvg(setup: string, punchline: string): SVGSVGElement {
    const svg = document.createElementNS('http://www.w3.org/2000/svg', 'svg')
    svg.setAttribute('viewBox', '0 0 600 520')
    svg.setAttribute('class', 'w-full max-w-xl h-auto drop-shadow-xl select-none')

    const topFont = getMemeFontClass(setup)
    const btmFont = getMemeFontClass(punchline)
    const shadow = '2px 2px 0 #000, -2px -2px 0 #000, 2px -2px 0 #000, -2px 2px 0 #000'

    const defs = document.createElementNS('http://www.w3.org/2000/svg', 'defs')
    const grad = document.createElementNS('http://www.w3.org/2000/svg', 'linearGradient')
    grad.setAttribute('id', 'posterBg')
    grad.setAttribute('x1', '0')
    grad.setAttribute('y1', '0')
    grad.setAttribute('x2', '0')
    grad.setAttribute('y2', '1')
    const s1 = document.createElementNS('http://www.w3.org/2000/svg', 'stop')
    s1.setAttribute('offset', '0%')
    s1.setAttribute('stop-color', '#1e293b')
    const s2 = document.createElementNS('http://www.w3.org/2000/svg', 'stop')
    s2.setAttribute('offset', '100%')
    s2.setAttribute('stop-color', '#0a0f1d')
    grad.append(s1, s2)
    defs.appendChild(grad)

    const frame = document.createElementNS('http://www.w3.org/2000/svg', 'rect')
    frame.setAttribute('width', '600')
    frame.setAttribute('height', '520')
    frame.setAttribute('rx', '16')
    frame.setAttribute('fill', 'url(#posterBg)')
    frame.setAttribute('stroke', '#475569')
    frame.setAttribute('stroke-width', '3')

    const makeFo = (y: string, height: string, text: string, cls: string) => {
        const fo = document.createElementNS('http://www.w3.org/2000/svg', 'foreignObject')
        fo.setAttribute('x', '20')
        fo.setAttribute('y', y)
        fo.setAttribute('width', '560')
        fo.setAttribute('height', height)
        const wrap = el(
            'div',
            { className: 'w-full h-full flex items-center justify-center text-center overflow-hidden px-2' },
            el('h2', { className: cls, style: { textShadow: shadow } }, text)
        )
        fo.appendChild(wrap)
        return fo
    }

    const img = document.createElementNS('http://www.w3.org/2000/svg', 'image')
    img.setAttribute('href', '/brand/meme_mascot_transparent.png')
    img.setAttribute('x', '160')
    img.setAttribute('y', '135')
    img.setAttribute('width', '280')
    img.setAttribute('height', '235')
    img.setAttribute('preserveAspectRatio', 'xMidYMid meet')

    const mark = document.createElementNS('http://www.w3.org/2000/svg', 'text')
    mark.setAttribute('x', '580')
    mark.setAttribute('y', '508')
    mark.setAttribute('text-anchor', 'end')
    mark.setAttribute('fill', '#475569')
    mark.setAttribute('font-size', '10')
    mark.setAttribute('font-weight', 'bold')
    mark.setAttribute('font-family', 'monospace')
    mark.textContent = 'KNOWBEAR'

    svg.append(
        defs,
        frame,
        makeFo('20', '120', setup, `text-white uppercase tracking-wider ${topFont}`),
        img,
        makeFo('375', '125', punchline, `text-amber-300 uppercase tracking-wider ${btmFont}`),
        mark
    )
    return svg
}
