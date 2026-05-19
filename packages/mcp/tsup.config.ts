import { defineConfig } from 'tsup'

export default defineConfig([
  {
    entry: ['src/index.ts'],
    format: ['esm'],
    dts: true,
    clean: true,
    sourcemap: false,
    splitting: false,
  },
  {
    entry: { bin: 'src/bin.ts' },
    format: ['esm'],
    dts: false,
    sourcemap: false,
    splitting: false,
    banner: {
      js: '#!/usr/bin/env node',
    },
  },
])
