import type { PinnedTopic } from '../types'

interface PinnedTopicsProps {
    topics: PinnedTopic[]
    onSelect: (topic: string) => void
}

export default function PinnedTopics({ topics, onSelect }: PinnedTopicsProps) {
    return (
        <section className="w-full max-w-3xl mx-auto mt-6">
            <h3 className="text-sm font-semibold text-gray-500 uppercase tracking-widest mb-6 text-center">
                Popular Topics
            </h3>
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-6">
                {topics.map((item, index) => (
                    <button
                        key={item.id}
                        onClick={() => onSelect(item.title)}
                        className="p-6 bg-dark-800 border border-dark-600 rounded-2xl hover:border-amber-500 hover:bg-dark-700 transition-all text-left group flex flex-col gap-3"
                    >
                        <span className="text-xs font-bold text-amber-500/70 font-mono">0{index + 1}</span>
                        <h3 className="font-semibold text-white group-hover:text-amber-400 transition-colors text-lg">
                            {item.title}
                        </h3>
                        <p className="text-sm text-gray-400 leading-relaxed">
                            {item.description}
                        </p>
                    </button>
                ))}
            </div>
        </section>
    )
}
