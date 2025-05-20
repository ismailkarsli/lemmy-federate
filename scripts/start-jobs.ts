#!/usr/bin/env bun
import ms from "ms";
import { isMain } from "../src/lib/utils";
import { addAllCommunities } from "./add-all-communities";
import { addNewCommunities } from "./add-new-communities";
import { clearDeletedCommunities } from "./clear-deleted-communities";
import { updateFollows } from "./update-follows";

// TODO: just use cron

if (isMain(import.meta.url)) {
	startJobs();
}

export function startJobs() {
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
