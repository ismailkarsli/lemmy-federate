<template>
  <v-form class="rounded rounded-md" @submit.prevent="submit">
    <v-text-field
      v-model="community"
      label="Community"
      placeholder="!community@instance.tld"
      required
      hide-details
      density="compact"
      variant="underlined"
    >
      <template #append>
        <v-btn
          type="submit"
          prepend-icon="mdi-plus"
          color="primary"
          :loading="loading"
        >
          Add Community
        </v-btn>
      </template>
    </v-text-field>
  </v-form>
</template>

<script setup>
const community = ref("");
const loading = ref(false);

const submit = () => {
  loading.value = true;
  setTimeout(() => {
    community.value = "";
    loading.value = false;
  }, 2000);
};
</script>
