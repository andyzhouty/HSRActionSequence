import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { expect, it } from "vitest";
import {
	type ElationDamageRow,
	simulateElationTeam,
} from "../../src/damage/elationTeam";
import { toNormalizedSavedData } from "../../src/pages/action-sequence/savedData";

const source =
	process.env.HSR_ELATION_EXAMPLE_SOURCE ??
	"build/elation-star-absent-base80/variant-preset.json";
it.skipIf(process.env.HSR_ELATION_EXAMPLE !== "1" || !existsSync(source))(
	"exports one reproducible resource-audited axis with complete post-action resource snapshots",
	() => {
		const saved = toNormalizedSavedData(
			JSON.parse(readFileSync(source, "utf8")),
		);
		const config = saved.elationTeamTrial;
		if (!config) throw new Error("Missing config");
		if (!process.env.HSR_ELATION_EXAMPLE_SOURCE) {
			const reference = JSON.parse(
				readFileSync(
					"build/elation-star-absent-base80/variant-result.json",
					"utf8",
				),
			);
			expect(simulateElationTeam(config).total).toBeCloseTo(reference.total, 5);
		}
		const p90 = process.env.HSR_ELATION_EXAMPLE_P90 === "1";
		const samples = Array.from({ length: p90 ? 100 : 1 }, (_, i) => {
			const cfg = { ...config, seed: p90 ? 20281106 + i : 20261135 };
			return { cfg, result: simulateElationTeam(cfg) };
		}).sort((a, b) => a.result.total - b.result.total);
		const selected = samples[p90 ? 90 : 0];
		if (p90) {
			const reference = JSON.parse(
				readFileSync("build/elation-custom-rolls/comparison.json", "utf8"),
			);
			expect(selected.result.total).toBeCloseTo(reference.requested.p90, 5);
		}

		const r = selected.result;
		const short = (actor: string) =>
			actor.includes("银狼")
				? "狼"
				: actor.includes("爻光")
					? "爻"
					: actor.includes("开拓者")
						? "主"
						: actor === "藿藿"
							? "藿"
							: "敌";
		const groups: { av: number; ops: string[]; last: ElationDamageRow }[] = [];
		let inMoment = false;
		for (const row of r.rows) {
			let g = groups.at(-1);
			if (!g || Math.abs(g.av - row.av) > 1e-7) {
				g = { av: row.av, ops: [], last: row };
				groups.push(g);
			}
			g.last = row;
			let op = "";
			if (row.skill === "开场") op = "秘技入场";
			if (row.skill === "敌方群攻") op = "敌方群攻";
			if (row.skill === "Q")
				op =
					short(row.actor) +
					"Q" +
					(short(row.actor) === "主" ? "（狼ES20）" : "");
			if (row.skill === "阿哈时刻") {
				op = row.detail.replace(/时刻#\d+，计入/, "·").replace("笑点", "");
				inMoment = true;
			}
			if (row.skill === "阿哈时刻结束") inMoment = false;
			if (
				row.detail === "银狼普通技能" ||
				row.detail === "欢愉主普通技能" ||
				row.detail === "爻光行动后" ||
				row.detail === "禳命与同一种心情回能" ||
				row.detail === "藿藿生命值普攻"
			)
				op = short(row.actor) + row.skill;
			if (row.skill === "强化A结束")
				op = `狼A★${row.detail === "E2额外回合" ? "（额外）" : ""}`;
			if (row.skill === "退场") op = "退大";
			if (op) g.ops.push(op);
		}
		expect(inMoment).toBe(false);
		expect(groups.every((g) => g.ops.length > 0)).toBe(true);
		const out =
			process.env.HSR_ELATION_EXAMPLE_OUT ??
			"build/elation-resource-audit/corrected-example";
		mkdirSync(out, { recursive: true });
		writeFileSync(
			join(out, "preset.json"),
			JSON.stringify({ ...saved, elationTeamTrial: selected.cfg }, null, 2),
		);
		writeFileSync(join(out, "result.json"), JSON.stringify(r, null, 2));
		const f = (n: number) => n.toFixed(1);
		const formatGroup = (g: (typeof groups)[number]) =>
			`|${g.av.toFixed(4)}|${g.ops.join(" → ")}|${g.last.hidden} / ${g.last.jokes}|${["爻光", "开拓者·欢愉（女）", "藿藿"].map((a) => f(g.last.energy[a] ?? 0)).join(" / ")}|`;
		const first = r.cycles[0],
			second = r.cycles[1];
		const parts = [
			{ label: "启动", from: 0, to: first.start },
			{ label: "第一轮爆发", from: first.start, to: first.end ?? 300 },
			{
				label: "第二轮启动与爆发",
				from: first.end ?? 300,
				to: second?.end ?? 300,
			},
			{ label: "尾段收束", from: second?.end ?? 300, to: 301 },
		];
		const lines = [
			`# ${(r.total / 1e6).toFixed(3)}M · 银狼攒分轴`,
			"",
			`总伤害 **${r.total.toFixed(2)}**；随机种子 **${selected.cfg.seed}**。单个95级、132速敌人；阿哈基础80；隐藏分保留去尾取整。`,
			"",
			"当前配置以同目录preset.json为准；用户自定义副词条样例包含银狼暴伤衣、爻光当她决定看见S1与主角伶人套。",
			"",
			"狼=银狼，爻=爻光，主=欢愉主，藿=藿藿；A★为强化普攻，ES及阿哈时刻自动触发。同AV严格按箭头顺序；隐藏分和能量为该时点所有事件结算完后的值。常规能量按爻/主/藿排列，银狼使用隐藏分。",
			"",
			"|角色|伤害（万）|占比|",
			"|---|---:|---:|",
			...Object.entries(r.byActor).map(
				([a, n]) =>
					`|${a}|${(n / 10000).toFixed(1)}|${((n / r.total) * 100).toFixed(1)}%|`,
			),
			"",
			"|爆发轮次|开Q AV|退大AV|最高隐藏分|强化A/其中额外A|",
			"|---|---:|---|---:|---:|",
			...r.cycles.map(
				(c, i) =>
					`|${i + 1}|${c.start.toFixed(4)}|${c.end?.toFixed(4) ?? "300AV内未退大"}|${c.peakHidden}|${c.basics} / ${c.usedExtras}|`,
			),
		];
		for (const [index, p] of parts.entries()) {
			const gs = groups.filter(
				(g) =>
					(index > 1 ? g.av > p.from + 1e-8 : g.av >= p.from - 1e-8) &&
					(index === 0 ? g.av < p.to - 1e-8 : g.av <= p.to + 1e-8),
			);
			if (!gs.length) continue;
			lines.push(
				"",
				`## ${p.label}`,
				"",
				"|AV|动作顺序|隐藏分 / 笑点|常规能量：爻/主/藿|",
				"|---:|---|---:|---:|",
				...gs.map(formatGroup),
			);
		}
		lines.push(
			"",
			"这是单个模拟样本；盲盒按当前SP与隐藏分动态采样，默认a=C/8，暴击取期望，并非游戏实测。P90模式取此前100样本升序第91条，不另外拟合伤害。",
		);
		writeFileSync(join(out, "axis.md"), lines.join("\n"));
		writeFileSync(
			join(out, "timeline.json"),
			JSON.stringify(
				{
					total: r.total,
					seed: selected.cfg.seed,
					cycles: r.cycles,
					byActor: r.byActor,
					groups,
				},
				null,
				2,
			),
		);
	},
	120000,
);
