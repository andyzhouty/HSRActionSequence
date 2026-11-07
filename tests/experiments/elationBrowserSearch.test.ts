import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { expect, it } from "vitest";
import { searchElationAxis } from "../../src/damage/elationSearch";
import { evaluateAxis } from "../../src/damage/elationSearchEvaluation";

const source = process.env.HSR_ELATION_BROWSER_SEARCH_CONFIG;
it.skipIf(!source || !existsSync(source))(
	"runs the browser search algorithm against a supplied saved damage config",
	async () => {
		if (!source) throw new Error("missing config");
		const config = JSON.parse(
			readFileSync(source, "utf8").replace(/^\uFEFF/, ""),
		);
		const before = JSON.stringify(config);
		const result = await searchElationAxis(
			config,
			"quick",
			async (jobs) => jobs.map((job) => evaluateAxis(config, job)),
			(p) => console.log(p.phase, p.evaluated, p.simulations),
		);
		expect(result.candidates.some((c) => c.baseline)).toBe(true);
		expect(result.candidates[0].stats.mean).toBeGreaterThanOrEqual(
			result.baseline.mean,
		);
		expect(JSON.stringify(config)).toBe(before);
		mkdirSync("build/elation-browser-search", { recursive: true });
		writeFileSync(
			"build/elation-browser-search/result.json",
			JSON.stringify(result, null, 2),
		);
	},
	120000,
);
