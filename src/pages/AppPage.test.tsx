import { describe, it, expect, beforeEach, vi } from 'vitest'
import { render, screen } from '@testing-library/react'
import { BrowserRouter } from 'react-router-dom'
import AppPage from './AppPage'
import { useKnowBearStore } from '../store/useKnowBearStore'

vi.mock('../api', () => ({
    getPinnedTopics: vi.fn(() => Promise.resolve([])),
}))

vi.mock('../components/SearchBar', () => ({
    default: () => <div data-testid="search-bar" />,
}))

vi.mock('../components/LevelDropdown', () => ({
    default: () => <div data-testid="level-dropdown" />,
}))

vi.mock('../components/ExplanationCard', () => ({
    default: ({ content }: { content: string }) => <div data-testid="explanation-card">{content}</div>,
}))

vi.mock('../components/Navbar', () => ({
    default: () => <div data-testid="navbar">Navbar</div>,
}))

vi.mock('../components/LoadingState', () => ({
    LoadingState: () => <div data-testid="loading-state">Loading...</div>,
}))

describe('AppPage', () => {
    beforeEach(() => {
        useKnowBearStore.getState().reset()
        vi.clearAllMocks()
    })

    it('renders initial empty state', () => {
        render(
            <BrowserRouter>
                <AppPage />
            </BrowserRouter>
        )

        expect(screen.getByTestId('navbar')).toBeInTheDocument()
        expect(screen.getByTestId('search-bar')).toBeInTheDocument()
        expect(screen.getByText('What passes for knowledge...?')).toBeInTheDocument()
    })

    it('renders result from store', () => {
        const store = useKnowBearStore.getState()
        store.setResult({
            topic: 'blockchain',
            explanations: { eli5: 'Blockchain is like a digital ledger' },
            mode: 'fast',
        })

        render(
            <BrowserRouter>
                <AppPage />
            </BrowserRouter>
        )

        expect(screen.getByText('blockchain')).toBeInTheDocument()
        expect(screen.getByTestId('explanation-card')).toHaveTextContent('Blockchain is like a digital ledger')
    })
})
