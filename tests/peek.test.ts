import { describe, expect, test } from 'claude-code/testing'

import { fit, fitRow, isSame, placeholders, pngSize } from '../hooks/images'

// The first 24 bytes of a 1600×400 PNG
const HEADER = btoa(String.fromCharCode(0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 0, 0, 0, 13, 0x49, 0x48, 0x44, 0x52, 0, 0, 0x06, 0x40, 0, 0, 0x01, 0x90))

describe('placeholders', () => {
  test('finds each image once, in order', async () => {
    expect(placeholders('see [Image #2] and [Image #1], again [Image #2]')).toEqual([2, 1])
  })

  test('drops a placeholder once it is deleted', async () => {
    expect(placeholders('see [Image #2] and [Image #')).toEqual([2])
    expect(placeholders('no images')).toEqual([])
  })
})

describe('pngSize', () => {
  test('reads the size from the header', async () => {
    expect(pngSize(HEADER)).toEqual({ width: 1600, height: 400 })
    expect(pngSize(btoa('not a png at all, just text....'))).toBe(null)
  })
})

describe('fit', () => {
  test('keeps a wide screenshot wide and a phone shot tall', async () => {
    expect(fit({ width: 1600, height: 400 }, 8)).toEqual({ columns: 40, rows: 5 })
    expect(fit({ width: 400, height: 800 }, 8)).toEqual({ columns: 8, rows: 8 })
  })

  test('shrinks the tiles until the row fits the band', async () => {
    const sizes = [{ width: 1000, height: 1000 }, { width: 1000, height: 1000 }]
    const cells = fitRow(sizes, 20, 40)
    const width = cells.reduce((sum, cell) => sum + cell.columns + 2, 0) + 1

    expect(width).toBeLessThanOrEqual(40)
  })
})

describe('isSame', () => {
  test('notices a newly resolved file', async () => {
    expect(isSame([{ n: 1, file: null, size: null }], [{ n: 1, file: '/a/1.png', size: null }])).toBe(false)
    expect(isSame([{ n: 1, file: '/a/1.png', size: null }], [{ n: 1, file: '/a/1.png', size: null }])).toBe(true)
  })
})
