import { useState, useEffect, forwardRef } from 'react'
import { Download, Copy, Check, FileText, Share2, Image as ImageIcon } from 'lucide-react'
import { copyMemeImageToClipboard, shareMemeImage, downloadMemePng } from '../utils/memeImage'

interface MemeRendererProps {
  content: string
  topic?: string
  streaming?: boolean
}

export interface ParsedMeme {
  setup: string
  punchline: string
  cleanText: string
}

function sanitizeMemeText(raw: string): string {
  return raw
    // Strip regeneration quotes (---\n*"Quote"* — Author)
    .replace(/\n*---\s*\n\s*\*["'][^"']+["']\*\s*—\s*.*$/s, '')
    .replace(/\n*---\s*$/s, '')
    // Strip reasoning blocks
    .replace(/<think>[\s\S]*?<\/think>/gi, '')
    .replace(/^Thought:[\s\S]*?\n\n/gi, '')
    // Strip legacy TEMPLATE: line if present
    .replace(/TEMPLATE:\s*\w+\s*\n*/gi, '')
    .trim()
}

export function parseMemeContent(rawContent: string, fallbackTopic = 'The Concept'): ParsedMeme {
  const text = sanitizeMemeText(rawContent)
  
  // Try JSON first
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

  // Fallback if structured headers weren't found:
  // entire text is the punchline, topic is the setup
  if (!punchline) {
    setup = fallbackTopic
    punchline = text.replace(/^["']|["']$/g, '')
  }

  setup = sanitizeMemeText(setup || fallbackTopic)
  punchline = sanitizeMemeText(punchline)

  // Clean text for Plain Text view (normal response like before)
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

  // Strip wrapping outer quotes for clean reading
  cleanText = cleanText.replace(/^["']|["']$/g, '').trim()

  return { setup, punchline, cleanText }
}

function getMemeFontClass(text: string): string {
  const len = text.length
  if (len > 90) return 'text-xs sm:text-sm font-extrabold leading-tight'
  if (len > 55) return 'text-sm sm:text-base font-black leading-tight'
  if (len > 30) return 'text-base sm:text-xl font-black leading-snug'
  return 'text-lg sm:text-2xl font-black leading-tight'
}

export default function MemeRenderer({ content, topic, streaming }: MemeRendererProps) {
  const parsed = parseMemeContent(content, topic)
  const [viewMode, setViewMode] = useState<'text' | 'svg'>('text')
  const [copiedText, setCopiedText] = useState(false)
  const [copiedImage, setCopiedImage] = useState(false)
  const [isProcessing, setIsProcessing] = useState(false)
  const [canShare, setCanShare] = useState(false)

  useEffect(() => {
    if (typeof navigator !== 'undefined' && typeof navigator.share === 'function') {
      setCanShare(true)
    }
  }, [])

  const handleCopyText = async () => {
    const textToCopy = parsed.cleanText || parsed.punchline || content
    await navigator.clipboard.writeText(textToCopy)
    setCopiedText(true)
    setTimeout(() => setCopiedText(false), 2000)
  }

  const handleCopyImage = async () => {
    setIsProcessing(true)
    try {
      const ok = await copyMemeImageToClipboard(parsed.setup, parsed.punchline)
      if (ok) {
        setCopiedImage(true)
        setTimeout(() => setCopiedImage(false), 2500)
      } else {
        // Fallback: trigger PNG download directly
        await downloadMemePng(parsed.setup, parsed.punchline)
      }
    } catch {
      await downloadMemePng(parsed.setup, parsed.punchline)
    } finally {
      setIsProcessing(false)
    }
  }

  const handleShare = async () => {
    setIsProcessing(true)
    try {
      const ok = await shareMemeImage(parsed.setup, parsed.punchline)
      if (!ok) {
        // If native share dialog was not available or cancelled, copy or download
        await handleCopyImage()
      }
    } catch {
      await downloadMemePng(parsed.setup, parsed.punchline)
    } finally {
      setIsProcessing(false)
    }
  }

  const handleDownloadPng = async () => {
    setIsProcessing(true)
    try {
      await downloadMemePng(parsed.setup, parsed.punchline)
    } finally {
      setIsProcessing(false)
    }
  }

  return (
    <div className="flex flex-col gap-4">
      {/* View Switcher Toolbar */}
      <div className="flex flex-wrap items-center justify-between gap-3 bg-dark-900/80 p-2.5 rounded-xl border border-white/5">
        <div className="flex items-center gap-1.5 p-1 bg-dark-800 rounded-lg border border-white/5">
          <button
            type="button"
            onClick={() => setViewMode('text')}
            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-md text-xs font-medium transition-all ${
              viewMode === 'text'
                ? 'bg-amber-500 text-dark-950 font-bold shadow-sm'
                : 'text-gray-400 hover:text-white'
            }`}
          >
            <FileText className="w-3.5 h-3.5" />
            <span>Plain Text</span>
          </button>
          <button
            type="button"
            onClick={() => setViewMode('svg')}
            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-md text-xs font-medium transition-all ${
              viewMode === 'svg'
                ? 'bg-amber-500 text-dark-950 font-bold shadow-sm'
                : 'text-gray-400 hover:text-white'
            }`}
          >
            <span>🐻 Mascot Meme</span>
          </button>
        </div>

        {/* Action Buttons */}
        <div className="flex flex-wrap items-center gap-2">
          {viewMode === 'svg' && (
            <>
              {canShare && (
                <button
                  type="button"
                  onClick={handleShare}
                  disabled={isProcessing}
                  title="Share image via WhatsApp, Instagram, Twitter, etc."
                  className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-amber-500/10 hover:bg-amber-500/20 text-amber-300 border border-amber-500/30 text-xs font-medium transition-all active:scale-95 disabled:opacity-50"
                >
                  <Share2 className="w-3.5 h-3.5 text-amber-400" />
                  <span>Share</span>
                </button>
              )}

              <button
                type="button"
                onClick={handleCopyImage}
                disabled={isProcessing}
                title="Copy as image to paste in WhatsApp, Discord, Slack"
                className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-dark-800 hover:bg-dark-700 text-gray-300 hover:text-white text-xs border border-white/10 transition-all active:scale-95 disabled:opacity-50"
              >
                {copiedImage ? <Check className="w-3.5 h-3.5 text-emerald-400" /> : <ImageIcon className="w-3.5 h-3.5 text-amber-400" />}
                <span>{copiedImage ? 'Image Copied!' : 'Copy Image'}</span>
              </button>

              <button
                type="button"
                onClick={handleDownloadPng}
                disabled={isProcessing}
                title="Download shareable PNG image"
                className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-dark-800 hover:bg-dark-700 text-gray-300 hover:text-white text-xs border border-white/10 transition-all active:scale-95 disabled:opacity-50"
              >
                <Download className="w-3.5 h-3.5 text-amber-400" />
                <span>Download Image</span>
              </button>
            </>
          )}

          <button
            type="button"
            onClick={handleCopyText}
            title="Copy meme text"
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-dark-800 hover:bg-dark-700 text-gray-300 hover:text-white text-xs border border-white/10 transition-all active:scale-95"
          >
            {copiedText ? <Check className="w-3.5 h-3.5 text-emerald-400" /> : <Copy className="w-3.5 h-3.5 text-gray-400" />}
            <span>{copiedText ? 'Copied!' : 'Copy Text'}</span>
          </button>
        </div>
      </div>

      {/* Mode 1: Clean Normal Response Like Before (Default) */}
      {viewMode === 'text' && (
        <div className="prose prose-invert max-w-none text-gray-200 leading-relaxed">
          <p className="text-base sm:text-lg">
            {parsed.cleanText || parsed.punchline || content}
          </p>
        </div>
      )}

      {/* Mode 2: Mascot Vector SVG Graphic (On Toggle) */}
      {viewMode === 'svg' && (
        <div className="relative w-full rounded-2xl overflow-hidden border border-white/10 bg-dark-900 shadow-2xl flex justify-center p-2 sm:p-4">
          <MascotMemeSvg setup={parsed.setup} punchline={parsed.punchline} />
        </div>
      )}

      {streaming && (
        <div className="flex items-center gap-2 text-xs text-amber-400 font-mono">
          <span className="w-2 h-2 rounded-full bg-amber-400 animate-ping" />
          <span>Generating punchline...</span>
        </div>
      )}
    </div>
  )
}

/* =========================================================================
   SVG MASCOT MEME POSTER
   ========================================================================= */

const MascotMemeSvg = forwardRef<SVGSVGElement, { setup: string; punchline: string }>(
  ({ setup, punchline }, ref) => {
    const topFont = getMemeFontClass(setup)
    const btmFont = getMemeFontClass(punchline)

    return (
      <svg
        ref={ref}
        viewBox="0 0 600 520"
        className="w-full max-w-xl h-auto drop-shadow-xl select-none"
        xmlns="http://www.w3.org/2000/svg"
      >
        <defs>
          <linearGradient id="posterBg" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="#1e293b" />
            <stop offset="100%" stopColor="#0a0f1d" />
          </linearGradient>
        </defs>

        {/* Outer Frame */}
        <rect width="600" height="520" rx="16" fill="url(#posterBg)" stroke="#475569" strokeWidth="3" />

        {/* Top Text Header Container (Generous 120px height) */}
        <foreignObject x="20" y="20" width="560" height="120">
          <div className="w-full h-full flex items-center justify-center text-center overflow-hidden px-2">
            <h2
              className={`text-white uppercase tracking-wider ${topFont}`}
              style={{ textShadow: '2px 2px 0 #000, -2px -2px 0 #000, 2px -2px 0 #000, -2px 2px 0 #000' }}
            >
              {setup}
            </h2>
          </div>
        </foreignObject>

        {/* Center Character: KnowBear Meme Mascot */}
        <image
          href="/brand/meme_mascot_transparent.png"
          x="160"
          y="135"
          width="280"
          height="235"
          preserveAspectRatio="xMidYMid meet"
        />

        {/* Bottom Text Footer Container (Generous 125px height) */}
        <foreignObject x="20" y="375" width="560" height="125">
          <div className="w-full h-full flex items-center justify-center text-center overflow-hidden px-2">
            <h2
              className={`text-amber-300 uppercase tracking-wider ${btmFont}`}
              style={{ textShadow: '2px 2px 0 #000, -2px -2px 0 #000, 2px -2px 0 #000, -2px 2px 0 #000' }}
            >
              {punchline}
            </h2>
          </div>
        </foreignObject>

        {/* Mascot Brand Mark */}
        <text x="580" y="508" textAnchor="end" fill="#475569" fontSize="10" fontWeight="bold" fontFamily="monospace">
          KNOWBEAR
        </text>
      </svg>
    )
  }
)
MascotMemeSvg.displayName = 'MascotMemeSvg'
