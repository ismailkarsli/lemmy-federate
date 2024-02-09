import { createVuetify } from "vuetify";
import { defineNuxtPlugin } from "#app";
import "vuetify/styles";
import "@mdi/font/css/materialdesignicons.css";

export default defineNuxtPlugin((app) => {
  const vuetify = createVuetify({
    theme: {
      defaultTheme: "myTheme",
      themes: {
        myTheme: {
          dark: true,
          colors: {
            primary: "rgb(102, 215, 186)",
          },
        },
      },
    },
  });
  app.vueApp.use(vuetify);
});
