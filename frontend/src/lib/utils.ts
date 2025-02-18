export function getHumanReadableSoftwareName(name: string) {
	switch (name.toLowerCase()) {
		case "lemmy":
			return "Lemmy";
		case "mbin":
			return "Mbin";
		case "activity_pub":
			return "Generic ActivityPub";
		default:
			return name[0].toLocaleUpperCase() + name.slice(1).toLocaleLowerCase();
	}
}
