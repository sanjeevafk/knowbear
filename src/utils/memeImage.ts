/**
 * Utility for generating shareable PNG images from KnowBear memes using HTML5 Canvas.
 * Produces crisp 2x retina images (1200x1040) compatible with mobile galleries,
 * WhatsApp, Discord, Twitter/X, Slack, and the native mobile share sheet.
 */

function wrapText(
    ctx: CanvasRenderingContext2D,
    text: string,
    maxWidth: number
): string[] {
    const words = text.toUpperCase().split(/\s+/)
    const lines: string[] = []
    let currentLine = ''

    for (const word of words) {
        const testLine = currentLine ? `${currentLine} ${word}` : word
        const metrics = ctx.measureText(testLine)
        if (metrics.width > maxWidth && currentLine) {
            lines.push(currentLine)
            currentLine = word
        } else {
            currentLine = testLine
        }
    }
    if (currentLine) lines.push(currentLine)
    return lines
}

function drawFallbackMascot(ctx: CanvasRenderingContext2D, cx: number, cy: number) {
    // Ears
    ctx.fillStyle = '#E67A12'
    ctx.beginPath()
    ctx.arc(cx - 90, cy - 90, 48, 0, Math.PI * 2)
    ctx.arc(cx + 90, cy - 90, 48, 0, Math.PI * 2)
    ctx.fill()

    ctx.fillStyle = '#FFA54B'
    ctx.beginPath()
    ctx.arc(cx - 90, cy - 90, 28, 0, Math.PI * 2)
    ctx.arc(cx + 90, cy - 90, 28, 0, Math.PI * 2)
    ctx.fill()

    // Head
    ctx.fillStyle = '#E67A12'
    ctx.beginPath()
    ctx.arc(cx, cy, 125, 0, Math.PI * 2)
    ctx.fill()

    // Muzzle
    ctx.fillStyle = '#FFE6B3'
    ctx.beginPath()
    ctx.ellipse(cx, cy + 35, 64, 42, 0, 0, Math.PI * 2)
    ctx.fill()

    // Nose
    ctx.fillStyle = '#0B1320'
    ctx.beginPath()
    ctx.ellipse(cx, cy + 18, 22, 14, 0, 0, Math.PI * 2)
    ctx.fill()

    // Smile
    ctx.strokeStyle = '#0B1320'
    ctx.lineWidth = 6
    ctx.lineCap = 'round'
    ctx.beginPath()
    ctx.arc(cx, cy + 32, 26, 0.15 * Math.PI, 0.85 * Math.PI)
    ctx.stroke()

    // Sunglasses
    ctx.fillStyle = '#0B1320'
    if (ctx.roundRect) {
        ctx.roundRect(cx - 95, cy - 35, 88, 42, 6)
        ctx.roundRect(cx + 7, cy - 35, 88, 42, 6)
    } else {
        ctx.rect(cx - 95, cy - 35, 88, 42)
        ctx.rect(cx + 7, cy - 35, 88, 42)
    }
    ctx.rect(cx - 15, cy - 22, 30, 14)
    ctx.fill()

    // Glints
    ctx.fillStyle = '#FFFFFF'
    ctx.fillRect(cx - 80, cy - 28, 16, 8)
    ctx.fillRect(cx + 22, cy - 28, 16, 8)
}

export async function generateMemePngBlob(setup: string, punchline: string): Promise<Blob> {
    const canvas = document.createElement('canvas')
    const width = 1200
    const height = 1040
    canvas.width = width
    canvas.height = height

    const ctx = canvas.getContext('2d')
    if (!ctx) {
        throw new Error('Canvas 2D context is not available')
    }

    // Outer Background Gradient
    const grad = ctx.createLinearGradient(0, 0, 0, height)
    grad.addColorStop(0, '#1e293b')
    grad.addColorStop(1, '#0a0f1d')
    ctx.fillStyle = grad

    ctx.beginPath()
    if (typeof ctx.roundRect === 'function') {
        ctx.roundRect(16, 16, width - 32, height - 32, 32)
    } else {
        ctx.rect(16, 16, width - 32, height - 32)
    }
    ctx.fill()

    ctx.lineWidth = 6
    ctx.strokeStyle = '#475569'
    ctx.stroke()

    // Draw KnowBear Meme Mascot in Center (Finger guns & MLG shades)
    const mascotW = 480
    const mascotH = 422
    const mascotY = 325

    try {
        const img = new Image()
        img.crossOrigin = 'anonymous'
        await new Promise<void>((resolve) => {
            img.onload = () => resolve()
            img.onerror = () => resolve()
            img.src = '/brand/meme_mascot_transparent.png'
        })

        if (img.complete && img.naturalWidth > 0) {
            ctx.drawImage(img, (width - mascotW) / 2, mascotY, mascotW, mascotH)
        } else {
            drawFallbackMascot(ctx, width / 2, mascotY + mascotH / 2)
        }
    } catch {
        drawFallbackMascot(ctx, width / 2, mascotY + mascotH / 2)
    }

    // Draw Setup (Top Text)
    ctx.textAlign = 'center'
    ctx.textBaseline = 'middle'

    const topFontSize = setup.length > 80 ? 38 : setup.length > 45 ? 46 : 54
    ctx.font = `900 ${topFontSize}px system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif`
    const topLines = wrapText(ctx, setup, width - 160)
    const topStartLineY = Math.max(90, 200 - (topLines.length * (topFontSize * 1.3)) / 2)

    topLines.forEach((line, i) => {
        const y = topStartLineY + i * (topFontSize * 1.3)
        ctx.strokeStyle = '#000000'
        ctx.lineWidth = 10
        ctx.lineJoin = 'round'
        ctx.strokeText(line, width / 2, y)
        ctx.fillStyle = '#ffffff'
        ctx.fillText(line, width / 2, y)
    })

    // Draw Punchline (Bottom Text)
    const btmFontSize = punchline.length > 80 ? 42 : punchline.length > 45 ? 52 : 62
    ctx.font = `900 ${btmFontSize}px system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif`
    const btmLines = wrapText(ctx, punchline, width - 160)
    const btmStartLineY = Math.min(840, 810 - ((btmLines.length - 1) * (btmFontSize * 1.3)) / 2)

    btmLines.forEach((line, i) => {
        const y = btmStartLineY + i * (btmFontSize * 1.3)
        ctx.strokeStyle = '#000000'
        ctx.lineWidth = 12
        ctx.lineJoin = 'round'
        ctx.strokeText(line, width / 2, y)
        ctx.fillStyle = '#fcd34d' // Amber-300
        ctx.fillText(line, width / 2, y)
    })

    // Watermark
    ctx.textAlign = 'right'
    ctx.textBaseline = 'bottom'
    ctx.font = '700 22px monospace'
    ctx.fillStyle = '#64748b'
    ctx.fillText('KNOWBEAR', width - 40, height - 36)

    return new Promise<Blob>((resolve, reject) => {
        canvas.toBlob((blob) => {
            if (blob) resolve(blob)
            else reject(new Error('Failed to generate image blob'))
        }, 'image/png')
    })
}

