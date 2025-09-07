<script setup lang="ts">
import { useMutation, useQuery } from "@tanstack/vue-query";
import { computed, ref, watch, watchEffect } from "vue";
import { useRouter } from "vue-router";
import { getHumanReadableSoftwareName, isGenericAP } from "../lib/utils";
import { useAuthStore } from "../stores/auth";
import { trpc } from "../trpc";

const authStore = useAuthStore();
const router = useRouter();

const instance = ref<Awaited<ReturnType<typeof trpc.instance.get.query>>>();
const { data, isPending, refetch, error } = useQuery({
	queryKey: ["instance"],
	queryFn: () => trpc.instance.get.query(),
	retry: false,
});
watchEffect(async () => {
	if (data.value) {
		// clone object
		instance.value = JSON.parse(JSON.stringify(data.value));
	}
});
watch(error, async () => {
	if (error.value?.message.includes("Unauthorized")) {
		await authStore.logout();
		router.push("/authenticate");
	}
});
const { data: allInstances } = useQuery({
	queryKey: ["allInstances"],
	queryFn: () => trpc.instance.find.query(),
});
const snackbar = ref({
	value: false,
	success: false,
	message: "",
});
const showPassword = ref(false);
const allowedInstance = ref<number | null>(null);
const blockedInstance = ref<number | null>(null);
const showHints = ref<boolean>(true);

const isGeneric = computed(() => {
	return isGenericAP(instance.value?.software || "unknown");
});
const filteredAllInstances = computed(() => {
	if (instance) {
		return allInstances.value?.instances.filter(
			(i) =>
				!instance.value?.allowed.some((a) => a.id === i.id) &&
				!instance.value?.blocked.some((b) => b.id === i.id),
		);
	}
	return [];
});

const { mutate: submit } = useMutation({
	mutationKey: ["updateInstance"],
	// biome-ignore lint/style/noNonNullAssertion: todo fix this
	mutationFn: () => trpc.instance.update.mutate(instance.value!),
	onSuccess() {
		snackbar.value = {
			value: true,
			success: true,
			message: "Instance settings saved",
		};
	},
	onError(error) {
		snackbar.value = {
			value: true,
			success: false,
			message: error.message,
		};
	},
});

const { mutate: resetSubscriptions } = useMutation({
	mutationKey: ["instance", "resetSubscriptions"],
	mutationFn: () => trpc.instance.resetSubscriptions.query(),
	onSuccess(data) {
		snackbar.value = {
			value: true,
			success: true,
			message: data.message,
		};
	},
	onError(error) {
		snackbar.value = {
			value: true,
			success: false,
			message: error.message,
		};
	},
});

watchEffect(async () => {
	try {
		if (allowedInstance.value) {
			const res = await trpc.instance.allowed.add.mutate({
				instanceId: allowedInstance.value,
			});
			allowedInstance.value = null;
			await refetch();
			snackbar.value = {
				value: true,
				success: true,
				message: res.message,
			};
		}
	} catch (error) {
		if (error instanceof Error) {
			snackbar.value = {
				value: true,
				success: false,
				message: error.message,
			};
		} else throw error;
	}
});
watchEffect(async () => {
	try {
		if (blockedInstance.value) {
			const res = await trpc.instance.blocked.add.mutate({
				instanceId: blockedInstance.value,
			});
			blockedInstance.value = null;
			await refetch();
			snackbar.value = {
				value: true,
				success: true,
				message: res.message,
			};
		}
	} catch (error) {
		if (error instanceof Error) {
			snackbar.value = {
				value: true,
				success: false,
				message: error.message,
			};
		} else throw error;
	}
});

const deleteAllowed = async (id: number) => {
	try {
		const data = await trpc.instance.allowed.delete.mutate({
			instanceId: id,
		});
		await refetch();
		snackbar.value = {
			value: true,
			success: true,
			message: data.message,
		};
	} catch (error) {
		if (error instanceof Error) {
			snackbar.value = {
				value: true,
				success: false,
				message: error.message,
			};
		} else throw error;
	}
};
const deleteBlocked = async (id: number) => {
	try {
		const data = await trpc.instance.blocked.delete.mutate({
			instanceId: id,
		});
		await refetch();
		snackbar.value = {
			value: true,
			success: true,
			message: data.message,
		};
	} catch (error) {
		if (error instanceof Error) {
			snackbar.value = {
				value: true,
				success: false,
				message: error.message,
			};
		} else throw error;
	}
};

