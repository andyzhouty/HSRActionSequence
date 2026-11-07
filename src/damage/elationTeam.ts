import { getCharacterBaseSpeed, getCharacterCid } from "../data/characters";
import { getPearlAdvancePercent } from "../mechanics/pearl";
import {
	drawSparxieLottery,
	sparxieInitialPity,
	startSparxieLottery,
} from "../mechanics/sparxieLottery";
import { calculateElationDamage } from "./elationFormula";
import {
	type ElationTeamConfig,
	normalizeElationTeamConfig,
	resolveElationAhaBaseSpeed,
} from "./elationTypes";
import type { EquipmentProfile } from "./equipment";
import { calculateDamage, type DamageFactors } from "./formula";
import {
	lightconeParameters,
	rankParameters,
	skillParameters,
	traceParameters,
} from "./metadata";
import {
	consumePearlResistance,
	pearlDefenseElation,
	pearlExtraReward,
} from "./pearlDamage";
import {
	pruneSilverWolfBoxProbabilities,
	type SilverWolfBoxContext,
	silverWolfBoxProbabilities,
} from "./silverWolfBox";
import { pathAscension, starAhaAscension } from "./starAhaDamage";
import { defaultPhainonTrialConfig } from "./types";

type Actor = {
	p: EquipmentProfile;
	cid: string;
	turn: number;
	actions: number;
	energy: number;
	maximum: number;
	speed: number;
	next: number;
	applause: { value: number; until: number }[];
};
type Buff = {
	id: string;
	target: string;
	stat:
		| "attack"
		| "cd"
		| "elation"
		| "pen"
		| "speed"
		| "vulnerability"
		| "elationVulnerability";
	value: number;
	until: number;
};
export type ElationEnergyEvent = {
	id: number;
	actor: string;
	source: string;
	base: number;
	fixed: boolean;
	amount: number;
	before: number;
	after: number;
};
export type ElationCycle = {
	start: number;
	end?: number;
	entryHidden: number;
	peakHidden: number;
	exitHidden?: number;
	earnedExtras: number;
	usedExtras: number;
	basics: number;
	hit240: boolean;
};
export type ElationResourceEvent = {
	id: number;
	source: string;
	kind:
		| "jokes"
		| "hidden"
		| "applause"
		| "countedJokes"
		| "sp"
		| "sparxieBoom"
		| "starWill"
		| "pearlApplause";
	target?: string;
	requested: number;
	before: number;
	after: number;
	amount: number;
};
export type ElationDamageRow = {
	pearlBlueprint?: string;
	pearlEnergyToken?: string;
	pearlCharges?: number;
	pearlApplause?: number;
	pearlResistance?: number;
	borrowedFrom?: string;
	healingPerTarget?: number;
	pearlTemporaryJokes?: number;
	pearlTemporaryApplause?: number;
	pearlExtraTurn?: boolean;
	starWill?: number;
	starUniverseTurns?: number;
	starEnvoy?: string;
	hiddenCap?: number;
	starDebt?: number;
	starDebtHpLoss?: number;
	starTrueBase?: number;
	starTrueRatio?: number;
	sparxiePity?: number;
	sparxieBooms?: number;
	sparxieLottery?: ReturnType<typeof drawSparxieLottery>;
	resourceEvents: ElationResourceEvent[];
	boxBranch?: "sword" | "sp" | "beans";
	boxForced?: boolean;
	/** Order: sword, SP, beans; probabilities captured before rewards. */
	boxProbabilities?: [number, number, number];
	boxContext?: SilverWolfBoxContext;
	cycle: number;
	cycleScore: number;
	mode: boolean;
	energyEvents: ElationEnergyEvent[];
	key: string;
	av: number;
	actor: string;
	skill: string;
	detail: string;
	kind: "normal" | "elation" | "true" | "state";
	multiplier: number;
	elation: number;
	jokesUsed: number;
	expected: number;
	crit: number;
	cumulative: number;
	factors?: DamageFactors;
	buffs: string[];
	sp: number;
	jokes: number;
	hidden: number;
	basics: number;
	energy: Record<string, number>;
	applause: Record<string, number>;
};
export type ElationTeamResult = {
	ahaBaseSpeed: number;
	cycles: ElationCycle[];
	rows: ElationDamageRow[];
	total: number;
	byActor: Record<string, number>;
	warnings: string[];
	events: number;
};

