<script setup lang="ts">
import { CommunityFollowStatus } from "@prisma/client";

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

const { data, pending, refresh } = useFetch("/api/community", {
  query: {
    skip,
    take: perPage,
  },
});

const communitiesWithProgress = computed(() => {
  return data.value?.communities.map((item) => {
    const finished = [],
      inProgress = [],
      error = [],
      notAllowed = [];

    for (const follow of item.follows) {
      switch (follow.status) {
        case CommunityFollowStatus.DONE:
          finished.push(follow);
          break;
        case CommunityFollowStatus.IN_PROGRESS:
          inProgress.push(follow);
          break;
        case CommunityFollowStatus.ERROR:
          error.push(follow);
          break;
        case CommunityFollowStatus.NOT_ALLOWED:
          notAllowed.push(follow);
          break;
      }
    }
    return {
      ...item,
      progress: {
        count: item.follows.length,
        finished,
        inProgress,
        error,
        notAllowed,
      },
    };
  });
});

const submit = async () => {
  try {
    loading.value = true;
    const data = await $fetch("/api/community", {
      method: "POST",
      body: {
        community: community.value,
      },
    });

    alert.value = {
      active: true,
      type: "success",
      message: data.message,
    };
    community.value = "";
    await refresh();
  } catch (error) {
    if (isFetchError(error)) {
      alert.value = {
        active: true,
        type: "error",
        message: error.data.message || error.message,
      };
    } else throw error;
  } finally {
    loading.value = false;
  }
};

onMounted(() => {
  setInterval(() => refresh(), 15000);
});
</script>

<template>
  <v-container>
    <v-row>
      <v-col cols="12">
        <v-card variant="text">
          <p class="mb-4">
            Lemmy Federate is a tool to federate new communities in the
            Lemmyverse.
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
                Communities in Lemmy are <b>not federated</b> by default. So
                when you create a new community, it will only be available to
                your instance. At least 1 person from all other instances must
                follow it in order to make it available. This tool does that. It
                follows your community from all remote instances until at least
                1 other person follows it.
              </p>
              <p class="mb-4">
                There are currently {{ data?.stats.instanceCount }} instances
                and {{ data?.stats.communityCount }} communities added to this
                tool. In the instance/community matrix,
                {{ data?.stats.completed }} are federated,
                {{ data?.stats.inprogress }}
                are waiting to be federated. As a note, these stats only work
                correctly after Lemmy 0.19.4.
              </p>
              <p class="mb-4"></p>
            </div>
          </v-expand-transition>
        </v-card>
      </v-col>
      <v-col rows="12">
        <v-form class="rounded rounded-md" @submit.prevent="submit">
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
                type="submit"
                prepend-icon="mdi-plus"
                color="primary"
                :loading="loading"
              >
                Submit Community
              </v-btn>
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
                  :active="pending"
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
                    v-if="item.progress.finished.length"
                    location="bottom"
                  >
                    <template v-slot:activator="{ props }">
                      <v-chip color="success" class="mr-2" v-bind="props">
                        {{ item.progress.finished.length }} completed
                      </v-chip>
                    </template>

                    <v-card min-width="200">
                      <v-list density="compact">
                        <v-list-item
                          v-for="follow in item.progress.finished"
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
                    v-if="item.progress.inProgress.length"
                    location="bottom"
                  >
                    <template v-slot:activator="{ props }">
                      <v-chip color="warning" class="mr-2" v-bind="props">
                        {{ item.progress.inProgress.length }} in progress
                      </v-chip>
                    </template>

                    <v-card min-width="200">
                      <v-list density="compact">
                        <v-list-item
                          v-for="follow in item.progress.inProgress"
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
        <!-- it errors with SSR for some reason :/ -->
        <client-only>
          <v-pagination
            v-model="page"
            :length="Math.ceil((data?.stats.communityCount || 0) / perPage)"
          ></v-pagination>
        </client-only>
      </v-col>
    </v-row>
  </v-container>
</template>
