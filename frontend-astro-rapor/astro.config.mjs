// @ts-check
import { defineConfig } from "astro/config";
import tailwindcss from "@tailwindcss/vite";

import alpinejs from "@astrojs/alpinejs";

export default defineConfig({
  vite: {
    plugins: [tailwindcss()],
  },

  integrations: [alpinejs()],
});