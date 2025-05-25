<script setup lang="ts">
import { keepPreviousData, useQuery } from "@tanstack/vue-query";
import { computed, ref } from "vue";
import InfoTooltip from "../components/info-tooltip.vue";
import { getHumanReadableSoftwareName, isGenericAP } from "../lib/utils";
import { trpc } from "../trpc";

const search = ref("");
const page = ref(1);
const skip = computed(() => (page.value - 1) * perPage);
const software = ref<string | undefined>(undefined);
const enabledOnly = ref<boolean>(false);
const perPage = 10;

const { data, isPending, isLoading, isFetching } = useQuery({
	queryKey: ["instances", search, skip, perPage, software, enabledOnly],
	queryFn: ({ signal }) =>
		trpc.instance.find.query(
			{
				search: search.value,
				skip: skip.value,
				take: perPage,
				software: software.value,
				enabledOnly: enabledOnly.value,
			},
			{ signal },
		),
	placeholderData: keepPreviousData,
});
</script>

<template>
  <v-container>
    <v-row>
      <v-col cols="12">
        <v-form>
          <v-text-field v-model="search" label="Search an instance" required hide-details density="compact"
            variant="underlined" :loading="isLoading || isPending || isFetching">
            <template #append>
              <v-menu location="bottom end" :close-on-content-click="false">
                <template v-slot:activator="{ props }">
                  <v-btn icon="mdi-filter-variant" density="comfortable" v-bind="props" />
                </template>
                <v-card min-width="300" class="px-2 py-2">
                  <v-autocomplete v-model="software" clearable variant="filled" hide-details label="Filter by software"
                    :items="data?.softwares" />
                  <v-checkbox v-model="enabledOnly" label="Enabled only" hide-details></v-checkbox>
                </v-card>
              </v-menu>
            </template>
          </v-text-field>
        </v-form>
      </v-col>
      <v-col cols="12">
        <v-table fixed-header height="600px">
          <thead>
            <tr>
              <th class="text-left text-no-wrap">Instance</th>
              <th class="text-left text-no-wrap">Software</th>
              <th class="text-left text-no-wrap">Status</th>
              <th class="text-left text-no-wrap">
                Auto add
                <info-tooltip text="Fetch and add all new communities periodically" />
              </th>
            </tr>
          </thead>
          <tbody v-if="!isPending">
            <tr v-for="instance in data?.instances" :key="instance.id">
              <td>
                <a :href="`https://${instance.host}`" target="_blank" class="text-primary">{{ instance.host }}</a>
              </td>
              <td>
                {{ getHumanReadableSoftwareName(instance.software) }}
              </td>
              <td>
                <v-chip v-if="instance.enabled" color="success" class="mr-2">
                  Enabled
                </v-chip>
                <v-chip v-else color="error" class="mr-2">Disabled</v-chip>
              </td>
              <td>
                <v-chip v-if="isGenericAP(instance.software)" color="blue-grey" class="mr-2">Not applicable</v-chip>
                <v-chip v-else-if="instance.auto_add" color="success" class="mr-2">
                  Enabled
                </v-chip>
                <v-chip v-else color="error" class="mr-2">Disabled</v-chip>
              </td>
            </tr>
          </tbody>
          <tbody v-else>
            <tr>
              <td colspan="5" class="h-0 pa-0">
                <v-progress-linear indeterminate color="primary" />
              </td>
            </tr>
          </tbody>
        </v-table>
        <v-pagination v-model="page" :length="Math.ceil((data?.total || 0) / perPage)"></v-pagination>
      </v-col>
    </v-row>
  </v-container>
</template>
