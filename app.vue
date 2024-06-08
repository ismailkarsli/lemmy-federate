<script setup lang="ts">
const authStore = useAuthStore();
// save the auth state to local storage

onMounted(async () => {
  // load the auth state from local storage
  if (process.client) {
    const authState = localStorage.getItem("auth-store");
    if (authState) {
      authStore.$patch(JSON.parse(authState));
    }
    authStore.$subscribe((_mutation, state) => {
      localStorage.setItem("auth-store", JSON.stringify(state));
    });
  }
});

const { isMobile } = useDevice();

useHead({
  title: "Lemmy Federate",
  meta: [
    {
      name: "description",
      content:
        "Lemmy Federate is a tool to federate new communities in the Lemmyverse.",
    },
  ],
});
useSeoMeta({
  title: "Lemmy Federate",
  ogTitle: "Lemmy Federate",
  description:
    "Lemmy Federate is a tool to federate new communities in the Lemmyverse.",
  ogDescription:
    "Lemmy Federate is a tool to federate new communities in the Lemmyverse.",
});
</script>

<template>
  <NuxtLayout>
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
          <NuxtLink
            href="https://github.com/ismailkarsli/lemmy-federate"
            class="github-link"
            target="_blank"
            title="Source code"
          >
            <v-btn class="mx-1" icon="mdi-github" />
          </NuxtLink>
          <TheHeaderAuth />
        </template>
      </v-app-bar>
      <v-main style="min-height: 300px" class="my-4">
        <div style="max-width: 1200px; margin: 0 auto">
          <NuxtPage />
        </div>
      </v-main>
    </v-layout>
  </NuxtLayout>
</template>

<style scoped>
.github-link {
  color: white;
}
</style>
