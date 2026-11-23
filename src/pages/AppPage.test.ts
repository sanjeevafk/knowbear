import { describe, it, expect, beforeEach, vi } from 'vitest'
import { screen } from '@testing-library/dom'
import { mountAppPage } from './AppPage'
import { useKnowBearStore } from '../store/useKnowBearStore'

vi.mock('../api', () => ({
    getPinnedTopics: vi.fn(() => Promise.resolve([])),
}))

describe('AppPage', () => {
    beforeEach(() => {
        useKnowBearStore.getState().reset()
        document.body.innerHTML = ''
        vi.clearAllMocks()
    })

    it('renders initial empty state', async () => {
        const container = document.createElement('div')
        document.body.appendChild(container)
        const unmount = mountAppPage(container)

        expect(screen.getByText('What passes for knowledge...?')).toBeInTheDocument()
        expect(screen.getByRole('button', { name: /explain/i })).toBeInTheDocument()
        unmount()
    })

    it('renders result from store', async () => {
        useKnowBearStore.getState().setResult({
            topic: 'blockchain',
            explanations: { eli5: 'Blockchain is like a digital ledger' },
            mode: 'fast',
        })

        const container = document.createElement('div')
        document.body.appendChild(container)
        const unmount = mountAppPage(container)

        expect(screen.getByText('blockchain')).toBeInTheDocument()
        expect(screen.getByText('Blockchain is like a digital ledger')).toBeInTheDocument()
        unmount()
    })
})
