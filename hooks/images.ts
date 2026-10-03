import type { Preview } from '../types'

// The numbers of the [Image #N] placeholders in a draft, in order, once each
export function placeholders(text: string): number[] {
  const numbers = [...text.matchAll(/\[Image #(\d+)\]/g)].map(match => Number(match[1]))

  return [...new Set(numbers)]
}

export function label(preview: Preview): string {
  if (preview.size === null) {
    return `#${preview.n}`
  }

  const kb = Math.max(1, Math.round(preview.size / 1024))

  return `#${preview.n} · ${kb} KB`
}

export function isSame(a: Preview[], b: Preview[]): boolean {
  return a.length === b.length && a.every((preview, i) => preview.n === b[i]?.n && preview.file === b[i]?.file)
}
