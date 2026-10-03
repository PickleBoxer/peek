import { atom, read, update } from 'claude-code'
import type { EngineInterface, Register } from 'claude-code'

import type { Preview, Size } from '../types'
import { fitRow, isSame, placeholders, pngSize } from './images'

// Pasting an image raises no prompt.edit (the placeholder only lands with the next key),
// so the draft is polled instead
const POLL_MS = 200
const EXTENSIONS = ['png', 'jpg', 'jpeg', 'gif', 'webp']

const previewsAtom = atom({ plugin: 'peek', key: 'previews' } as const, [] as Preview[])

// Only cached once found: the folder appears with the session's first paste
let imagesDir: string | null = null
let isPolling = false
const sizes = new Map<string, Size | null>()

// Claude Code writes each pasted image to <tmp>/claude-<uid>/<project-slug>/<sessionId>/images/N.<ext>,
// keeping its original format.
// The path is internal and may move between releases; when it does, tiles say "no preview".
async function findImagesDir($: EngineInterface): Promise<string | null> {
  const sessionId = await $.session.id()
  const custom = await $.env.get('CLAUDE_CODE_TMPDIR')
  const roots = custom
    ? [custom]
    : (await $.fs.list('/tmp').catch(() => []))
        .filter(entry => entry.name.startsWith('claude-'))
        .map(entry => `/tmp/${entry.name}`)

  for (const root of roots) {
    for (const project of await $.fs.list(root).catch(() => [])) {
      const dir = `${root}/${project.name}/${sessionId}/images`

      if (project.kind === 'dir' && (await $.fs.exists(dir))) {
        return dir
      }
    }
  }

  return null
}

async function findSource($: EngineInterface, n: number): Promise<string | null> {
  for (const extension of EXTENSIONS) {
    const file = `${imagesDir}/${n}.${extension}`

    if (await $.fs.exists(file)) {
      return file
    }
  }

  return null
}

// Image draws PNG only, so other formats get a PNG copy once, through macOS sips.
// The copy stays inside Claude Code's cache, which only this user can enter.
async function toPng($: EngineInterface, source: string, n: number): Promise<string | null> {
  if (source.endsWith('.png')) {
    return source
  }

  const dir = `${imagesDir}/peek`
  const file = `${dir}/${n}.png`

  if (await $.fs.exists(file)) {
    return file
  }

  const converted = await $.process.run(['mkdir', '-p', dir])
    .then(() => $.process.run(['sips', '-s', 'format', 'png', '-Z', '512', source, '--out', file]))
    .catch(() => null)

  return converted?.exitCode === 0 ? file : null
}

async function resolvePreview($: EngineInterface, n: number): Promise<Preview> {
  imagesDir ??= await findImagesDir($)

  const source = imagesDir ? await findSource($, n) : null
  const file = source ? await toPng($, source, n) : null

  if (!file) {
    return { n, file: null, size: null }
  }

  if (!sizes.has(file)) {
    // Over the 4 MiB read cap it still draws, just without its aspect ratio
    const size = await $.fs.read(file, { as: 'bytes' }).then(({ base64 }) => pngSize(base64), () => null)
    sizes.set(file, size)
  }

  return { n, file, size: sizes.get(file) ?? null }
}

async function poll($: EngineInterface): Promise<void> {
  if (isPolling) {
    return
  }

  isPolling = true

  try {
    const { text } = await $.prompt.read()
    const known = await read($, previewsAtom)
    const numbers = placeholders(text)

    if (numbers.length === 0 && known.length === 0) {
      return
    }

    const previews = await Promise.all(
      numbers.map(n => known.find(preview => preview.n === n && preview.file) ?? resolvePreview($, n)),
    )

    if (!isSame(previews, known)) {
      await update($, previewsAtom, () => previews)
    }
  } finally {
    isPolling = false
  }
}

export const register: Register = on => {
  on('session.start', async ($, e, next) => {
    $.clock.every(POLL_MS, () => poll($))

    return next(e)
  })

  on('prompt.submit', async ($, e, next) => {
    await update($, previewsAtom, () => [])

    return next(e)
  })

  on('ui.render', { component: 'AbovePrompt' }, async ($, e, next) => {
    // The desktop composer already shows its own thumbnails
    if (e.surface !== 'terminal' || e.props.hasSurvey) {
      return next(e)
    }

    const previews = await read($, previewsAtom)

    if (previews.length === 0) {
      return next(e)
    }

    const { Box, Image, Text } = $.ui.resolve(e)
    const cells = fitRow(previews.map(preview => preview.size), e.props.maxRows, e.props.bodyColumns)
    const below = await next(e)

    return (
      <Box flexDirection="column">
        <Box flexDirection="row" columnGap={1}>
          {previews.map((preview, i) => {
            const { columns, rows } = cells[i] ?? { columns: 6, rows: 1 }

            return (
              <Box key={`tile-${preview.n}`} flexDirection="column" alignItems="center" borderStyle="round" borderDimColor>
                {preview.file ? (
                  <Image
                    key={`image-${preview.n}`}
                    source={{ file: preview.file, format: 'png' }}
                    columns={columns}
                    rows={rows}
                    alt={`[Image #${preview.n}]`}
                  />
                ) : (
                  <Box width={columns} height={rows} alignItems="center" justifyContent="center">
                    <Text dimColor wrap="truncate">no preview</Text>
                  </Box>
                )}
                <Text dimColor>#{preview.n}</Text>
              </Box>
            )
          })}
        </Box>
        {below}
      </Box>
    )
  })
}
