import { VueQueryPlugin } from "@tanstack/vue-query";
import { createPinia } from "pinia";
import { createApp } from "vue";
import { createRouter, createWebHistory } from "vue-router";
import { createVuetify } from "vuetify";
import "vuetify/styles";
import "@mdi/font/css/materialdesignicons.css";

import App from "./App.vue";
import HomePage from "./pages/home.vue";
import InstancesPage from "./pages/instances.vue";
import ManagePage from "./pages/manage.vue";

const vuetify = createVuetify({
	theme: {
		defaultTheme: "defaultDark",
		themes: {
			defaultDark: {
				dark: true,
				colors: {
					primary: "rgb(102, 215, 186)",
				},
			},
		},
	},
});

const routes = [
	{ path: "/", component: HomePage },
	{ path: "/instances", component: InstancesPage },
	{ path: "/manage", component: ManagePage },
];

const router = createRouter({
	history: createWebHistory(),
	routes,
});
const pinia = createPinia();

const app = createApp(App);
app.use(pinia);
app.use(router);
app.use(VueQueryPlugin);
app.use(vuetify);
app.mount("#app");
