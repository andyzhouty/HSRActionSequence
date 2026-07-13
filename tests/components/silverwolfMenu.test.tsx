import { screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";
import ActionPanel from "../../src/components/ActionPanel";
import {
	defaultCharacters,
	type GeneratedAction,
} from "../../src/utils/actionSequence";
import { renderWithContext } from "../helpers/actionSequenceComponentTestUtils";

describe("ActionPanel Silver Wolf", () => {
	it("银狼在无敌玩家状态时，队友右键菜单显示 E2 开关", () => {
		const swAction: GeneratedAction = {
			key: "sw-1",
			characterId: "sw",
			actionNo: 1,
			actionValue: 100,
			skill: "A",
			speed: 100,
			lockedSkill: true,
		};
		const allyAction: GeneratedAction = {
			key: "ally-1",
			characterId: "ally",
			actionNo: 1,
			actionValue: 80,
			skill: "E",
			speed: 80,
		};
		const chars = [
			{
				id: "sw",
				name: "银狼LV.999",
				kind: "角色" as const,
				speed: "100",
				baseSpeed: "100",
				hasVonwacq: false,
				hasWindSet: false,
				hasDance: false,
				eidolon: 2,
				superimpose: 1,
				lc_id: 0,
			},
			{
				id: "ally",
				name: "队友",
				kind: "角色" as const,
				speed: "80",
				baseSpeed: "80",
				hasVonwacq: false,
				hasWindSet: false,
				hasDance: false,
				eidolon: 0,
				superimpose: 1,
				lc_id: 0,
			},
		];
		renderWithContext(<ActionPanel />, {
			characters: chars,
			characterNames: { sw: "银狼LV.999", ally: "队友" },
			characterKinds: { sw: "角色", ally: "角色" },
			charactersById: Object.fromEntries(chars.map((c) => [c.id, c])),
			actions: [swAction, allyAction],
			actionMenuOpen: true,
			actionMenuKey: "ally-1",
			selectedActionKeys: new Set(["ally-1"]),
		});

		expect(screen.getByText("银狼 E2 额外行动：")).toBeInTheDocument();
	});

	it("点击 E2 开关会调用 setGodmodeExtraActions", async () => {
		const swAction: GeneratedAction = {
			key: "sw-1",
			characterId: "sw",
			actionNo: 1,
			actionValue: 100,
			skill: "A",
			speed: 100,
			lockedSkill: true,
		};
		const allyAction: GeneratedAction = {
			key: "ally-1",
			characterId: "ally",
			actionNo: 1,
			actionValue: 80,
			skill: "E",
			speed: 80,
		};
		const chars = [
			{
				id: "sw",
				name: "银狼LV.999",
				kind: "角色" as const,
				speed: "100",
				baseSpeed: "100",
				hasVonwacq: false,
				hasWindSet: false,
				hasDance: false,
				eidolon: 2,
				superimpose: 1,
				lc_id: 0,
			},
			{
				id: "ally",
				name: "队友",
				kind: "角色" as const,
				speed: "80",
				baseSpeed: "80",
				hasVonwacq: false,
				hasWindSet: false,
				hasDance: false,
				eidolon: 0,
				superimpose: 1,
				lc_id: 0,
			},
		];
		const setGodmodeExtraActions = vi.fn();
		renderWithContext(<ActionPanel />, {
			characters: chars,
			characterNames: { sw: "银狼LV.999", ally: "队友" },
			characterKinds: { sw: "角色", ally: "角色" },
			charactersById: Object.fromEntries(chars.map((c) => [c.id, c])),
			actions: [swAction, allyAction],
			actionMenuOpen: true,
			actionMenuKey: "ally-1",
			selectedActionKeys: new Set(["ally-1"]),
			setGodmodeExtraActions,
		});

		await userEvent.click(screen.getByText("已关闭"));
		expect(setGodmodeExtraActions).toHaveBeenCalled();
	});

	it("阿哈行动在银狼 Q 后也会显示 E2 开关", () => {
		const swQ: GeneratedAction = {
			key: "sw-1-q",
			characterId: "sw",
			actionNo: 0,
			actionValue: 100,
			skill: "Q",
			speed: 100,
		};
		const ahaAction: GeneratedAction = {
			key: "@aha-1",
			characterId: "@aha",
			displayName: "阿哈时刻",
			actionNo: 1,
			actionValue: 89,
			skill: "",
			speed: 110,
			isAhaInstant: true,
		};
		const chars = [
			{
				id: "sw",
				name: "银狼LV.999",
				kind: "角色" as const,
				speed: "100",
				baseSpeed: "100",
				hasVonwacq: false,
				hasWindSet: false,
				hasDance: false,
				eidolon: 2,
				superimpose: 1,
				lc_id: 0,
			},
		];
		renderWithContext(<ActionPanel />, {
			characters: chars,
			characterNames: { sw: "银狼LV.999", "@aha": "阿哈时刻" },
			characterKinds: { sw: "角色" },
			charactersById: Object.fromEntries(chars.map((c) => [c.id, c])),
			actions: [swQ, ahaAction],
			actionMenuOpen: true,
			actionMenuKey: "@aha-1",
			selectedActionKeys: new Set(["@aha-1"]),
		});

		expect(screen.getByText("银狼 E2 额外行动：")).toBeInTheDocument();
	});

	it("插队 Q 后的阿哈行动也会显示 E2 开关", () => {
		const swQ: GeneratedAction = {
			key: "ally-1-interrupt-0",
			characterId: "sw",
			actionNo: 0,
			actionValue: 80,
			skill: "Q",
			speed: 100,
		};
		const ahaAction: GeneratedAction = {
			key: "@aha-1",
			characterId: "@aha",
			displayName: "阿哈时刻",
			actionNo: 1,
			actionValue: 89,
			skill: "",
			speed: 110,
			isAhaInstant: true,
		};
		const chars = [
			{
				id: "sw",
				name: "银狼LV.999",
				kind: "角色" as const,
				speed: "100",
				baseSpeed: "100",
				hasVonwacq: false,
				hasWindSet: false,
				hasDance: false,
				eidolon: 2,
				superimpose: 1,
				lc_id: 0,
			},
		];
		renderWithContext(<ActionPanel />, {
			characters: chars,
			characterNames: { sw: "银狼LV.999", "@aha": "阿哈时刻" },
			characterKinds: { sw: "角色" },
			charactersById: Object.fromEntries(chars.map((c) => [c.id, c])),
			actions: [swQ, ahaAction],
			actionMenuOpen: true,
			actionMenuKey: "@aha-1",
			selectedActionKeys: new Set(["@aha-1"]),
		});

		expect(screen.getByText("银狼 E2 额外行动：")).toBeInTheDocument();
	});

	it("火花额外回合的 Q 行点击银狼 E2 时，写入主额外回合 key", async () => {
		const swQ: GeneratedAction = {
			key: "sw-1-q",
			characterId: "sw",
			actionNo: 0,
			actionValue: 80,
			skill: "Q",
			speed: 200,
		};
		const sparxieExtraQ: GeneratedAction = {
			key: "@aha-1-sparxie-extra-q",
			characterId: "sparxie",
			actionNo: 0,
			actionValue: 89,
			skill: "Q",
			speed: 160,
		};
		const chars = [
			{
				id: "sw",
				name: "银狼LV.999",
				kind: "角色" as const,
				speed: "200",
				baseSpeed: "200",
				hasVonwacq: false,
				hasWindSet: false,
				hasDance: false,
				eidolon: 2,
				superimpose: 1,
				lc_id: 0,
			},
			{
				id: "sparxie",
				name: "火花",
				kind: "角色" as const,
				speed: "160",
				baseSpeed: "160",
				hasVonwacq: false,
				hasWindSet: false,
				hasDance: false,
				eidolon: 2,
				superimpose: 1,
				lc_id: 0,
			},
		];
		const setGodmodeExtraActions = vi.fn();
		renderWithContext(<ActionPanel />, {
			characters: chars,
			characterNames: { sw: "银狼LV.999", sparxie: "火花" },
			characterKinds: { sw: "角色", sparxie: "角色" },
			charactersById: Object.fromEntries(chars.map((c) => [c.id, c])),
			actions: [swQ, sparxieExtraQ],
			actionMenuOpen: true,
			actionMenuKey: "@aha-1-sparxie-extra-q",
			selectedActionKeys: new Set(["@aha-1-sparxie-extra-q"]),
			setGodmodeExtraActions,
		});

		await userEvent.click(screen.getByText("已关闭"));
		expect(setGodmodeExtraActions).toHaveBeenCalledWith(expect.any(Function));
		const updater = setGodmodeExtraActions.mock.calls[0]?.[0];
		expect(updater({})).toEqual({ "@aha-1-sparxie-extra": true });
	});

	it("银狼未进入 Q 状态时，阿哈行动不显示 E2 开关", () => {
		const swAction: GeneratedAction = {
			key: "sw-1",
			characterId: "sw",
			actionNo: 1,
			actionValue: 100,
			skill: "A",
			speed: 100,
		};
		const ahaAction: GeneratedAction = {
			key: "@aha-1",
			characterId: "@aha",
			displayName: "阿哈时刻",
			actionNo: 1,
			actionValue: 89,
			skill: "",
			speed: 110,
			isAhaInstant: true,
		};
		const chars = [
			{
				id: "sw",
				name: "银狼LV.999",
				kind: "角色" as const,
				speed: "100",
				baseSpeed: "100",
				hasVonwacq: false,
				hasWindSet: false,
				hasDance: false,
				eidolon: 2,
				superimpose: 1,
				lc_id: 0,
			},
		];
		renderWithContext(<ActionPanel />, {
			characters: chars,
			characterNames: { sw: "银狼LV.999", "@aha": "阿哈时刻" },
			characterKinds: { sw: "角色" },
			charactersById: Object.fromEntries(chars.map((c) => [c.id, c])),
			actions: [swAction, ahaAction],
			actionMenuOpen: true,
			actionMenuKey: "@aha-1",
			selectedActionKeys: new Set(["@aha-1"]),
		});

		expect(screen.queryByText("银狼 E2 额外行动：")).toBeNull();
	});

	it("银狼无敌玩家状态在三次正常行动后结束，后续菜单不显示 E2 开关", () => {
		const sw = {
			...defaultCharacters[0],
			id: "sw",
			name: "银狼LV.999",
			kind: "角色" as const,
			speed: "100",
			baseSpeed: "100",
		};
		const ally = {
			...defaultCharacters[0],
			id: "ally",
			name: "队友",
			kind: "角色" as const,
			speed: "80",
			baseSpeed: "80",
		};
		const actions: GeneratedAction[] = [
			{
				key: "sw-1-q",
				characterId: "sw",
				actionNo: 0,
				actionValue: 1,
				skill: "Q",
				speed: 100,
			},
			{
				key: "sw-1",
				characterId: "sw",
				actionNo: 1,
				actionValue: 2,
				skill: "A",
				speed: 100,
				lockedSkill: true,
			},
			{
				key: "sw-2",
				characterId: "sw",
				actionNo: 2,
				actionValue: 3,
				skill: "A",
				speed: 100,
				lockedSkill: true,
			},
			{
				key: "sw-3",
				characterId: "sw",
				actionNo: 3,
				actionValue: 4,
				skill: "A",
				speed: 100,
			},
			{
				key: "ally-1",
				characterId: "ally",
				actionNo: 1,
				actionValue: 5,
				skill: "E",
				speed: 80,
			},
		];
		renderWithContext(<ActionPanel />, {
			characters: [sw, ally],
			characterNames: { sw: "银狼LV.999", ally: "队友" },
			characterKinds: { sw: "角色", ally: "角色" },
			charactersById: { sw, ally },
			actions,
			actionMenuOpen: true,
			actionMenuKey: "ally-1",
			selectedActionKeys: new Set(["ally-1"]),
		});

		expect(screen.queryByText("银狼 E2 额外行动：")).toBeNull();
	});
});
