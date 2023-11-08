import { defineConfig } from "vite";
import { resolve } from "path";

// https://vitejs.dev/config/
export default defineConfig({
  build: {
    target: "es2015",
    lib: {
      entry: resolve(__dirname, "src/storyplayer.ts"),
      name: "StoryPlayer",
      formats: ["es"],
    },
    rollupOptions: {
      output: {
        assetFileNames: (asset) => (
          asset.name === 'style.css' ? 'storyplayer.css' :
          asset.name as string
        ),
      },
    },
  },
});
