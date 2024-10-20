<script setup lang="ts">
import { ref } from "vue";

const props = defineProps<{
  text: string;
}>();

const show = ref(false);
</script>

<template>
  <v-tooltip :text="props.text" v-model="show">
    <template v-slot:activator="{ props }">
      <v-btn
        v-bind="props"
        icon="mdi-information"
        variant="text"
        density="compact"
        @click="show = !show"
      />
    </template>
  </v-tooltip>
</template>