const logout = () => {
	authStore.logout();
	router.push("/");
};
</script>

<template>
  <v-alert v-if="error" class="my-4" type="warning" variant="tonal">
    {{ error.message }}
  </v-alert>
  <v-container v-if="instance">
    <v-app-bar-title>
      <div class="d-flex justify-space-between">
        <div>
          Manage instance
          <v-chip color="primary" class="ml-2" label>
            {{ instance.host }}
          </v-chip>
          <v-btn class="text-lowercase" variant="plain" density="compact" size="small" @click="logout">Logout</v-btn>
        </div>
        <v-checkbox label="Show hints" color="primary" v-model="showHints" hide-details />
      </div>
    </v-app-bar-title>
    <v-overlay :model-value="isPending" class="align-center justify-center" scrim="rgba(0, 0, 0, 0.7)">
      <v-progress-circular indeterminate color="primary" size="64" />
    </v-overlay>

    <v-form @submit.prevent="submit()">
      <v-row>
        <v-col cols="12">
          <v-row>
            <v-checkbox label="Enable tool" v-model="instance.enabled" hide-details />
            <v-checkbox v-if="!isGeneric" label="Auto add communities" v-model="instance.auto_add" hide-details />
            <v-checkbox v-if="!isGeneric" label="Cross software" v-model="instance.cross_software" hide-details />
          </v-row>
          <v-alert v-if="showHints && !isGeneric" type="info" color="primary" variant="text" density="compact" class="mt-2">
            <p>
              <strong>Auto add communities</strong>: Lemmy Federate will regularly check your instance and add any
              communities it finds automatically.
            </p>
            <p>
              <strong>Cross software</strong>:
              Allow the bot to federate with instances that use other types of Fediverse software than yours.
            </p>
            <p>
              For example, as a
              {{ getHumanReadableSoftwareName(instance.software) }} instance,
              tick this option to follow instances other than
              {{ getHumanReadableSoftwareName(instance.software) }}
              such as
              {{["lemmy", "mbin", "NodeBB"].filter(s => s !==
                instance?.software).map(getHumanReadableSoftwareName).join(", ")}}.
            </p>
          </v-alert>
        </v-col>
        <v-col v-if="!isGeneric" cols="12">
          <p>Federation mode</p>
          <v-row>
            <v-checkbox label="Mutual" v-model="instance.mode" value="FULL" hide-details />
            <v-checkbox label="Seed only" v-model="instance.mode" value="SEED" hide-details />
          </v-row>
          <v-alert v-if="showHints" type="info" color="primary" variant="text" density="compact">
            <p>
              <strong>Mutual:</strong> Your instance will both follow and be followed by other instances.
            </p>
            <p>
              <strong>Seed only:</strong> Your instance will not follow other instances' communities, but others can
              follow yours.
            </p>
          </v-alert>
        </v-col>

        <v-col v-if="!isGeneric" cols="12">
          <p>NSFW</p>
          <v-row>
            <v-checkbox label="Allow" v-model="instance.nsfw" value="ALLOW" hide-details />
            <v-checkbox label="Don't allow" v-model="instance.nsfw" value="BLOCK" hide-details />
            <v-checkbox label="Allow only NSFW" v-model="instance.nsfw" value="ONLY" hide-details />
          </v-row>
        </v-col>
        <v-col v-if="!isGeneric" cols="12">
          <p>Fediseer</p>
          <v-row>
            <v-checkbox label="Don't use" v-model="instance.fediseer" value="NONE" hide-details />
            <v-checkbox label="Don't allow censured" v-model="instance.fediseer" value="BLACKLIST_ONLY" hide-details />
            <v-checkbox label="Allow only endorsed" v-model="instance.fediseer" value="WHITELIST_ONLY" hide-details />
          </v-row>
        </v-col>
        <v-col v-if="!isGeneric" cols="12" md="6">
          <v-text-field :label="instance?.software === 'mbin'
            ? 'OAuth client id'
            : 'Bot username'
            " v-model="instance.client_id" hide-details />
        </v-col>
        <v-col v-if="!isGeneric" cols="12" md="6">
          <v-text-field :append-inner-icon="showPassword ? 'mdi-eye' : 'mdi-eye-off'"
            :type="showPassword ? 'text' : 'password'" @click:append-inner="showPassword = !showPassword" :label="instance?.software === 'mbin'
              ? 'OAuth client secret'
              : 'Bot password'
              " v-model="instance.client_secret" hide-details autocomplete="off" />
        </v-col>
        <v-col cols="12">
          <v-btn type="submit" color="primary">Save</v-btn>
          <v-menu v-if="!isGeneric" location="bottom">
            <template v-slot:activator="{ props }">
              <v-btn class="ml-4" v-bind="props" color="error">
                Reset Subscriptions
              </v-btn>
            </template>

            <v-card min-width="300">
              <v-card-text>
                Are you sure you want to continue?
              </v-card-text>
              <v-card-actions>
                <v-spacer></v-spacer>
                <v-btn variant="text">No</v-btn>
                <v-btn color="primary" variant="text" @click="resetSubscriptions">Yes</v-btn>
              </v-card-actions>
            </v-card>
          </v-menu>
          <v-alert v-if="showHints && !isGeneric" type="info" color="primary" variant="text" density="compact">
            <strong>Reset subscriptions</strong>:
            The bot will unsubscribe from all communities. This can be useful when you want to disable the tool.
            If the tool is enabled, then it will re-subscribe later.
          </v-alert>
        </v-col>
      </v-row>
      <v-snackbar v-model="snackbar.value" :color="snackbar.success ? 'primary' : 'error'">
        {{ snackbar.message }}
        <template v-slot:actions>
          <v-btn icon="mdi-close" @click="snackbar.value = false" />
        </template>
      </v-snackbar>
    </v-form>
    <v-divider class="my-4" />
    <v-row style="min-height: 16em">
      <v-col cols="12" lg="6">
        <v-app-bar-title class="mb-2">
          Allowed instances
        </v-app-bar-title>
        <v-alert v-if="showHints" type="info" color="primary" variant="text" density="compact">
          This list is explicit: if you add at least one instance, all others will be blocked.
        </v-alert>
        <v-autocomplete label="instance to allow..." v-model="allowedInstance" :items="filteredAllInstances"
          item-title="host" item-value="id" />
        <v-row>
          <v-col v-for="i in instance.allowed" :key="i.id" class="flex-grow-0">
            <v-chip class="mr-2" color="primary" label>
              {{ i.host }}
              <template v-slot:close>
                <v-icon @click.prevent="deleteAllowed(i.id)">mdi-close</v-icon>
              </template>
            </v-chip>
          </v-col>
        </v-row>
      </v-col>
      <v-col cols="12" lg="6">
        <v-app-bar-title class="mb-2">
          Blocked instances
        </v-app-bar-title>
        <v-alert v-if="showHints" type="info" color="primary" variant="text" density="compact">
          Unlike the allow list, you will continue to follow instances other than those you block.
        </v-alert>
        <v-autocomplete label="instance to block..." v-model="blockedInstance" :items="filteredAllInstances"
          item-title="host" item-value="id" />
        <v-row>
          <v-col v-for="i in instance.blocked" :key="i.id" class="flex-grow-0">
            <v-chip class="mr-2" color="error" label>
              {{ i.host }}
              <template v-slot:close>
                <v-icon @click.prevent="deleteBlocked(i.id)">mdi-close</v-icon>
              </template>
            </v-chip>
          </v-col>
        </v-row>
      </v-col>
    </v-row>
  </v-container>
  <v-container v-else-if="!error">
    <v-progress-linear indeterminate color="primary" />
  </v-container>
</template>
