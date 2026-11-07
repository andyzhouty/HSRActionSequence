import { getCharacterCid } from "../data/characters";
import {
	type NormalizedSavedData,
	toNormalizedSavedData,
} from "../pages/action-sequence/savedData";
import { simulateActions } from "../simulate/actions";
import type { GeneratedAction } from "../utils/action-sequence/types";
import { getDisplayOrderedActions } from "../utils/actionDisplayOrder";
import { calculatePhainonTrial, type TrialRow } from "./phainonTrial";
import { createPhainonTrialPreset } from "./preset";
import type { PhainonTrialConfig } from "./types";

type Cast = { actor: string; after: string; timing?: "before" | "after" };
type Plan = { skills: Record<string, string>; casts: Cast[] };
export type AxisCandidate = {
	saved: NormalizedSavedData;
	actions: GeneratedAction[];
	rows: TrialRow[];
	score: number;
	plan: Plan;
};
export type SearchOptions = {
	seed?: NormalizedSavedData;
	evaluateSeedOnly?: boolean;
	/** 这些插入必须在每条候选轴里出现，其余位置照常搜索。 */
	lockedCasts?: Cast[];
	/** 每个留存毁伤点在下一个境界的期望价值；0 表示只按单境界最优。 */
	ruinCarryValue?: number;
	/** 行动值上限，默认 300。 */
	limit?: number;
	/** 覆盖导入的面板参数（例如把暴击率按满暴处理）。 */
	configOverride?: Partial<PhainonTrialConfig>;
	budget?: number;
	restarts?: number;
	onProgress?: (message: string) => void;
};

/**
 * Exact finite DP over this E2 single-target domain's legal A/E/W/EA/EW choices.
 * `ruinValue` 是留在手里的每点毁伤对下一个境界的期望价值；不传时只按本境界伤害最优，
 * 会倾向于在收尾把毁伤打光，这与「留 2 点给下一次变身」的实战打法相反。
 */
export function optimizeDomain(
	initialRuin: number,
	visibleSlots: number,
	enemyCount = 1,
	ruinValue = 0,
	ruinEndCap?: number,
) {
	const memo = new Map<string, { value: number; path: string[] }>();
	const solve = (
		index: number,
		ruin: number,
	): { value: number; path: string[] } => {
		if (index === 7) {
			// 收尾留存的毁伤超过上限时，这个结局不可取。
			if (ruinEndCap !== undefined && ruin > ruinEndCap)
				return { value: -Infinity, path: [] };
			return { value: ruin * 1e-9 + Math.min(ruin, 2) * ruinValue, path: [] };
		}
		const key = `${index}:${ruin}`;
		const cached = memo.get(key);
		if (cached) return cached;
		const spent = Math.min(4, ruin);
		const e = spent * 1.8 + (spent === 4 ? 4.5 : 0);
		const a = 2.5 + 0.75 * Math.min(2, enemyCount - 1);
		const w = (0.4 * enemyCount + 1.2) * (1 + 0.2 * (enemyCount + 1));
		// 对单时 A 严格优于 W：伤害更高且毁伤 +2，不再把 W 放进候选。
		const choices =
			enemyCount > 1
				? [
						{ skill: "A", next: Math.min(7, ruin + 2), damage: a },
						{ skill: "W", next: Math.min(7, ruin + enemyCount), damage: w },
					]
				: [{ skill: "A", next: Math.min(7, ruin + 2), damage: a }];
		if (spent === 4)
			choices.push(
				{ skill: "EA", next: Math.min(7, ruin - 4 + 2), damage: e + a },
				{
					skill: "EW",
					next: Math.min(7, ruin - 4 + enemyCount),
					damage: e + w,
				},
			);
		else if (spent > 0) choices.push({ skill: "E", next: 0, damage: e });
		let best = { value: -Infinity, path: [] as string[] };
		for (const choice of choices) {
			const tail = solve(index + 1, choice.next);
			const value = (index < visibleSlots ? choice.damage : 0) + tail.value;
			if (value > best.value)
				best = { value, path: [choice.skill, ...tail.path] };
		}
		memo.set(key, best);
		return best;
	};
	return solve(0, initialRuin).path;
}

