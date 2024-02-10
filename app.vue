<template>
  <NuxtLayout>
    <v-layout class="rounded rounded-md">
      <v-app-bar title="Lemmy Seeder">
        <template v-slot:append>
          <v-btn to="/" class="mx-2">Home</v-btn>
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
