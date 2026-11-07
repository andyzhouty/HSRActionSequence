import { readFileSync, writeFileSync } from "node:fs";
import { it } from "vitest";
import { simulateElationTeam } from "../../src/damage/elationTeam";
import type { ElationTeamConfig } from "../../src/damage/elationTypes";

const dir = process.env.HSR_ELATION_MAX_AXIS_DIR ?? "build/elation-max-axis";
const WOLF = "银狼LV.999";

type Policy = { name: string; patch: Partial<ElationTeamConfig> };

const DEFAULTS: Partial<ElationTeamConfig> = {
	wolfUltMinScore: 60,
	wolfUltRushWindow: 0,
	wolfSupportTiming: "immediate",
	starSkillEvery: 1,
	pearlSkillEvery: 3,
	starEnvoyId: "",
	pearlBlueprintId: "",
};

const POLICIES: Policy[] = [
	{ name: "A 默认轴：满60就开，真珠3动1E，底本=虚照", patch: DEFAULTS },
	{
		name: "B 攒到560再开，末段20AV放宽；真珠4动1E",
		patch: {
			...DEFAULTS,
			wolfUltMinScore: 560,
			wolfUltRushWindow: 20,
			pearlSkillEvery: 4,
		},
	},
	{
		name: "C 攒到560再开，末段60AV放宽",
		patch: {
			...DEFAULTS,
			wolfUltMinScore: 560,
			wolfUltRushWindow: 60,
			pearlSkillEvery: 4,
		},
	},
	{
		name: "D 攒到620再开，末段150AV放宽",
		patch: {
			...DEFAULTS,
			wolfUltMinScore: 620,
			wolfUltRushWindow: 150,
			pearlSkillEvery: 4,
		},
	},
	{
		name: "E 攒到300再开，末段150AV放宽",
		patch: {
			...DEFAULTS,
			wolfUltMinScore: 300,
			wolfUltRushWindow: 150,
			pearlSkillEvery: 4,
		},
	},
	{
		name: "F 首轮攒到210，末段150AV放宽；底本=银狼",
		patch: {
			...DEFAULTS,
			wolfUltMinScore: 210,
			wolfUltRushWindow: 150,
			pearlSkillEvery: 4,
			pearlBlueprintId: "freesr-1506",
		},
	},
	{
		name: "G 同B但底本给银狼",
		patch: {
			...DEFAULTS,
			wolfUltMinScore: 560,
			wolfUltRushWindow: 20,
			pearlSkillEvery: 4,
			pearlBlueprintId: "freesr-1506",
		},
	},
	{
		name: "H 同B但真珠改回3动1E",
		patch: {
			...DEFAULTS,
			wolfUltMinScore: 560,
			wolfUltRushWindow: 20,
		},
	},
	{
		name: "I 同B但队友Q改攒到240再放",
		patch: {
			...DEFAULTS,
			wolfUltMinScore: 560,
			wolfUltRushWindow: 20,
			pearlSkillEvery: 4,
			wolfSupportTiming: "score240",
		},
	},
	{
		name: "J 同B但虚照E改2动1次",
		patch: {
			...DEFAULTS,
			wolfUltMinScore: 560,
			wolfUltRushWindow: 20,
			pearlSkillEvery: 4,
			starSkillEvery: 2,
		},
	},
];