/** Deterministic coordinate/restart search; reports a best found axis, not a global proof. */
export function searchPhainonAxis(raw: unknown, options: SearchOptions = {}) {
	const base = toNormalizedSavedData(
		createPhainonTrialPreset(raw, "freesr-data(4).json"),
	);
	const trial = base.phainonDamageTrial;
	if (!trial) throw new Error("缺少伤害设置");
	// 面板覆盖写回 base，导出的轴才会带着同一套参数。
	const config = options.configOverride
		? { ...trial, ...options.configOverride }
		: trial;
	base.phainonDamageTrial = config;
	const ids = ["1101", "1306", "1309", "1408"].map((cid) => {
		const actor = base.characters.find(
			(character) => getCharacterCid(character.name) === cid,
		);
		if (!actor) throw new Error(`缺少${cid}`);
		return actor.id;
	});
	const white = ids[3],
		robin = ids[2];
	const budget = options.budget ?? 20000;
	const horizon = options.limit ?? 300;
	const ruinCarryValue = options.ruinCarryValue ?? 0;
	const visited = new Set<string>();
	let evaluations = 0,
		valid = 0,
		lastProgress = Date.now();
	let randomState = 0x5eeda11;
	const random = () => {
		randomState ^= randomState << 13;
		randomState ^= randomState >>> 17;
		randomState ^= randomState << 5;
		return (randomState >>> 0) / 4294967296;
	};
	const clone = (plan: Plan): Plan => ({
		skills: { ...plan.skills },
		casts: plan.casts.map((cast) => ({ ...cast })),
	});
	const sameCast = (a: Cast, b: Cast) =>
		a.actor === b.actor &&
		a.after === b.after &&
		(a.timing ?? "after") === (b.timing ?? "after");
	const locked = options.lockedCasts ?? [];
	const isLocked = (cast: Cast) => locked.some((item) => sameCast(item, cast));
	const keyOf = (plan: Plan) =>
		JSON.stringify([
			Object.entries(plan.skills).sort(),
			[...plan.casts]
				.sort(
					(a, b) =>
						a.after.localeCompare(b.after) ||
						ids.indexOf(a.actor) - ids.indexOf(b.actor) ||
						(a.timing ?? "after").localeCompare(b.timing ?? "after"),
				)
				.map((cast) => [cast.actor, cast.after, cast.timing ?? "after"]),
		]);
	const roots = (actions: GeneratedAction[]) =>
		actions
			.filter(
				(action) =>
					action.actionNo > 0 &&
					!action.isDomainAction &&
					!action.isFuaAction &&
					!action.key.includes("-interrupt-") &&
					!action.key.endsWith("-q") &&
					(ids.includes(action.characterId) ||
						action.characterId === "damage-trial-enemy"),
			)
			.map((action) => action.key);
	const run = (saved: NormalizedSavedData) => {
		const actions = getDisplayOrderedActions(
			simulateActions({
				...saved,
				limit: horizon,
				legacyUltOverrides: saved.ultOverrides,
			}),
			saved.sameAVOrder,
		).filter((action) => action.actionValue <= horizon);
		const result = calculatePhainonTrial({
			characters: saved.characters,
			actions,
			config,
			skillTargets: saved.skillTargets,
			defaultSkillTargets: saved.defaultSkillTargets,
			attackDisabled: saved.attackDisabled,
			meritTarget: saved.meritTarget,
		});
		return { actions, result };
	};
	const evaluate = (plan: Plan, force = false): AxisCandidate | undefined => {
		if (evaluations >= budget && !force) return undefined;
		if (locked.length) {
			const missing = locked.filter(
				(cast) => !plan.casts.some((item) => sameCast(item, cast)),
			);
			if (missing.length)
				plan = {
					skills: { ...plan.skills },
					casts: [...plan.casts.map((cast) => ({ ...cast })), ...missing],
				};
		}
		const key = keyOf(plan);
		if (!force && visited.has(key)) return undefined;
		visited.add(key);
		evaluations++;
		try {
			const saved = {
				...base,
				overrides: {},
				skillOverrides: { ...plan.skills },
				ultInterrupts: {} as NormalizedSavedData["ultInterrupts"],
			};
			for (const cast of [...plan.casts].sort(
				(a, b) => ids.indexOf(a.actor) - ids.indexOf(b.actor),
			)) {
				saved.ultInterrupts[cast.after] ??= [];
				saved.ultInterrupts[cast.after].push({
					casterId: cast.actor,
					timing: cast.timing ?? "after",
				});
			}
			let replay = run(saved);
			// A filled first domain changes both retained ruin and Robin's energy in later domains.
			for (let pass = 0; pass < 3; pass++) {
				const groups = new Map<string, GeneratedAction[]>();
				for (const action of replay.actions.filter(
					(action) => action.isDomainAction,
				)) {
					const prefix = action.key.replace(/-domain-\d+$/, "");
					const group = groups.get(prefix) ?? [];
					group.push(action);
					groups.set(prefix, group);
				}
				let changed = false;
				const order = [...groups.entries()];
				for (const [groupIndex, [prefix, group]] of order.entries()) {
					const firstIndex = replay.result.rows.findIndex(
						(row) =>
							row.key === group[0].key ||
							row.key.startsWith(`${group[0].key}-damage-`),
					);
					const opening = replay.result.rows
						.slice(0, firstIndex)
						.reverse()
						.find((row) => row.description.includes("展开境界"));
					if (!opening) continue;
					// 后面还有境界时，收尾剩下的毁伤对下一次变身有价值。
					const path = optimizeDomain(
						opening.ruin,
						group.filter((action) => !action.isDomainFinalAction).length,
						config.enemyCount,
						groupIndex === order.length - 1 ? 0 : ruinCarryValue,
						groupIndex === order.length - 1 || ruinCarryValue <= 0
							? undefined
							: 2,
					);
					for (let index = 0; index < 7; index++) {
						const actionKey = `${prefix}-domain-${index}`;
						if (saved.skillOverrides[actionKey] !== path[index]) {
							saved.skillOverrides[actionKey] = path[index];
							changed = true;
						}
					}
				}
				if (!changed) break;
				replay = run(saved);
			}
			if (
				replay.result.warnings.length ||
				replay.result.rows.some((row) => row.warnings.length)
			)
				return undefined;
			for (const id of ids) {
				const expected = plan.casts.filter((cast) => cast.actor === id).length;
				const actual = replay.actions.filter(
					(action) =>
						action.characterId === id &&
						action.skill === "Q" &&
						!action.isDomainAction,
				).length;
				if (actual > expected) return undefined;
			}
			// An earlier domain can freeze a later planned anchor beyond the horizon.
			// Remove those non-executed casts instead of rejecting the earlier opening.
			const executed = plan.casts.filter((cast) =>
				replay.actions.some(
					(action) =>
						action.characterId === cast.actor &&
						action.skill === "Q" &&
						!action.isDomainAction &&
						action.key.startsWith(`${cast.after}-interrupt-`) &&
						action.interruptTiming === (cast.timing ?? "after"),
				),
			);
			// 指定的插入必须真的执行过，否则这条候选不满足约束。
			if (locked.some((cast) => !executed.some((item) => sameCast(item, cast))))
				return undefined;
			const actualPlan = { skills: { ...plan.skills }, casts: executed };
			for (const key of Object.keys(saved.ultInterrupts))
				if (!executed.some((cast) => cast.after === key))
					delete saved.ultInterrupts[key];
			valid++;
			return {
				saved,
				actions: replay.actions,
				rows: replay.result.rows,
				score:
					replay.result.rows[replay.result.rows.length - 1]?.cumulative ?? 0,
				plan: actualPlan,
			};
		} catch {
			return undefined;
		}
	};
	const initial: Plan = {
		skills: {},
		casts: [
			{ actor: ids[0], after: `${ids[0]}-1` },
			{ actor: ids[1], after: `${ids[1]}-1` },
			{ actor: robin, after: `${robin}-1` },
			{ actor: white, after: `${ids[0]}-2` },
		],
	};
	for (const id of ids)
		for (let i = 1; i <= 14; i++)
			initial.skills[`${id}-${i}`] =
				id === white && i > 2 ? "A" : id === robin && i > 1 ? "A" : "E";
	const original = run(base);
	const baselineScore =
		original.result.rows[original.result.rows.length - 1]?.cumulative ?? 0;
	const seedPlan: Plan | undefined = options.seed
		? {
				skills: Object.fromEntries(
					Object.entries(options.seed.skillOverrides).filter(
						([key]) => !key.includes("-domain-"),
					),
				),
				casts: Object.entries(options.seed.ultInterrupts).flatMap(
					([after, casts]) =>
						casts.map((cast) => ({
							actor: cast.casterId,
							after,
							timing: cast.timing,
						})),
				),
			}
		: undefined;
	const seedCandidate = seedPlan ? evaluate(seedPlan) : undefined;
	if (options.evaluateSeedOnly && !seedCandidate)
		throw new Error("给定行动轴未通过资源或能量校验");
	// 锁定插入可能让默认轴不成立，此时以给定的种子轴为起点。
	const initialCandidate = options.evaluateSeedOnly
		? undefined
		: evaluate(initial);
	let best = options.evaluateSeedOnly
		? seedCandidate
		: seedCandidate &&
				(!initialCandidate || seedCandidate.score > initialCandidate.score)
			? seedCandidate
			: initialCandidate;
	if (!best) throw new Error("搜索初始轴未通过资源/能量校验");
	const baselineRoots = roots(
		run({ ...base, skillOverrides: initial.skills, ultInterrupts: {} }).actions,
	);
	const notify = () => {
		if (Date.now() - lastProgress > 10000) {
			options.onProgress?.(
				`已评估${evaluations}条轴，合法${valid}条，最高${best?.score.toFixed(2)}`,
			);
			lastProgress = Date.now();
		}
	};
	const consider = (plan: Plan) => {
		const candidate = evaluate(plan);
		if (candidate && candidate.score > (best?.score ?? -Infinity) + 1e-6) {
			best = candidate;
		}
		notify();
		return candidate;
	};
	for (
		let restart = 0;
		restart < (options.evaluateSeedOnly ? 0 : (options.restarts ?? 5)) &&
		evaluations < budget;
		restart++
	) {
		if (restart > 0) {
			for (let attempt = 0; attempt < 60 && evaluations < budget; attempt++) {
				const seed = clone(best.plan);
				const anchors = [
					...new Set([...roots(best.actions), ...baselineRoots]),
				];
				const count = 1 + Math.floor(random() * 3);
				for (let mutation = 0; mutation < count; mutation++) {
					const actor = ids[Math.floor(random() * ids.length)];
					if (random() < 0.6) {
						const casts = seed.casts.filter(
							(cast) => cast.actor === actor && !isLocked(cast),
						);
						if (casts.length)
							casts[Math.floor(random() * casts.length)].after =
								anchors[Math.floor(random() * anchors.length)];
					} else {
						const index = 1 + Math.floor(random() * 7);
						const key = `${actor}-${index}`;
						seed.skills[key] = seed.skills[key] === "E" ? "A" : "E";
					}
				}
				consider(seed);
			}
		}
		for (let round = 0; round < 5 && evaluations < budget; round++) {
			const startScore = best.score;
			const anchors = [...new Set([...roots(best.actions), ...baselineRoots])];
			// Coordinate moves preserve normal turn times; only insert ultimate interrupts.
			for (const actor of [white, ...ids.slice(0, 3)]) {
				// 白厄自身在他回合内先开大会直接变身、该回合不能再用E，暂不开放before。
				const timings: ("before" | "after")[] =
					actor === white ? ["after"] : ["after", "before"];
				const existing = best.plan.casts.filter((cast) => cast.actor === actor);
				for (let index = 0; index < existing.length; index++)
					for (const after of anchors)
						for (const timing of timings) {
							const plan = clone(best.plan);
							const list = plan.casts.filter((cast) => cast.actor === actor);
							if (list[index]) list[index] = { ...list[index], after, timing };
							consider(plan);
						}
				if (best.plan.casts.filter((cast) => cast.actor === actor).length < 3)
					for (const after of anchors)
						for (const timing of timings) {
							const plan = clone(best.plan);
							if (
								!plan.casts.some(
									(cast) =>
										cast.actor === actor &&
										cast.after === after &&
										(cast.timing ?? "after") === timing,
								)
							) {
								plan.casts.push({ actor, after, timing });
								consider(plan);
							}
						}
			}
			for (const action of best.actions.filter(
				(action) =>
					action.actionNo > 0 &&
					!action.isDomainAction &&
					ids.includes(action.characterId),
			)) {
				const plan = clone(best.plan);
				plan.skills[action.key] = plan.skills[action.key] === "E" ? "A" : "E";
				consider(plan);
			}
			if (best.score <= startScore + 1e-6) break;
		}
	}
	// Return an independently replayed, resource-valid copy, not a cached score.
	const verified = evaluate(best.plan, true) ?? best;
	return {
		best: verified,
		baselineScore,
		evaluations,
		valid,
		constraints: [
			"固定配装，95级单敌，200速群攻",
			"300行动值，仅白厄自身期望伤害",
			"A/E选择、Q插入位置及同场多次Q；校验能量、火种、战技点与毁伤",
			"不修改自然行动值、不主动提前退场、不计击杀和布洛妮娅随机返还",
			"坐标搜索与确定性扰动，未证明全局最优",
		],
	};
}
