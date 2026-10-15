import React from 'react'
import { motion, AnimatePresence } from 'framer-motion'

export type BearExpression =
    | 'default'
    | 'thinking'
    | 'happy'
    | 'confused'
    | 'serious'
    | 'wink'
    | 'excited'
    | 'loading'
    | 'idea'
    | 'error'
    | 'meme'

export interface KnowBearAvatarProps {
    expression?: BearExpression
    size?: 'xs' | 'sm' | 'md' | 'lg' | 'xl' | '2xl'
    transparent?: boolean
    animate?: boolean
    pulse?: boolean
    className?: string
}

const sizeClasses: Record<NonNullable<KnowBearAvatarProps['size']>, string> = {
    xs: 'w-6 h-6',
    sm: 'w-8 h-8',
    md: 'w-12 h-12',
    lg: 'w-16 h-16',
    xl: 'w-24 h-24',
    '2xl': 'w-32 h-32',
}

const AVAILABLE_EXPRESSIONS = new Set([
    'default',
    'happy',
    'idea',
    'serious',
    'meme',
    'loading',
    'confused',
])

export const KnowBearAvatar: React.FC<KnowBearAvatarProps> = ({
    expression = 'default',
    size = 'md',
    animate = true,
    pulse = false,
    className = '',
}) => {
    const activeExpression = AVAILABLE_EXPRESSIONS.has(expression) ? expression : 'default'
    const src = `/brand/expressions/${activeExpression}_transparent.png`

    return (
        <AnimatePresence mode="wait">
            <motion.div
                key={expression}
                initial={animate ? { scale: 0.88, opacity: 0 } : false}
                animate={{
                    scale: 1,
                    opacity: 1,
                    y: pulse ? [0, -3, 0] : 0,
                }}
                exit={animate ? { scale: 0.88, opacity: 0 } : undefined}
                transition={{
                    duration: 0.25,
                    ease: 'easeOut',
                    y: pulse ? { repeat: Infinity, duration: 1.8, ease: 'easeInOut' } : undefined,
                }}
                className={`relative inline-flex items-center justify-center shrink-0 ${sizeClasses[size]} ${className}`}
            >
                <img
                    src={src}
                    alt={`KnowBear expression: ${expression}`}
                    className="w-full h-full object-contain select-none drop-shadow-sm"
                    draggable={false}
                />
            </motion.div>
        </AnimatePresence>
    )
}

export default KnowBearAvatar