it.skipIf(process.env.HSR_ELATION_FINAL !== "1")(
	"validates the candidate axes on a fresh seed block",
	() => {
		const base = JSON.parse(
			readFileSync(`${dir}/best-config.json`, "utf8"),
		) as ElationTeamConfig;
		const SEEDS = 400,
			OFFSET = 1000000;
		const run = (
			patch: Partial<ElationTeamConfig>,
			n = SEEDS,
			offset = OFFSET,
		) => {
			const per: number[] = [];
			let wolf = 0;
			let cycles = 0,
				basics = 0;
			for (let i = 0; i < n; i++) {
				const r = simulateElationTeam({
					...base,
					...patch,
					seed: base.seed + offset + i,
				});
				per.push(r.total);
				wolf += r.byActor[WOLF] ?? 0;
				cycles += r.cycles.length;
				basics += r.cycles.reduce((s, c) => s + c.basics, 0);
			}
			per.sort((a, b) => a - b);
			return {
				mean: per.reduce((a, b) => a + b, 0) / n,
				wolf: wolf / n,
				cycles: cycles / n,
				basics: basics / n,
				p10: per[Math.floor(n * 0.1)],
				p90: per[Math.floor(n * 0.9)],
				max: per[n - 1],
			};
		};

		const rows = POLICIES.map((p) => ({
			...p,
			result: run(p.patch),
			ceiling: run({ ...p.patch, critExpectation: false }, 200, 7000000),
		}));
		const reference = rows[0].result.mean;

		// 假设敏感性：在最优轴上逐个改动机制口径与盲盒剔除阈值
		const control = run(rows[1].patch, 160, 2000000);
		const sensitivity = [
			{ label: "暴击按每次都命中结算", patch: { critExpectation: false } },
			{ label: "盲盒剔除阈值 0（不剔除）", patch: { boxMinProbability: 0 } },
			{ label: "盲盒剔除阈值 0.03", patch: { boxMinProbability: 0.03 } },
			{ label: "盲盒剔除阈值 0.10", patch: { boxMinProbability: 0.1 } },
			{
				label: "强化A内置盲盒也触发大吉大利",
				patch: { boxCountsAsAttack: true },
			},
			{
				label: "阿哈时刻先发好活再结算欢愉技",
				patch: { applausePhase: "before" as const },
			},
			{
				label: "真珠复制取底本好活",
				patch: { pearlCopyApplause: "blueprint" as const },
			},
		].map((s) => ({
			...s,
			atBest: run({ ...rows[1].patch, ...s.patch }, 160, 2000000),
		}));

		const example = simulateElationTeam({ ...base, ...POLICIES[1].patch });
		const md = [
			"# 欢愉队 300 行动值最高伤害轴",
			"",
			"## 队伍与面板（四人 6 魂、指定叠 5 专锥、指定副词条取中间值）",
			"",
			"|角色|光锥|速度|攻击力|暴击率|暴击伤害|防御力|欢愉度|遗器|",
			"|---|---|---:|---:|---:|---:|---:|---:|---|",
			...base.profiles.map(
				(p) =>
					`|${p.character.name}|${p.character.lc_id} 叠${p.character.superimpose}|${p.speed.toFixed(1)}|${p.attack.toFixed(0)}|${(p.critRate * 100).toFixed(2)}%|${(p.critDamage * 100).toFixed(2)}%|${(p.defense ?? 0).toFixed(0)}|${(p.elation * 100).toFixed(0)}%|${Object.entries(
						p.gear.sets,
					)
						.map(([k, v]) => `${k}×${v}`)
						.join(" ")}|`,
			),
			"",
			"## 候选轴（400 个独立种子，300 行动值，95 级单体 132 速）",
			"",
			"|轴|平均伤害|相对默认轴|运气上限(期望暴击)|全暴击均值|全暴击上限|银狼|开大次数|强化A次数|",
			"|---|---:|---:|---:|---:|---:|---:|---:|---:|",
			...rows.map(
				(r) =>
					`|${r.name}|${(r.result.mean / 1e8).toFixed(3)}亿|${((r.result.mean / reference - 1) * 100).toFixed(2)}%|${(r.result.max / 1e8).toFixed(3)}亿|${(r.ceiling.mean / 1e8).toFixed(3)}亿|${(r.ceiling.max / 1e8).toFixed(3)}亿|${(r.result.wolf / 1e8).toFixed(3)}亿|${r.result.cycles.toFixed(2)}|${r.result.basics.toFixed(2)}|`,
			),
			"",
			"## 假设敏感性（最优轴，160 个种子）",
			"",
			"|假设改动|平均伤害|相对基准|",
			"|---|---:|---:|",
			`|（基准：最优轴默认口径）|${(control.mean / 1e8).toFixed(3)}亿|—|`,
			...sensitivity.map(
				(s) =>
					`|${s.label}|${(s.atBest.mean / 1e8).toFixed(3)}亿|${((s.atBest.mean / control.mean - 1) * 100).toFixed(2)}%|`,
			),
			"",
			"## 最优轴的单次逐轮明细（种子 20261106）",
			"",
			"|轮次|开大 AV|退大 AV|入场隐藏分|峰值隐藏分|强化A次数|额外回合|",
			"|---|---:|---:|---:|---:|---:|---:|",
			...example.cycles.map(
				(c, i) =>
					`|${i + 1}|${c.start.toFixed(2)}|${c.end?.toFixed(2) ?? "300AV内未退大"}|${c.entryHidden}|${c.peakHidden}|${c.basics}|${c.usedExtras}|`,
			),
			"",
			`本次总伤害 ${(example.total / 1e8).toFixed(3)} 亿：${Object.entries(
				example.byActor,
			)
				.map(([k, v]) => `${k} ${(v / 1e8).toFixed(3)}亿`)
				.join("、")}`,
		].join("\n");

		writeFileSync(`${dir}/final.md`, md);
		writeFileSync(
			`${dir}/final.json`,
			JSON.stringify(
				{
					rows,
					sensitivity,
					example: {
						cycles: example.cycles,
						byActor: example.byActor,
						total: example.total,
					},
				},
				null,
				2,
			),
		);
		console.log(md);
	},
	1800000,
);
