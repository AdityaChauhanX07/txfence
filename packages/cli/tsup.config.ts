import { defineConfig } from 'tsup'

export default defineConfig({
  entry: ['src/index.ts'],
  format: ['esm'],
  dts: true,
  clean: true,
  sourcemap: false,
  splitting: false,
  banner: {
    js: '#!/usr/bin/env node',
  },
})
