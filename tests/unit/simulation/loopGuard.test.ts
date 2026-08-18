import { describe, expect, it } from "vitest";
import {
	MAX_SIMULATION_ITERATIONS,
	SimulationLoopLimitError,
} from "../../../src/simulate/loop";

describe("模拟器循环保护", () => {
	it("统一暴露最大行动数和可定位的错误类型", () => {
		const error = new SimulationLoopLimitError(
			MAX_SIMULATION_ITERATIONS,
			"c1-9",
		);
		expect(error.name).toBe("SimulationLoopLimitError");
		expect(error.iterations).toBe(MAX_SIMULATION_ITERATIONS);
		expect(error.lastActionKey).toBe("c1-9");
		expect(error.message).toContain("c1-9");
	});
});
