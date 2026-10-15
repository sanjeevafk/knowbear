import type { Level } from '../types'
import ReactMarkdown from 'react-markdown'
import type { HTMLAttributes, ImgHTMLAttributes } from 'react'
import remarkGfm from 'remark-gfm'
import Mermaid from './Mermaid'
import SafeImage from './SafeImage'
import MemeRenderer from './MemeRenderer'
import { KnowBearAvatar, BearExpression } from './KnowBearAvatar'

const LEVEL_EXPRESSIONS: Record<Level, BearExpression> = {
    eli5: 'happy',
    eli12: 'idea',
    eli15: 'serious',
    meme: 'meme',
}

interface ExplanationCardProps {
    level: Level
    content: string
    topic?: string
    streaming?: boolean
}

const LEVEL_COLORS: Record<Level, string> = {
    eli5: 'level-eli5',
    eli12: 'level-eli12',
    eli15: 'level-eli15',
    meme: 'level-meme',
}

const LEVEL_NAMES: Record<Level, string> = {
    eli5: 'Explain Like I\'m 5',
    eli12: 'Explain Like I\'m 12',
    eli15: 'Explain Like I\'m 15',
    meme: 'Meme Explanation',
}

export default function ExplanationCard({ level, content, topic, streaming }: ExplanationCardProps) {
    const borderColor = LEVEL_COLORS[level]

    if (level === 'meme') {
        return (
            <div className={`bg-dark-700 border-l-4 ${borderColor} rounded-lg p-6 transition-all shadow-2xl relative`}>
                <h3 className="text-sm font-semibold text-gray-300 uppercase tracking-wide mb-4 border-b border-white/5 pb-2 flex items-center gap-2.5">
                    <KnowBearAvatar expression={LEVEL_EXPRESSIONS[level] || 'default'} size="xs" />
                    <span>{LEVEL_NAMES[level]}</span>
                </h3>
                <MemeRenderer content={content} topic={topic} streaming={streaming} />
            </div>
        )
    }

    return (
        <div
            className={`bg-dark-700 border-l-4 ${borderColor} rounded-lg p-6 transition-all shadow-2xl relative`}
        >
            <h3 className="text-sm font-semibold text-gray-300 uppercase tracking-wide mb-4 border-b border-white/5 pb-2 flex items-center gap-2.5">
                <KnowBearAvatar expression={LEVEL_EXPRESSIONS[level] || 'default'} size="xs" />
                <span>{LEVEL_NAMES[level]}</span>
            </h3>

            <div className="prose prose-invert max-w-none text-gray-200 leading-relaxed prose-headings:text-white prose-a:text-amber-400 hover:prose-a:text-amber-300 prose-code:text-amber-300 prose-img:rounded-xl prose-hr:border-white/5">
                <ReactMarkdown
                    remarkPlugins={[remarkGfm]}
                    components={{
                        code({ inline, className, children, ...props }: HTMLAttributes<HTMLElement> & { inline?: boolean }) {
                            const match = /language-(\w+)/.exec(className || '')
                            const codeStr = String(children).replace(/\n$/, '')

                            if (!inline && match && match[1] === 'mermaid') {
                                return <Mermaid chart={codeStr} />
                            }

                            return (
                                <code className={`${className} bg-dark-900 rounded px-1.5 py-0.5 text-xs font-mono`} {...props}>
                                    {children}
                                </code>
                            )
                        },
                        pre({ children }) {
                            return <pre className="bg-dark-900 p-4 rounded-xl border border-white/5 overflow-x-auto my-4">{children}</pre>
                        },
                        img({ src, alt }: ImgHTMLAttributes<HTMLImageElement>) {
                            return <SafeImage src={src || ''} alt={alt || 'Image'} />
                        },
                        a({ ...props }: React.AnchorHTMLAttributes<HTMLAnchorElement>) {
                            return <a {...props} target="_blank" rel="noopener noreferrer" className="underline decoration-amber-500/30 underline-offset-4 hover:decoration-amber-400 transition-all font-medium" />
                        },
                        h2({ children }) {
                            return <h2 className="text-2xl font-bold mt-8 mb-4 text-white border-b border-white/5 pb-2">{children}</h2>
                        },
                        h3({ children }) {
                            return <h3 className="text-xl font-semibold mt-6 mb-3 text-amber-100">{children}</h3>
                        },
                        hr() {
                            return <hr className="my-8 border-white/10" />
                        }
                    }}
                >
                    {content}
                </ReactMarkdown>
                {streaming && (
                    <span className="inline-block w-2 h-5 ml-1 bg-amber-500 animate-[pulse_0.8s_infinite] vertical-middle" style={{ verticalAlign: 'middle' }}></span>
                )}
            </div>
        </div>
    )
}
