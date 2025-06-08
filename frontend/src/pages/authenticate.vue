<script setup lang="ts">
import { useMutation } from "@tanstack/vue-query";
import { ref } from "vue";
import { useRouter } from "vue-router";
import { useAuthStore } from "../stores/auth";
import { trpc } from "../trpc";

const authStore = useAuthStore();
const router = useRouter();

const alert = ref<{
	type: "error" | "success" | "warning" | "info";
	message: string;
}>();
const privateKey = ref<string | null>(null);
const publicKey = ref<string | null>(null);

const instance = ref("");
const apiKey = ref("");

const { mutate: submit, isPending } = useMutation({
	mutationKey: ["login"],
	mutationFn: () =>
		trpc.auth.login.mutate({
			instance: instance.value,
			apiKey: apiKey.value,
		}),
	onMutate() {
		alert.value = undefined;
	},
	onSuccess(data) {
		if ("publicKey" in data) {
			privateKey.value = data.privateKey;
			publicKey.value = data.publicKey;
			apiKey.value = data.privateKey;
			return;
		}

		authStore.authenticate(data.instance);
		router.push("/manage");
	},
	onError(error) {
		alert.value = {
			type: "error",
			message: error.message,
		};
	},
});
</script>

<template>
<v-container width="640">
    <v-app-bar-title class="mb-4">
        Manage instance
    </v-app-bar-title>
    <v-form @submit.prevent="submit()">
        <v-text-field
          v-model="instance"
          label="Instance"
          :loading="isPending"
        />
        <v-text-field
          v-model="apiKey"
          label="API Key (optional)"
          :loading="isPending"
        />

        <v-card-actions>
          <v-spacer></v-spacer>
          <v-btn type="submit" color="primary" variant="text"
            >Login
          </v-btn>
        </v-card-actions>
        <v-alert v-if="alert" :type="alert.type" prominent>
          {{ alert.message }}
        </v-alert>
        <div v-if="publicKey && privateKey">
          <p class="my-2">
          API key generated successfully. To use it, add the following TXT record to your instance's DNS.
          </p>
          <v-text-field :value="`lemmy-federate-verification=${publicKey}`" variant="solo" density="compact" hide-details></v-text-field>
          <p class="mt-4 mb-2">
            You can then log in using this API key. Make sure you save it.
          </p>
          <v-text-field :value="privateKey" variant="solo" density="compact" hide-details></v-text-field>
        </div>
        <div v-else-if="!apiKey">
          If you have not created an API key before, you can leave that field blank.
        </div>
    </v-form>
</v-container>
</template>
