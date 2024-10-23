<script setup lang="ts">
import { keepPreviousData, useMutation, useQuery } from "@tanstack/vue-query";
import { computed, ref } from "vue";
import { trpc } from "../trpc";

const community = ref("");
const loading = ref(false);
const alert = ref<{
	active: boolean;
	type: "error" | "success" | "warning" | "info";
	message: string;
}>();
const readMore = ref(false);
const page = ref(1);
const skip = computed(() => (page.value - 1) * perPage);
const perPage = 10;
const instanceId = ref<number | null>(null);

const { data, isPending, refetch } = useQuery({
	queryKey: ["communities", page, perPage, instanceId],
	placeholderData: keepPreviousData,
	queryFn: () =>
		trpc.community.find.query({
			skip: skip.value,
			take: perPage,
			instanceId: instanceId.value ?? undefined,
		}),
});

const { data: instances } = useQuery({
	queryKey: ["allInstances"],
	queryFn: () => trpc.instance.find.query({ enabledOnly: true }),
});

const communitiesWithProgress = computed(() => {
	return data.value?.communities.map((item) => {
		const federatedByUser = [];
		const federatedByBot = [];
		const inProgress = [];
		const waiting = [];
		const error = [];
		const notAllowed = [];

		for (const follow of item.follows) {
			switch (follow.status) {
				case "FEDERATED_BY_USER":
					federatedByUser.push(follow);
					break;
				case "FEDERATED_BY_BOT":
				case "IN_PROGRESS":
					federatedByBot.push(follow);
					inProgress.push(follow);
					break;
				case "WAITING":
					waiting.push(follow);
					break;
				case "ERROR":
					error.push(follow);
					break;
				case "NOT_ALLOWED":
					notAllowed.push(follow);
					break;
			}
		}
		return {
			...item,
			progress: {
				count: item.follows.length,
				federatedByUser,
				federatedByBot,
				waiting,
				inProgress,
				error,
				notAllowed,
			},
		};
	});
});

const { mutate: submit } = useMutation({
	mutationKey: ["addCommunity"],
	mutationFn: () => trpc.community.add.mutate({ community: community.value }),
	onMutate() {
		loading.value = true;
	},
	onSettled() {
		loading.value = false;
	},
	async onSuccess(data) {
		alert.value = {
			active: true,
			type: "success",
			message: data.message,
		};
		community.value = "";
		await refetch();
	},
	async onError(error) {
		alert.value = {
			active: true,
			type: "error",
			message: error.message,
		};
	},
});
</script>

