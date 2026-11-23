import { el, icon } from '../utils/dom'

export interface SearchBarOptions {
    onSearch: (topic: string, image?: string | null) => void
    loading?: boolean
    value?: string
    initialImage?: string | null
}

export function createSearchBar({
    onSearch,
    loading = false,
    value = '',
    initialImage = null,
}: SearchBarOptions): { el: HTMLDivElement; destroy: () => void } {
    let topic = value
    let imagePreview: string | null = initialImage
    let isFocused = false

    const previewContainer = el('div', { className: 'hidden' })
    const searchSvg = icon('search', 'ml-3 w-5 h-5 transition-colors self-center shrink-0 text-gray-500')

    const textarea = el('textarea', {
        rows: 1,
        value: topic,
        maxLength: 2000,
        disabled: loading,
        className:
            'flex-1 min-w-0 bg-transparent text-white placeholder-gray-500 px-3 sm:px-4 py-2 sm:py-2.5 outline-none text-base md:text-lg resize-none overflow-hidden [scrollbar-width:none] [-ms-overflow-style:none] [&::-webkit-scrollbar]:hidden leading-normal',
    })
    textarea.value = topic

    const fileInput = el('input', {
        type: 'file',
        accept: 'image/*',
        className: 'hidden',
        disabled: loading,
    })

    const attachBtn = el(
        'button',
        {
            type: 'button',
            disabled: loading,
            title: 'Attach screenshot or diagram',
            'aria-label': 'Attach screenshot or diagram',
            onClick: () => fileInput.click(),
        },
        icon('image', 'w-5 h-5')
    )

    const charCounter = el('span', { className: 'text-[11px] font-mono text-gray-500' })
    const charCounterWrap = el('div', { className: 'hidden md:flex items-center gap-3' }, charCounter)

    const submitBtn = el('button', {
        type: 'submit',
        className:
            'ml-1 px-4 sm:px-6 py-2.5 bg-[#e8e4dc] hover:opacity-90 text-[#1a1918] rounded-xl font-bold transition-all transform active:scale-95 disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center shrink-0 gap-2 shadow-lg',
    })

    const updatePlaceholder = () => {
        if (imagePreview) {
            textarea.placeholder = 'Ask about this image, or click Explain...'
        } else if (window.innerWidth <= 640) {
            textarea.placeholder = 'Search topics...'
        } else {
            textarea.placeholder = 'What passes for knowledge...?'
        }
    }

    const resizeTextarea = () => {
        textarea.style.height = 'auto'
        const scrollH = textarea.scrollHeight
        const nextHeight = Math.min(Math.max(scrollH, 44), 160)
        textarea.style.height = `${nextHeight}px`
        textarea.style.overflowY = scrollH > 160 ? 'auto' : 'hidden'
    }

    const syncUi = () => {
        updatePlaceholder()
        searchSvg.setAttribute(
            'class',
            `ml-3 w-5 h-5 transition-colors self-center shrink-0 ${isFocused ? 'text-amber-500' : 'text-gray-500'}`
        )
        attachBtn.className = `p-2 rounded-xl transition-colors shrink-0 ${
            imagePreview
                ? 'bg-amber-500/20 text-amber-300 border border-amber-500/40'
                : 'text-gray-400 hover:text-gray-200 hover:bg-dark-700/60'
        }`

        if (topic.length > 80) {
            charCounter.textContent = `${topic.length}/2000`
            charCounterWrap.classList.remove('hidden')
        } else {
            charCounterWrap.classList.add('hidden')
        }

        const canSubmit = (topic.trim().length > 0 || !!imagePreview) && !loading
        submitBtn.disabled = !canSubmit
        submitBtn.replaceChildren(loading ? icon('loader', 'w-5 h-5 animate-spin') : el('span', { className: 'inline' }, 'Explain'))

        if (imagePreview) {
            previewContainer.className =
                'flex items-center gap-3 bg-dark-800/90 border border-amber-500/30 rounded-xl p-2.5 px-3 shadow-md backdrop-blur-sm'
            previewContainer.replaceChildren(
                el(
                    'div',
                    { className: 'relative group/thumb shrink-0' },
                    el('img', {
                        src: imagePreview,
                        alt: 'Screenshot attachment',
                        className: 'w-12 h-12 rounded-lg object-cover border border-amber-500/40 shadow-sm',
                    })
                ),
                el(
                    'div',
                    { className: 'flex-1 min-w-0' },
                    el('p', { className: 'text-xs font-semibold text-amber-300' }, 'Screenshot / Diagram attached'),
                    el('p', { className: 'text-[11px] text-gray-400 truncate' }, 'Ready for visual explanation')
                ),
                el(
                    'button',
                    {
                        type: 'button',
                        disabled: loading,
                        className:
                            'p-1.5 rounded-lg bg-dark-700/80 hover:bg-dark-600 text-gray-400 hover:text-white transition-colors disabled:opacity-50',
                        title: 'Remove image',
                        'aria-label': 'Remove image',
                        onClick: () => {
                            imagePreview = null
                            syncUi()
                        },
                    },
                    icon('x', 'w-4 h-4')
                )
            )
        } else {
            previewContainer.className = 'hidden'
            previewContainer.replaceChildren()
        }
    }

    const processFile = (file: File) => {
        if (!file.type.startsWith('image/')) return
        if (file.size > 10 * 1024 * 1024) {
            alert('Image must be under 10MB')
            return
        }
        const reader = new FileReader()
        reader.onload = (e) => {
            const result = e.target?.result as string
            if (result) {
                imagePreview = result
                syncUi()
            }
        }
        reader.readAsDataURL(file)
    }

    const submit = () => {
        if ((topic.trim() || imagePreview) && !loading) {
            if (imagePreview) {
                onSearch(topic.trim(), imagePreview)
            } else {
                onSearch(topic.trim())
            }
        }
    }

    textarea.addEventListener('input', () => {
        topic = textarea.value
        resizeTextarea()
        syncUi()
    })
    textarea.addEventListener('change', () => {
        topic = textarea.value
        resizeTextarea()
        syncUi()
    })
    textarea.addEventListener('focus', () => {
        isFocused = true
        syncUi()
    })
    textarea.addEventListener('blur', () => {
        isFocused = false
        syncUi()
    })
    textarea.addEventListener('keydown', (e) => {
        if (e.key === 'Enter' && !e.shiftKey) {
            e.preventDefault()
            submit()
        }
    })
    textarea.addEventListener('paste', (e) => {
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
    })
    fileInput.addEventListener('change', () => {
        const file = fileInput.files?.[0]
        if (file) processFile(file)
        fileInput.value = ''
    })

    const form = el(
        'form',
        {
            className: 'relative group z-20',
            onSubmit: (e: Event) => {
                e.preventDefault()
                submit()
            },
        },
        el(
            'div',
            {
                className:
                    'relative flex items-center bg-dark-800 border border-dark-600 rounded-2xl p-2 transition-all shadow-xl group-hover:border-dark-500',
            },
            searchSvg,
            textarea,
            fileInput,
            el('div', { className: 'flex items-center gap-1.5 sm:gap-2 mr-1 sm:mr-2 shrink-0' }, attachBtn, charCounterWrap, submitBtn)
        )
    )

    const onResize = () => updatePlaceholder()
    const onGlobalKeyDown = (e: KeyboardEvent) => {
        if (e.key === '/' && !isFocused && document.activeElement?.tagName !== 'INPUT' && document.activeElement?.tagName !== 'TEXTAREA') {
            e.preventDefault()
            textarea.focus()
        }
    }
    window.addEventListener('resize', onResize)
    window.addEventListener('keydown', onGlobalKeyDown)

    syncUi()
    resizeTextarea()

    return {
        el: el('div', { className: 'w-full max-w-3xl mx-auto space-y-3' }, previewContainer, form),
        destroy: () => {
            window.removeEventListener('resize', onResize)
            window.removeEventListener('keydown', onGlobalKeyDown)
        },
    }
}
