import { z } from 'zod'

export const modeSchema = z.string().optional()
export const levelSchema = z.enum(['eli5', 'eli12', 'eli15', 'meme'])

export const queryRequestSchema = z
    .object({
        topic: z.string().max(2000).default(''),
        image: z.string().optional(),
        levels: z.array(levelSchema).optional(),
        mode: modeSchema.optional(),
        temperature: z.number().optional(),
        regenerate: z.boolean().optional(),
    })
    .refine((data) => data.topic.trim().length > 0 || !!data.image, {
        message: 'Either a topic or an image must be provided',
        path: ['topic'],
    })

export const pinnedTopicSchema = z.object({
    id: z.string(),
    title: z.string(),
    description: z.string(),
})

export const pinnedTopicsSchema = z.array(pinnedTopicSchema)

export const queryResponseSchema = z.object({
    topic: z.string(),
    explanations: z.record(z.string()),
    mode: modeSchema.optional(),
})

export const streamChunkSchema = z.object({
    chunk: z.string().optional(),
    warning: z.string().optional(),
    error: z.string().optional(),
})
