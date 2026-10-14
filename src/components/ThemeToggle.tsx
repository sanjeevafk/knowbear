import { useState } from 'react'
import { Sun, Moon } from 'lucide-react'

export default function ThemeToggle() {
    const [theme, setTheme] = useState<'light' | 'dark'>(() => {
        if (typeof window !== 'undefined') {
            return document.documentElement.classList.contains('light') ? 'light' : 'dark'
        }
        return 'dark'
    })

    const toggleTheme = () => {
        const nextTheme = theme === 'dark' ? 'light' : 'dark'
        setTheme(nextTheme)
        if (nextTheme === 'light') {
            document.documentElement.classList.add('light')
            document.documentElement.classList.remove('dark')
            localStorage.setItem('theme', 'light')
        } else {
            document.documentElement.classList.add('dark')
            document.documentElement.classList.remove('light')
            localStorage.setItem('theme', 'dark')
        }
    }

    return (
        <button
            onClick={toggleTheme}
            className="h-10 w-10 inline-flex items-center justify-center rounded-xl border border-dark-600 bg-dark-800 text-gray-400 hover:text-white hover:bg-dark-700 transition-colors cursor-pointer"
            aria-label={`Switch to ${theme === 'dark' ? 'light' : 'dark'} theme`}
            title={`Switch to ${theme === 'dark' ? 'light' : 'dark'} theme`}
        >
            {theme === 'dark' ? (
                <Sun className="w-5 h-5" />
            ) : (
                <Moon className="w-5 h-5 text-gray-600" />
            )}
        </button>
    )
}
