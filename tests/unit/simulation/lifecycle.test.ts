import { describe, expect, it } from "vitest";
import { ACTION_LIFECYCLE_PHASES } from "../../../src/simulate/lifecycle";
import { MAX_SIMULATION_ITERATIONS } from "../../../src/simulate/loop";

describe("模拟行动生命周期", () => {
	it("固定阶段顺序并保留循环保护上限", () => {
		expect(ACTION_LIFECYCLE_PHASES).toEqual([
			"preActionChecks",
			"specialAction",
			"garmentmakerAction",
			"domainAction",
			"normalAction",
			"postActionCleanup",
		]);
		expect(MAX_SIMULATION_ITERATIONS).toBe(2000);
	});
});
