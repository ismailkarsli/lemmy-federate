<script setup lang="ts">
const { data: instance, pending, refresh } = useFetch("/api/instance");
const { data: allInstances } = useFetch("/api/instance/all");
const snackbar = ref({
	value: false,
	success: false,
	message: "",
});
const showPassword = ref(false);
const allowedInstance = ref<number | null>(null);

const filteredAllInstances = computed(() => {
	if (instance) {
		return allInstances.value?.instances.filter(
			(i) => !instance.value?.allowed.some((a) => a.id === i.id),
		);
	}
	return [];
});

const submit = async () => {
	try {
		await $fetch("/api/instance", {
			method: "POST",
			headers: {
				"Content-Type": "application/json",
			},
			body: JSON.stringify(instance.value),
		});
		snackbar.value = {
			value: true,
			success: true,
			message: "Instance settings saved",
		};
	} catch (error) {
		if (isFetchError(error)) {
			snackbar.value = {
				value: true,
				success: false,
				message: error.data.message || error.message,
			};
		} else throw error;
	}
};

const resetSubscriptions = async () => {
	try {
		const res = await $fetch("/api/instance/reset-subscriptions", {
			method: "GET",
		});
		snackbar.value = {
			value: true,
			success: true,
			message: res.message,
		};
	} catch (error) {
		if (isFetchError(error)) {
			snackbar.value = {
				value: true,
				success: false,
				message: error.data.message || error.message,
			};
		} else throw error;
	}
};

watchEffect(async () => {
	try {
		if (allowedInstance.value) {
			const res = await $fetch("/api/instance/allowed", {
				method: "PUT",
				headers: {
					"Content-Type": "application/json",
				},
				body: JSON.stringify({
					instanceId: allowedInstance.value,
				}),
			});
			allowedInstance.value = null;
			await refresh();
			snackbar.value = {
				value: true,
				success: true,
				message: res.message,
			};
		}
	} catch (error) {
		if (isFetchError(error)) {
			snackbar.value = {
				value: true,
				success: false,
				message: error.data.message || error.message,
			};
		} else throw error;
	}
});

const deleteAllowed = async (id: number) => {
	try {
		const data = await $fetch("/api/instance/allowed", {
			method: "DELETE",
			headers: {
				"Content-Type": "application/json",
			},
			body: JSON.stringify({
				instanceId: id,
			}),
		});
		await refresh();
		snackbar.value = {
			value: true,
			success: true,
			message: data.message,
		};
	} catch (error) {
		if (isFetchError(error)) {
			snackbar.value = {
				value: true,
				success: false,
				message: error.data.message || error.message,
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
    <v-overlay
      :model-value="pending"
      class="align-center justify-center"
      scrim="rgba(0, 0, 0, 0.7)"
    >
      <v-progress-circular indeterminate color="primary" size="64" />
    </v-overlay>

    <v-form @submit.prevent="submit">
      <v-row>
        <v-checkbox
          label="Enable tool"
          v-model="instance.enabled"
          hide-details
        />
        <v-checkbox
          label="Auto add local communities"
          v-model="instance.auto_add"
          hide-details
        />
        <v-col cols="12">
          <p>NSFW</p>
          <v-row>
            <v-checkbox
              label="Allow"
              v-model="instance.nsfw"
              value="ALLOW"
              hide-details
            />
            <v-checkbox
              label="Don't allow"
              v-model="instance.nsfw"
              value="BLOCK"
              hide-details
            />
            <v-checkbox
              label="Allow only NSFW"
              v-model="instance.nsfw"
              value="ONLY"
              hide-details
            />
          </v-row>
        </v-col>
        <v-col cols="12">
          <p>Fediseer</p>
          <v-row>
            <v-checkbox
              label="Don't use"
              v-model="instance.fediseer"
              value="NONE"
              hide-details
            />
            <v-checkbox
              label="Don't allow censured"
              v-model="instance.fediseer"
              value="BLACKLIST_ONLY"
              hide-details
            />
            <v-checkbox
              label="Allow only endorsed"
              v-model="instance.fediseer"
              value="WHITELIST_ONLY"
              hide-details
            />
          </v-row>
        </v-col>
        <v-col cols="12" md="6">
          <v-text-field
            label="Bot username"
            v-model="instance.bot_name"
            hide-details
          />
        </v-col>
        <v-col cols="12" md="6">
          <v-text-field
            :append-inner-icon="showPassword ? 'mdi-eye' : 'mdi-eye-off'"
            :type="showPassword ? 'text' : 'password'"
            @click:append-inner="showPassword = !showPassword"
            label="Bot password"
            v-model="instance.bot_pass"
            hide-details
            autocomplete="off"
          />
        </v-col>
        <v-col cols="12">
          <v-btn type="submit" color="primary">Save</v-btn>
          <!-- client only coz: https://github.com/vuetifyjs/vuetify/issues/15323 -->
          <v-menu location="bottom">
            <template v-slot:activator="{ props }">
              <v-btn
                class="ml-4"
                append-icon="mdi-information"
                v-bind="props"
                color="error"
              >
                Reset Subscriptions
              </v-btn>
            </template>

            <v-card min-width="300">
              <v-card-text>
                <p>
                  This will remove <b>all subscriptions</b> of the bot account.
                </p>
                <p>
                  This is useful when you change the instance settings<br />
                  or disabled the tool.
                </p>
                <p>If the tool is enabled, then it will re-subscribe later.</p>
              </v-card-text>
              <v-card-actions>
                <v-spacer></v-spacer>
                <v-btn variant="text">Cancel</v-btn>
                <v-btn
                  color="primary"
                  variant="text"
                  @click="resetSubscriptions"
                  >Save</v-btn
                >
              </v-card-actions>
            </v-card>
          </v-menu>
        </v-col>
      </v-row>
      <v-snackbar
        v-model="snackbar.value"
        :color="snackbar.success ? 'primary' : 'error'"
      >
        {{ snackbar.message }}
        <template v-slot:actions>
          <v-btn icon="mdi-close" @click="snackbar.value = false" />
        </template>
      </v-snackbar>
    </v-form>
    <v-divider class="my-4" />
    <v-row>
      <v-col cols="12">
        <v-app-bar-title>
          Allowed instances
          <info-tooltip
            text="If you add at lease one instance, then all others will be ignored. So this list is explicit."
          />
        </v-app-bar-title>
      </v-col>
      <v-col cols="12">
        <v-autocomplete
          label="Search an instance"
          v-model="allowedInstance"
          :items="filteredAllInstances"
          item-title="host"
          item-value="id"
        />
      </v-col>
      <v-col cols="12">
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
    </v-row>
  </v-container>
  <v-container v-else>
    <v-progress-linear indeterminate color="primary" />
  </v-container>
</template>
