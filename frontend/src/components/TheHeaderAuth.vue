<script setup lang="ts">
import { useMutation } from "@tanstack/vue-query";
import { ref } from "vue";
import { useAuthStore } from "../stores/auth";
import { trpc } from "../trpc";

const authStore = useAuthStore();

const loading = ref(false);
const menu = ref(false);
const alert = ref<{
	type: "error" | "success" | "warning" | "info";
	message: string;
}>({
	type: "warning",
	message: "A code will be sent to your account",
});
const codePrompt = ref(false);

const username = ref("");
const instance = ref("");
const code = ref("");

const { mutate: submit } = useMutation({
	mutationKey: ["login"],
	mutationFn: () =>
		trpc.auth.login.mutate({
			username: username.value,
			instance: instance.value,
			code: code.value,
		}),
	onMutate() {
		loading.value = true;
	},
	onSettled() {
		loading.value = false;
	},
	onSuccess(data) {
		if ("message" in data) {
			alert.value = {
				type: "success",
				message: data.message,
			};
			codePrompt.value = true;
			return;
		}

		authStore.authenticate(data.user);
	},
	onError(error) {
		alert.value = {
			type: "error",
			message: error.message,
		};
	},
});
function back() {
	codePrompt.value = false;
	code.value = "";
}
</script>

<template>
  <v-menu v-model="menu" :close-on-content-click="false" location="bottom">
    <template v-slot:activator="{ props }">
      <v-btn
        class="mx-1"
        v-bind="props"
        icon="mdi-account"
        title="Manage instance"
      />
    </template>

    <v-list v-if="authStore.authenticated">
      <v-list-item>
        <v-btn to="/manage" @click="menu = false">
          <v-icon>mdi-cog</v-icon>
          Manage Instance
        </v-btn>
      </v-list-item>
      <v-list-item>
        <v-btn @click="authStore.logout">
          <v-icon>mdi-logout</v-icon>
          Logout
        </v-btn>
      </v-list-item>
    </v-list>

    <form v-else @submit.prevent="submit()">
      <v-card width="360" class="px-4 py-8">
        <v-text-field
          v-model="username"
          label="Username"
          :disabled="codePrompt"
          :loading="loading"
        />
        <v-text-field
          v-model="instance"
          label="Instance"
          :disabled="codePrompt"
          :loading="loading"
        />
        <v-text-field
          v-if="codePrompt"
          v-model="code"
          label="Code"
          :loading="loading"
        />

        <v-card-actions>
          <v-spacer></v-spacer>

          <v-btn v-if="codePrompt" variant="text" @click="back">Back</v-btn>
          <v-btn type="submit" color="primary" variant="text" :loading="loading"
            >Login
          </v-btn>
        </v-card-actions>
        <v-alert v-if="alert" :type="alert.type" prominent>
          {{ alert.message }}
        </v-alert>
      </v-card>
    </form>
  </v-menu>
</template>