/**
 * Copies a PNG blob directly to the user's system clipboard.
 * Enables pasting the image directly into WhatsApp, Discord, Slack, iMessage, etc.
 */
export async function copyMemeImageToClipboard(setup: string, punchline: string): Promise<boolean> {
    if (typeof window === 'undefined' || !navigator.clipboard || typeof ClipboardItem === 'undefined') {
        return false
    }

    try {
        const blob = await generateMemePngBlob(setup, punchline)
        const item = new ClipboardItem({ 'image/png': blob })
        await navigator.clipboard.write([item])
        return true
    } catch (err) {
        console.warn('Direct image clipboard copy not permitted:', err)
        return false
    }
}

/**
 * Triggers native system share dialog (mobile share sheet or desktop share).
 */
export async function shareMemeImage(setup: string, punchline: string): Promise<boolean> {
    if (typeof window === 'undefined' || !navigator.share) {
        return false
    }

    try {
        const blob = await generateMemePngBlob(setup, punchline)
        const file = new File([blob], 'knowbear-meme.png', { type: 'image/png' })

        if (navigator.canShare && !navigator.canShare({ files: [file] })) {
            return false
        }

        await navigator.share({
            title: `KnowBear: ${setup}`,
            text: `${setup} — ${punchline}`,
            files: [file],
        })
        return true
    } catch (err) {
        // User cancelled share or aborted
        if ((err as Error)?.name === 'AbortError') return true
        console.warn('Native share failed:', err)
        return false
    }
}

/**
 * Downloads the meme as a real PNG image file.
 */
export async function downloadMemePng(setup: string, punchline: string) {
    const blob = await generateMemePngBlob(setup, punchline)
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `knowbear-meme-${Date.now()}.png`
    document.body.appendChild(a)
    a.click()
    document.body.removeChild(a)
    URL.revokeObjectURL(url)
}

export interface ParsedMeme {
    setup: string
    punchline: string
    cleanText: string
}

function sanitizeMemeText(raw: string): string {
    return raw
        .replace(/\n*---\s*\n\s*\*["'][^"']+["']\*\s*—\s*.*$/s, '')
        .replace(/\n*---\s*$/s, '')
        .replace(/<think>[\s\S]*?<\/think>/gi, '')
        .replace(/^Thought:[\s\S]*?\n\n/gi, '')
        .replace(/TEMPLATE:\s*\w+\s*\n*/gi, '')
        .trim()
}

export function parseMemeContent(rawContent: string, fallbackTopic = 'The Concept'): ParsedMeme {
    const text = sanitizeMemeText(rawContent)

    if (text.startsWith('{') && text.endsWith('}')) {
        try {
            const parsed = JSON.parse(text)
            const setup = sanitizeMemeText(parsed.setup || fallbackTopic)
            const punchline = sanitizeMemeText(parsed.punchline || text)
            return {
                setup,
                punchline,
                cleanText: punchline || text,
            }
        } catch {
            // Ignore JSON parse failure
        }
    }

    let setup = ''
    let punchline = ''

    const setupMatch = text.match(/SETUP:\s*([\s\S]*?)(?=PUNCHLINE:|$)/i)
    if (setupMatch) {
        setup = setupMatch[1].trim()
    }

    const punchlineMatch = text.match(/PUNCHLINE:\s*([\s\S]*?)$/i)
    if (punchlineMatch) {
        punchline = punchlineMatch[1].trim()
    }

    if (!punchline) {
        setup = fallbackTopic
        punchline = text.replace(/^["']|["']$/g, '')
    }

    setup = sanitizeMemeText(setup || fallbackTopic)
    punchline = sanitizeMemeText(punchline)

    let cleanText = text
    if (setupMatch || punchlineMatch) {
        const cleanSetup = setup.replace(/^KnowBear(\s+asks)?:?\s*/i, '').trim()
        const cleanPunchline = punchline.replace(/^KnowBear(\s+says)?:?\s*/i, '').trim()
        if (cleanSetup && cleanSetup !== fallbackTopic) {
            cleanText = `${cleanSetup} ${cleanPunchline}`
        } else {
            cleanText = cleanPunchline
        }
    }

    cleanText = cleanText.replace(/^["']|["']$/g, '').trim()

    return { setup, punchline, cleanText }
}
