import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { expect, it } from "vitest";
import { simulateElationTeam } from "../../src/damage/elationTeam";
import { buildTeam, panel } from "./elationMaxBuild";

const source = process.env.HSR_FREESR_TEST_FILE;

it.skipIf(process.env.HSR_ELATION_MAX_AXIS !== "1" || !source)(
	"builds the requested four-character build and dumps the baseline run",
	() => {
		if (!source || !existsSync(source)) throw new Error("缺少配装文件");
		const raw = JSON.parse(readFileSync(source, "utf8").replace(/^\uFEFF/, ""));
		const config = buildTeam(raw, source);
		const result = simulateElationTeam(config);
		const dir =
			process.env.HSR_ELATION_MAX_AXIS_DIR ?? "build/elation-max-axis";
		mkdirSync(dir, { recursive: true });
		writeFileSync(`${dir}/panel.json`, JSON.stringify(panel(config), null, 2));
		writeFileSync(
			`${dir}/baseline-result.json`,
			JSON.stringify(
				{ total: result.total, byActor: result.byActor, cycles: result.cycles },
				null,
				2,
			),
		);
		expect(result.total).toBeGreaterThan(0);
		console.log(JSON.stringify(panel(config), null, 1));
		console.log("total", result.total, result.byActor);
	},
	120000,
);
