import vuetify, { transformAssetUrls } from "vite-plugin-vuetify";
import { createRequire } from "module";
import path from "path";

// workaround for prisma client error on output: https://github.com/prisma/prisma/issues/12504#issuecomment-1599452566
const { resolve } = createRequire(import.meta.url);
const prismaClient = `prisma${path.sep}client`;
const prismaClientIndexBrowser = resolve(
  "@prisma/client/index-browser"
).replace(`@${prismaClient}`, `.${prismaClient}`);

// https://nuxt.com/docs/api/configuration/nuxt-config
export default defineNuxtConfig({
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
    "nuxt-scheduler",
    "@nuxtjs/device",
  ],
  vite: {
    vue: {
      template: {
        transformAssetUrls,
      },
    },
    resolve: {
      alias: {
        ".prisma/client/index-browser": path.relative(
          __dirname,
          prismaClientIndexBrowser
        ),
      },
    },
  },
  typescript: {
    shim: false,
  },
});
