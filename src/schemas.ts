import * as z from 'zod/v4-mini'

export const modeSchema = z.optional(z.string())
export const levelSchema = z.enum(['eli5', 'eli12', 'eli15', 'meme'])

export const queryRequestSchema = z
    .object({
        topic: z._default(z.string().check(z.maxLength(2000)), ''),
        image: z.optional(z.string()),
        levels: z.optional(z.array(levelSchema)),
        mode: modeSchema,
        temperature: z.optional(z.number()),
        regenerate: z.optional(z.boolean()),
    })
    .check(
        z.refine((data) => data.topic.trim().length > 0 || !!data.image, {
            message: 'Either a topic or an image must be provided',
            path: ['topic'],
        })
    )

export const pinnedTopicSchema = z.object({
    id: z.string(),
    title: z.string(),
    description: z.string(),
})

export const pinnedTopicsSchema = z.array(pinnedTopicSchema)

export const queryResponseSchema = z.object({
    topic: z.string(),
    explanations: z.record(z.string(), z.string()),
    mode: modeSchema,
})

export const streamChunkSchema = z.object({
    chunk: z.optional(z.string()),
    warning: z.optional(z.string()),
    error: z.optional(z.string()),
})
