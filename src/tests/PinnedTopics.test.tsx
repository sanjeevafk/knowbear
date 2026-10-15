import { describe, it, expect, vi } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'
import PinnedTopics from '../components/PinnedTopics'
import type { PinnedTopic } from '../types'

describe('PinnedTopics', () => {
    const mockTopics: PinnedTopic[] = [
        { id: 'black-holes', title: 'How Black Holes Work', description: 'Event horizons and singularities.' },
        { id: 'sleep', title: 'Why We Need Sleep', description: 'Brain restoration and circadian rhythms.' },
        { id: 'inflation', title: 'How Inflation Works', description: 'Money supply and purchasing power.' },
    ]

    it('renders topic cards with index indicators and descriptions', () => {
        const onSelect = vi.fn()
        render(<PinnedTopics topics={mockTopics} onSelect={onSelect} />)

        expect(screen.getByText('Popular Topics')).toBeInTheDocument()
        expect(screen.getByText('01')).toBeInTheDocument()
        expect(screen.getByText('02')).toBeInTheDocument()
        expect(screen.getByText('03')).toBeInTheDocument()
        expect(screen.getByText('How Black Holes Work')).toBeInTheDocument()
        expect(screen.getByText('Why We Need Sleep')).toBeInTheDocument()
        expect(screen.getByText('How Inflation Works')).toBeInTheDocument()
        expect(screen.getByText('Event horizons and singularities.')).toBeInTheDocument()
    })

    it('triggers onSelect with topic title when a card is clicked', () => {
        const onSelect = vi.fn()
        render(<PinnedTopics topics={mockTopics} onSelect={onSelect} />)

        fireEvent.click(screen.getByText('How Black Holes Work'))
        expect(onSelect).toHaveBeenCalledWith('How Black Holes Work')
    })
})
