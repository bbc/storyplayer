import { defineConfig } from 'vite'
import { resolve } from 'path'

export default defineConfig({
  publicDir: 'src/assets/public',
  build: {
    target: 'es2015',
    lib: {
      entry: resolve(__dirname, 'src/storyplayer.ts'),
      name: 'StoryPlayer',
      fileName: (format) => `storyplayer.js`,
      formats: ['cjs'],
    },
    rollupOptions: {
      output: {
        assetFileNames: "storyplayer.[ext]",
      },
    },
  },
})
