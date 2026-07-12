import { defineConfig } from 'vite'
import tsConfigPaths from 'vite-tsconfig-paths'
import { tanstackStart } from '@tanstack/react-start/plugin/vite'
import { nitro } from 'nitro/vite'
import viteReact from '@vitejs/plugin-react'

export default defineConfig({
  plugins: [
    tsConfigPaths({ projects: ['./tsconfig.json'] }),
    // tanstackStart must come before viteReact.
    // nitro emits the host-specific server output: it auto-detects Vercel
    // (.vercel/output) in Vercel's CI, and falls back to a Node server
    // (.output/server/index.mjs) elsewhere.
    tanstackStart(),
    nitro(),
    viteReact(),
  ],
})
