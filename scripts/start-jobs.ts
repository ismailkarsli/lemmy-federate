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
	// update oldest updated 1000 cf every minute
	loop(() => updateFollows(1000), ms("1 minute"));
	loop(addNewCommunities, ms("1 minute")); // fetch newest communities directly from instances
	loop(addAllCommunities, ms("1 day"));
	loop(clearDeletedCommunities, ms("2 days"));
}

async function loop(callback: () => void, timeout = 0) {
	while (true) {
		await callback();
		await new Promise((resolve) => setTimeout(resolve, timeout));
	}
}
