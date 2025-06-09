export function getHumanReadableSoftwareName(name: string): string {
	if (!name) return "";
	// Split the string by underscores or one or more whitespace characters
	const words = name.split(/[\s_]+/);

	// Capitalize the first letter of each word and make the rest of the word lowercase
	const capitalizedWords = words.map(
		(word) => word.charAt(0).toUpperCase() + word.slice(1),
	);

	// Join the words back together with a space
	return capitalizedWords.join(" ");
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
