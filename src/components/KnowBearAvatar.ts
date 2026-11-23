import { el } from '../utils/dom'

export type BearExpression = 'happy' | 'serious' | 'loading' | 'idea' | 'meme'

export interface KnowBearAvatarOptions {
    expression?: BearExpression
    size?: 'xs' | 'sm' | 'md' | 'lg' | 'xl' | '2xl'
    pulse?: boolean
    className?: string
}

const sizeClasses: Record<NonNullable<KnowBearAvatarOptions['size']>, string> = {
    xs: 'w-6 h-6',
    sm: 'w-8 h-8',
    md: 'w-12 h-12',
    lg: 'w-16 h-16',
    xl: 'w-24 h-24',
    '2xl': 'w-32 h-32',
}

const AVAILABLE_EXPRESSIONS = new Set(['happy', 'idea', 'serious', 'meme', 'loading'])

export function createKnowBearAvatar({
    expression = 'happy',
    size = 'md',
    pulse = false,
    className = '',
}: KnowBearAvatarOptions = {}): HTMLDivElement {
    const activeExpression = AVAILABLE_EXPRESSIONS.has(expression) ? expression : 'happy'
    const src = `/brand/expressions/${activeExpression}_transparent.png`

    return el(
        'div',
        {
            className: `relative inline-flex items-center justify-center shrink-0 ${sizeClasses[size]} ${pulse ? 'animate-bounce' : ''} ${className}`,
        },
        el('img', {
            src,
            alt: `KnowBear expression: ${expression}`,
            className: 'w-full h-full object-contain select-none drop-shadow-sm',
            draggable: false,
        })
    )
}
