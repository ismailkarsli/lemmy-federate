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
    <v-layout class="rounded rounded-md">
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
                <TheHeaderAuth />
            </template>
        </v-app-bar>
        <v-main style="min-height: 300px" class="my-4">
            <div style="max-width: 1200px; margin: 0 auto">
                <RouterView />
                <v-footer class="bg-transparent text-no-wrap d-flex flex-column flex-sm-row">
                    <div>
                        <v-btn href="https://github.com/ismailkarsli/lemmy-federate" variant="text" class="text-none"
                            target="_blank">
                            <v-icon size="x-large" class="mr-2">mdi-github</v-icon>
                            Star on Github
                        </v-btn>
                        <v-btn href="https://lemmyverse.link/c/lemmyfederate@lemy.lol" variant="text" class="text-none"
                            target="_blank">
                            <img src="./assets/lemmy.svg" class="v-icon v-icon--size-x-large mr-2"></img>
                            Subscribe on Lemmy
                        </v-btn>
                    </div>
                    <v-divider></v-divider>
                    <div>
                        <strong>Lemmy Federate</strong>
                    </div>
                </v-footer>
            </div>
        </v-main>
    </v-layout>
</template>

<style scoped>
.footer-link {
    color: white;
    text-decoration: unset;
}
</style>
