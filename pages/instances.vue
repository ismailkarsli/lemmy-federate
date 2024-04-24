<script setup lang="ts">
const page = ref(1);
const skip = computed(() => (page.value - 1) * perPage);
const perPage = 10;

const { data, pending } = useFetch("/api/instance/all", {
  query: {
    skip,
    take: perPage,
  },
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
              <th class="text-left text-no-wrap">NSFW</th>
              <th class="text-left text-no-wrap">Fediseer usage</th>
              <th class="text-left text-no-wrap">Allow list</th>
              <th class="text-left text-no-wrap">
                Auto add communities
                <info-tooltip
                  text="Fetch and add all new communities periodically"
                />
              </th>
            </tr>
          </thead>
          <tbody v-if="!pending">
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
                <v-chip color="grey" class="mr-2">
                  {{
                    instance.nsfw === "ALLOW"
                      ? "Allow"
                      : instance.nsfw === "BLOCK"
                      ? "Don't allow"
                      : "Allow only NSFW"
                  }}
                </v-chip>
              </td>
              <td>
                <v-chip color="grey" class="mr-2">
                  {{
                    instance.fediseer === "NONE"
                      ? "Don't use"
                      : instance.fediseer === "BLACKLIST_ONLY"
                      ? "Don't allow censured"
                      : "Allow only endorsed"
                  }}
                </v-chip>
              </td>
              <td>
                <v-menu v-if="instance.allowed.length" location="bottom">
                  <template v-slot:activator="{ props }">
                    <v-chip color="grey" class="mr-2" v-bind="props">
                      Allowing {{ instance.allowed.length }} instances
                    </v-chip>
                  </template>

                  <v-card min-width="200">
                    <v-list density="compact">
                      <v-list-item v-for="i in instance.allowed" :key="i.id">
                        <v-list-item-title>
                          {{ i.host }}
                        </v-list-item-title>
                      </v-list-item>
                    </v-list>
                  </v-card>
                </v-menu>
                <v-chip v-else color="grey" class="mr-2">All instances</v-chip>
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
        <!-- it errors with SSR for some reason :/ -->
        <client-only>
          <v-pagination
            v-model="page"
            :length="Math.ceil((data?.total || 0) / perPage)"
          ></v-pagination>
        </client-only>
      </v-col>
    </v-row>
  </v-container>
</template>
