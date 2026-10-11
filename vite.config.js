import { defineConfig } from 'vite'

// Relative asset paths keep the static frontend deployable under a GitHub Pages project path.
export default defineConfig({
  base: './',
})
