import type { Level } from '../types'
import { ALL_LEVELS } from '../types'
import { el, icon } from '../utils/dom'

const LEVEL_LABELS: Record<Level, string> = {
    eli5: "Like I'm 5",
    eli12: "Like I'm 12",
    eli15: "Like I'm 15",
    meme: 'Meme Style',
}

export interface LevelDropdownOptions {
    selected: Level
    onChange: (level: Level) => void
}

export function createLevelDropdown({ selected, onChange }: LevelDropdownOptions): {
    el: HTMLDivElement
    destroy: () => void
} {
    let isOpen = false
    let currentSelected = selected

    const labelSpan = el('span', { className: 'font-medium' }, LEVEL_LABELS[currentSelected])
    const chevron = icon('chevronDown', 'w-5 h-5 text-gray-400 transition-transform')

    const trigger = el(
        'button',
        {
            type: 'button',
            className:
                'w-full flex flex-wrap items-center justify-between px-4 py-3 bg-dark-700 hover:bg-dark-600 border border-dark-600 rounded-lg text-white transition-all outline-none focus:border-accent-primary',
            onClick: () => {
                isOpen = !isOpen
                renderMenu()
            },
        },
        labelSpan,
        chevron
    )

    const menu = el('div', {
        className: 'absolute z-50 w-full mt-2 bg-dark-800 border border-dark-600 rounded-lg shadow-xl max-h-60 overflow-y-auto hidden',
    })

    const root = el('div', { className: 'relative w-full md:w-64' }, trigger, menu)

    const renderMenu = () => {
        labelSpan.textContent = LEVEL_LABELS[currentSelected]
        chevron.setAttribute('class', `w-5 h-5 text-gray-400 transition-transform ${isOpen ? 'rotate-180' : ''}`)
        if (!isOpen) {
            menu.classList.add('hidden')
            return
        }
        menu.classList.remove('hidden')
        menu.replaceChildren(
            ...ALL_LEVELS.map((level) =>
                el(
                    'button',
                    {
                        type: 'button',
                        className: `w-full text-left px-4 py-2 text-sm transition-colors ${
                            currentSelected === level ? 'bg-accent-primary/10 text-accent-primary font-medium' : 'text-gray-300 hover:bg-dark-700'
                        }`,
                        onClick: () => {
                            currentSelected = level
                            isOpen = false
                            renderMenu()
                            onChange(level)
                        },
                    },
                    LEVEL_LABELS[level]
                )
            )
        )
    }

    const onDocClick = (event: MouseEvent) => {
        if (!root.contains(event.target as Node) && isOpen) {
            isOpen = false
            renderMenu()
        }
    }
    document.addEventListener('mousedown', onDocClick)

    return {
        el: root,
        destroy: () => document.removeEventListener('mousedown', onDocClick),
    }
}
