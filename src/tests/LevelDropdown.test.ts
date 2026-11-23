import { describe, it, expect, beforeEach, vi } from 'vitest'
import { screen, fireEvent } from '@testing-library/dom'
import { createLevelDropdown } from '../components/LevelDropdown'

describe('LevelDropdown', () => {
    beforeEach(() => {
        document.body.innerHTML = ''
    })

    it('renders trigger button with selected label', () => {
        const dd = createLevelDropdown({ selected: 'eli5', onChange: () => {} })
        document.body.appendChild(dd.el)
        expect(screen.getByText(/like i'm 5/i)).toBeInTheDocument()
        expect(screen.queryByText(/like i'm 12/i)).toBeNull()
        dd.destroy()
    })

    it('opens menu and calls onChange when option clicked', () => {
        const onChange = vi.fn()
        const dd = createLevelDropdown({ selected: 'eli5', onChange })
        document.body.appendChild(dd.el)

        fireEvent.click(screen.getByRole('button'))
        const option = screen.getByText(/like i'm 12/i)
        fireEvent.click(option)

        expect(onChange).toHaveBeenCalledWith('eli12')
        dd.destroy()
    })
})
