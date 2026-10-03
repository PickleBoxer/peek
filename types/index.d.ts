export type Preview = { n: number; file: string | null; size: number | null }

declare module 'claude-code' {
  interface PluginState {
    peek: { previews: Preview[] }
  }
}
