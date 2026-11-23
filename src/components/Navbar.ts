import { el, icon } from '../utils/dom'
import { navigate } from '../router'
import { createThemeToggle } from './ThemeToggle'

export interface NavbarOptions {
    onNewSearch?: () => void
}

export function createNavbar({ onNewSearch }: NavbarOptions = {}): HTMLElement {
    const logoLink = el(
        'a',
        {
            href: '/',
            className: 'flex items-center gap-2.5 text-white hover:opacity-95 transition-opacity select-none group',
            onClick: (e: MouseEvent) => {
                e.preventDefault()
                onNewSearch?.()
                navigate('/')
            },
        },
        el(
            'div',
            {
                className:
                    'w-9 h-9 rounded-xl overflow-hidden shadow-md group-hover:scale-105 transition-transform bg-[#0F1B2D] border border-amber-500/30 flex items-center justify-center',
            },
            el('img', { src: '/brand/icons/app_icon.png', alt: 'KnowBear', className: 'w-full h-full object-cover' })
        ),
        el('span', { className: 'font-extrabold text-base tracking-tight text-white' }, 'Know', el('span', { className: 'text-amber-500' }, 'Bear'))
    )

    const githubLink = el(
        'a',
        {
            href: 'https://github.com/sanjeevafk/knowbear',
            target: '_blank',
            rel: 'noopener noreferrer',
            className:
                'h-9 w-9 sm:h-10 sm:w-10 inline-flex items-center justify-center rounded-xl border border-dark-600 bg-dark-800 text-gray-400 hover:text-white hover:bg-dark-700 transition-colors',
            'aria-label': 'GitHub repository',
            title: 'View on GitHub',
        },
        icon('github', 'w-4 h-4 sm:w-5 sm:h-5')
    )

    return el(
        'header',
        { className: 'sticky top-0 z-40 w-full border-b border-dark-700/80 bg-dark-900/80 backdrop-blur-xl' },
        el(
            'div',
            { className: 'max-w-5xl mx-auto px-4 sm:px-6 lg:px-8 h-14 flex items-center justify-between' },
            el('div', { className: 'flex items-center gap-3' }, logoLink),
            el('div', { className: 'flex items-center gap-2 sm:gap-3' }, githubLink, createThemeToggle())
        )
    )
}
