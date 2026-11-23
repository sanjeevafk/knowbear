import { describe, it, expect, beforeEach, vi } from 'vitest'
import { screen, fireEvent } from '@testing-library/dom'
import { createNavbar } from '../components/Navbar'

describe('Navbar', () => {
    beforeEach(() => {
        document.body.innerHTML = ''
    })

    it('renders logo, brand name, and GitHub link', () => {
        document.body.appendChild(createNavbar())

        expect(screen.getByText('Know')).toBeInTheDocument()
        expect(screen.getByText('Bear')).toBeInTheDocument()

        const githubLink = screen.getByLabelText(/gitHub repository/i)
        expect(githubLink).toBeInTheDocument()
        expect(githubLink).toHaveAttribute('href', 'https://github.com/sanjeevafk/knowbear')
        expect(githubLink).toHaveAttribute('target', '_blank')
    })

    it('triggers onNewSearch when logo is clicked', () => {
        const onNewSearch = vi.fn()
        document.body.appendChild(createNavbar({ onNewSearch }))

        const logoLink = screen.getByRole('link', { name: /know bear/i })
        fireEvent.click(logoLink)

        expect(onNewSearch).toHaveBeenCalledTimes(1)
    })
})
