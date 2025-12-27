// This file is kept for reference but is no longer used in Workers mode.
// Background jobs are now handled via Cron Triggers in wrangler.toml
// and the scheduled handler in src/index.ts

export async function startJobs() {
	console.warn(
		"startJobs() is deprecated in Workers mode. Jobs are now handled via Cron Triggers.",
	);
}
