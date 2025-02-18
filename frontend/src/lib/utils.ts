export function getHumanReadableSoftwareName(name: string) {
	switch (name.toLowerCase()) {
		case "lemmy":
			return "Lemmy";
		case "mbin":
			return "Mbin";
		default:
			return name[0].toLocaleUpperCase() + name.slice(1).toLocaleLowerCase();
	}
}

// keep this function same with /src/lib/utils.ts
export function isSeedOnlySoftware(name: string): boolean {
	switch (name.toLocaleLowerCase()) {
		case "lemmy":
		case "mbin":
			return false;
		default:
			return true;
	}
}
