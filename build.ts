import UnpluginTypia from "@ryoppippi/unplugin-typia/bun";

await Bun.build({
	entrypoints: ["./src/index.ts"],
	outdir: "./dist",
	target: "bun",
	format: "esm",
	minify: false,
	packages: "bundle",
	sourcemap: "inline",
	plugins: [UnpluginTypia({ cache: false })],
});
