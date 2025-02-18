<script setup lang="ts">
import { useMutation, useQuery } from "@tanstack/vue-query";
import { computed, ref, watchEffect } from "vue";
import InfoTooltip from "../components/InfoTooltip.vue";
import { trpc } from "../trpc";
import { getHumanReadableSoftwareName, isSeedOnlySoftware } from "../lib/utils";

const instance = ref<Awaited<ReturnType<typeof trpc.instance.get.query>>>();
const { data, isPending, refetch } = useQuery({
	queryKey: ["instance"],
	queryFn: () => trpc.instance.get.query(),
});
watchEffect(async () => {
	if (data.value) {
		// clone object
		instance.value = JSON.parse(JSON.stringify(data.value));
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

const softwareSeedOnly = computed(() => {
	return isSeedOnlySoftware(instance.value?.software || "unknown");
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

const { mutate: createOauthClient } = useMutation({
	mutationKey: ["instance", "createOauthClient"],
	mutationFn: () => trpc.instance.createOauthClient.mutate(),
	onSuccess(data) {
		snackbar.value = {
			value: true,
			success: true,
			message: data.message,
		};
		refetch();
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
</script>

<template>
  <v-container v-if="instance">
    <v-app-bar-title class="mb-4">
      Manage instance
      <v-chip color="primary" class="ml-2" label>
        {{ instance.host }}
      </v-chip>
    </v-app-bar-title>
    <v-overlay :model-value="isPending" class="align-center justify-center" scrim="rgba(0, 0, 0, 0.7)">
      <v-progress-circular indeterminate color="primary" size="64" />
    </v-overlay>
    <v-alert v-if="!instance.approved" class="my-4" type="warning" variant="tonal" closable>
      Your instance is not approved yet.
      We manually check new instances to prevent spam.
      You can edit the settings until your instance is approved.
    </v-alert>

    <v-form @submit.prevent="submit()">
      <v-row>
        <v-checkbox label="Enable tool" v-model="instance.enabled" hide-details />
        <v-checkbox v-if="!softwareSeedOnly" label="Auto add local communities" v-model="instance.auto_add" hide-details />
        <v-checkbox v-if="!softwareSeedOnly" v-model="instance.cross_software" hide-details>
          <template v-slot:label>
            Cross software
            <info-tooltip>
              <p>Only federate with instances that use the same software.</p>
              <p>
                For example, as a
                {{ getHumanReadableSoftwareName(instance.software) }} instance,
                check this option to follow only
                {{ getHumanReadableSoftwareName(instance.software) }}
                instances.
              </p>
            </info-tooltip>
          </template>
        </v-checkbox>
        <v-col v-if="!softwareSeedOnly" cols="12">
          <p>Federation mode</p>
          <v-row>
            <v-checkbox label="Mutual" v-model="instance.mode" value="FULL" hide-details>
              <template v-slot:label>
                Mutual
                <info-tooltip>
                  <ul>
                    <li>
                      Your instance will follow other instance communities
                    </li>
                    <li>
                      Other instances will follow your instance communities
                    </li>
                  </ul>
                </info-tooltip>
              </template>
            </v-checkbox>
            <v-checkbox v-model="instance.mode" value="SEED" hide-details>
              <template v-slot:label>
                Seed only
                <info-tooltip>
                  <ul>
                    <li>
                      Your instance <b>won't</b> follow other instance
                      communities
                    </li>
                    <li>
                      Other instances will follow your instance communities
                    </li>
                  </ul>
                </info-tooltip>
              </template>
            </v-checkbox>
            <!-- <v-checkbox
              label="Leech only"
              v-model="instance.mode"
              value="LEECH"
              hide-details
            >
              <template v-slot:label>
                Leech only
                <info-tooltip>
                  <ul>
                    <li>
                      Your instance will follow other instance communities
                    </li>
                    <li>
                      Other instances <b>won't</b> follow your instance
                      communities
                    </li>
                  </ul>
                </info-tooltip>
              </template>
            </v-checkbox> -->
          </v-row>
        </v-col>

        <v-col v-if="!softwareSeedOnly" cols="12">
          <p>NSFW</p>
          <v-row>
            <v-checkbox label="Allow" v-model="instance.nsfw" value="ALLOW" hide-details />
            <v-checkbox label="Don't allow" v-model="instance.nsfw" value="BLOCK" hide-details />
            <v-checkbox label="Allow only NSFW" v-model="instance.nsfw" value="ONLY" hide-details />
          </v-row>
        </v-col>
        <v-col v-if="!softwareSeedOnly" cols="12">
          <p>Fediseer</p>
          <v-row>
            <v-checkbox label="Don't use" v-model="instance.fediseer" value="NONE" hide-details />
            <v-checkbox label="Don't allow censured" v-model="instance.fediseer" value="BLACKLIST_ONLY" hide-details />
            <v-checkbox label="Allow only endorsed" v-model="instance.fediseer" value="WHITELIST_ONLY" hide-details />
          </v-row>
        </v-col>
        <v-col v-if="!softwareSeedOnly" cols="12" md="6">
          <v-text-field :label="instance?.software === 'LEMMY'
            ? 'Bot username'
            : 'OAuth client id'
            " v-model="instance.client_id" hide-details />
        </v-col>
        <v-col v-if="!softwareSeedOnly" cols="12" md="6">
          <v-text-field :append-inner-icon="showPassword ? 'mdi-eye' : 'mdi-eye-off'"
            :type="showPassword ? 'text' : 'password'" @click:append-inner="showPassword = !showPassword" :label="instance?.software === 'LEMMY'
              ? 'Bot password'
              : 'OAuth client secret'
              " v-model="instance.client_secret" hide-details autocomplete="off" />
        </v-col>
        <v-col cols="12">
          <v-btn type="submit" color="primary">Save</v-btn>
          <v-menu v-if="instance.software === 'MBIN'" location="bottom">
            <template v-slot:activator="{ props }">
              <v-btn class="ml-4" append-icon="mdi-information" v-bind="props" color="blue" type="button">
                Create OAuth Client
              </v-btn>
            </template>

            <v-card min-width="300">
              <v-card-text>
                <p>
                  Lemmy Federate will try to create a OAuth client with default
                  credentials.
                </p>
                <p>
                  If your instance is limiting client creations to admins, then
                  you <b>can't</b> use this option.
                </p>
                <p>
                  You can also create your own OAuth client and use it instead.
                </p>
                <p>
                  Make sure it has <b>client_credentials</b> grant type and
                  <b>"read", "magazine", "user:profile"</b> scopes.
                </p>
              </v-card-text>
              <v-card-actions>
                <v-spacer></v-spacer>
                <v-btn variant="text">Cancel</v-btn>
                <v-btn color="primary" variant="text" @click="createOauthClient">Create
                </v-btn>
              </v-card-actions>
            </v-card>
          </v-menu>
          <v-menu v-if="!softwareSeedOnly" location="bottom">
            <template v-slot:activator="{ props }">
              <v-btn class="ml-4" append-icon="mdi-information" v-bind="props" color="error">
                Reset Subscriptions
              </v-btn>
            </template>

            <v-card min-width="300">
              <v-card-text>
                <p>
                  This will remove <b>all subscriptions</b> of the bot account.
                </p>
                <p>
                  This is useful when you change the instance settings<br></br>
                  or disabled the tool.
                </p>
                <p>
                  You may need to temporarily increase the rate limits to<br></br>
                  allow the bot to complete all unsubscriptions in bulk.
                </p>
                <p>If the tool is enabled, then it will re-subscribe later.</p>
              </v-card-text>
              <v-card-actions>
                <v-spacer></v-spacer>
                <v-btn variant="text">Cancel</v-btn>
                <v-btn color="primary" variant="text" @click="resetSubscriptions">Save</v-btn>
              </v-card-actions>
            </v-card>
          </v-menu>
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
    <v-row>
      <v-col cols="12" lg="6">
        <v-app-bar-title class="mb-2">
          Allowed instances
          <info-tooltip
            text="If you add at lease one instance, then all others will be ignored. So this list is explicit." />
        </v-app-bar-title>
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
          <info-tooltip text="Only the added instances are blocked, others continue to work." />
        </v-app-bar-title>
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
  <v-container v-else>
    <v-progress-linear indeterminate color="primary" />
  </v-container>
</template>
