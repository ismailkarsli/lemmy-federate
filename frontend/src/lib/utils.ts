export function getHumanReadableSoftwareName(name: string) {
	return name[0].toLocaleUpperCase() + name.slice(1).toLocaleLowerCase();
}

// keep this function same with /src/lib/utils.ts
export function isGenericAP(name: string): boolean {
	switch (name.toLowerCase()) {
		case "lemmy":
		case "mbin":
			return false;
		default:
			return true;
	}
}
