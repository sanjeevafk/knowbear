import React from 'react'
import { motion } from 'framer-motion'

export type BearPose =
    | 'working'
    | 'learning'
    | 'chill'
    | 'explaining'
    | 'wave'
    | 'confident'

export interface KnowBearPoseProps {
    pose?: BearPose
    size?: 'sm' | 'md' | 'lg' | 'xl' | '2xl' | 'hero'
    transparent?: boolean
    animate?: boolean
    floating?: boolean
    className?: string
}

const sizeClasses: Record<NonNullable<KnowBearPoseProps['size']>, string> = {
    sm: 'w-24 h-auto',
    md: 'w-36 sm:w-44 h-auto',
    lg: 'w-52 h-auto',
    xl: 'w-64 h-auto',
    '2xl': 'w-80 h-auto',
    hero: 'w-60 sm:w-72 md:w-80 h-auto',
}

export const KnowBearPose: React.FC<KnowBearPoseProps> = ({
    pose = 'wave',
    size = 'md',
    transparent = true,
    animate = true,
    floating = false,
    className = '',
}) => {
    const fileName = transparent ? `${pose}_transparent.png` : `${pose}.png`
    const src = `/brand/poses/${fileName}`

    return (
        <motion.div
            initial={animate ? { scale: 0.92, opacity: 0 } : false}
            animate={{
                scale: 1,
                opacity: 1,
                y: floating ? [0, -6, 0] : 0,
            }}
            transition={{
                duration: 0.35,
                ease: 'easeOut',
                y: floating ? { repeat: Infinity, duration: 3, ease: 'easeInOut' } : undefined,
            }}
            className={`relative inline-flex items-center justify-center shrink-0 ${sizeClasses[size]} ${className}`}
        >
            <img
                src={src}
                alt={`KnowBear pose: ${pose}`}
                className="w-full h-full object-contain select-none drop-shadow-md"
                draggable={false}
            />
        </motion.div>
    )
}

export default KnowBearPose
