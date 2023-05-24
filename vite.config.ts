import { defineConfig } from "vite";
import { svelte } from "@sveltejs/vite-plugin-svelte";
import legacy from "@vitejs/plugin-legacy";

export default defineConfig({
	plugins: [svelte(), legacy({ targets: ["> 0.1%", "IE 9"] })],
});
