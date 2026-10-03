# peek: plan

A Claude Code mod that shows a thumbnail preview for every image pasted into the prompt, labelled `#1`, `#2`, ... to match the `[Image #N]` placeholders.

## How Claude Code handles pasted images

1. On paste, the image bytes are written to a session cache file, observed at `/private/tmp/claude-<uid>/<project-slug>/<sessionId>/images/N.png`. The prompt only gets the text placeholder `[Image #N]`.
2. On submit, the placeholders become image content blocks (base64 PNG) sent with the text. The model sees pixels; large images are downscaled, cost is roughly `width * height / 750` tokens.
3. What a mod can see:
   - `prompt.edit` fires on every edit and paste, with the draft (`text`, `cursor`, `start`, `end`, `inputText`).
   - `prompt.submit` carries `attachments: [{ type: 'image', mediaType, filename? }]`: the kind, never the bytes.
   - No event hands over the image itself. The cache file is the only path to it.

## Image display API per surface

| Surface | Element | Notes |
| --- | --- | --- |
| Terminal | `Image`, `source: { file, format: 'png' }` | The terminal reads the file itself, no bytes cross `$`. Pixels in kitty, Ghostty, iTerm2, WezTerm; `alt` text elsewhere. Also accepts `{ png: base64 }` (max 2 MiB) or raw `{ rgba, width, height }`. |
| Terminal | `Raster` | Pixel buffer drawn in cells, for generated content. Not needed here. |
| Desktop | `Svg` only (max 131,072 chars) | No `Image` element. Plan: make a thumbnail with `sips -Z 160` via `$.process`, base64 it, embed as `<svg><image href="data:image/png;base64,..."/></svg>`. Unverified: whether the desktop sanitizer keeps `data:` URIs. |
| Desktop | `Client` | A surface module drawing the plugin's own element tree; same element set, so no extra image capability. |

## Steps

### 0. Spike (throwaway, about 30 min)

A logging mod to answer:

- Does `prompt.edit` fire on an image paste, and what is `inputText`? In the terminal and in the desktop composer.
- Does the desktop composer raise `prompt.edit` at all?
- Does a `data:` PNG inside `Svg` render on desktop?
- How does a hook get the session id and project slug to build the cache path?

### 1. Track

- After each `prompt.edit`, scan the draft for `[Image #N]` and keep the list in an atom.
- Deleting a placeholder drops its preview, so the list always mirrors the draft.
- Clear on `prompt.submit`.

### 2. Resolve

Map `#N` to `<cache>/images/N.png`, confirm with `$.fs.stat`.

### 3. Render

A band above the prompt (`ui.render` on `AbovePrompt`): one thumbnail per image, labelled `#N`, wrapping to more rows when needed.

- Terminal: `<Image columns={16} rows={6} />`.
- Desktop: `Svg` from a cached `sips` thumbnail.
- Fallback: `#2 · 1658×274 · 84 KB`.

### 4. Interaction (v2)

- Button per thumbnail opens it full size (`open` via `$.process`), or in a `/peek` pane.
- ✕ removes the placeholder from the draft.

### 5. Coexist with burn

Both draw `AbovePrompt`. Each hook must call `next(e)` and stack its row with the result, not replace it. Verify burn does.

## Risks

- The cache path is internal and undocumented and may move between releases. Degrade to the text fallback.
- The desktop composer may already show thumbnails, or may not raise `prompt.edit`. The spike decides.

## Open questions

1. Terminal, desktop, or both? Terminal is the solid path; desktop depends on the spike.
2. Thumbnails only in v1, or clickable to open full size?
