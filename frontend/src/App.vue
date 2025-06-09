<script setup lang="ts">
import { onMounted } from "vue";
import { useDisplay } from "vuetify";
import { useAuthStore } from "./stores/auth";

const authStore = useAuthStore();
// save the auth state to local storage

onMounted(async () => {
	// load the auth state from local storage
	const authState = localStorage.getItem("auth-store");
	if (authState) {
		authStore.$patch(JSON.parse(authState));
	}
	authStore.$subscribe((_mutation, state) => {
		localStorage.setItem("auth-store", JSON.stringify(state));
	});
});

const { mobile: isMobile } = useDisplay();
</script>

<template>
  <v-layout class="rounded rounded-md d-flex flex-column fill-height">
    <v-app-bar title="Lemmy Federate">
      <template v-slot:append>
        <v-btn to="/" class="mx-1">
          <v-icon v-if="isMobile">mdi-account-group</v-icon>
          <span v-else>Communities</span>
        </v-btn>
        <v-btn to="/instances" class="mx-1">
          <v-icon v-if="isMobile">mdi-server-network</v-icon>
          <span v-else>Instances</span>
        </v-btn>
        <v-btn to="/manage" class="mx-1">
          <v-icon v-if="isMobile">mdi-plus</v-icon>
          <span v-else-if="authStore.authenticated">{{ `Manage ${authStore.instance?.host}` }}</span>
          <span v-else>Manage Instance</span>
        </v-btn>
      </template>
    </v-app-bar>
    <v-main class="flex-grow-1 my-4">
      <RouterView />
    </v-main>
    <v-footer class="flex-grow-0 mb-2 bg-transparent text-no-wrap d-flex flex-column flex-sm-row"
      style="margin: 0 auto; width: 100%; max-width: 1200px;">
      <div>
        <v-btn href="https://github.com/ismailkarsli/lemmy-federate" variant="text" class="text-none" target="_blank">
          <v-icon size="x-large" class="mr-2">mdi-github</v-icon>
          Star on Github
        </v-btn>
        <v-btn href="https://lemmyverse.link/c/lemmyfederate@lemy.lol" variant="text" class="text-none" target="_blank">
          <img src="./assets/lemmy.svg" class="v-icon v-icon--size-x-large mr-2"></img>
          Subscribe on Lemmy
        </v-btn>
      </div>
      <v-divider></v-divider>
      <div style="padding-right: 16px;">
        <strong>Lemmy Federate</strong>
      </div>
    </v-footer>
  </v-layout>
</template>

<style scoped>
.footer-link {
  color: white;
  text-decoration: unset;
}
</style>
