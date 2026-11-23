import { el, icon } from '../utils/dom'

export function openImageLightbox(src: string, onClosed?: (dialog: HTMLDialogElement) => void): HTMLDialogElement {
    const dialog = el(
        'dialog',
        {
            'aria-label': 'Analyzed image preview',
            className: 'bg-transparent p-4 max-w-4xl max-h-[90vh] backdrop:bg-black/80 backdrop:backdrop-blur-sm m-auto',
            onClick: (e: MouseEvent) => {
                if (e.target === dialog) dialog.close()
            },
            onClose: () => {
                dialog.remove()
                onClosed?.(dialog)
            },
        },
        el(
            'div',
            { className: 'relative' },
            el(
                'button',
                {
                    type: 'button',
                    'aria-label': 'Close image preview',
                    className:
                        'absolute -top-3 -right-3 p-1.5 rounded-full bg-dark-800 border border-white/15 text-gray-200 hover:text-white shadow-lg',
                    onClick: () => dialog.close(),
                },
                icon('x', 'w-4 h-4')
            ),
            el('img', {
                src,
                alt: 'Full analyzed screenshot or diagram',
                className: 'max-w-full max-h-[85vh] rounded-xl border border-white/10 shadow-2xl object-contain',
            })
        )
    )
    document.body.appendChild(dialog)
    if (typeof dialog.showModal === 'function') {
        dialog.showModal()
    } else {
        dialog.setAttribute('open', '')
    }
    return dialog
}
