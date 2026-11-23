import { el } from '../utils/dom'

export type BearPose = 'wave'

export interface KnowBearPoseOptions {
    pose?: BearPose
    size?: 'sm' | 'md' | 'lg' | 'xl' | '2xl' | 'hero'
    floating?: boolean
    className?: string
}

const sizeClasses: Record<NonNullable<KnowBearPoseOptions['size']>, string> = {
    sm: 'w-24 h-auto',
    md: 'w-36 sm:w-44 h-auto',
    lg: 'w-52 h-auto',
    xl: 'w-64 h-auto',
    '2xl': 'w-80 h-auto',
    hero: 'w-60 sm:w-72 md:w-80 h-auto',
}

export function createKnowBearPose({
    pose = 'wave',
    size = 'md',
    floating = false,
    className = '',
}: KnowBearPoseOptions = {}): HTMLDivElement {
    return el(
        'div',
        {
            className: `relative inline-flex items-center justify-center shrink-0 ${sizeClasses[size]} ${floating ? 'animate-pulse-slow' : ''} ${className}`,
        },
        el('img', {
            src: '/brand/poses/wave_transparent.png',
            alt: `KnowBear pose: ${pose}`,
            className: 'w-full h-full object-contain select-none drop-shadow-md',
            draggable: false,
        })
    )
}
