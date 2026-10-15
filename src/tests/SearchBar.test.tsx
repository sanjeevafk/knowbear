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

    it('handles multiline pasted text and Enter key submit', () => {
        const onSearch = vi.fn()
        render(<SearchBar onSearch={onSearch} loading={false} />)
        const textarea = screen.getByPlaceholderText(/what passes for knowledge/i)
        const multilineText = 'Line 1 of text.\nLine 2 of text.\nLine 3 of text.'
        fireEvent.change(textarea, { target: { value: multilineText } })

        // Shift+Enter should not submit
        fireEvent.keyDown(textarea, { key: 'Enter', shiftKey: true })
        expect(onSearch).not.toHaveBeenCalled()

        // Enter without shift should submit
        fireEvent.keyDown(textarea, { key: 'Enter', shiftKey: false })
        expect(onSearch).toHaveBeenCalledWith(multilineText)
    })

    it('shows character counter when text exceeds 80 characters', () => {
        render(<SearchBar onSearch={() => {}} loading={false} />)
        const textarea = screen.getByPlaceholderText(/what passes for knowledge/i)
        const longText = 'A'.repeat(120)
        fireEvent.change(textarea, { target: { value: longText } })
        expect(screen.getByText('120/2000')).toBeInTheDocument()
    })

    it('renders initial image preview chip and allows removing it', () => {
        const dummyImage = 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNk+A8AAQUBAScY42YAAAAASUVORK5CYII='
        render(<SearchBar onSearch={() => {}} loading={false} initialImage={dummyImage} />)
        expect(screen.getByText(/screenshot \/ diagram attached/i)).toBeInTheDocument()
        expect(screen.getByRole('button', { name: /remove image/i })).toBeInTheDocument()

        fireEvent.click(screen.getByRole('button', { name: /remove image/i }))
        expect(screen.queryByText(/screenshot \/ diagram attached/i)).not.toBeInTheDocument()
    })

    it('submits with image even if text is empty', () => {
        const onSearch = vi.fn()
        const dummyImage = 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNk+A8AAQUBAScY42YAAAAASUVORK5CYII='
        render(<SearchBar onSearch={onSearch} loading={false} initialImage={dummyImage} />)
        
        const submitButton = screen.getByRole('button', { name: /explain/i })
        expect(submitButton).not.toBeDisabled()
        fireEvent.click(submitButton)
        expect(onSearch).toHaveBeenCalledWith('', dummyImage)
    })
})

