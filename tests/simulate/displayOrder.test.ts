import { describe, expect, it } from "vitest";
import {
	canExchangeActionOrder,
	getDisplayOrderedActions,
	getExtraTurnParentKey,
} from "../../src/utils/actionDisplayOrder";
import type { GeneratedAction } from "../../src/utils/actionSequence";

function normal(key: string, actionValue = 100): GeneratedAction {
	return {
		key,
		characterId: "x",
		actionNo: 1,
		actionValue,
		skill: "",
		speed: 100,
	};
}

function extra(key: string, skill = ""): GeneratedAction {
	return {
		key,
		characterId: "x",
		actionNo: 0,
		actionValue: 100,
		skill,
		speed: 100,
	};
}

describe("getDisplayOrderedActions with sameAVOrder", () => {
	it("只重排同父级的额外回合", () => {
		const actions = [extra("turn-1-q", "Q"), extra("turn-1-godmode-A", "A")];
		const result = getDisplayOrderedActions(actions, {
			"turn-1-q": 1,
			"turn-1-godmode-A": 0,
		});
		expect(result.map((action) => action.key)).toEqual([
			"turn-1-godmode-A",
			"turn-1-q",
		]);
	});

	it("正常回合不会被 sameAVOrder 重排或识别为可拖拽对象", () => {
		const actions = [normal("first"), normal("second")];
		const result = getDisplayOrderedActions(actions, { second: 0, first: 1 });
		expect(result.map((action) => action.key)).toEqual(["first", "second"]);
		expect(getExtraTurnParentKey(actions[0])).toBeNull();
	});

	it("不同父级的额外回合不会互相重排", () => {
		const actions = [
			{ ...extra("first-1-q", "Q"), characterId: "first" },
			{ ...extra("second-1-q", "Q"), characterId: "second" },
		];
		const result = getDisplayOrderedActions(actions, {
			"second-1-q": 0,
			"first-1-q": 1,
		});
		expect(result.map((action) => action.key)).toEqual([
			"first-1-q",
			"second-1-q",
		]);
	});

	it("同一正常回合后的多个插入 Q 可以交换", () => {
		const actions = [
			{
				...extra("cyrene-1-interrupt-0", "Q"),
				interruptTiming: "after" as const,
			},
			{
				...extra("cyrene-1-interrupt-1", "Q"),
				interruptTiming: "after" as const,
			},
		];
		const result = getDisplayOrderedActions(actions, {
			"cyrene-1-interrupt-0": 1,
			"cyrene-1-interrupt-1": 0,
		});
		expect(result.map((action) => action.key)).toEqual([
			"cyrene-1-interrupt-1",
			"cyrene-1-interrupt-0",
		]);
		expect(getExtraTurnParentKey(actions[0])).toBe("cyrene-1");
	});

	it("后插入 Q 与其生成的绯英追击属于同一拖拽组", () => {
		const q = {
			...extra("cyrene-1-interrupt-0", "Q"),
			interruptTiming: "after" as const,
		};
		const fua = {
			...extra("cyrene-1-interrupt-0-fua", "Z"),
			isFuaAction: true,
		};
		const result = getDisplayOrderedActions([q, fua], {
			"cyrene-1-interrupt-0": 1,
			"cyrene-1-interrupt-0-fua": 0,
		});

		expect(getExtraTurnParentKey(fua)).toBe("cyrene-1");
		expect(result.map((action) => action.key)).toEqual([
			"cyrene-1-interrupt-0-fua",
			"cyrene-1-interrupt-0",
		]);
	});

	it("火花 2 魂额外回合属于阿哈时刻拖拽组且不能越过触发者", () => {
		const aha = {
			...normal("@aha-1"),
			isAhaInstant: true,
			hasElationSkills: true,
		};
		const sparxieExtra = {
			...extra("@aha-1-sparxie-extra", "A"),
			isSparxieExtraAction: true,
		};

		expect(getExtraTurnParentKey(sparxieExtra)).toBe("@aha-1");
		expect(
			getDisplayOrderedActions([aha, sparxieExtra], {
				"@aha-1": 1,
				"@aha-1-sparxie-extra": 0,
			}).map((action) => action.key),
		).toEqual(["@aha-1", "@aha-1-sparxie-extra"]);
		expect(canExchangeActionOrder(aha, sparxieExtra)).toBe(false);
	});

	it("流萤击破和诗篇即时额外行动可与同源额外行动排序", () => {
		const breakExtra = {
			...normal("firefly-1-break-extra-1"),
			isCombustionAction: true,
		};
		const odeExtra = {
			...extra("firefly-1-memosprite-Q-ode-hymn", "E"),
			isOdeExtraAction: true,
		};

		expect(getExtraTurnParentKey(breakExtra)).toBe("firefly-1");
		expect(getExtraTurnParentKey(odeExtra)).toBe("firefly-1");
		expect(
			getDisplayOrderedActions([breakExtra, odeExtra], {
				"firefly-1-break-extra-1": 1,
				"firefly-1-memosprite-Q-ode-hymn": 0,
			}).map((action) => action.key),
		).toEqual(["firefly-1-memosprite-Q-ode-hymn", "firefly-1-break-extra-1"]);
	});

	it("由 Q 触发的额外阿哈时刻归属原正常回合", () => {
		const q = extra("yaoguang-1-q", "Q");
		const extraAha = {
			...extra("yaoguang-1-q-extra-aha"),
			isAhaInstant: true,
			isExtraAha: true,
			hasElationSkills: true,
		};
		const result = getDisplayOrderedActions([q, extraAha], {
			"yaoguang-1-q": 1,
			"yaoguang-1-q-extra-aha": 0,
		});

		expect(getExtraTurnParentKey(extraAha)).toBe("yaoguang-1");
		expect(result.map((action) => action.key)).toEqual([
			"yaoguang-1-q",
			"yaoguang-1-q-extra-aha",
		]);
	});

	it("额外阿哈不会被 sameAVOrder 排到触发 Q 之前", () => {
		const q = extra("yaoguang-1-q", "Q");
		const extraAha = {
			...extra("yaoguang-1-q-extra-aha"),
			isAhaInstant: true,
			isExtraAha: true,
			hasElationSkills: true,
		};
		const result = getDisplayOrderedActions([q, extraAha], {
			"yaoguang-1-q": 1,
			"yaoguang-1-q-extra-aha": 0,
		});

		expect(canExchangeActionOrder(q, extraAha)).toBe(false);
		expect(result.map((action) => action.key)).toEqual([
			"yaoguang-1-q",
			"yaoguang-1-q-extra-aha",
		]);
	});

	it("多项同组重排时额外阿哈仍不会越过触发 Q", () => {
		const yaoguangQ = {
			...extra("yaoguang-1-interrupt-0", "Q"),
			interruptTiming: "after" as const,
		};
		const evanesciaQ = {
			...extra("yaoguang-1-interrupt-1", "Q"),
			interruptTiming: "after" as const,
		};
		const extraAha = {
			...extra("yaoguang-1-interrupt-0-extra-aha"),
			isAhaInstant: true,
			isExtraAha: true,
			hasElationSkills: true,
		};
		const fua = {
			...extra("yaoguang-1-interrupt-0-extra-aha-fua", "Z"),
			isFuaAction: true,
		};
		const result = getDisplayOrderedActions(
			[extraAha, fua, yaoguangQ, evanesciaQ],
			{
				"yaoguang-1-interrupt-0-extra-aha": 0,
				"yaoguang-1-interrupt-0-extra-aha-fua": 1,
				"yaoguang-1-interrupt-0": 2,
				"yaoguang-1-interrupt-1": 3,
			},
		);

		expect(result.map((action) => action.key)).toEqual([
			"yaoguang-1-interrupt-0-extra-aha-fua",
			"yaoguang-1-interrupt-0",
			"yaoguang-1-interrupt-0-extra-aha",
			"yaoguang-1-interrupt-1",
		]);
	});

	it("Q 后派生的额外阿哈与其他额外行动可交换", () => {
		const extraAha = {
			...extra("yaoguang-1-q-extra-aha"),
			isAhaInstant: true,
			isExtraAha: true,
			hasElationSkills: true,
		};
		const fua = {
			...extra("yaoguang-1-q-fua", "Z"),
			isFuaAction: true,
		};
		const godmodeA = extra("yaoguang-1-q-godmode-A", "A");
		const result = getDisplayOrderedActions([extraAha, fua, godmodeA], {
			"yaoguang-1-q-extra-aha": 2,
			"yaoguang-1-q-fua": 1,
			"yaoguang-1-q-godmode-A": 0,
		});

		expect(getExtraTurnParentKey(fua)).toBe("yaoguang-1");
		expect(getExtraTurnParentKey(godmodeA)).toBe("yaoguang-1");
		expect(result.map((action) => action.key)).toEqual([
			"yaoguang-1-q-godmode-A",
			"yaoguang-1-q-fua",
			"yaoguang-1-q-extra-aha",
		]);
	});

	it("后插入 Q 触发的额外阿哈可与同回合其他后插入 Q 交换", () => {
		const yaoguangQ = {
			...extra("yaoguang-1-interrupt-0", "Q"),
			interruptTiming: "after" as const,
		};
		const evanesciaQ = {
			...extra("yaoguang-1-interrupt-1", "Q"),
			interruptTiming: "after" as const,
		};
		const extraAha = {
			...extra("yaoguang-1-interrupt-0-extra-aha"),
			isAhaInstant: true,
			isExtraAha: true,
			hasElationSkills: true,
		};
		const result = getDisplayOrderedActions([yaoguangQ, evanesciaQ, extraAha], {
			"yaoguang-1-interrupt-0": 2,
			"yaoguang-1-interrupt-1": 1,
			"yaoguang-1-interrupt-0-extra-aha": 0,
		});

		expect(getExtraTurnParentKey(extraAha)).toBe("yaoguang-1");
		expect(result.map((action) => action.key)).toEqual([
			"yaoguang-1-interrupt-1",
			"yaoguang-1-interrupt-0",
			"yaoguang-1-interrupt-0-extra-aha",
		]);
	});

	it("由额外阿哈触发的绯英追击仍归属原 after-Q 组", () => {
		const yaoguangQ = {
			...extra("yaoguang-1-interrupt-0", "Q"),
			interruptTiming: "after" as const,
		};
		const extraAha = {
			...extra("yaoguang-1-interrupt-0-extra-aha"),
			isAhaInstant: true,
			isExtraAha: true,
			hasElationSkills: true,
		};
		const fua = {
			...extra("yaoguang-1-interrupt-0-extra-aha-fua", "Z"),
			isFuaAction: true,
		};
		const result = getDisplayOrderedActions([yaoguangQ, extraAha, fua], {
			"yaoguang-1-interrupt-0": 2,
			"yaoguang-1-interrupt-0-extra-aha": 1,
			"yaoguang-1-interrupt-0-extra-aha-fua": 0,
		});

		expect(getExtraTurnParentKey(fua)).toBe("yaoguang-1");
		expect(result.map((action) => action.key)).toEqual([
			"yaoguang-1-interrupt-0-extra-aha-fua",
			"yaoguang-1-interrupt-0",
			"yaoguang-1-interrupt-0-extra-aha",
		]);
	});

	it("欢愉技可与同父级额外行动交换", () => {
		const elationSkill = {
			...extra("@aha-1-elation-sparxie", "ES"),
			isElationSkill: true,
			elationSkillParentKey: "@aha-1",
		};
		const extraAction = extra("@aha-1-godmode-A", "A");
		expect(getExtraTurnParentKey(elationSkill)).toBe("@aha-1");
		expect(
			getDisplayOrderedActions([elationSkill, extraAction], {
				"@aha-1-elation-sparxie": 1,
				"@aha-1-godmode-A": 0,
			}),
		).toEqual([extraAction, elationSkill]);
	});

	it("正常回合后的绯英追击可与 after 插队 Q 交换", () => {
		const fua = {
			...extra("yaoguang-1-fua", "Z"),
			isFuaAction: true,
		};
		const insertedQ = {
			...extra("yaoguang-1-interrupt-0", "Q"),
			interruptTiming: "after" as const,
		};
		const result = getDisplayOrderedActions([fua, insertedQ], {
			"yaoguang-1-fua": 1,
			"yaoguang-1-interrupt-0": 0,
		});

		expect(getExtraTurnParentKey(fua)).toBe("yaoguang-1");
		expect(getExtraTurnParentKey(insertedQ)).toBe("yaoguang-1");
		expect(result).toEqual([insertedQ, fua]);
	});

	it("阿哈时刻作为整体重排，内部欢愉技顺序保持固定", () => {
		const aha = {
			...normal("@aha-1"),
			actionNo: 1,
			isAhaInstant: true,
			hasElationSkills: true,
		};
		const firstElationSkill = {
			...extra("@aha-1-elation-first", "ES"),
			isElationSkill: true,
			elationSkillParentKey: "@aha-1",
		};
		const secondElationSkill = {
			...extra("@aha-1-elation-second", "ES"),
			isElationSkill: true,
			elationSkillParentKey: "@aha-1",
		};
		const extraAction = extra("@aha-1-godmode-A", "A");
		const result = getDisplayOrderedActions(
			[aha, firstElationSkill, secondElationSkill, extraAction],
			{ "@aha-1": 1, "@aha-1-godmode-A": 0 },
		);

		expect(getExtraTurnParentKey(aha)).toBe("@aha-1");
		expect(result.map((action) => action.key)).toEqual([
			"@aha-1-godmode-A",
			"@aha-1",
			"@aha-1-elation-first",
			"@aha-1-elation-second",
		]);
	});

	it("不同 AV 始终优先于同 AV 排序", () => {
		const actions = [
			normal("late", 200),
			normal("early", 50),
			normal("mid", 100),
		];
		const result = getDisplayOrderedActions(actions, {
			late: 0,
			early: 0,
			mid: 0,
		});
		expect(result.map((action) => action.key)).toEqual([
			"early",
			"mid",
			"late",
		]);
	});
});
