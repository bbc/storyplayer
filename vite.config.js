import { defineConfig } from 'vite'
import { resolve } from 'path'

export default defineConfig(({ command, mode, ssrBuild }) => {

  const isProduction = mode === "production";
  const minify = isProduction ? "terser" : "esbuild"; // applies to src code and css
  const cssCodeSplit = isProduction;
  const sourcemap = isProduction ? false : "inline";

  return {
    build: {
      target: 'es2015',
      cssCodeSplit,
      minify,
      sourcemap,
      lib: {
        entry: resolve(__dirname, 'src/storyplayer.ts'),
        name: 'StoryPlayer',
        fileName: (format, entryName) => `${entryName}.js`,
        formats: ['es'],
      },
      rollupOptions: {
        output: {
          assetFileNames: "storyplayer.[ext]",
        },
      },
    },
  }
})
