import { defineConfig } from 'tsup'

export default defineConfig([
  // Core (framework-independent)
  {
    entry: { index: 'src/index.ts' },
    format: ['esm', 'cjs'],
    dts: true,
    sourcemap: true,
    clean: true,
    external: ['react', 'react-dom'],
  },
  // React bindings
  {
    entry: { react: 'src/react/index.ts' },
    format: ['esm', 'cjs'],
    dts: true,
    sourcemap: true,
    external: ['react', 'react-dom'],
  },
  // Default UI components
  {
    entry: { ui: 'src/ui/index.ts' },
    format: ['esm', 'cjs'],
    dts: true,
    sourcemap: true,
    external: ['react', 'react-dom', 'react-virtuoso'],
    async onSuccess() {
      const fs = await import('fs/promises')
      await fs.mkdir('dist/ui', { recursive: true })
      await fs.copyFile('src/ui/style.css', 'dist/ui/style.css')
    },
  },
])
