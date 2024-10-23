<script setup lang="ts">
import { keepPreviousData, useQuery } from "@tanstack/vue-query";
import { computed, ref } from "vue";
import InfoTooltip from "../components/InfoTooltip.vue";
import { trpc } from "../trpc";

const page = ref(1);
const skip = computed(() => (page.value - 1) * perPage);
const perPage = 10;

const { data, isPending } = useQuery({
	queryKey: ["instances", skip, perPage],
	queryFn: () =>
		trpc.instance.find.query({
			skip: skip.value,
			take: perPage,
		}),
	placeholderData: keepPreviousData,
});
</script>

<template>
  <v-container>
    <v-row>
      <v-col cols="12">
        <v-card variant="text">
          <p>
            If you want to add your instance to the list, you can login from top
            right. Your instance must be guaranteed on the Fediseer. If you are
            a user, you can ask your instance admin to add your instance.
          </p>
        </v-card>
      </v-col>
      <v-col cols="12">
        <v-table fixed-header height="600px">
          <thead>
            <tr>
              <th class="text-left text-no-wrap">Instance</th>
              <th class="text-left text-no-wrap">Status</th>
              <th class="text-left text-no-wrap">
                Auto add
                <info-tooltip
                  text="Fetch and add all new communities periodically"
                />
              </th>
            </tr>
          </thead>
          <tbody v-if="!isPending">
            <tr v-for="instance in data?.instances" :key="instance.id">
              <td>
                <a
                  :href="`https://${instance.host}`"
                  target="_blank"
                  class="text-primary"
                  >{{ instance.host }}</a
                >
              </td>
              <td>
                <v-chip v-if="instance.enabled" color="success" class="mr-2">
                  Enabled
                </v-chip>
                <v-chip v-else color="error" class="mr-2"> Disabled </v-chip>
              </td>
              <td>
                <v-chip v-if="instance.auto_add" color="success" class="mr-2">
                  Enabled
                </v-chip>
                <v-chip v-else color="error" class="mr-2"> Disabled </v-chip>
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
        <v-pagination
          v-model="page"
          :length="Math.ceil((data?.total || 0) / perPage)"
        ></v-pagination>
      </v-col>
    </v-row>
  </v-container>
</template>