<template>
  <v-container>
    <v-row>
      <v-col cols="12">
        <v-card variant="text">
          <p class="mb-4">
            Lemmy Federate is a tool to help new Lemmy/Mbin communities grow.
            <button
              @click="readMore = !readMore"
              variant="text"
              density="compact"
              class="text-primary"
            >
              {{ readMore ? "read less" : "read more" }}
            </button>
          </p>
          <v-expand-transition>
            <div v-show="readMore">
              <p class="mb-4">
                Communities in Lemmy/Mbin are <b>not federated</b> by default. So
                when you create a new community, it will only be available to
                your instance. At least 1 person from all other instances must
                follow it in order to make it available. This tool does that. It
                follows your community from all remote instances until at least
                1 other person follows it.
              </p>
              <p class="mb-4"></p>
            </div>
          </v-expand-transition>
        </v-card>
      </v-col>

      <v-col cols="12">
        <v-row dense>
          <v-col cols="12" md="6" lg="3">
            <v-card
              class="mx-auto"
              subtitle="Instances"
              :title="data?.stats.instanceCount"
            ></v-card>
          </v-col>
          <v-col cols="12" md="6" lg="3">
            <v-card
              class="mx-auto"
              subtitle="Communities"
              :title="data?.stats.communityCount"
            ></v-card>
          </v-col>
          <v-col cols="12" md="6" lg="3">
            <v-card
              class="mx-auto"
              subtitle="Federated by users"
              :title="data?.stats.completed"
            ></v-card>
          </v-col>
          <v-col cols="12" md="6" lg="3">
            <v-card
              class="mx-auto"
              subtitle="Federated by bots"
              :title="data?.stats.inprogress"
            ></v-card>
          </v-col>
        </v-row>
      </v-col>

      <v-col cols="12">
        <v-form @submit.prevent="submit()">
          <v-text-field
            v-model="community"
            label="Community"
            placeholder="!community@instance.tld"
            required
            hide-details
            density="compact"
            variant="underlined"
            :loading="loading"
          >
            <template #append>
              <v-btn
              class="mr-3"
                type="submit"
                prepend-icon="mdi-plus"
                color="primary"
                :loading="loading"
              >
                Submit
              </v-btn>
              <v-menu location="bottom left" :close-on-content-click="false">
                <template v-slot:activator="{ props }">
                  <v-btn icon="mdi-filter-variant" density="comfortable" v-bind="props" />
                </template>
                <v-card min-width="300" class="px-2 py-4">
                  <v-autocomplete
                    v-model="instanceId"
                    clearable
                    variant="filled"
                    density="default"
                    hide-details
                    label="Filter by instance"
                    :items="instances?.instances"
                    item-title="host"
                    item-value="id"
                  />
                </v-card>
              </v-menu>
            </template>
          </v-text-field>

          <v-snackbar v-if="alert" v-model="alert.active" :color="alert.type">
            {{ alert.message }}
          </v-snackbar>
        </v-form>
      </v-col>
      <v-col cols="12">
        <v-table fixed-header height="600px">
          <thead>
            <tr>
              <th class="text-left">Community</th>
              <th class="text-left">Status</th>
            </tr>
          </thead>
          <tbody>
            <tr>
              <td colspan="2" class="h-0 pa-0 position-relative">
                <v-progress-linear
                  :active="isPending"
                  indeterminate
                  absolute
                  color="primary"
                />
              </td>
            </tr>
          </tbody>
          <tbody>
            <tr v-for="item in communitiesWithProgress" :key="item.name">
              <td>
                <a
                  :href="`https://lemmyverse.link/c/${item.name}@${item.instance.host}`"
                  target="_blank"
                  class="text-primary"
                  >{{ item.name }}</a
                >@<a
                  :href="`https://${item.instance.host}`"
                  target="_blank"
                  class="text-white text-decoration-none"
                  >{{ item.instance.host }}
                </a>
              </td>
              <td>
                <div v-if="item.progress.count === 0" class="text-grey">
                  No progress
                </div>
                <template v-else>
                  <v-menu
                    v-if="item.progress.federatedByUser.length"
                    location="bottom"
                  >
                    <template v-slot:activator="{ props }">
                      <v-chip color="success" class="mr-2" v-bind="props">
                        {{ item.progress.federatedByUser.length }} federated by
                        user
                      </v-chip>
                    </template>

                    <v-card min-width="200">
                      <v-list density="compact">
                        <v-list-item
                          v-for="follow in item.progress.federatedByUser"
                          :key="follow.id"
                        >
                          <v-list-item-title>
                            {{ follow.instance.host }}
                          </v-list-item-title>
                        </v-list-item>
                      </v-list>
                    </v-card>
                  </v-menu>
                  <v-menu
                    v-if="item.progress.federatedByBot.length"
                    location="bottom"
                  >
                    <template v-slot:activator="{ props }">
                      <v-chip color="warning" class="mr-2" v-bind="props">
                        {{ item.progress.federatedByBot.length }} federated by
                        bot
                      </v-chip>
                    </template>

                    <v-card min-width="200">
                      <v-list density="compact">
                        <v-list-item
                          v-for="follow in item.progress.federatedByBot"
                          :key="follow.id"
                        >
                          <v-list-item-title>
                            <span class="mr-2">
                              {{ follow.instance.host }}
                            </span>
                            <v-tooltip
                              v-if="follow.status === 'IN_PROGRESS'"
                              text="Does not provide local subscriber count."
                            >
                              <template v-slot:activator="{ props }">
                                <v-icon
                                  v-bind="props"
                                  icon="mdi-alert"
                                  size="small"
                                  color="warning"
                                ></v-icon>
                              </template>
                            </v-tooltip>
                          </v-list-item-title>
                        </v-list-item>
                      </v-list>
                    </v-card>
                  </v-menu>
                  <v-menu v-if="item.progress.waiting.length" location="bottom">
                    <template v-slot:activator="{ props }">
                      <v-chip color="yellow" class="mr-2" v-bind="props">
                        {{ item.progress.waiting.length }} waiting to be
                        processed
                      </v-chip>
                    </template>

                    <v-card min-width="200">
                      <v-list density="compact">
                        <v-list-item
                          v-for="follow in item.progress.waiting"
                          :key="follow.id"
                        >
                          <v-list-item-title>
                            {{ follow.instance.host }}
                          </v-list-item-title>
                        </v-list-item>
                      </v-list>
                    </v-card>
                  </v-menu>
                  <v-menu v-if="item.progress.error.length" location="bottom">
                    <template v-slot:activator="{ props }">
                      <v-chip color="error" class="mr-2" v-bind="props">
                        {{ item.progress.error.length }} error
                      </v-chip>
                    </template>

                    <v-card min-width="200">
                      <v-list density="compact">
                        <v-list-item
                          v-for="follow in item.progress.error"
                          :key="follow.id"
                        >
                          <v-list-item-title>
                            {{ follow.instance.host }}
                          </v-list-item-title>
                        </v-list-item>
                      </v-list>
                    </v-card>
                  </v-menu>
                  <v-menu
                    v-if="item.progress.notAllowed.length"
                    location="bottom"
                  >
                    <template v-slot:activator="{ props }">
                      <v-chip color="grey" class="mr-2" v-bind="props">
                        {{ item.progress.notAllowed.length }} not allowed
                      </v-chip>
                    </template>

                    <v-card min-width="200">
                      <v-list density="compact">
                        <v-list-item
                          v-for="follow in item.progress.notAllowed"
                          :key="follow.id"
                        >
                          <v-list-item-title>
                            {{ follow.instance.host }}
                          </v-list-item-title>
                        </v-list-item>
                      </v-list>
                    </v-card>
                  </v-menu>
                </template>
              </td>
            </tr>
          </tbody>
        </v-table>
        <v-pagination
          v-model="page"
          :length="Math.ceil((data?.stats.communityCount || 0) / perPage)"
        ></v-pagination>
      </v-col>
    </v-row>
  </v-container>
</template>
