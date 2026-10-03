export type Size = { width: number; height: number }

export type Preview = { n: number; file: string | null; size: Size | null }

declare module 'claude-code' {
  interface PluginState {
    peek: { previews: Preview[] }
  }
}
