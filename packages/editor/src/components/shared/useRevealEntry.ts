import { useEffect, useRef, useState } from 'react'

/** Reveal only explicitly requested entries; normal selection never moves the page. */
export function useRevealEntry() {
  const root = useRef<HTMLDivElement>(null)
  const [target, reveal] = useState<string | null>(null)
  useEffect(() => {
    if (!target) return
    const frame = requestAnimationFrame(() => {
      const item = [...(root.current?.querySelectorAll<HTMLElement>('[data-entry-id]') ?? [])]
        .find(element => element.dataset.entryId === target)
      item?.scrollIntoView({ block: 'nearest', inline: 'nearest' })
      reveal(null)
    })
    return () => cancelAnimationFrame(frame)
  }, [target])
  return { root, reveal }
}
