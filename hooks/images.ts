import type { Preview, Size } from '../types'

export type Cells = { columns: number; rows: number }

const TILE_ROWS = 8
const MAX_COLUMNS = 40
const MIN_COLUMNS = 6
// A terminal cell is about twice as tall as it is wide
const CELL_ASPECT = 2
// A tile's border on each side plus the label row
const CHROME_ROWS = 3
const CHROME_COLUMNS = 2
const GAP = 1
const UNKNOWN: Size = { width: 16, height: 10 }

// The numbers of the [Image #N] placeholders in a draft, in order, once each
export function placeholders(text: string): number[] {
  const numbers = [...text.matchAll(/\[Image #(\d+)\]/g)].map(match => Number(match[1]))

  return [...new Set(numbers)]
}

// Width and height from the PNG header, null when the bytes are not a PNG
export function pngSize(base64: string): Size | null {
  // 32 base64 characters decode to the 24 bytes holding the signature and IHDR size
  const head = Uint8Array.from(atob(base64.slice(0, 32)), char => char.charCodeAt(0))
  const signature = [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]

  if (head.length < 24 || signature.some((byte, i) => head[i] !== byte)) {
    return null
  }

  const view = new DataView(head.buffer)
  const width = view.getUint32(16)
  const height = view.getUint32(20)

  return width > 0 && height > 0 ? { width, height } : null
}

// A picture box at most `maxRows` tall that keeps the image's aspect ratio
export function fit(size: Size | null, maxRows: number): Cells {
  const { width, height } = size ?? UNKNOWN
  let rows = maxRows
  let columns = Math.round((rows * CELL_ASPECT * width) / height)

  if (columns > MAX_COLUMNS) {
    columns = MAX_COLUMNS
    rows = Math.max(1, Math.round((MAX_COLUMNS * height) / (CELL_ASPECT * width)))
  }

  return { columns: Math.max(MIN_COLUMNS, columns), rows: Math.min(rows, maxRows) }
}

// The tallest boxes that fit one row of tiles into the band, so it never scrolls
export function fitRow(sizes: readonly (Size | null)[], bandRows: number, bandColumns: number): Cells[] {
  const tallest = Math.max(1, Math.min(TILE_ROWS, bandRows - CHROME_ROWS))

  for (let rows = tallest; rows > 1; rows--) {
    const cells = sizes.map(size => fit(size, rows))
    const width = cells.reduce((sum, cell) => sum + cell.columns + CHROME_COLUMNS, 0) + GAP * (cells.length - 1)

    if (width <= bandColumns) {
      return cells
    }
  }

  return sizes.map(size => fit(size, 1))
}

export function isSame(a: Preview[], b: Preview[]): boolean {
  return a.length === b.length && a.every((preview, i) => preview.n === b[i]?.n && preview.file === b[i]?.file)
}
