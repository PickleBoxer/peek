import { describe, expect, test } from 'claude-code/testing'

import { isSame, label, placeholders } from '../hooks/images'

describe('placeholders', () => {
  test('finds each image once, in order', async () => {
    expect(placeholders('see [Image #2] and [Image #1], again [Image #2]')).toEqual([2, 1])
  })

  test('drops a placeholder once it is deleted', async () => {
    expect(placeholders('see [Image #2] and [Image #')).toEqual([2])
    expect(placeholders('no images')).toEqual([])
  })
})

describe('label', () => {
  test('shows the size when the file was found', async () => {
    expect(label({ n: 2, file: '/tmp/x/2.png', size: 86_000 })).toBe('#2 · 84 KB')
    expect(label({ n: 3, file: null, size: null })).toBe('#3')
  })
})

describe('isSame', () => {
  test('notices a newly resolved file', async () => {
    expect(isSame([{ n: 1, file: null, size: null }], [{ n: 1, file: '/a/1.png', size: 1 }])).toBe(false)
    expect(isSame([{ n: 1, file: '/a/1.png', size: 1 }], [{ n: 1, file: '/a/1.png', size: 1 }])).toBe(true)
  })
})
