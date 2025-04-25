<script setup lang="ts">
import { ref } from "vue";

const props = defineProps<{
	text?: string;
	icon?: string;
}>();

const show = ref(false);
</script>

<template>
  <v-tooltip :text="props.text" v-model="show">
    <template v-slot:activator="{ props }">
      <v-btn
        v-bind="props"
        :icon="icon || 'mdi-information'"
        variant="text"
        density="compact"
        @click="show = !show"
      />
    </template>
    <template v-slot:default>
      <span v-if="props.text">{{ props.text }}</span>
      <slot v-else />
    </template>
  </v-tooltip>
</template>