/** Event-driven 300-AV trial. Randomness has an explicit seed and user-visible state-dependent probabilities. */
export function simulateElationTeam(raw: ElationTeamConfig): ElationTeamResult {
	const config = normalizeElationTeamConfig(raw);
	if (!config?.enabled || config.profiles.length !== 4)
		return {
			rows: [],
			cycles: [],
			ahaBaseSpeed: 80,
			total: 0,
			byActor: {},
			warnings: ["请先导入四人配装"],
			events: 0,
		};
	const ahaBaseSpeed = resolveElationAhaBaseSpeed(config);
	const allowed = new Set([
		"1506",
		"1502",
		"1217",
		"8010",
		"1501",
		"1511",
		"1503",
	]);
	const actors = config.profiles.map(
		(p) =>
			({
				p,
				cid: getCharacterCid(p.character.name) ?? "",
				turn: 0,
				actions: 0,
				energy: p.gear.initialEnergy ?? (p.gear.ultimateCost ?? 140) / 2,
				maximum: p.gear.ultimateCost ?? 140,
				speed: p.speed,
				next: 0,
				applause: [],
			}) as Actor,
	);
	if (
		!actors.some((a) => a.cid === "1506") ||
		actors.some((a) => !allowed.has(a.cid)) ||
		new Set(actors.map((a) => a.cid)).size !== 4
	)
		throw new Error("欢愉试验需要银狼及已接入角色的四人队，角色不能重复");
	if (actors.some((a) => a.p.level !== 80 || a.p.speed <= 0))
		throw new Error("本试验要求80级与正数速度");
	const wolf = actors.find((a) => a.cid === "1506") as Actor,
		yao = actors.find((a) => a.cid === "1502"),
		mc = actors.find((a) => a.cid === "8010"),
		fire = actors.find((a) => a.cid === "1501"),
		huo = actors.find((a) => a.cid === "1217"),
		star = actors.find((a) => a.cid === "1511"),
		pearl = actors.find((a) => a.cid === "1503");
	if (
		pearl &&
		(!Number.isFinite(pearl.p.defense) || Number(pearl.p.defense) <= 0)
	)
		throw new Error("真珠配装缺少防御力，请重新导入完整配装");
	const participants = [
		...(pearl ? [pearl] : []),
		...(yao ? [yao] : []),
		...(mc ? [mc] : []),
		...(fire ? [fire] : []),
		wolf,
		...(star ? [star] : []),
	];
	const fireCone =
		fire?.p.character.lc_id === 23053
			? lightconeParameters(23053, fire.p.character.superimpose)
			: undefined;
	const spCap =
		5 +
		(fireCone ? Math.min(fireCone[2], participants.length * fireCone[1]) : 0);
	let firePity = sparxieInitialPity,
		fireBooms = 0,
		fireConsumed = 0,
		firePush = false,
		pendingFireExtras = 0;
	const actorBaseSpeed = (a: Actor) =>
		a.p.baseSpeed ?? getCharacterBaseSpeed(a.p.character.name) ?? 100;
	let starWill = 0,
		universeTurns = 0,
		envoy: Actor | undefined,
		fortyClaimed = false,
		healingClaimed = false,
		starE6Used = false,
		starConeReadyTurn = 0,
		starConeDefense = 0;
	let momentStart: number | undefined;
	/** 阿哈正传·欢愉负债：按已造成伤害的固定比例额外计入；生命上限已知时按比例封顶。 */
	const debtRatio =
		star && config.ahaDebt ? skillParameters("1511", "31", 1)[0] : 0;
	const debtCap =
		config.enemyMaxHp > 0
			? config.enemyMaxHp * skillParameters("1511", "31", 1)[2]
			: Number.POSITIVE_INFINITY;
	let debtHpLoss = 0;
	const ascended = () => !!star && universeTurns > 0;
	const path = (cid: string) =>
		pathAscension(cid, star?.p.character.eidolon ?? 0);
	const hiddenCap = () =>
		ascended()
			? Math.max(config.hiddenScoreCap, path("1506")[0])
			: config.hiddenScoreCap;
	let pearlPoints = 0,
		pearlCharges = 0,
		pearlBlueprint: Actor | undefined,
		pearlEnergyToken: Actor | undefined,
		pearlTurnGain = 0;
	const pearlExtraQueue: Actor[] = [];
	const pearlNextAttack = new Map<Actor, number>();
	const pearlAttackTargets = new Map<Actor, number>();
	const pearlCap = () => (ascended() ? path("1503")[0] : 50);
	const defense = (a: Actor) => a.p.defense ?? 0;
	const cycles: ElationCycle[] = [];
	const rows: ElationDamageRow[] = [],
		buffs: Buff[] = [],
		byActor: Record<string, number> = {};
	let av = 0,
		total = 0,
		sp = 3,
		jokes = 0,
		hidden = 0,
		mode = false,
		basics = 0,
		growth = 0,
		awardedExtras = 0,
		pendingExtras = 0,
		boxChance = 1,
		coneReady = true,
		coneBasics = 0;
	let wardUntil = huo ? 2 + (huo.p.character.eidolon >= 1 ? 0 : -1) : -1,
		yaoFieldUntil = -1,
		enemyTurn = 0,
		nextEnemy = 10000 / config.enemySpeed,
		mcPending = 0,
		mcE1 = 0,
		foreteller = false;
	const energyEvents: ElationEnergyEvent[] = [];
	const resourceEvents: ElationResourceEvent[] = [];
	let resourceSerial = 0;

	const resource = (
		kind: ElationResourceEvent["kind"],
		source: string,
		requested: number,
		before: number,
		after: number,
		target?: string,
	) => {
		resourceEvents.push({
			id: resourceSerial++,
			kind,
			source,
			requested,
			before,
			after,
			amount: after - before,
			target,
		});
	};
	let energySerial = 0;
	let rng = config.seed >>> 0,
		eventCount = 0,
		momentNo = 0,
		normalActor: Actor | undefined;
	const random = () => {
		rng = (Math.imul(rng, 1664525) + 1013904223) >>> 0;
		return rng / 4294967296;
	};
	const sid = (a: Actor) =>
		a.cid === "1217" && a.p.gear.enhanced ? "11217" : a.cid;
	const params = (a: Actor, suffix: string) =>
		skillParameters(
			sid(a),
			suffix,
			suffix === "01" || suffix === "08" || suffix === "10"
				? // 星魂3 普攻+1：6→7（普攻上限10，强化A沿用普攻等级）
					(a.cid === "8010" && a.p.character.eidolon >= 5) ||
					a.p.character.eidolon >= 3
					? 7
					: 6
				: suffix === "02"
					? a.p.gear.skillLevel
					: suffix === "03"
						? a.p.gear.ultimateLevel
						: suffix === "04"
							? a.p.gear.talentLevel
							: suffix === "20"
								? // 星魂3与星魂5各给欢愉技+1，六魂即12级
									10 +
									Number(a.p.character.eidolon >= 3) +
									Number(a.p.character.eidolon >= 5)
								: 10,
		);
	const hasSet = (a: Actor, id: string, n = 2) => (a.p.gear.sets[id] ?? 0) >= n;
	const active = (b: Buff) =>
		b.until >=
		(b.target === "enemy"
			? enemyTurn
			: (actors.find((a) => a.cid === b.target)?.turn ?? 0));
	const value = (a: Actor, stat: Buff["stat"]) =>
		buffs
			.filter(
				(b) =>
					active(b) &&
					b.stat === stat &&
					(b.target === a.cid || b.target === "enemy"),
			)
			.reduce((v, b) => v + b.value, 0);
	const addBuff = (
		id: string,
		a: Actor | "enemy",
		stat: Buff["stat"],
		amount: number,
		duration: number,
	) => {
		const target = a === "enemy" ? "enemy" : a.cid;
		const old = buffs.findIndex(
			(b) => b.id === id && b.target === target && b.stat === stat,
		);
		if (old >= 0) buffs.splice(old, 1);
		buffs.push({
			id,
			target,
			stat,
			value: amount,
			until: (a === "enemy" ? enemyTurn : a.turn) + duration,
		});
	};
	const teamBuff = (
		id: string,
		stat: Buff["stat"],
		amount: number,
		duration: number,
	) =>
		actors.forEach((a) => {
			addBuff(id, a, stat, amount, duration);
		});
	const seerUntil = new Map<Actor, number>();
	const seerParams = (a: Actor) =>
		lightconeParameters(23054, a.p.character.superimpose);
	const seerActive = (a: Actor) =>
		a.p.character.lc_id === 23054 && a.turn <= (seerUntil.get(a) ?? -1);
	const seerTeam = (index: number) =>
		actors.reduce((n, a) => n + (seerActive(a) ? seerParams(a)[index] : 0), 0);
	const ward = () => !!huo && huo.turn <= wardUntil;
	const gainWill = (amount: number, source: string) => {
		if (!star) return;
		const before = starWill;
		starWill = Math.max(0, Math.min(10, starWill + amount));
		resource(
			"starWill",
			source,
			amount,
			before,
			starWill,
			star.p.character.name,
		);
	};
	const checkForty = () => {
		if (star && !fortyClaimed && jokes >= params(star, "04")[1]) {
			fortyClaimed = true;
			gainWill(params(star, "04")[2], "虚照·首次达到40笑点");
			teamBuff(
				"虚照·40笑点暴伤",
				"cd",
				params(star, "04")[8],
				params(star, "04")[9],
			);
		}
	};
	const regen = (a: Actor) =>
		1 + (a.p.gear.energyRegen ?? 0) + (seerActive(a) ? seerParams(a)[4] : 0);
	const energy = (
		a: Actor,
		amount: number,
		fixed = false,
		source = "技能回能",
	) => {
		if (a === wolf || a === star) return;
		const before = a.energy,
			actual = amount * (fixed ? 1 : regen(a));
		a.energy = Math.max(0, Math.min(a.maximum, a.energy + actual));
		energyEvents.push({
			id: energySerial++,
			actor: a.p.character.name,
			source,
			base: amount,
			fixed,
			amount: actual,
			before,
			after: a.energy,
		});
	};
	const score = (amount: number, source: string) => {
		const old = hidden;
		hidden = Math.floor(Math.min(hiddenCap(), Math.max(0, hidden + amount)));
		resource("hidden", source, amount, old, hidden, wolf.p.character.name);
		if (mode) {
			growth += Math.max(0, hidden - old);
			const n = Math.floor(growth / 120) - awardedExtras;
			if (n > 0) {
				pendingExtras += n;
				basics += n;
				awardedExtras += n;
				if (cycles.length) {
					const c = cycles[cycles.length - 1];
					c.earnedExtras = awardedExtras;
				}
			}
		}
		if (mode && cycles.length) {
			const c = cycles[cycles.length - 1];
			c.peakHidden = Math.max(c.peakHidden, hidden);
			c.hit240 = c.peakHidden >= 240;
		}
	};
	let totalJokes = 0;
	const earnJokes = (amount: number, source: string) => {
		const before = jokes;
		jokes = Math.floor(Math.max(0, jokes + amount));
		const gained = jokes - before;
		totalJokes += gained;
		resource("jokes", source, amount, before, jokes);
		score(gained, `${source}→银狼天赋等量隐藏分`);
		checkForty();
	};
	const gainPearl = (amount: number, source: string) => {
		if (!pearl) return 0;
		const before = pearlPoints;
		pearlPoints = Math.max(0, Math.min(pearlCap(), pearlPoints + amount));
		resource(
			"pearlApplause",
			source,
			amount,
			before,
			pearlPoints,
			pearl.p.character.name,
		);
		return pearlPoints - before;
	};
	const applause = (a: Actor) =>
		a === pearl
			? pearlPoints
			: a.applause
					.filter((b) => b.until >= a.turn)
					.reduce((n, b) => n + b.value, 0);

	const giveApplause = (a: Actor, n: number, source = "技能给予好活当赏") => {
		if (a === pearl) {
			gainPearl(n, source);
			return undefined;
		}
		const before = applause(a);
		const grant = { value: n, until: a.turn + 2 + (a === yao ? 1 : 0) };
		if (n > 0) a.applause.push(grant);
		if (n > 0)
			resource("applause", source, n, before, applause(a), a.p.character.name);
		if (a === wolf && n > 0 && ascended())
			score(n * path("1506")[1], "银狼升格·获得绝活共赏");
		return grant;
	};
	const attack = (a: Actor) => a.p.attack + a.p.baseAttack * value(a, "attack");
	const baseElation = (a: Actor) => {
		let e =
			(pearl && pearl.p.character.eidolon >= 1 && participants.length >= 2
				? rankParameters("1503", 1)[Math.min(4, participants.length) - 2]
				: 0) +
			a.p.elation +
			value(a, "elation") +
			(foreteller ? 0.1 : 0) +
			(firePush && fireCone ? fireCone[3] : 0);
		if (a === fire) {
			const t = traceParameters("1501", "101");
			e += Math.min(t[3], (Math.max(0, attack(a) - t[0]) / t[1]) * t[2]);
		}
		if (a === envoy && star) e += params(star, "02")[0];
		if (a === star) {
			const t = traceParameters("1511", "103");
			e += a.speed >= t[1] ? t[3] : a.speed >= t[0] ? t[2] : 0;
		}
		if (a === pearl) e += pearlDefenseElation(defense(a));
		if (a === wolf && a.speed >= 160)
			e += 0.5 + Math.min(100, a.speed - 160) * 0.02;
		if (a === yao && a.speed >= 120)
			e += 0.3 + Math.min(200, a.speed - 120) * 0.01;
		if (a === mc)
			e += Math.min(0.6, (Math.max(0, attack(a) - 1000) / 200) * 0.1);
		return e;
	};
	const elation = (a: Actor) =>
		baseElation(a) +
		(yao && yao.turn <= yaoFieldUntil
			? baseElation(yao) * params(yao, "02")[1]
			: 0);
	let wolfPlanarCD = 0;
	const factors = (
		a: Actor,
		isElation: boolean,
		independent = 1,
	): DamageFactors => {
		let cr =
			a.p.critRate +
			(a === star && ascended()
				? starAhaAscension(a.p.character.eidolon)[2]
				: 0) +
			(hasSet(a, "314") && participants.includes(a) && participants.length > 1
				? 0.12
				: 0) +
			seerTeam(1) +
			(a === mc ? 0.15 : 0) +
			(hasSet(a, "130", 4)
				? a.p.speed >= 160
					? 0.18
					: a.p.speed >= 120
						? 0.1
						: 0
				: 0);
		let cd =
			(fire
				? Math.min(
						traceParameters("1501", "103")[1],
						jokes * traceParameters("1501", "103")[0],
					)
				: 0) +
			a.p.critDamage +
			seerTeam(2) +
			value(a, "cd") +
			(a === yao ? 0.6 : 0) +
			actors.filter(
				(x) =>
					hasSet(x, "310") &&
					x.p.effectRes +
						(pearl && pearlPoints > 0
							? traceParameters("1503", "102")[2]
							: 0) >=
						0.3,
			).length *
				0.1;
		if (a === wolf) {
			if (ascended()) cd += path("1506")[2];
			const p = params(wolf, "04");
			const needed = Math.max(0, (1 - cr) / p[3]);
			cd += Math.max(0, hidden - needed) * p[5];
			cr += Math.min(hidden, needed) * p[3];
			if (hasSet(a, "325")) {
				wolfPlanarCD = Math.max(
					wolfPlanarCD,
					elation(a) >= 0.8 ? 0.32 : elation(a) >= 0.4 ? 0.2 : 0,
				);
				cd += wolfPlanarCD;
			}
		}
		const ignore = isElation
			? (a === fire && fireCone
					? Math.min(fireCone[4], fireConsumed) * fireCone[5]
					: 0) +
				(yao && yao.p.character.eidolon >= 1 ? 0.2 : 0) +
				(a.p.character.lc_id === 23057
					? lightconeParameters(23057, a.p.character.superimpose)[1]
					: 0) +
				(hasSet(a, "129", 4)
					? 0.1 + Math.min(10, Math.floor(totalJokes / 5)) * 0.01
					: 0)
			: 0;
		return {
			...defaultPhainonTrialConfig,
			attackerLevel: 80,
			enemyLevel: config.enemyLevel,
			resistance: config.resistance,
			critRate: cr,
			critDamage: cd,
			damageBonus: isElation
				? 0
				: (a.p.damageBonuses[
						a === wolf
							? "Imaginary"
							: a === mc
								? "Thunder"
								: a === yao
									? "Physical"
									: a === pearl
										? "Ice"
										: a === star
											? "Quantum"
											: a === fire
												? "Fire"
												: "Wind"
					] ?? 0),
			vulnerability:
				value(a, "vulnerability") +
				(isElation ? value(a, "elationVulnerability") : 0) +
				(mode ? rankParameters("1506", 1)[1] : 0),
			defenseIgnore:
				ignore +
				starConeDefense +
				(a === star && ascended()
					? starAhaAscension(a.p.character.eidolon)[1]
					: 0) +
				(fire && ascended() ? path("1501")[0] : 0),
			resistancePenetration:
				value(a, "pen") +
				(pearl && pearlCharges > 0 && pearl.p.character.eidolon >= 6
					? rankParameters("1503", 6)[0]
					: 0) +
				(fire && fire.p.character.eidolon >= 1
					? Math.min(
							rankParameters("1501", 1)[2],
							jokes * rankParameters("1501", 1)[1],
						)
					: 0) +
				(a === fire && a.p.character.eidolon >= 6
					? rankParameters("1501", 6)[2]
					: 0) +
				// 银狼6魂植入禁限弱点：基础抗性已为0，改为对应属性抗性降低
				(wolf.p.character.eidolon >= 6 ? rankParameters("1506", 6)[0] : 0),
			independentMultiplier: independent,
		};
	};
	const snapshot = () => ({
		pearlBlueprint: pearlBlueprint?.p.character.name,
		pearlEnergyToken: pearlEnergyToken?.p.character.name,
		pearlCharges: pearl ? pearlCharges : undefined,
		pearlApplause: pearl ? pearlPoints : undefined,
		pearlResistance: pearl ? pearlPoints * params(pearl, "04")[4] : undefined,
		starWill: star ? starWill : undefined,
		starUniverseTurns: star ? universeTurns : undefined,
		starEnvoy: envoy?.p.character.name,
		hiddenCap: hiddenCap(),
		starDebt: star ? debtHpLoss : undefined,
		starDebtHpLoss: star ? debtHpLoss : undefined,
		sparxiePity: fire ? firePity : undefined,
		sparxieBooms: fire ? fireBooms : undefined,
		cycle: cycles.length,
		cycleScore: growth,
		mode,
		sp,
		jokes,
		hidden,
		basics,
		energy: Object.fromEntries(
			actors
				.filter((a) => a !== wolf && a !== star)
				.map((a) => [a.p.character.name, a.energy]),
		),
		applause: Object.fromEntries(
			actors.map((a) => [a.p.character.name, applause(a)]),
		),
	});
	const log = (
		a: Actor | undefined,
		skill: string,
		detail: string,
		kind: ElationDamageRow["kind"] = "state",
		multiplier = 0,
		expected = 0,
		crit = 0,
		f?: DamageFactors,
		j = 0,
		e = 0,
	) => {
		total += expected;
		if (a)
			byActor[a.p.character.name] =
				(byActor[a.p.character.name] ?? 0) + expected;
		rows.push({
			key: `elation-${rows.length}`,
			av,
			actor: a?.p.character.name ?? "系统",
			skill,
			detail,
			kind,
			multiplier,
			elation: e,
			jokesUsed: j,
			expected,
			crit,
			cumulative: total,
			factors: f,
			buffs: a
				? buffs
						.filter(
							(b) => active(b) && (b.target === a.cid || b.target === "enemy"),
						)
						.map((b) => `${b.id} ${b.value}`)
				: [],
			energyEvents: energyEvents.splice(0),
			resourceEvents: resourceEvents.splice(0),
			...snapshot(),
		});
	};
	const hit = (
		a: Actor,
		skill: string,
		detail: string,
		multiplier: number,
		isElation: boolean,
		j = applause(a),
		count = 1,
		independent = 1,
		elationOverride?: number,
		credit?: Actor,
	) => {
		if (pearl && !["附加", "协同", "复制"].includes(skill))
			pearlAttackTargets.set(
				credit ?? a,
				Math.max(pearlAttackTargets.get(credit ?? a) ?? 0, count),
			);
		const f = factors(a, isElation, independent);
		const e = elationOverride ?? elation(a);
		const usedJ =
			j +
			(a === star && a.p.character.eidolon >= 4
				? actors
						.filter((x) => x !== star)
						.reduce((n, x) => n + applause(x), 0) * rankParameters("1511", 4)[0]
				: 0);
		const d = isElation
			? calculateElationDamage(
					multiplier,
					e,
					usedJ,
					// 增笑：虚照1魂全队15%、真珠2魂15%、爻光6魂全队25%、银狼6魂强化普攻期间50%
					(star && star.p.character.eidolon >= 1
						? rankParameters("1511", 1)[1]
						: 0) +
						(pearl && pearl.p.character.eidolon >= 2
							? rankParameters("1503", 2)[0]
							: 0) +
						(yao && yao.p.character.eidolon >= 6
							? rankParameters("1502", 6)[0]
							: 0) +
						(a === wolf && mode && wolf.p.character.eidolon >= 6
							? rankParameters("1506", 6)[1]
							: 0),
					f,
				)
			: calculateDamage(
					(a === huo ? a.p.hp : a === pearl ? defense(a) : attack(a)) *
						multiplier,
					f,
				);
		// 暴击口径：默认取期望；关闭后按「每次都暴击」的最幸运情况结算。
		const dealt = (config.critExpectation ? d.expected : d.crit) * count;
		log(
			credit ?? a,
			skill,
			detail,
			isElation ? "elation" : "normal",
			multiplier,
			dealt,
			d.crit * count,
			f,
			usedJ,
			e,
		);
		if (credit) rows[rows.length - 1].borrowedFrom = a.p.character.name;
		return dealt;
	};
	const updateSpeeds = () => {
		const oldAha = ahaSpeed();
		actors.forEach((a) => {
			const next =
				a.p.speed +
				actorBaseSpeed(a) *
					((ward() && huo && huo.p.character.eidolon >= 1 ? 0.12 : 0) +
						value(a, "speed"));
			if (a.next > av) a.next = av + ((a.next - av) * a.speed) / next;
			a.speed = next;
		});
		const next = ahaSpeed();
		if (nextAha > av) nextAha = av + ((nextAha - av) * oldAha) / next;
	};
	const ahaSpeed = () => {
		const speeds = participants.map((a) => a.speed).sort((a, b) => b - a);
		return ahaBaseSpeed + speeds[0] * 0.2 + speeds[1] * 0.1 + speeds[2] * 0.05;
	};
	let nextAha = 0;
	const wardHeal = (target?: Actor) => {
		if (ward() && huo) {
			energy(huo, 2 + config.lowHpHealTargets, false, "强化藿藿天赋治疗回能");
			if (target === star && !healingClaimed) {
				healingClaimed = true;
				gainWill(1, "虚照·受到队友治疗");
			}
		}
	};
	const turnStart = (a: Actor, extra = false) => {
		if (!extra) {
			a.turn++;
			if (a === star) {
				universeTurns = Math.max(0, universeTurns - 1);
				score(0, "虚照状态结束·隐藏分上限校验");
				if (pearl) gainPearl(0, "升格结束·真珠好活上限校验");
			}
		}
		if (pearl) {
			if (a === pearl) pearlTurnGain = 0;
			const t = traceParameters("1503", "102");
			if (pearlTurnGain < t[1])
				pearlTurnGain += Math.max(
					0,
					gainPearl(
						Math.min(t[0], t[1] - pearlTurnGain),
						"真珠·队友回合开始好活",
					),
				);
		}
		if (a === envoy) gainWill(1, "令使回合开始");
		wardHeal(a);
		updateSpeeds();
	};

	const afterAttack = (
		a: Actor,
		spent = false,
		independent = 1,
		origin: "ordinary" | "elation" | "box" = "ordinary",
		targetCount = 0,
	) => {
		const covered = targetCount || pearlAttackTargets.get(a) || 1;
		pearlAttackTargets.delete(a);
		if (a === mc) {
			energy(mc, params(mc, "04")[0], true, "欢愉主天赋·固定回能");
			earnJokes(
				params(mc, "04")[1],
				origin === "ordinary"
					? "欢愉主天赋·普通攻击产笑"
					: "欢愉主天赋·欢愉技后产笑",
			);
		}
		if (yao && applause(yao) > 0) {
			const e = Math.max(elation(a), elation(yao));
			for (let i = 0; i < (spent ? 2 : 1); i++)
				hit(
					a,
					"附加",
					"大吉大利",
					params(yao, "04")[0] * (ascended() ? 1 + path("1502")[0] : 1),
					true,
					applause(a),
					1,
					independent,
					e,
				);
		}
		const pearlMultiplier = pearlNextAttack.get(a);
		if (pearlMultiplier !== undefined) {
			pearlNextAttack.delete(a);
			hit(
				a,
				"附加",
				"真珠欢愉技·下一次攻击追加",
				pearlMultiplier,
				true,
				applause(a),
				covered,
				independent,
			);
		}
	};
	const box = (source: string, forced?: "beans", duringBasic = false) => {
		const context = {
			sp,
			spCap,
			hidden,
			hiddenCap: hiddenCap(),
			beanCurveK: config.boxBeanCurveK,
		};
		const probabilities = pruneSilverWolfBoxProbabilities(
			silverWolfBoxProbabilities(context),
			config.boxMinProbability ?? 0,
		);
		const weights: [number, number, number] = [
			probabilities.sword,
			probabilities.sp,
			probabilities.beans,
		];
		const ownMultiplier = duringBasic
			? 1 + Math.min(2, Math.floor(hidden / 60)) * 0.15
			: 1;
		const dealt = hit(
			wolf,
			"盲盒",
			source,
			params(wolf, "03")[2],
			true,
			forced ? 99 : applause(wolf),
			1,
			ownMultiplier,
		);
		const blindCrit = rows[rows.length - 1].crit;
		let branch = "beans";
		if (!forced) {
			let roll = random();
			let n = 0;
			while (n < 2 && roll >= weights[n]) {
				roll -= weights[n];
				n++;
			}
			branch = ["sword", "sp", "beans"][n];
		}
		if (branch === "sword")
			log(
				wolf,
				"真实伤害",
				"超超超大剑（复制已结算伤害）",
				"true",
				params(wolf, "03")[4],
				dealt * params(wolf, "03")[4],
				blindCrit * params(wolf, "03")[4],
			);
		if (branch === "sp") {
			const before = sp,
				amount = params(wolf, "03")[6];
			sp = Math.min(spCap, sp + amount);
			resource("sp", "盲盒·爆爆爆炸蛋", amount, before, sp);
		}
		if (branch === "beans")
			earnJokes(
				params(wolf, "03")[5],
				forced ? "银狼秘技怪味豆" : "盲盒·怪怪怪味豆",
			);
		log(wolf, "盲盒结果", branch);
		const boxRow = rows[rows.length - 1];
		boxRow.boxBranch = branch as "sword" | "sp" | "beans";
		boxRow.boxForced = !!forced;
		boxRow.boxContext = context;
		if (!forced) boxRow.boxProbabilities = weights;
		if (!duringBasic || config.boxCountsAsAttack)
			afterAttack(wolf, false, duringBasic ? ownMultiplier : 1, "box");
	};
	const triggerSpend = () => {
		if (mode && applause(wolf) > 0 && random() < boxChance) {
			boxChance *= params(wolf, "03")[3];
			box("消耗战技点触发");
		}
	};
	const spend = () => {
		const before = sp;
		sp--;
		resource("sp", "消耗战技点", -1, before, sp);
		triggerSpend();
	};
	const gainBooms = (amount: number, source: string) => {
		const before = fireBooms;
		fireBooms += amount;
		resource(
			"sparxieBoom",
			source,
			amount,
			before,
			fireBooms,
			fire?.p.character.name,
		);
	};
	const consumeFirePoint = () => {
		if (!fire) throw new Error("缺少火花");
		const usedBoom = fireBooms > 0;
		if (usedBoom) {
			const before = fireBooms;
			fireBooms--;
			resource(
				"sparxieBoom",
				"互动陷阱抵扣",
				-1,
				before,
				fireBooms,
				fire.p.character.name,
			);
			triggerSpend();
		} else spend();
		fireConsumed++;
		if (usedBoom && fire.p.character.eidolon >= 2) {
			const own = buffs.find((b) => b.id === "火花E2" && active(b));
			addBuff("火花E2", fire, "cd", Math.min(0.4, (own?.value ?? 0) + 0.1), 2);
		}
	};

	const elationSkill = (
		a: Actor,
		j: number,
		boost = 1,
		trueBaseOverride?: number,
		trueRatioOverride?: number,
	) => {
		let primary = 0;
		resource(
			"countedJokes",
			"欢愉技计入笑点（不加入共享池）",
			j,
			0,
			j,
			a.p.character.name,
		);
		if (hasSet(a, "130", 4)) foreteller = true;
		if (a.p.character.lc_id === 21064) {
			const lc = lightconeParameters(21064, a.p.character.superimpose);
			addBuff(
				config.mushroomStacks ? `菇菇嘎嘎-${a.cid}` : "菇菇嘎嘎",
				"enemy",
				"elationVulnerability",
				lc[1],
				lc[2],
			);
		}
		if (a === pearl) {
			const p = params(a, "20"),
				mult =
					p[Math.min(4, participants.length) - 1] *
					(a.p.character.eidolon >= 4 ? 1 + rankParameters("1503", 4)[0] : 1);
			actors.forEach((x) => {
				pearlNextAttack.set(x, mult);
			});
			energy(a, 5);
			if (a.p.character.lc_id === 23055) {
				const lc = lightconeParameters(23055, a.p.character.superimpose);
				addBuff("献给明日的色彩", "enemy", "vulnerability", lc[3], lc[2]);
				energy(a, lc[1], true, "真珠专锥·欢愉技固定回能");
				if (star && !healingClaimed) {
					healingClaimed = true;
					gainWill(1, "虚照·真珠专锥全队治疗");
				}
			}
			log(a, "ES", "真珠欢愉技·全队下一次攻击追加");
			if (a.p.character.lc_id === 23055)
				rows[rows.length - 1].healingPerTarget =
					defense(a) *
					lightconeParameters(23055, a.p.character.superimpose)[4] *
					(1 + (a.p.healingBonus ?? 0) + elation(a) * 0.2);
		}
		if (a === fire) {
			const p = params(a, "20");
			const bounces =
				a.p.character.eidolon >= 6
					? Math.min(
							rankParameters("1501", 6)[1],
							p[2] + Math.floor(j / rankParameters("1501", 6)[0]),
						)
					: p[2];
			hit(
				a,
				"ES",
				"火花欢愉技·全体",
				p[1] * (ascended() ? 1 + path("1501")[4] : 1),
				true,
				j,
				config.enemyCount,
			);
			hit(
				a,
				"ES",
				"火花欢愉技·弹射",
				p[0] * bounces * (ascended() ? 1 + path("1501")[4] : 1),
				true,
				j,
			);
			energy(a, 5);
			gainBooms(p[3], "火花欢愉技");
			afterAttack(a, false, 1, "elation");
		}
		if (a === yao) {
			const p = params(yao, "20");
			const e6 = a.p.character.eidolon >= 6 ? rankParameters("1502", 6)[1] : 0;
			addBuff("凶星低语", "enemy", "vulnerability", p[2], p[3]);
			hit(
				a,
				"ES",
				"凶星低语·全体",
				p[1] * (1 + e6),
				true,
				j,
				config.enemyCount,
			);
			hit(a, "ES", "凶星低语·弹射", p[4] * p[5] * (1 + e6), true, j);
			energy(a, 5);
			sp = Math.min(spCap, sp + 1);
			afterAttack(a, false, 1, "elation");
		}
		if (a === mc) {
			if (a.p.character.eidolon >= 6)
				addBuff(
					"欢愉主6魂",
					a,
					"cd",
					rankParameters(a.cid, 6)[0],
					rankParameters(a.cid, 6)[1],
				);
			if (a.p.character.eidolon >= 4)
				addBuff(
					"欢愉主4魂",
					"enemy",
					"vulnerability",
					rankParameters(a.cid, 4)[0],
					rankParameters(a.cid, 4)[1],
				);
			const p = params(a, "20");
			primary = hit(
				a,
				"ES",
				"欢愉主欢愉技",
				(p[0] * p[1] + p[2]) * boost,
				true,
				j,
			);
			energy(a, 5);
			afterAttack(a, false, 1, "elation");
		}
		if (a === wolf) {
			if (mode) {
				const p = skillParameters(
					"1506",
					"21",
					10 +
						Number(a.p.character.eidolon >= 3) +
						Number(a.p.character.eidolon >= 5),
				);
				// 银狼4魂：崩坏级伤害演示额外计入5倍笑点
				hit(
					a,
					"ES",
					"强化欢愉技",
					p[0] * p[1],
					true,
					a.p.character.eidolon >= 4
						? j * (1 + rankParameters("1506", 4)[0])
						: j,
				);
				boxChance = 1;
				afterAttack(a, false, 1, "elation");
			} else {
				score(params(a, "20")[0], "银狼普通欢愉技·直接隐藏分");
				log(a, "ES", "普通欢愉技·隐藏分+15");
			}
			const t = traceParameters("1506", "102");
			if (j >= t[0]) score(t[2], "银狼行迹·计入笑点达到20");
			if (j >= t[1]) score(t[3], "银狼行迹·计入笑点达到40");
		}
		if (a === star) {
			const p = params(a, "20");
			hit(a, "ES", "虚照欢愉技·全体", p[0], true, j, config.enemyCount);
			gainWill(1, "虚照·施放欢愉技");
			afterAttack(a, false, 1, "elation");
			const base =
				trueBaseOverride ??
				(momentStart === undefined
					? 0
					: rows
							.slice(momentStart)
							.filter((r) => r.kind !== "true")
							.reduce((n, r) => n + r.expected, 0));
			const ratio =
				(trueRatioOverride ?? p[1]) *
				(a.p.character.eidolon >= 4 ? 1 + rankParameters("1511", 4)[1] : 1);
			if (base > 0) {
				log(
					a,
					"ES真伤",
					trueBaseOverride === undefined
						? "本次阿哈非真实伤害总和的真实伤害"
						: "主角升格ES伤害为基数的真实伤害",
					"true",
					ratio,
					base * ratio,
					base * ratio,
				);
				rows[rows.length - 1].starTrueBase = base;
				rows[rows.length - 1].starTrueRatio = ratio;
			}
		}
		mcPending = config.mcTraceStack ? mcPending + 2 : 2;
		return primary;
	};
	const moment = (fixed?: number) => {
		const used = Math.floor(Math.max(0, fixed ?? jokes));

		const previousMoment = momentStart;
		momentStart = rows.length;
		momentNo++;
		log(
			undefined,
			"阿哈时刻",
			`${fixed === undefined ? "常规" : "额外"}时刻#${momentNo}，计入${used}笑点`,
		);
		if (config.applausePhase === "before")
			participants.forEach((a) => {
				giveApplause(a, used, "阿哈时刻结束发放好活");
			});
		participants.forEach((a) => {
			elationSkill(a, used);
		});
		if (config.applausePhase === "after")
			participants.forEach((a) => {
				giveApplause(a, used, "阿哈时刻结束发放好活");
			});
		let consumed = 0;
		if (fixed === undefined) {
			const before = jokes;
			consumed = before;
			jokes = 0;
			resource("jokes", "常规阿哈结束消耗共享笑点", -before, before, 0);
		}
		log(undefined, "阿哈时刻结束", "发放好活当赏，随后消耗笑点");
		fortyClaimed = false;
		if (fixed === undefined && ascended())
			earnJokes(
				consumed * starAhaAscension(star?.p.character.eidolon ?? 0)[0],
				"虚照升格·爽点回收",
			);
		checkForty();
		momentStart = previousMoment;
		if (fire && fire.p.character.eidolon >= 1)
			earnJokes(rankParameters("1501", 1)[0], "火花E1·阿哈结束产笑");
		if (fire && fire.p.character.eidolon >= 2) {
			gainBooms(rankParameters("1501", 2)[0], "火花E2·阿哈结束");
			pendingFireExtras++;
		}
		if (fire) log(fire, "阿哈后结算", "火花星魂资源与额外回合入队");
		if (star) log(star, "阿哈后结算", "愿力、爽点回收与升格资源结算");
	};
	const extendWolf = () => {
		buffs
			.filter((b) => b.target === wolf.cid && active(b))
			.forEach((b) => {
				b.until++;
			});
		wolf.applause
			.filter((b) => b.until >= wolf.turn)
			.forEach((b) => {
				b.until++;
			});
	};
	const pearlHeal = (amount: number, source: string) => {
		if (!pearl) return;
		if (star && !healingClaimed) {
			healingClaimed = true;
			gainWill(1, "虚照·真珠全队治疗");
		}
		log(pearl, "治疗", source);
		rows[rows.length - 1].healingPerTarget = amount;
	};
	const supportiveRelics = (a: Actor, target: Actor) => {
		if (hasSet(a, "133", 4)) {
			addBuff("伶人·目标欢愉度", target, "elation", 0.16, 3);
			if (applause(a) >= 10) teamBuff("伶人·全队暴伤", "cd", 0.12, 3);
		}
		if (hasSet(a, "121", 4)) {
			const old = buffs.find(
				(b) => b.id === "司铎" && b.target === target.cid && active(b),
			);
			addBuff(
				"司铎",
				target,
				"cd",
				Math.min(0.36, (old?.value ?? 0) + 0.18),
				2,
			);
		}
		if (hasSet(a, "114", 4)) teamBuff("信使", "speed", 0.12, 1);
	};
	const castUltimate = (a: Actor) => {
		if (pearl && a === pearlEnergyToken) {
			pearlEnergyToken = undefined;
			energy(
				pearl,
				traceParameters("1503", "103")[0],
				true,
				"真珠行迹·底本下一次Q固定回能",
			);
		}

		if (a === star) {
			gainWill(-8, "虚照Q消耗8愿力");
			universeTurns = params(a, "03")[5];
			healingClaimed = false;
		}

		if (
			a.p.character.lc_id === 23054 &&
			(a === yao || a === mc || a === huo || a === pearl)
		)
			seerUntil.set(a, a.turn + seerParams(a)[3]);
		if (a !== wolf) energy(a, -a.maximum, true, "终结技消耗");
		// Special energy does not exempt Silver Wolf's Q from Huohuo's healing trigger.
		wardHeal(a);
		if (a !== wolf) energy(a, 5);
		if (a === pearl) {
			const p = params(a, "03");
			pearlBlueprint =
				actors.find(
					(x) => x.p.character.id === config.pearlBlueprintId && x !== a,
				) ??
				star ??
				wolf;
			pearlCharges = p[0];
			giveApplause(a, p[2], "真珠Q好活");
			pearlEnergyToken = participants.includes(pearlBlueprint)
				? pearlBlueprint
				: undefined;
			supportiveRelics(a, pearlBlueprint);
			if (a.p.character.hasWindSet)
				a.next = Math.max(av, a.next - 2500 / a.speed);
			const advance = getPearlAdvancePercent(participants.length);
			pearlBlueprint.next = Math.max(
				av,
				pearlBlueprint.next - (10000 * advance) / pearlBlueprint.speed,
			);
			if (a.p.character.eidolon >= 2)
				participants
					.filter((x) => x !== a && x !== pearlBlueprint)
					.forEach((x) => {
						x.next = Math.max(av, x.next - (10000 * advance) / x.speed);
					});
			if (participants.length >= 4) pearlExtraQueue.push(pearlBlueprint);
			updateSpeeds();
			log(a, "Q", "真珠Q·深度学习与行动提前");
		}
		if (a === star) {
			const p = params(a, "03");
			let advance = p[4];
			if (a.p.character.eidolon >= 6 && !starE6Used) {
				starE6Used = true;
				advance = rankParameters("1511", 6)[2];
				earnJokes(rankParameters("1511", 6)[1], "虚照E6首次Q产笑");
			}
			nextAha = Math.max(av, nextAha - (10000 * advance) / ahaSpeed());
			hit(a, "Q", "虚照Q·全体欢愉", p[1], true, applause(a), config.enemyCount);
			hit(a, "Q", "虚照Q·随机弹射", p[3] * p[2], true);
			afterAttack(a);
		}
		if (a === wolf) {
			// Q spends the 60-point activation cost before mode growth is initialized.
			const entryHidden = hidden;
			score(-60, "银狼Q消耗60隐藏分");
			mode = true;
			cycles.push({
				start: av,
				entryHidden,
				peakHidden: hidden,
				earnedExtras: 0,
				usedExtras: 0,
				basics: 0,
				hit240: hidden >= 240,
			});
			boxChance = 1;
			basics = 3;
			growth = hidden;
			awardedExtras = 0;
			pendingExtras = 0;
			score(20, "银狼进入无敌玩家·行迹+20");
			if (a.p.character.eidolon >= 2) {
				const n = Math.floor(growth / 120) - awardedExtras;
				if (n > 0) {
					pendingExtras += n;
					basics += n;
					awardedExtras += n;
					cycles[cycles.length - 1].earnedExtras = awardedExtras;
				}
				extendWolf();
			}
			if (coneReady) {
				earnJokes(
					lightconeParameters(23057, a.p.character.superimpose)[2],
					"欢迎来到银河城·自身Q产笑",
				);
				coneReady = false;
				coneBasics = 0;
			}
			if (normalActor !== wolf) wolf.next = av;
			log(a, "Q", "隐藏分达标·进入无敌玩家");
		}
		if (a === fire) {
			const p = params(a, "03"),
				t = traceParameters("1501", "102"),
				index = Math.min(3, participants.length) - 1;
			earnJokes(p[0] + t[index], "火花Q与行迹产笑");
			gainBooms(t[index + 3], "火花Q行迹");
			if (a.p.character.eidolon >= 4) {
				const e4 = rankParameters("1501", 4);
				earnJokes(e4[0], "火花E4·Q产笑");
				addBuff("火花E4", a, "elation", e4[1], e4[2]);
			}
			hit(
				a,
				"Q",
				"火花终结技·常规伤害",
				p[1] + p[2] * elation(a),
				false,
				0,
				config.enemyCount,
			);
			if (applause(a) > 0)
				hit(
					a,
					"Q",
					"火花终结技·好活欢愉伤害",
					params(a, "04")[1],
					true,
					applause(a),
					config.enemyCount,
				);
			afterAttack(a);
		}
		if (a === yao) {
			const p = params(a, "03");
			earnJokes(p[0], "爻光Q产笑");
			teamBuff("爻光终结技", "pen", p[1], p[2]);
			log(a, "Q", "爻光终结技·额外阿哈时刻");
			moment(a.p.character.eidolon >= 1 ? rankParameters(a.cid, 1)[1] : p[3]);
			if (ascended()) {
				const up = path("1502");
				energy(a, up[1], true, "爻光升格·Q固定回能");
				earnJokes(up[3], "爻光升格·Q爽点");
			}
		}
		if (a === mc) {
			const p = params(a, "03");
			earnJokes(p[5], "欢愉主Q产笑");
			const mcTarget = star ?? wolf;
			if (ascended()) teamBuff("欢愉主Q", "cd", p[0] + path("8010")[0], p[1]);
			else addBuff("欢愉主Q", mcTarget, "cd", p[0], p[1]);
			addBuff(
				"欢愉主2魂",
				mcTarget,
				"elation",
				rankParameters(a.cid, 2)[0],
				rankParameters(a.cid, 2)[1],
			);
			giveApplause(mcTarget, p[3] + mcE1 * 2);
			mcE1 = 0;
			sp = Math.min(spCap, sp + 1);
			if (hasSet(a, "133", 4)) {
				addBuff("伶人·目标欢愉度", mcTarget, "elation", 0.16, 3);
				if (applause(a) >= 10) teamBuff("伶人·全队暴伤", "cd", 0.12, 3);
			}
			if (hasSet(a, "121", 4)) {
				const old = buffs.find(
					(b) => b.id === "司铎" && b.target === mcTarget.cid && active(b),
				);
				addBuff(
					"司铎",
					mcTarget,
					"cd",
					Math.min(0.36, (old?.value ?? 0) + 0.18),
					2,
				);
			}
			log(a, "Q", "欢愉主Q·目标立即欢愉技");
			if (star && ascended()) {
				const up = path("8010");
				const j = Math.max(...actors.map(applause));
				const mcDamage = elationSkill(a, j, 1 + up[1]);
				elationSkill(star, p[4], 1, mcDamage, up[2]);
			} else elationSkill(mcTarget, p[4]);
		}
		if (a === huo) {
			const p = params(a, "03");
			actors
				.filter((x) => x !== a && x !== wolf)
				.forEach((x) => {
					energy(x, x.maximum * p[0], false, "藿藿Q百分比回能");
				});
			actors
				.filter((x) => x !== a)
				.forEach((x) => {
					addBuff(
						"藿藿Q",
						x,
						"attack",
						p[1] + (x.maximum >= 160 ? 0.24 : 0),
						p[2],
					);
				});
			wardUntil = a.turn + params(a, "04")[0] + 1 - 1;
			if (hasSet(a, "114", 4)) teamBuff("信使", "speed", 0.12, 1);
			updateSpeeds();
			log(a, "Q", "藿藿Q·回能并刷新禳命");
		}
		log(a, "Q结算", "终结技结算完成");
	};
	const canCastUltimate = (a: Actor) => {
		if (a === star) return starWill >= 8;
		if (a === wolf) {
			const threshold =
				config.wolfUltRushWindow > 0 &&
				config.limit - av <= config.wolfUltRushWindow
					? 60
					: config.wolfUltMinScore;
			return !mode && hidden >= threshold;
		}
		if (a.energy + 1e-8 < a.maximum) return false;
		if (
			config.wolfSupportTiming === "score240" &&
			(a === mc || a === yao) &&
			mode
		)
			return growth < 240 && basics <= 1;
		return true;
	};
	const ultimateChecks = () => {
		for (let guard = 0; guard < 20; guard++) {
			let cast = false;
			for (const a of [
				...(huo ? [huo] : []),
				...(star ? [star] : []),
				...(pearl ? [pearl] : []),
				wolf,
				...(mc ? [mc] : []),
				...(fire ? [fire] : []),
				...(yao ? [yao] : []),
			])
				if (canCastUltimate(a)) {
					castUltimate(a);
					cast = true;
				}
			if (!cast) return;
		}
		throw new Error("终结技循环未收敛");
	};
	const normal = (a: Actor, extra = false, pearlTurn = false) => {
		const pearlStart = rows.length;
		const reward =
			pearlTurn && pearl
				? pearlExtraReward(
						pearl.p.character.eidolon,
						pearl.p.gear.ultimateLevel,
						ascended() ? (star && star.p.character.eidolon >= 2 ? 2 : 1) : 0,
					)
				: undefined;
		const temporary = reward
			? giveApplause(a, reward.applause, "真珠额外回合临时好活")
			: undefined;
		if (reward) earnJokes(reward.jokes, "真珠额外回合临时笑点");
		turnStart(a, extra);
		if (!extra) a.actions++;
		normalActor = a;
		if (!extra) ultimateChecks();
		if (a === wolf && mode) {
			const p = params(a, "08");
			let previous = 0;
			for (const cut of [...config.basicPauseCuts, 100]) {
				const hits = cut - previous;
				hit(
					a,
					"强化A",
					`弹射${hits}段`,
					(p[0] * hits) / p[2],
					true,
					applause(a),
					1,
					1 + Math.min(2, Math.floor(hidden / 60)) * p[7],
				);
				if (cut < 100) box("强化普攻内置盲盒", undefined, true);
				previous = cut;
			}

			hit(
				a,
				"强化A",
				"最后一击",
				p[3],
				true,
				applause(a),
				1,
				1 + Math.min(2, Math.floor(hidden / 60)) * p[7],
			);
			afterAttack(a, false, 1 + Math.min(2, Math.floor(hidden / 60)) * p[7]);
			basics--;
			const cycle = cycles[cycles.length - 1];
			cycle.basics++;
			if (extra && !pearlTurn) cycle.usedExtras++;
			coneBasics++;
			if (coneBasics >= 3) coneReady = true;
			log(
				a,
				"强化A结束",
				pearlTurn ? "真珠额外回合" : extra ? "E2额外回合" : "正常回合",
			);
			if (basics <= 0) {
				cycle.end = av;
				cycle.exitHidden = hidden;
				mode = false;
				const beforeRetention = hidden;
				hidden = Math.floor(hidden * rankParameters("1506", 1)[0]);
				resource(
					"hidden",
					"银狼退大保留20%去尾",
					hidden - beforeRetention,
					beforeRetention,
					hidden,
					wolf.p.character.name,
				);
				log(a, "退场", "保留20%隐藏分（去尾取整）");
			}
		} else if (a === pearl) {
			const useE = (a.actions - 1) % config.pearlSkillEvery === 0 && sp > 0;
			if (useE) {
				spend();
				energy(a, 30);
				giveApplause(a, params(a, "02")[0], "真珠E好活");
				const p = params(a, "02"),
					heal =
						(defense(a) * p[1] + p[2]) *
						(1 +
							(a.p.healingBonus ?? 0) +
							elation(a) * traceParameters("1503", "101")[5]);
				pearlHeal(heal, "真珠E全体治疗并额外治疗最低HP目标");
				log(a, "E", "真珠战技·非攻击");
			} else if (pearlCharges > 0 && pearlBlueprint) {
				const bp = pearlBlueprint,
					p = params(a, participants.includes(bp) ? "08" : "10");
				energy(a, 30);
				sp = Math.min(spCap, sp + 1);
				hit(
					a,
					"强化A",
					"真珠强化普攻·防御力全体伤害",
					p[0],
					false,
					0,
					config.enemyCount,
				);
				if (participants.includes(bp)) {
					if (applause(a) > 0)
						hit(
							a,
							"强化A",
							"真珠强化普攻·自身好活欢愉",
							p[4],
							true,
							applause(a),
							config.enemyCount,
						);
					const j =
						config.pearlCopyApplause === "pearl" ? applause(a) : applause(bp);
					hit(
						bp,
						"复制",
						"真珠强化普攻·底本属性冰欢愉",
						params(a, "03")[1] +
							(a.p.character.eidolon >= 6 ? rankParameters("1503", 6)[1] : 0),
						true,
						j,
						config.enemyCount,
						1,
						undefined,
						a,
					);
				} else if (a.p.character.eidolon >= 6) {
					hit(
						bp,
						"复制",
						"真珠E6·底本属性冰欢愉",
						rankParameters("1503", 6)[1],
						true,
						applause(a),
						config.enemyCount,
						1,
						undefined,
						a,
					);
				}
				pearlHeal(
					(defense(a) * p[1] + p[3]) *
						(1 + (a.p.healingBonus ?? 0) + elation(a) * 0.2),
					"真珠强化A全体治疗并额外治疗最低HP目标",
				);
				afterAttack(a, false, 1, "ordinary", config.enemyCount);
				pearlCharges--;
				log(a, "强化A结束", "真珠深度学习消耗1充能");
				if (pearlCharges === 0) pearlBlueprint = undefined;
			} else {
				sp = Math.min(spCap, sp + 1);
				energy(a, 20);
				hit(a, "A", "真珠普通普攻·防御力伤害", params(a, "01")[0], false);
				afterAttack(a);
			}
		} else if (a === star) {
			const useE = sp > 0 && (a.actions - 1) % config.starSkillEvery === 0;
			if (useE) {
				spend();
				envoy =
					actors.find(
						(x) => x.p.character.id === config.starEnvoyId && x !== a,
					) ?? wolf;
				if (hasSet(a, "133", 4)) {
					addBuff("伶人·目标欢愉度", envoy, "elation", 0.16, 3);
					if (applause(a) >= 10) teamBuff("伶人·全队暴伤", "cd", 0.12, 3);
				}
				if (hasSet(a, "121", 4)) {
					const old = buffs.find(
						(b) => b.id === "司铎" && b.target === envoy?.cid && active(b),
					);
					addBuff(
						"司铎",
						envoy,
						"cd",
						Math.min(0.36, (old?.value ?? 0) + 0.18),
						2,
					);
				}
				if (a.p.character.lc_id === 23065 && a.turn >= starConeReadyTurn) {
					const lc = lightconeParameters(23065, a.p.character.superimpose);
					starConeReadyTurn = a.turn + lc[2];
					earnJokes(lc[1], "虚照专锥·对队友施放E");
					starConeDefense = lc[3];
				}
				log(a, "E", "指定令使并发动追加攻击");
				hit(
					a,
					"Z",
					"虚照E·追加攻击",
					params(a, "02")[1],
					true,
					applause(a),
					config.enemyCount,
				);
				hit(
					envoy,
					"协同",
					"令使额外欢愉伤害（不视为攻击）",
					traceParameters("1511", "101")[0],
					true,
				);
				sp = Math.min(spCap, sp + traceParameters("1511", "101")[2]);
				afterAttack(a);
			} else {
				sp = Math.min(spCap, sp + 1);
				hit(a, "A", "虚照普攻·欢愉伤害", params(a, "01")[0], true);
				afterAttack(a);
			}
			gainWill(1, useE ? "虚照·施放战技" : "虚照·施放普攻");
		} else if (a === fire) {
			if (sp + fireBooms <= 0) {
				sp = Math.min(spCap, sp + 1);
				energy(a, 20);
				hit(a, "A", "火花普通普攻", params(a, "01")[0], false);
				afterAttack(a);
			} else {
				let lottery = startSparxieLottery(firePity),
					spent = 0;
				while (
					lottery.draws < 20 &&
					lottery.jackpots < config.sparxieJackpotTarget &&
					sp + fireBooms > 0
				) {
					consumeFirePoint();
					spent++;
					if (fireCone && spent >= fireCone[6]) firePush = true;
					const draw = drawSparxieLottery(lottery, random);
					lottery = draw.state;
					firePity = lottery.pity;
					earnJokes(
						draw.jokes +
							(draw.jackpot && ascended()
								? Math.min(
										path("1501")[3],
										Math.floor(applause(a) / path("1501")[1]) * path("1501")[2],
									)
								: 0),
						draw.jackpot ? "火花互动·大奖" : "火花互动·小奖",
					);
					if (draw.spRefund) {
						const before = sp;
						sp = Math.min(spCap, sp + draw.spRefund);
						resource("sp", "火花大奖返还", draw.spRefund, before, sp);
					}
					log(
						a,
						"互动",
						`第${lottery.draws}抽·${draw.jackpot ? "大奖" : "小奖"}${draw.forced ? "（保底）" : ""}·剩余大奖${lottery.jackpotsLeft}/小奖${lottery.smallPrizesLeft}`,
					);
					rows[rows.length - 1].sparxieLottery = draw;
				}
				energy(a, 40);
				const p = params(a, "08"),
					interaction = params(a, "09"),
					talent = params(a, "04");
				hit(
					a,
					"强化A",
					"火花强化普攻·主目标",
					p[0] + lottery.draws * interaction[3],
					false,
				);
				if (config.enemyCount > 1)
					hit(
						a,
						"强化A",
						"火花强化普攻·扩散",
						p[1] + lottery.draws * interaction[4],
						false,
						0,
						Math.min(2, config.enemyCount - 1),
					);
				if (applause(a) > 0) {
					hit(a, "强化A", "火花好活·主目标", talent[2], true);
					if (config.enemyCount > 1)
						hit(
							a,
							"强化A",
							"火花好活·扩散",
							talent[3],
							true,
							applause(a),
							Math.min(2, config.enemyCount - 1),
						);
					hit(
						a,
						"强化A",
						"火花互动·随机欢愉伤害",
						talent[0] * lottery.draws,
						true,
					);
				}
				afterAttack(a);
			}
		} else {
			let skill = "A";
			if (a === wolf) skill = sp > 0 ? "E" : "A";
			if (a === yao) skill = a.turn > yaoFieldUntil && sp > 0 ? "E" : "A";
			if (a === mc)
				skill =
					(a.actions - 1) % config.mcSkillEvery === 0 && sp > 0 ? "E" : "A";
			if (a === huo)
				skill =
					((a.actions - 1) % config.huoSkillEvery === 0 || !ward()) && sp > 0
						? "E"
						: "A";
			if (skill === "E") spend();
			else sp = Math.min(spCap, sp + 1);
			if (a !== wolf) energy(a, a === yao ? 30 : skill === "E" ? 30 : 20);
			if (a === wolf) {
				if (skill === "E") earnJokes(params(a, "02")[1], "银狼普通战技产笑");
				hit(
					a,
					skill,
					"银狼普通技能",
					params(a, skill === "E" ? "02" : "01")[0],
					false,
					0,
					skill === "E" ? config.enemyCount : 1,
				);
				if (applause(a) > 0)
					hit(
						a,
						skill,
						"好活当赏·附加欢愉伤害",
						params(a, "04")[2],
						true,
						applause(a),
						skill === "E" ? config.enemyCount : 1,
					);
				afterAttack(a, skill === "E");
				if (skill === "A") {
					coneBasics++;
					if (coneBasics >= 3) coneReady = true;
				}
			}
			if (a === yao) {
				if (skill === "E") yaoFieldUntil = a.turn + params(a, "02")[0] - 1;
				else {
					const p = params(a, "01");
					hit(a, "A", "爻光普攻", p[0], false);
					if (config.enemyCount > 1)
						hit(
							a,
							"A",
							"爻光扩散",
							p[1],
							false,
							0,
							Math.min(2, config.enemyCount - 1),
						);
					afterAttack(a);
				}
				if (a.turn <= yaoFieldUntil)
					earnJokes(params(a, "02")[2], "爻光结界·普通A/E产笑");
				log(a, skill, "爻光行动后");
			}
			if (a === mc) {
				if (skill === "E") {
					giveApplause(a, params(a, "02")[1] + mcPending);
					mcPending = 0;
					mcE1 = Math.min(3, mcE1 + 1);
				}
				hit(
					a,
					skill,
					"欢愉主普通技能",
					params(a, skill === "E" ? "02" : "01")[0],
					false,
					0,
					skill === "E" ? config.enemyCount : 1,
				);
				if (skill === "E" && applause(a) > 0)
					hit(
						a,
						"E",
						"好活当赏·额外全体欢愉伤害",
						params(a, "04")[2],
						true,
						Math.max(...actors.map(applause)),
						config.enemyCount,
					);
				afterAttack(a, skill === "E");
			}
			if (a === huo) {
				if (skill === "E") {
					wardUntil = a.turn + params(a, "04")[0] + 1 - 1;
					const lc = lightconeParameters(21007, a.p.character.superimpose);
					actors
						.filter((x) => x !== wolf)
						.forEach((x) => {
							energy(x, lc[1], false, "同一种心情·战技回能");
						});
					updateSpeeds();
					log(a, "E", "禳命与同一种心情回能");
				} else {
					hit(a, "A", "藿藿生命值普攻", params(a, "01")[0], false);
					afterAttack(a);
				}
			}
		}
		if (reward) {
			if (temporary) {
				const before = applause(a);
				temporary.value *= reward.keepApplause;
				resource(
					"applause",
					"真珠额外回合结束·移除临时好活",
					-(reward.applause * (1 - reward.keepApplause)),
					before,
					applause(a),
					a.p.character.name,
				);
			}
			const before = jokes;
			jokes = Math.floor(
				Math.max(0, jokes - reward.jokes * (1 - reward.keepJokes)),
			);
			resource(
				"jokes",
				"真珠额外回合结束·移除临时笑点",
				jokes - before,
				before,
				jokes,
			);
			log(pearl, "额外回合结束", "真珠临时资源清理（保留升格比例）");
			rows[rows.length - 1].pearlTemporaryJokes = reward.jokes;
			rows[rows.length - 1].pearlTemporaryApplause = reward.applause;
		}

		normalActor = undefined;
		if (!extra) a.next = av + 10000 / a.speed;
		log(
			a,
			"行动结算",
			pearlTurn
				? "真珠额外回合结算完成"
				: extra
					? "E2额外回合结算完成"
					: "正常回合结算完成",
		);
		if (pearlTurn)
			rows.slice(pearlStart).forEach((row) => {
				row.pearlExtraTurn = true;
			});
		ultimateChecks();
	};
	if (star) {
		gainWill(star.p.gear.initialEnergy ?? 0, "虚照初始愿力");
		if (star.p.character.eidolon >= 1)
			gainWill(rankParameters("1511", 1)[0], "虚照E1进战愿力");
	}
	// Opening: profile speeds exclude combat-only speed buffs. Preserve exact relic decimals.
	actors.forEach((a) => {
		a.speed = a.p.speed + actorBaseSpeed(a) * (huo ? 0.12 : 0);
		const advance =
			(a.p.character.hasVonwacq ? 0.4 : 0) +
			(a === star ? traceParameters("1511", "103")[4] : 0) +
			(hasSet(a, "329") && elation(a) >= 0.4 ? 0.4 : 0);
		a.next = (10000 / a.speed) * Math.max(0, 1 - advance);
	});
	nextAha = 10000 / ahaSpeed();
	actors
		.filter((a) => a.p.character.lc_id === 23054)
		.forEach((a) => {
			seerUntil.set(a, seerParams(a)[3]);
			energy(a, seerParams(a)[5], true, "当她决定看见·每波固定回能");
		});
	if (huo)
		energy(huo, traceParameters("11217", "101")[0], false, "强化藿藿开场回能");
	if (mc?.p.character.techniqueOn)
		teamBuff("欢愉主秘技", "elation", config.mcTechniqueElation, 3);
	if (yao?.p.character.techniqueOn) {
		yaoFieldUntil = 2;
		energy(yao, 30, false, "爻光秘技自动战技");
		earnJokes(3, "爻光秘技自动E产笑");
	}
	if (fire?.p.character.techniqueOn) {
		const p = skillParameters("1501", "07", 1);
		sp = Math.min(spCap, sp + p[0]);
		hit(fire, "秘技", "火花秘技开场", p[1], false, 0, config.enemyCount);
	}
	if (pearl?.p.character.techniqueOn) {
		const p = skillParameters("1503", "07", 1);
		pearlBlueprint =
			actors.find(
				(a) => a.p.character.id === config.pearlBlueprintId && a !== pearl,
			) ??
			star ??
			wolf;
		pearlCharges = p[0];
		giveApplause(pearl, p[1], "真珠秘技好活");
		pearlEnergyToken = participants.includes(pearlBlueprint)
			? pearlBlueprint
			: undefined;
	}
	if (wolf.p.character.techniqueOn) box("秘技·怪味豆固定99好活", "beans");
	log(undefined, "开场", "指定配装，银狼为主要输出位");
	if (star?.p.character.techniqueOn)
		moment(skillParameters("1511", "07", 1)[0]);
	ultimateChecks();
	while (eventCount++ < 5000) {
		while (
			(pendingExtras > 0 ||
				pendingFireExtras > 0 ||
				pearlExtraQueue.length > 0) &&
			av <= config.limit
		) {
			const pearlTarget = pearlExtraQueue.shift();
			if (pearlTarget) {
				normal(pearlTarget, true, true);
				continue;
			}
			if (pendingExtras === 0 && fire) {
				pendingFireExtras--;
				normal(fire, true);
				continue;
			}
			pendingExtras--;
			normal(wolf, true);
		}
		const nextActor = actors.reduce((a, b) => (a.next <= b.next ? a : b));
		const next = Math.min(nextActor.next, nextAha, nextEnemy);
		if (next > config.limit + 1e-8) break;
		av = next;
		if (nextEnemy <= next + 1e-8) {
			enemyTurn++;
			if (pearl && config.enemyAttackDamage > 0) {
				const result = consumePearlResistance(
					pearlPoints,
					config.enemyAttackDamage * actors.length,
					params(pearl, "04")[4],
					params(pearl, "04")[1],
				);
				gainPearl(result.points - pearlPoints, "真珠抵御群攻消耗");
			}
			actors
				.filter((a) => a !== wolf)
				.forEach((a) => {
					energy(a, 10, false, "敌方群攻受击回能");
				});
			nextEnemy += 10000 / config.enemySpeed;
			log(undefined, "敌方群攻", "常规能量角色获得10×回能效率");
			ultimateChecks();
			continue;
		}
		if (nextAha <= next + 1e-8) {
			nextAha = av + 10000 / ahaSpeed();
			moment();
			ultimateChecks();
			continue;
		}
		normal(nextActor);
	}
	if (eventCount >= 5000) throw new Error("欢愉队模拟未收敛");
	// 阿哈正传：已造成的伤害按固定比例额外结算为欢愉负债；填了生命上限时受10%上限与6魂20%下限约束。
	if (star && debtRatio > 0 && total > 0) {
		const flow = total * debtRatio;
		const debt =
			config.enemyMaxHp > 0
				? Math.max(
						star.p.character.eidolon >= 6
							? config.enemyMaxHp * rankParameters("1511", 6)[0]
							: 0,
						Math.min(debtCap, flow),
					)
				: flow;
		debtHpLoss = debt;
		log(
			star,
			"负债",
			`阿哈正传·欢愉负债（按已造成伤害的${(debtRatio * 100).toFixed(0)}%计入）`,
			"true",
			debtRatio,
			debt,
			debt,
		);
	}
	return {
		rows,
		ahaBaseSpeed,
		cycles,
		total,
		byActor,
		events: eventCount,
		warnings: [
			"银狼Q先消耗60隐藏分，再结算行迹与光锥收益；盲盒按开箱前SP和隐藏分动态计算概率（a=C/k），暴击取期望。",
			`好活发放相位=${config.applausePhase}（技能资料为after）；菇菇嘎嘎${config.mushroomStacks ? "分来源叠加" : "同名不叠加"}；欢愉主行迹${config.mcTraceStack ? "累计" : "刷新"}，均需对照实测。`,
			huo
				? `强化藿藿默认每次天赋触发提供2次基础治疗；额外低血治疗人数=${config.lowHpHealTargets}。`
				: "本配置不含藿藿，不计其治疗、回能或加速。",
			...(star
				? [
						`虚照已接入升格；【欢愉负债】按阿哈正传的面板比例把已造成伤害额外计入总量（${config.ahaDebt ? "开启" : "关闭"}），填了生命上限时按10%封顶。`,
					]
				: []),
		],
	};
}
