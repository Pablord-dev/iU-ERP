import { defineConfig } from 'vitest/config'
import path from 'node:path'

export default defineConfig({
  test: {
    environment: 'node',
    include: ['src/**/*.test.ts'],
    /** Each suite boots its own PGlite and applies every migration; under parallel
     *  contention that setup exceeds the 10s default and fails a random subset of files. */
    hookTimeout: 30_000,
  },
  resolve: {
    alias: { '@': path.resolve(__dirname, 'src') },
  },
})
