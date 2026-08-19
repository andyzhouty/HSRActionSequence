import { describe, expect, it } from "vitest";
import { getNormalActionMechanicNames } from "../../../src/simulate/normal-action/mechanics";

describe("模拟器机制注册表", () => {
	it("按生命周期阶段登记低耦合角色机制", () => {
		expect(getNormalActionMechanicNames()).toEqual([
			"aglaeaGarmentmaker",
			"archerExtraE",
			"cyreneUltimate",
			"hyacine",
		]);
	});
});
