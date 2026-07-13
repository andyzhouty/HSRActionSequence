import { screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it } from "vitest";
import ActionPanel from "../../src/components/action-sequence/ActionPanel";
import type { GeneratedAction } from "../../src/utils/actionSequence";
import { renderWithContext } from "../helpers/actionSequenceComponentTestUtils";

describe("ActionPanel RMC / Evernight", () => {
	it("右键菜单会显示迷迷拉条目标选择", () => {
		const rmcAction: GeneratedAction = {
			key: "rmc-1",
			characterId: "rmc",
			actionNo: 1,
			actionValue: 62.5,
			skill: "E",
			speed: 160,
		};
		const memeAction: GeneratedAction = {
			key: "rmc-1-meme",
			characterId: "rmc-meme",
			displayName: "迷迷",
			actionNo: 0,
			actionValue: 62.5,
			skill: "拉条",
			speed: 130,
			isMemeAction: true,
			isMemospriteAction: true,
			memospriteOwnerId: "rmc",
		};
		const chars = [
			{
				id: "rmc",
				name: "开拓者·记忆",
				kind: "角色" as const,
				speed: "160",
				baseSpeed: "160",
				hasVonwacq: false,
				hasWindSet: false,
				hasDance: false,
				eidolon: 0,
				superimpose: 1,
				lc_id: 0,
			},
			{
				id: "ally",
				name: "队友",
				kind: "角色" as const,
				speed: "100",
				baseSpeed: "100",
				hasVonwacq: false,
				hasWindSet: false,
				hasDance: false,
				eidolon: 0,
				superimpose: 1,
				lc_id: 0,
			},
		];
		const meme = {
			id: "rmc-meme",
			name: "迷迷",
			kind: "忆灵" as const,
			speed: "130",
			baseSpeed: "130",
			hasVonwacq: false,
			hasWindSet: false,
			hasDance: false,
			eidolon: 0,
			superimpose: 1,
			lc_id: 0,
		};
		renderWithContext(<ActionPanel />, {
			characters: chars,
			characterNames: { rmc: "开拓者·记忆", ally: "队友", "rmc-meme": "迷迷" },
			characterKinds: { rmc: "角色", ally: "角色", "rmc-meme": "忆灵" },
			charactersById: { rmc: chars[0], ally: chars[1], "rmc-meme": meme },
			actions: [rmcAction, memeAction],
			actionMenuOpen: true,
			actionMenuKey: "rmc-1-meme",
			selectedActionKeys: new Set(["rmc-1-meme"]),
			memospriteTargets: [meme],
		});

		expect(screen.queryAllByText(/迷迷/).length).toBeGreaterThanOrEqual(1);
	});

	it("记忆主 Q 召唤迷迷后，右键菜单也会显示迷迷拉条", () => {
		const rmcQAction: GeneratedAction = {
			key: "rmc-1",
			characterId: "rmc",
			actionNo: 1,
			actionValue: 62.5,
			skill: "Q",
			speed: 160,
		};
		const allyAction: GeneratedAction = {
			key: "ally-1",
			characterId: "ally",
			actionNo: 1,
			actionValue: 80,
			skill: "A",
			speed: 100,
		};
		const chars = [
			{
				id: "rmc",
				name: "开拓者·记忆",
				kind: "角色" as const,
				speed: "160",
				baseSpeed: "160",
				hasVonwacq: false,
				hasWindSet: false,
				hasDance: false,
				eidolon: 0,
				superimpose: 1,
				lc_id: 0,
			},
			{
				id: "ally",
				name: "队友",
				kind: "角色" as const,
				speed: "100",
				baseSpeed: "100",
				hasVonwacq: false,
				hasWindSet: false,
				hasDance: false,
				eidolon: 0,
				superimpose: 1,
				lc_id: 0,
			},
		];
		const meme = {
			id: "rmc-meme",
			name: "迷迷",
			kind: "忆灵" as const,
			speed: "130",
			baseSpeed: "130",
			hasVonwacq: false,
			hasWindSet: false,
			hasDance: false,
			eidolon: 0,
			superimpose: 1,
			lc_id: 0,
		};
		renderWithContext(<ActionPanel />, {
			characters: chars,
			characterNames: { rmc: "开拓者·记忆", ally: "队友", "rmc-meme": "迷迷" },
			characterKinds: { rmc: "角色", ally: "角色", "rmc-meme": "忆灵" },
			charactersById: { rmc: chars[0], ally: chars[1], "rmc-meme": meme },
			actions: [rmcQAction, allyAction],
			actionMenuOpen: true,
			actionMenuKey: "ally-1",
			selectedActionKeys: new Set(["ally-1"]),
			memospriteTargets: [meme],
		});

		expect(screen.getByText("迷迷拉条")).toBeInTheDocument();
	});

	it("Sunday 的 E 目标列表不会出现死龙、衣匠、迷迷、长夜", async () => {
		const sundayAction: GeneratedAction = {
			key: "sunday-1",
			characterId: "sunday",
			actionNo: 1,
			actionValue: 50,
			skill: "E",
			speed: 200,
		};
		const chars = [
			{
				id: "sunday",
				name: "星期日",
				kind: "角色" as const,
				speed: "200",
				baseSpeed: "200",
				hasVonwacq: false,
				hasWindSet: false,
				hasDance: false,
				eidolon: 0,
				superimpose: 1,
				lc_id: 0,
			},
			{
				id: "castorice",
				name: "遐蝶",
				kind: "角色" as const,
				speed: "100",
				baseSpeed: "100",
				hasVonwacq: false,
				hasWindSet: false,
				hasDance: false,
				eidolon: 0,
				superimpose: 1,
				lc_id: 0,
			},
			{
				id: "aglaea",
				name: "阿格莱雅",
				kind: "角色" as const,
				speed: "100",
				baseSpeed: "100",
				hasVonwacq: false,
				hasWindSet: false,
				hasDance: false,
				eidolon: 0,
				superimpose: 1,
				lc_id: 0,
			},
			{
				id: "rmc",
				name: "开拓者·记忆",
				kind: "角色" as const,
				speed: "100",
				baseSpeed: "100",
				hasVonwacq: false,
				hasWindSet: false,
				hasDance: false,
				eidolon: 0,
				superimpose: 1,
				lc_id: 0,
			},
			{
				id: "evernight",
				name: "长夜月",
				kind: "角色" as const,
				speed: "100",
				baseSpeed: "100",
				hasVonwacq: false,
				hasWindSet: false,
				hasDance: false,
				eidolon: 0,
				superimpose: 1,
				lc_id: 0,
			},
		];
		const memos = [
			{
				id: "castorice-pollux",
				name: "死龙",
				kind: "忆灵" as const,
				speed: "165",
				baseSpeed: "165",
				hasVonwacq: false,
				hasWindSet: false,
				hasDance: false,
				eidolon: 0,
				superimpose: 1,
				lc_id: 0,
			},
			{
				id: "aglaea-garmentmaker",
				name: "衣匠",
				kind: "忆灵" as const,
				speed: "140",
				baseSpeed: "140",
				hasVonwacq: false,
				hasWindSet: false,
				hasDance: false,
				eidolon: 0,
				superimpose: 1,
				lc_id: 0,
			},
			{
				id: "rmc-meme",
				name: "迷迷",
				kind: "忆灵" as const,
				speed: "130",
				baseSpeed: "130",
				hasVonwacq: false,
				hasWindSet: false,
				hasDance: false,
				eidolon: 0,
				superimpose: 1,
				lc_id: 0,
			},
			{
				id: "evernight-evey",
				name: "长夜",
				kind: "忆灵" as const,
				speed: "160",
				baseSpeed: "160",
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
			characterNames: {
				sunday: "星期日",
				castorice: "遐蝶",
				aglaea: "阿格莱雅",
				rmc: "开拓者·记忆",
				evernight: "长夜月",
				"castorice-pollux": "死龙",
				"aglaea-garmentmaker": "衣匠",
				"rmc-meme": "迷迷",
				"evernight-evey": "长夜",
			},
			characterKinds: {
				sunday: "角色",
				castorice: "角色",
				aglaea: "角色",
				rmc: "角色",
				evernight: "角色",
				"castorice-pollux": "忆灵",
				"aglaea-garmentmaker": "忆灵",
				"rmc-meme": "忆灵",
				"evernight-evey": "忆灵",
			},
			charactersById: {
				sunday: chars[0],
				castorice: chars[1],
				aglaea: chars[2],
				rmc: chars[3],
				evernight: chars[4],
				"castorice-pollux": memos[0],
				"aglaea-garmentmaker": memos[1],
				"rmc-meme": memos[2],
				"evernight-evey": memos[3],
			},
			actions: [sundayAction],
			actionMenuOpen: true,
			actionMenuKey: "sunday-1",
			selectedActionKeys: new Set(["sunday-1"]),
			memospriteTargets: memos,
		});

		await userEvent.click(screen.getByText("无"));
		expect(screen.getByText("遐蝶")).toBeInTheDocument();
		expect(screen.getByText("阿格莱雅")).toBeInTheDocument();
		expect(screen.getByText("开拓者·记忆")).toBeInTheDocument();
		expect(screen.queryByText("死龙")).toBeNull();
		expect(screen.queryByText("衣匠")).toBeNull();
		expect(screen.queryByText("迷迷")).toBeNull();
		expect(screen.queryByText("长夜")).toBeNull();
	});

	it("敌人回合右键菜单会显示长夜自爆开关", () => {
		const enemyAction: GeneratedAction = {
			key: "enemy-1",
			characterId: "enemy",
			actionNo: 1,
			actionValue: 50,
			skill: "",
			speed: 200,
		};
		const chars = [
			{
				id: "evernight",
				name: "长夜月",
				kind: "角色" as const,
				speed: "100",
				baseSpeed: "100",
				hasVonwacq: false,
				hasWindSet: false,
				hasDance: false,
				eidolon: 0,
				superimpose: 1,
				lc_id: 0,
			},
			{
				id: "enemy",
				name: "敌人",
				kind: "敌人" as const,
				speed: "200",
				baseSpeed: "200",
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
			characterNames: {
				evernight: "长夜月",
				enemy: "敌人",
				"evernight-evey": "长夜",
			},
			characterKinds: {
				evernight: "角色",
				enemy: "敌人",
				"evernight-evey": "忆灵",
			},
			charactersById: {
				evernight: chars[0],
				enemy: chars[1],
				"evernight-evey": {
					id: "evernight-evey",
					name: "长夜",
					kind: "忆灵" as const,
					speed: "160",
					baseSpeed: "160",
					hasVonwacq: false,
					hasWindSet: false,
					hasDance: false,
					eidolon: 0,
					superimpose: 1,
					lc_id: 0,
				},
			},
			actions: [enemyAction],
			actionMenuOpen: true,
			actionMenuKey: "enemy-1",
			selectedActionKeys: new Set(["enemy-1"]),
			memospriteTargets: [
				{
					id: "evernight-evey",
					name: "长夜",
					kind: "忆灵" as const,
					speed: "160",
					baseSpeed: "160",
					hasVonwacq: false,
					hasWindSet: false,
					hasDance: false,
					eidolon: 0,
					superimpose: 1,
					lc_id: 0,
				},
			],
		});

		expect(screen.getByText("长夜自爆：")).toBeInTheDocument();
		expect(
			screen.getByText("未填写忆质时，可通过右键手动标记自爆"),
		).toBeInTheDocument();
	});

	it("填写的忆质小于16时，右键菜单会提示本次不会自爆", () => {
		const enemyAction: GeneratedAction = {
			key: "enemy-1",
			characterId: "enemy",
			actionNo: 1,
			actionValue: 50,
			skill: "",
			speed: 200,
		};
		const chars = [
			{
				id: "evernight",
				name: "长夜月",
				kind: "角色" as const,
				speed: "100",
				baseSpeed: "100",
				hasVonwacq: false,
				hasWindSet: false,
				hasDance: false,
				eidolon: 0,
				superimpose: 1,
				lc_id: 0,
			},
			{
				id: "enemy",
				name: "敌人",
				kind: "敌人" as const,
				speed: "200",
				baseSpeed: "200",
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
			characterNames: {
				evernight: "长夜月",
				enemy: "敌人",
				"evernight-evey": "长夜",
			},
			characterKinds: {
				evernight: "角色",
				enemy: "敌人",
				"evernight-evey": "忆灵",
			},
			charactersById: {
				evernight: chars[0],
				enemy: chars[1],
				"evernight-evey": {
					id: "evernight-evey",
					name: "长夜",
					kind: "忆灵" as const,
					speed: "160",
					baseSpeed: "160",
					hasVonwacq: false,
					hasWindSet: false,
					hasDance: false,
					eidolon: 0,
					superimpose: 1,
					lc_id: 0,
				},
			},
			actions: [enemyAction],
			actionMenuOpen: true,
			actionMenuKey: "enemy-1",
			selectedActionKeys: new Set(["enemy-1"]),
			resourceValues: { "enemy-1": { 忆质: "15" } },
			memospriteTargets: [
				{
					id: "evernight-evey",
					name: "长夜",
					kind: "忆灵" as const,
					speed: "160",
					baseSpeed: "160",
					hasVonwacq: false,
					hasWindSet: false,
					hasDance: false,
					eidolon: 0,
					superimpose: 1,
					lc_id: 0,
				},
			],
		});

		expect(screen.getByText("长夜自爆：")).toBeInTheDocument();
		expect(
			screen.getByText("当前忆质 < 16，视为误操作，本次不会自爆"),
		).toBeInTheDocument();
	});

	it("填写的忆质大于等于16时，右键菜单会显示已自爆", () => {
		const enemyAction: GeneratedAction = {
			key: "enemy-1",
			characterId: "enemy",
			actionNo: 1,
			actionValue: 50,
			skill: "",
			speed: 200,
		};
		const chars = [
			{
				id: "evernight",
				name: "长夜月",
				kind: "角色" as const,
				speed: "100",
				baseSpeed: "100",
				hasVonwacq: false,
				hasWindSet: false,
				hasDance: false,
				eidolon: 0,
				superimpose: 1,
				lc_id: 0,
			},
			{
				id: "enemy",
				name: "敌人",
				kind: "敌人" as const,
				speed: "200",
				baseSpeed: "200",
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
			characterNames: {
				evernight: "长夜月",
				enemy: "敌人",
				"evernight-evey": "长夜",
			},
			characterKinds: {
				evernight: "角色",
				enemy: "敌人",
				"evernight-evey": "忆灵",
			},
			charactersById: {
				evernight: chars[0],
				enemy: chars[1],
				"evernight-evey": {
					id: "evernight-evey",
					name: "长夜",
					kind: "忆灵" as const,
					speed: "160",
					baseSpeed: "160",
					hasVonwacq: false,
					hasWindSet: false,
					hasDance: false,
					eidolon: 0,
					superimpose: 1,
					lc_id: 0,
				},
			},
			actions: [enemyAction],
			actionMenuOpen: true,
			actionMenuKey: "enemy-1",
			selectedActionKeys: new Set(["enemy-1"]),
			resourceValues: { "enemy-1": { 忆质: "16" } },
			memospriteTargets: [
				{
					id: "evernight-evey",
					name: "长夜",
					kind: "忆灵" as const,
					speed: "160",
					baseSpeed: "160",
					hasVonwacq: false,
					hasWindSet: false,
					hasDance: false,
					eidolon: 0,
					superimpose: 1,
					lc_id: 0,
				},
			],
		});

		expect(screen.getByText("长夜自爆：")).toBeInTheDocument();
		expect(screen.getByText("已自爆")).toBeInTheDocument();
		expect(
			screen.getByText(
				"当前忆质 >= 16，长夜会在本回合结束后自动以锁定 E 立刻行动并离场",
			),
		).toBeInTheDocument();
	});

	it("敌人回合右键菜单也能显示小伊卡死亡和迷迷死亡", () => {
		const enemyAction: GeneratedAction = {
			key: "enemy-1",
			characterId: "enemy",
			actionNo: 1,
			actionValue: 100,
			skill: "",
			speed: 100,
		};
		const chars = [
			{
				id: "hyacine",
				name: "风堇",
				kind: "角色" as const,
				speed: "100",
				baseSpeed: "100",
				hasVonwacq: false,
				hasWindSet: false,
				hasDance: false,
				eidolon: 0,
				superimpose: 1,
				lc_id: 0,
			},
			{
				id: "rmc",
				name: "开拓者·记忆",
				kind: "角色" as const,
				speed: "100",
				baseSpeed: "100",
				hasVonwacq: false,
				hasWindSet: false,
				hasDance: false,
				eidolon: 0,
				superimpose: 1,
				lc_id: 0,
			},
			{
				id: "enemy",
				name: "敌人",
				kind: "敌人" as const,
				speed: "100",
				baseSpeed: "100",
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
			characterNames: { hyacine: "风堇", rmc: "开拓者·记忆", enemy: "敌人" },
			characterKinds: { hyacine: "角色", rmc: "角色", enemy: "敌人" },
			charactersById: { hyacine: chars[0], rmc: chars[1], enemy: chars[2] },
			actions: [enemyAction],
			actionMenuOpen: true,
			actionMenuKey: "enemy-1",
			selectedActionKeys: new Set(["enemy-1"]),
		});

		expect(screen.getByText("小伊卡死亡：")).toBeInTheDocument();
		expect(screen.getByText("迷迷死亡：")).toBeInTheDocument();
	});

	it("迷迷自己的回合右键菜单也能标记迷迷死亡", () => {
		const memeAction: GeneratedAction = {
			key: "rmc-1-meme",
			characterId: "rmc-meme",
			displayName: "迷迷",
			actionNo: 0,
			actionValue: 62.5,
			skill: "拉条",
			speed: 130,
			isMemeAction: true,
			isMemospriteAction: true,
			memospriteOwnerId: "rmc",
		};
		const chars = [
			{
				id: "rmc",
				name: "开拓者·记忆",
				kind: "角色" as const,
				speed: "160",
				baseSpeed: "160",
				hasVonwacq: false,
				hasWindSet: false,
				hasDance: false,
				eidolon: 0,
				superimpose: 1,
				lc_id: 0,
			},
		];
		const meme = {
			id: "rmc-meme",
			name: "迷迷",
			kind: "忆灵" as const,
			speed: "130",
			baseSpeed: "130",
			hasVonwacq: false,
			hasWindSet: false,
			hasDance: false,
			eidolon: 0,
			superimpose: 1,
			lc_id: 0,
		};
		renderWithContext(<ActionPanel />, {
			characters: chars,
			characterNames: { rmc: "开拓者·记忆", "rmc-meme": "迷迷" },
			characterKinds: { rmc: "角色", "rmc-meme": "忆灵" },
			charactersById: { rmc: chars[0], "rmc-meme": meme },
			actions: [memeAction],
			actionMenuOpen: true,
			actionMenuKey: "rmc-1-meme",
			selectedActionKeys: new Set(["rmc-1-meme"]),
			memospriteTargets: [meme],
		});

		expect(screen.getByText("迷迷死亡：")).toBeInTheDocument();
	});
});
