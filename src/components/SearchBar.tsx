import { useState, useRef, useEffect, useCallback } from 'react'
import { Search, Loader2, Image as ImageIcon, X } from 'lucide-react'

interface SearchBarProps {
    onSearch: (topic: string, image?: string | null) => void
    loading: boolean
    value?: string
    initialImage?: string | null
}

export default function SearchBar({ onSearch, loading, value = '', initialImage = null }: SearchBarProps) {
    const [topic, setTopic] = useState(value)
    const [imagePreview, setImagePreview] = useState<string | null>(initialImage)
    const [isFocused, setIsFocused] = useState(false)
    const [placeholder, setPlaceholder] = useState("What passes for knowledge...?")
    const textareaRef = useRef<HTMLTextAreaElement>(null)
    const fileInputRef = useRef<HTMLInputElement>(null)

    useEffect(() => {
        setTopic(value)
    }, [value])

    useEffect(() => {
        setImagePreview(initialImage)
    }, [initialImage])

    useEffect(() => {
        const updatePlaceholder = () => {
            if (imagePreview) {
                setPlaceholder("Ask about this image, or click Explain...")
            } else if (window.innerWidth <= 640) {
                setPlaceholder("Search topics...")
            } else {
                setPlaceholder("What passes for knowledge...?")
            }
        }

        updatePlaceholder()
        window.addEventListener('resize', updatePlaceholder)
        return () => window.removeEventListener('resize', updatePlaceholder)
    }, [imagePreview])

    useEffect(() => {
        const textarea = textareaRef.current
        if (textarea) {
            textarea.style.height = 'auto'
            const scrollH = textarea.scrollHeight
            const nextHeight = Math.min(Math.max(scrollH, 44), 160)
            textarea.style.height = `${nextHeight}px`
            textarea.style.overflowY = scrollH > 160 ? 'auto' : 'hidden'
        }
    }, [topic])

    useEffect(() => {
        const handleKeyDown = (e: KeyboardEvent) => {
            if (e.key === '/' && !isFocused && document.activeElement?.tagName !== 'INPUT' && document.activeElement?.tagName !== 'TEXTAREA') {
                e.preventDefault()
                textareaRef.current?.focus()
            }
        }
        window.addEventListener('keydown', handleKeyDown)
        return () => window.removeEventListener('keydown', handleKeyDown)
    }, [isFocused])

    const processFile = useCallback((file: File) => {
        if (!file.type.startsWith('image/')) return
        if (file.size > 10 * 1024 * 1024) {
            alert('Image must be under 10MB')
            return
        }
        const reader = new FileReader()
        reader.onload = (e) => {
            const result = e.target?.result as string
            if (result) {
                setImagePreview(result)
            }
        }
        reader.readAsDataURL(file)
    }, [])

    const handlePaste = (e: React.ClipboardEvent<HTMLTextAreaElement>) => {
        const items = e.clipboardData?.items
        if (!items) return
        for (let i = 0; i < items.length; i++) {
            const item = items[i]
            if (item.type.startsWith('image/')) {
                const file = item.getAsFile()
                if (file) {
                    e.preventDefault()
                    processFile(file)
                    return
                }
            }
        }
    }

    const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0]
        if (file) {
            processFile(file)
        }
        if (fileInputRef.current) {
            fileInputRef.current.value = ''
        }
    }

    const handleSubmit = (e: React.FormEvent) => {
        e.preventDefault()
        if ((topic.trim() || imagePreview) && !loading) {
            if (imagePreview) {
                onSearch(topic.trim(), imagePreview)
            } else {
                onSearch(topic.trim())
            }
        }
    }

    const handleTextareaKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
        if (e.key === 'Enter' && !e.shiftKey) {
            e.preventDefault()
            handleSubmit(e)
        }
    }

    const removeImage = () => {
        setImagePreview(null)
    }

    const canSubmit = (topic.trim().length > 0 || !!imagePreview) && !loading

    return (
        <div className="w-full max-w-3xl mx-auto space-y-3">
            {imagePreview && (
                <div className="flex items-center gap-3 bg-dark-800/90 border border-amber-500/30 rounded-xl p-2.5 px-3 shadow-md backdrop-blur-sm animate-in fade-in slide-in-from-bottom-2 duration-200">
                    <div className="relative group/thumb shrink-0">
                        <img
                            src={imagePreview}
                            alt="Screenshot attachment"
                            className="w-12 h-12 rounded-lg object-cover border border-amber-500/40 shadow-sm"
                        />
                    </div>
                    <div className="flex-1 min-w-0">
                        <p className="text-xs font-semibold text-amber-300">Screenshot / Diagram attached</p>
                        <p className="text-[11px] text-gray-400 truncate">Ready for visual explanation</p>
                    </div>
                    <button
                        type="button"
                        onClick={removeImage}
                        disabled={loading}
                        className="p-1.5 rounded-lg bg-dark-700/80 hover:bg-dark-600 text-gray-400 hover:text-white transition-colors disabled:opacity-50"
                        title="Remove image"
                        aria-label="Remove image"
                    >
                        <X className="w-4 h-4" />
                    </button>
                </div>
            )}

            <form onSubmit={handleSubmit} className="relative group z-20">
                <div className="relative flex items-center bg-dark-800 border border-dark-600 rounded-2xl p-2 transition-all shadow-xl group-hover:border-dark-500">
                    <Search className={`ml-3 w-5 h-5 transition-colors self-center shrink-0 ${isFocused ? 'text-amber-500' : 'text-gray-500'}`} />
                    <textarea
                        ref={textareaRef}
                        rows={1}
                        value={topic}
                        maxLength={2000}
                        onChange={(e) => setTopic(e.target.value)}
                        onKeyDown={handleTextareaKeyDown}
                        onPaste={handlePaste}
                        onFocus={() => setIsFocused(true)}
                        onBlur={() => setIsFocused(false)}
                        placeholder={placeholder}
                        className="flex-1 min-w-0 bg-transparent text-white placeholder-gray-500 px-3 sm:px-4 py-2 sm:py-2.5 outline-none text-base md:text-lg resize-none overflow-hidden [scrollbar-width:none] [-ms-overflow-style:none] [&::-webkit-scrollbar]:hidden leading-normal"
                        disabled={loading}
                    />

                    <input
                        ref={fileInputRef}
                        type="file"
                        accept="image/*"
                        className="hidden"
                        onChange={handleFileChange}
                        disabled={loading}
                    />

                    <div className="flex items-center gap-1.5 sm:gap-2 mr-1 sm:mr-2 shrink-0">
                        <button
                            type="button"
                            onClick={() => fileInputRef.current?.click()}
                            disabled={loading}
                            className={`p-2 rounded-xl transition-colors shrink-0 ${
                                imagePreview
                                    ? 'bg-amber-500/20 text-amber-300 border border-amber-500/40'
                                    : 'text-gray-400 hover:text-gray-200 hover:bg-dark-700/60'
                            }`}
                            title="Attach screenshot or diagram"
                            aria-label="Attach screenshot or diagram"
                        >
                            <ImageIcon className="w-5 h-5" />
                        </button>

                        <div className="hidden md:flex items-center gap-3">
                            {topic.length > 80 ? (
                                <span className="text-[11px] font-mono text-gray-500">
                                    {topic.length}/2000
                                </span>
                            ) : (
                                <div className="flex items-center gap-2 text-[10px] text-dark-400 font-bold uppercase tracking-widest pl-1">
                                    <kbd className="bg-dark-700/50 px-1.5 py-0.5 rounded border border-dark-600">/</kbd>
                                    <span>Focus</span>
                                </div>
                            )}
                        </div>

                        <button
                            type="submit"
                            disabled={!canSubmit}
                            className="ml-1 px-4 sm:px-6 py-2.5 bg-[#e8e4dc] hover:opacity-90 text-[#1a1918] rounded-xl font-bold transition-all transform active:scale-95 disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center shrink-0 gap-2 shadow-lg"
                        >
                            {loading ? (
                                <Loader2 className="w-5 h-5 animate-spin" />
                            ) : (
                                <span className="inline">Explain</span>
                            )}
                        </button>
                    </div>
                </div>
            </form>
        </div>
    )
}

