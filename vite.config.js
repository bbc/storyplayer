import { defineConfig } from 'vite'
import { resolve } from 'path'
import vitePluginFlow from 'vite-plugin-flow'

export default defineConfig({
  plugins: [vitePluginFlow()],
  publicDir: 'src/assets/public',
  build: {
    target: 'es2015',
    lib: {
      entry: resolve(__dirname, 'src/storyplayer.js'),
      name: 'StoryPlayer',
      fileName: 'storyplayer',
      formats: ['cjs'],
    },
    rollupOptions: {
      output: {
        assetFileNames: "storyplayer.[ext]",
      },
    },
  },
})
