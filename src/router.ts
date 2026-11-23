const listeners = new Set<() => void>()

export function navigate(to: string, options?: { replace?: boolean }): void {
    if (options?.replace) {
        window.history.replaceState({}, '', to)
    } else {
        window.history.pushState({}, '', to)
    }
    for (const listener of listeners) {
        listener()
    }
}

export function subscribeRoute(listener: () => void): () => void {
    listeners.add(listener)
    window.addEventListener('popstate', listener)
    return () => {
        listeners.delete(listener)
        window.removeEventListener('popstate', listener)
    }
}
