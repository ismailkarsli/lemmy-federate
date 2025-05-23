#!/usr/bin/env node
import ms from "ms";
import { isMain } from "../src/lib/utils.ts";
import { addAllCommunities } from "./add-all-communities.ts";
import { addNewCommunities } from "./add-new-communities.ts";
import { clearDeletedCommunities } from "./clear-deleted-communities.ts";
import { updateFollows } from "./update-follows.ts";

// TODO: just use cron

if (isMain(import.meta.url)) {
	startJobs();
}

export async function startJobs() {
	await new Promise((r) => setTimeout(r, ms("3 minutes")));
	loop(updateFollows, ms("1 minute"));
	loop(addNewCommunities, ms("1 minute")); // fetch newest communities directly from instances
	loop(addAllCommunities, ms("1 day")); // fetch all communities from lemmyverse.net
	loop(clearDeletedCommunities, ms("2 days"));
}

async function loop(callback: () => Promise<void>, timeout = 0) {
	while (true) {
		await callback().catch((reason) =>
			console.error(`Error on job ${callback.name}: ${reason}`),
		);
		await new Promise((resolve) => setTimeout(resolve, timeout));
	}
}
