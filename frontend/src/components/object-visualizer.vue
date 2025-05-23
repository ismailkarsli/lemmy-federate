<script lang="ts" setup>
const props = defineProps<{ object: { [key: string]: unknown } | null }>();

type TreeItem = {
	id: number | string;
	title: string | number | boolean;
	children?: TreeItem[];
};
function getJsonAsTree(
	title: string,
	target: unknown,
	id: number | string,
): TreeItem {
	if (
		!target ||
		typeof target === "string" ||
		typeof target === "number" ||
		typeof target === "boolean"
	) {
		return { id, title: `${title}: ${target || "null"}` };
	}

	if (typeof target === "object") {
		return {
			id,
			title: title,
			children: Object.entries(target).map(([key, value]) =>
				getJsonAsTree(key, value, `${key}:${id}`),
			),
		};
	}

	return { id, title: "Unknown" };
}
</script>

<template>
  <v-treeview
    :items="[getJsonAsTree('Object', props.object, 'parent')]"
    item-value="id"
    open-all
    density="compact"
    fluid
  ></v-treeview>
</template>
