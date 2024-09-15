import vuetify, { transformAssetUrls } from "vite-plugin-vuetify";

// https://nuxt.com/docs/api/configuration/nuxt-config
export default defineNuxtConfig({
	compatibilityDate: "2024-09-15",
	app: {
		head: {
			charset: "utf-8",
			viewport: "width=device-width, initial-scale=1",
		},
	},
	build: {
		transpile: ["vuetify"],
	},
	devtools: { enabled: true },
	modules: [
		(_options, nuxt) => {
			nuxt.hooks.hook("vite:extendConfig", (config) => {
				// @ts-expect-error
				config.plugins.push(vuetify({ autoImport: true }));
			});
		},
		"@pinia/nuxt",
		"@nuxtjs/device",
		"@prisma/nuxt",
	],
	vite: {
		vue: {
			template: {
				transformAssetUrls,
			},
		},
	},
	typescript: {
		shim: false,
	},
});
