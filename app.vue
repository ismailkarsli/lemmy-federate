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
</script>

<template>
  <NuxtLayout>
    <v-layout class="rounded rounded-md">
      <v-app-bar title="Lemmy Federate">
        <template v-slot:append>
          <v-btn to="/" class="mx-2">Communities</v-btn>
          <v-btn to="/instances" class="mx-2">Instances</v-btn>
          <TheHeaderAuth />
        </template>
      </v-app-bar>
      <v-main
        style="min-height: 300px; max-width: 800px; margin: 0 auto"
        class="my-4"
      >
        <NuxtPage />
      </v-main>
    </v-layout>
  </NuxtLayout>
</template>
