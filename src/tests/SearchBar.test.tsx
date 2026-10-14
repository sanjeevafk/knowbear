import { describe, it, expect, vi } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'
import SearchBar from '../components/SearchBar'

describe('SearchBar', () => {
    it('renders input and button', () => {
        render(<SearchBar onSearch={() => {}} loading={false} />)
        expect(screen.getByPlaceholderText(/what passes for knowledge/i)).toBeInTheDocument()
        expect(screen.getByRole('button', { name: /explain/i })).toBeInTheDocument()
    })

    it('calls onSearch with topic on submit', () => {
        const onSearch = vi.fn()
        render(<SearchBar onSearch={onSearch} loading={false} />)
        const input = screen.getByPlaceholderText(/what passes for knowledge/i)
        fireEvent.change(input, { target: { value: 'Photosynthesis' } })
        fireEvent.submit(input.closest('form')!)
        expect(onSearch).toHaveBeenCalledWith('Photosynthesis')
    })
})
