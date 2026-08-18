import { describe, expect, it } from "vitest";
import { buildInitialStates } from "../../../src/simulate/init";
import {
	ACTION_VALUE_EPSILON,
	compareActionCandidates,
} from "../../../src/simulate/scheduler";
import { character } from "../../helpers/simulateActionTestUtils";

describe("行动调度比较器", () => {
	it("将误差范围内的 AV 视为同值并使用稳定次序", () => {
		const states = buildInitialStates([
			character("first", "角色一", 100),
			character("second", "角色二", 100),
		]);
		const first = {
			stateIndex: 0,
			key: "first-1",
			actionValue: 100,
		};
		const second = {
			stateIndex: 1,
			key: "second-1",
			actionValue: 100 + ACTION_VALUE_EPSILON / 2,
		};
		expect(compareActionCandidates(first, second, states)).toBeLessThan(0);
		expect(compareActionCandidates(second, first, states)).toBeGreaterThan(0);
	});
});
