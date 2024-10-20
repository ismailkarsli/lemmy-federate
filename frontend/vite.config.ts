import UnpluginTypia from "@ryoppippi/unplugin-typia/vite";
import Vue from "@vitejs/plugin-vue";
import { defineConfig } from "vite";
import Vuetify, { transformAssetUrls } from "vite-plugin-vuetify";

// https://vitejs.dev/config/
export default defineConfig({
	plugins: [
		Vue({ template: { transformAssetUrls } }),
		Vuetify({ autoImport: true }),
		UnpluginTypia(),
	],
});
