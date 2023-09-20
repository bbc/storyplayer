import { defineConfig } from 'vite'
import { resolve } from 'path'
import { fileURLToPath } from 'url';
import { dirname } from 'path';

export default defineConfig(({ command, mode, ssrBuild }) => {

  const isProduction = mode === "production";
  const minify = isProduction ? "terser" : "esbuild"; // applies to src code and css
  const cssCodeSplit = true;  // set to True to force separate css file as its imported in StoryPlayer Harness
  const sourcemap = isProduction ? false : "inline";

  const __filename = fileURLToPath(import.meta.url);
  const __dirname = dirname(__filename);

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
