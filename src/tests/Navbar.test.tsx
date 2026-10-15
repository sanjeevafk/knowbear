import { describe, it, expect, vi } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'
import { BrowserRouter } from 'react-router-dom'
import Navbar from '../components/Navbar'

describe('Navbar', () => {
    it('renders logo, brand name, and GitHub link', () => {
        render(
            <BrowserRouter>
                <Navbar />
            </BrowserRouter>
        )

        expect(screen.getByText('Know')).toBeInTheDocument()
        expect(screen.getByText('Bear')).toBeInTheDocument()

        const githubLink = screen.getByLabelText(/gitHub repository/i)
        expect(githubLink).toBeInTheDocument()
        expect(githubLink).toHaveAttribute('href', 'https://github.com/sanjeevafk/knowbear')
        expect(githubLink).toHaveAttribute('target', '_blank')
    })

    it('triggers onNewSearch when logo is clicked', () => {
        const onNewSearch = vi.fn()
        render(
            <BrowserRouter>
                <Navbar onNewSearch={onNewSearch} />
            </BrowserRouter>
        )

        const logoLink = screen.getByRole('link', { name: /know bear/i })
        fireEvent.click(logoLink)

        expect(onNewSearch).toHaveBeenCalledTimes(1)
    })
})
