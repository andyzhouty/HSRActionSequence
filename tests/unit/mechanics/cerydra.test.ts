import { describe, expect, it } from "vitest";
import {
	applyCerydraSpeed,
	consumeCerydraSpeed,
} from "../../../src/mechanics/cerydra";
import { buildInitialStates } from "../../../src/simulate/init";
import { character } from "../../helpers/simulateActionTestUtils";

describe("Cerydra flat speed trace", () => {
	it("adds twenty rather than twenty percent, refreshes without stacking, and expires after three recipient turns", () => {
		const states = buildInitialStates([
			character("c", "刻律德菈", 140),
			character("w", "白厄", 110),
		]);
		const owner = states[0],
			target = states[1];
		applyCerydraSpeed(states, "c", "w", 0);
		expect(owner.currentSpeed).toBe(160);
		expect(target.currentSpeed).toBe(130);
		applyCerydraSpeed(states, "c", "w", 0);
		expect(owner.currentSpeed).toBe(160);
		consumeCerydraSpeed(owner, 0);
		expect(owner.cerydraSpeedTurns).toBe(3);
		for (let i = 0; i < 3; i++) consumeCerydraSpeed(target, 0);
		expect(target.currentSpeed).toBe(110);
	});
});
