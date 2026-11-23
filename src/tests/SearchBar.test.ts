import { describe, it, expect, beforeEach, vi } from 'vitest'
import { screen, fireEvent } from '@testing-library/dom'
import { createSearchBar } from '../components/SearchBar'

describe('SearchBar', () => {
    beforeEach(() => {
        document.body.innerHTML = ''
    })

    it('renders input and button', () => {
        const sb = createSearchBar({ onSearch: () => {}, loading: false })
        document.body.appendChild(sb.el)
        expect(screen.getByPlaceholderText(/what passes for knowledge/i)).toBeInTheDocument()
        expect(screen.getByRole('button', { name: /explain/i })).toBeInTheDocument()
        sb.destroy()
    })

    it('calls onSearch with topic on submit', () => {
        const onSearch = vi.fn()
        const sb = createSearchBar({ onSearch, loading: false })
        document.body.appendChild(sb.el)
        const input = screen.getByPlaceholderText(/what passes for knowledge/i) as HTMLTextAreaElement
        input.value = 'Photosynthesis'
        fireEvent.input(input)
        fireEvent.submit(input.closest('form')!)
        expect(onSearch).toHaveBeenCalledWith('Photosynthesis')
        sb.destroy()
    })

    it('handles multiline pasted text and Enter key submit', () => {
        const onSearch = vi.fn()
        const sb = createSearchBar({ onSearch, loading: false })
        document.body.appendChild(sb.el)
        const textarea = screen.getByPlaceholderText(/what passes for knowledge/i) as HTMLTextAreaElement
        const multilineText = 'Line 1 of text.\nLine 2 of text.\nLine 3 of text.'
        textarea.value = multilineText
        fireEvent.input(textarea)

        fireEvent.keyDown(textarea, { key: 'Enter', shiftKey: true })
        expect(onSearch).not.toHaveBeenCalled()

        fireEvent.keyDown(textarea, { key: 'Enter', shiftKey: false })
        expect(onSearch).toHaveBeenCalledWith(multilineText)
        sb.destroy()
    })

    it('shows character counter when text exceeds 80 characters', () => {
        const sb = createSearchBar({ onSearch: () => {}, loading: false })
        document.body.appendChild(sb.el)
        const textarea = screen.getByPlaceholderText(/what passes for knowledge/i) as HTMLTextAreaElement
        textarea.value = 'A'.repeat(120)
        fireEvent.input(textarea)
        expect(screen.getByText('120/2000')).toBeInTheDocument()
        sb.destroy()
    })

    it('renders initial image preview chip and allows removing it', () => {
        const dummyImage =
            'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNk+A8AAQUBAScY42YAAAAASUVORK5CYII='
        const sb = createSearchBar({ onSearch: () => {}, loading: false, initialImage: dummyImage })
        document.body.appendChild(sb.el)
        expect(screen.getByText(/screenshot \/ diagram attached/i)).toBeInTheDocument()
        expect(screen.getByRole('button', { name: /remove image/i })).toBeInTheDocument()

        fireEvent.click(screen.getByRole('button', { name: /remove image/i }))
        expect(screen.queryByText(/screenshot \/ diagram attached/i)).not.toBeInTheDocument()
        sb.destroy()
    })

    it('submits with image even if text is empty', () => {
        const onSearch = vi.fn()
        const dummyImage =
            'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNk+A8AAQUBAScY42YAAAAASUVORK5CYII='
        const sb = createSearchBar({ onSearch, loading: false, initialImage: dummyImage })
        document.body.appendChild(sb.el)

        const submitButton = screen.getByRole('button', { name: /explain/i })
        expect(submitButton).not.toBeDisabled()
        fireEvent.click(submitButton)
        expect(onSearch).toHaveBeenCalledWith('', dummyImage)
        sb.destroy()
    })
})
