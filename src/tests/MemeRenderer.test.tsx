import { describe, it, expect } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'
import MemeRenderer from '../components/MemeRenderer'
import { parseMemeContent } from '../utils/memeImage'

describe('parseMemeContent', () => {
  it('parses structured SETUP and PUNCHLINE tags into cleanText', () => {
    const raw = `SETUP: Explaining code in a 100-page document
PUNCHLINE: Summarizing with a single KnowBear meme`

    const parsed = parseMemeContent(raw)
    expect(parsed.setup).toBe('Explaining code in a 100-page document')
    expect(parsed.punchline).toBe('Summarizing with a single KnowBear meme')
    expect(parsed.cleanText).toBe('Explaining code in a 100-page document Summarizing with a single KnowBear meme')
  })

  it('handles plain text one-liners directly without extra formatting', () => {
    const raw = 'Quantum physics: where turning on the lights changes the experiment.'
    const parsed = parseMemeContent(raw, 'Quantum Computing')
    expect(parsed.setup).toBe('Quantum Computing')
    expect(parsed.punchline).toBe(raw)
    expect(parsed.cleanText).toBe(raw)
  })

  it('strips regeneration quotes and horizontal rules from memes', () => {
    const raw = `When you deploy to production on Friday, PagerDuty becomes your weekend DJ.

---
*"Learning never exhausts the mind."* — Leonardo da Vinci`

    const parsed = parseMemeContent(raw)
    expect(parsed.cleanText).toBe('When you deploy to production on Friday, PagerDuty becomes your weekend DJ.')
    expect(parsed.cleanText).not.toContain('Leonardo da Vinci')
  })
})

describe('MemeRenderer component', () => {
  const sampleMeme = 'Git rebase is like rewriting your diary so you look like a genius who never made a typo.'

  it('renders Plain Text view by default as normal response', () => {
    render(<MemeRenderer content={sampleMeme} topic="Git Rebase" />)
    expect(screen.getByText('Plain Text')).toBeInTheDocument()
    expect(screen.getByText('🐻 Mascot Meme')).toBeInTheDocument()
    expect(screen.getByText(sampleMeme)).toBeInTheDocument()
    expect(screen.queryByText(/KNOWBEAR SAYS/i)).not.toBeInTheDocument()
    // Download Image button should not be present in Plain Text mode
    expect(screen.queryByRole('button', { name: /Download Image/i })).not.toBeInTheDocument()
  })

  it('switches to Mascot Meme view when toggle is clicked', () => {
    render(<MemeRenderer content={sampleMeme} topic="Git Rebase" />)

    // Click Mascot Meme toggle
    const mascotBtn = screen.getByRole('button', { name: /Mascot Meme/i })
    fireEvent.click(mascotBtn)

    // Now image action buttons and mascot frame are visible
    expect(screen.getByRole('button', { name: /Copy Image/i })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: /Download Image/i })).toBeInTheDocument()
    expect(screen.getByRole('heading', { name: /^Git Rebase$/i })).toBeInTheDocument()
    expect(screen.getByText(/REWRITING YOUR DIARY/i)).toBeInTheDocument()

    // Switch back to Plain Text
    const textBtn = screen.getByRole('button', { name: /Plain Text/i })
    fireEvent.click(textBtn)
    expect(screen.queryByRole('button', { name: /Download Image/i })).not.toBeInTheDocument()
    expect(screen.queryByRole('button', { name: /Copy Image/i })).not.toBeInTheDocument()
    expect(screen.getByText(sampleMeme)).toBeInTheDocument()
  })
})
