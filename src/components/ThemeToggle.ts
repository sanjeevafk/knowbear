import { el, icon } from '../utils/dom'

export function createThemeToggle(): HTMLButtonElement {
    let theme: 'light' | 'dark' =
        typeof window !== 'undefined' && document.documentElement.classList.contains('light') ? 'light' : 'dark'

    const btn = el('button', {
        type: 'button',
        className:
            'h-10 w-10 inline-flex items-center justify-center rounded-xl border border-dark-600 bg-dark-800 text-gray-400 hover:text-white hover:bg-dark-700 transition-colors cursor-pointer',
    })

    const sync = () => {
        const nextLabel = `Switch to ${theme === 'dark' ? 'light' : 'dark'} theme`
        btn.setAttribute('aria-label', nextLabel)
        btn.setAttribute('title', nextLabel)
        btn.replaceChildren(theme === 'dark' ? icon('sun', 'w-5 h-5') : icon('moon', 'w-5 h-5 text-gray-600'))
    }

    btn.addEventListener('click', () => {
        theme = theme === 'dark' ? 'light' : 'dark'
        if (theme === 'light') {
            document.documentElement.classList.add('light')
            document.documentElement.classList.remove('dark')
            localStorage.setItem('theme', 'light')
        } else {
            document.documentElement.classList.add('dark')
            document.documentElement.classList.remove('light')
            localStorage.setItem('theme', 'dark')
        }
        sync()
    })

    sync()
    return btn
}
