import { atom, read, update } from 'claude-code'
import type { EngineInterface, Register } from 'claude-code'

import type { Preview } from '../types'
import { isSame, label, placeholders } from './images'

const previewsAtom = atom({ plugin: 'peek', key: 'previews' } as const, [])

// Claude Code writes each pasted image to /tmp/claude-<uid>/<project-slug>/<sessionId>/images/N.png.
// The path is internal and may move between releases; when it does, peek falls back to text labels.
async function findImagesDir($: EngineInterface): Promise<string | null> {
  const sessionId = await $.session.id()
  const roots = (await $.fs.list('/tmp').catch(() => [])).filter(entry => entry.name.startsWith('claude-'))

  for (const root of roots) {
    const projects = await $.fs.list(`/tmp/${root.name}`).catch(() => [])

    for (const project of projects) {
      const dir = `/tmp/${root.name}/${project.name}/${sessionId}/images`

      if (await $.fs.exists(dir)) {
        return dir
      }
    }
  }

  return null
}

// Only cached once found: the folder appears with the session's first paste
let imagesDir: string | null = null

async function resolvePreview($: EngineInterface, n: number, known: Preview[]): Promise<Preview> {
  const previous = known.find(preview => preview.n === n)

  if (previous?.file) {
    return previous
  }

  imagesDir ??= await findImagesDir($)

  if (!imagesDir) {
    return { n, file: null, size: null }
  }

  const file = `${imagesDir}/${n}.png`
  const stat = await $.fs.stat(file).catch(() => null)

  return stat?.kind === 'file' ? { n, file, size: stat.size } : { n, file: null, size: null }
}

export const register: Register = on => {
  on('prompt.edit', async ($, e, next) => {
    const result = await next(e)
    const known = await read($, previewsAtom)
    const numbers = placeholders(result.text)

    if (numbers.length === 0 && known.length === 0) {
      return result
    }

    const previews = await Promise.all(numbers.map(n => resolvePreview($, n, known)))

    if (!isSame(previews, known)) {
      await update($, previewsAtom, () => previews)
    }

    return result
  })

  on('prompt.submit', async ($, e, next) => {
    await update($, previewsAtom, () => [])

    return next(e)
  })

  on('ui.render', { component: 'AbovePrompt' }, async ($, e, next) => {
    // The desktop composer already shows its own thumbnails
    if (e.surface !== 'terminal') {
      return next(e)
    }

    const below = await next(e)
    const previews = await read($, previewsAtom)

    if (e.props.hasSurvey || previews.length === 0) {
      return below
    }

    const elements = $.ui.resolve(e)
    const { Box, Text } = elements

    // Terminals without an image protocol draw the alt text instead
    const thumbnail = (preview: Preview) =>
      preview.file && 'Image' in elements ? (
        <Box key={`#${preview.n}`} flexDirection="column">
          <elements.Image
            key={`image-${preview.n}`}
            source={{ file: preview.file, format: 'png' }}
            columns={16}
            rows={6}
            alt={label(preview)}
          />
          <Text dimColor>#{preview.n}</Text>
        </Box>
      ) : (
        <Text key={`#${preview.n}`} dimColor>
          {label(preview)}
        </Text>
      )

    return (
      <Box flexDirection="column">
        <Box flexDirection="row" flexWrap="wrap" columnGap={2}>
          {previews.map(thumbnail)}
        </Box>
        {below}
      </Box>
    )
  })
}
