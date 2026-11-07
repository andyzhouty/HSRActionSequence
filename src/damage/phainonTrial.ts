import { getCharacterCid } from "../data/characters";
import type {
	CharacterConfig,
	GeneratedAction,
} from "../utils/action-sequence/types";
import { CerydraMerit } from "./cerydra";
import {
	createEnergyTracker,
	type EnergyEvent,
	type EnergySnapshot,
} from "./energy";
import { calculateDamage, type DamageFactors } from "./formula";
import {
	lightconeParameters,
	rankParameters,
	skillParameters,
	traceParameters,
} from "./metadata";
import { normalizePhainonTrialConfig, type PhainonTrialConfig } from "./types";

export type TrialRow = {
	key: string;
	actionValue: number;
	actor: string;
	skill: string;
	description: string;
	attack: number;
	damageBonus: number;
	critDamage: number;
	buffs: string[];
	perTarget: number[];
	expected: number;
	crit: number;
	cumulative: number;
	factors: DamageFactors;
	energy: EnergySnapshot;
	energyEvents: EnergyEvent[];
	seedOverflow: number;
	multipliers: number[];
	ruin: number;
	seeds: number;
	skillPoints: number;
	warnings: string[];
	cerydra?: {
		target?: string;
		charges: number;
		crowned: boolean;
		extraHits: number;
	};
};
type TrialInput = {
	characters: readonly CharacterConfig[];
	actions: readonly GeneratedAction[];
	config: PhainonTrialConfig;
	skillTargets?: Record<string, string>;
	defaultSkillTargets?: Record<string, string>;
	attackDisabled?: Record<string, boolean>;
	meritTarget?: string;
};
type Buff = {
	id: string;
	name: string;
	expires: number;
	attackRatio?: number;
	critDamage?: number;
	damageBonus?: number;
};

/** Replays this trial's buff events over the existing action axis. */
export function calculatePhainonTrial(input: TrialInput): {
	rows: TrialRow[];
	warnings: string[];
} {
	const config = normalizePhainonTrialConfig(input.config);
	if (!config) return { rows: [], warnings: [] };
	const phainon = input.characters.find(
		(character) =>
			character.id === config.characterId &&
			getCharacterCid(character.name) === "1408",
	);
	if (!phainon) return { rows: [], warnings: ["请先在队伍中选择白厄"] };
	const party = input.characters.filter(
		(character) => character.kind === "角色",
	);
	const supported = new Set(["1408", "1101", "1306", "1309", "1412"]);
	const limits: Record<string, number> = {
		"1408": 2,
		"1101": 4,
		"1306": 0,
		"1309": 1,
		"1412": 6,
	};
	const unsupportedEidolons = party.filter(
		(character) =>
			character.eidolon > (limits[getCharacterCid(character.name) ?? ""] ?? 6),
	);
	if (unsupportedEidolons.length)
		return {
			rows: [],
			warnings: [
				`这些星魂尚未接入：${unsupportedEidolons.map((character) => character.name).join("、")}`,
			],
		};
	const warnings = party
		.filter(
			(character) => !supported.has(getCharacterCid(character.name) ?? ""),
		)
		.map((character) => `${character.name}的增益尚未接入`);
	const has = (cid: string) =>
		party.some((character) => getCharacterCid(character.name) === cid);
	const hasBronya = has("1101"),
		hasSparkle = has("1306"),
		hasRobin = has("1309");
	const member = (cid: string) =>
		party.find((character) => getCharacterCid(character.name) === cid);
	const gear = (cid: string) => config.gear[member(cid)?.id ?? ""];
	const sparkleEnhanced = gear("1306")?.enhanced ?? false;
	const cerydra = member("1412");
	const merit = cerydra
		? new CerydraMerit(
				cerydra.eidolon,
				gear("1412")?.skillLevel ?? 10,
				gear("1412")?.talentLevel ?? 10,
			)
		: undefined;
	let cerydraTurns = 0,
		cerydraConeExpiry = -1,
		songStacks = 0;
	const cerydraCone =
		cerydra?.lc_id === 23026
			? lightconeParameters(cerydra.lc_id, cerydra.superimpose)
			: undefined;
	const cerydraAttackNow = () =>
		config.cerydraAttack +
		config.cerydraBaseAttack *
			(teamAttackRatio() +
				(activeBuffs().some((b) => b.id === "bronyaQ")
					? supportParameters("1101", "03")[0]
					: 0) +
				(cerydraCone && cerydraTurns <= cerydraConeExpiry
					? cerydraCone[3]
					: 0)) +
		robinFlatAttackNow();
	const noteAttack = () => {
		energy.onAttack();
		if (cerydraCone && cerydra && songStacks < cerydraCone[1]) {
			songStacks += 1;
			energy.changeRegeneration(cerydra.id, cerydraCone[0]);
		}
	};

	const supportParameters = (cid: string, suffix: string) =>
		skillParameters(
			cid === "1306" && sparkleEnhanced ? "11306" : cid,
			suffix,
			gear(cid)?.[
				suffix === "02"
					? "skillLevel"
					: suffix === "03"
						? "ultimateLevel"
						: "talentLevel"
			] ?? 10,
		);
	const coneParameters = (actor: CharacterConfig) =>
		lightconeParameters(actor.lc_id, actor.superimpose);
	const whiteSets = config.gear[phainon.id]?.sets ?? {};
	const dawn = phainon.lc_id === 23044;
	let sparkleTurns = 0,
		overflowSkillPoints = 0,
		bronyaUltimates = 0;
	let pendingCone: CharacterConfig | undefined;
	let priestStacks = 0,
		priestExpiry = -1;
	let helpStacks = 0;
	let turn = 0,
		ruin = 0,
		seeds = traceParameters("1408", "101")[1],
		domain = false;
	let seedOverflow = 0;
	let selfAttackStacks = 1,
		skillPoints = config.initialSkillPoints;
	let sparkleStacks = hasSparkle ? config.initialSparkleStacks : 0,
		sparkleExpiry = 2;
	let robinTurns = 0,
		robinSkillExpiry = -1,
		robinActive = false;
	let currentTurnOwner = "",
		cumulative = 0;
	const buffs: Buff[] = [];
	const rows: TrialRow[] = [];
	const energy = createEnergyTracker(input.characters, config);
	const addBuff = (buff: Buff) => {
		const index = buffs.findIndex((item) => item.id === buff.id);
		if (index >= 0) buffs.splice(index, 1);
		buffs.push(buff);
	};
	if (config.healingTrace)
		addBuff({
			id: "healing",
			name: "行迹·治疗增伤",
			expires: 4,
			damageBonus: traceParameters("1408", "102")[0],
		});
	const activeBuffs = () => buffs.filter((buff) => buff.expires >= turn);
	const teamAttackRatio = () =>
		hasSparkle
			? sparkleEnhanced
				? traceParameters("11306", "103")[0]
				: traceParameters("1306", "103")[3]
			: 0;
	/**
	 * 辅助把自身暴伤按比例转化成增益时（花火E、鸭Q），要用它们当前的暴伤，
	 * 而队伍暴伤（鸟天赋、鸭Q）对全队生效，会给它们再次计入后二次转化。
	 */
	const teamCritDamage = (includeBronyaQ: boolean) => {
		const robin = hasRobin ? supportParameters("1309", "04")[0] : 0;
		const bronyaQ = includeBronyaQ
			? (buffs.find((buff) => buff.id === "bronyaQ")?.critDamage ?? 0)
			: 0;
		return robin + bronyaQ;
	};
	/**
	 * 协奏提供的攻击力加成按当前生效的队伍攻击力加成实时计算：
	 * 鸭Q 即使晚于鸟Q 施加，也会立刻抬高协奏攻击力，而不是只在施放瞬间结算。
	 */
	const robinFlatAttackNow = () => {
		if (!robinActive) return 0;
		const parameters = supportParameters("1309", "03");
		const bronyaAttack = activeBuffs().some((buff) => buff.id === "bronyaQ")
			? supportParameters("1101", "03")[0]
			: 0;
		return (
			(config.robinAttack +
				config.robinBaseAttack * (teamAttackRatio() + bronyaAttack)) *
				parameters[0] +
			parameters[2]
		);
	};
	const cerydraFactors = (): DamageFactors => {
		const attack = cerydraAttackNow();
		const trace = traceParameters("1412", "101");
		return {
			...config,
			critRate: config.cerydraCritRate + traceParameters("1412", "102")[0],
			critDamage:
				config.cerydraCritDamage +
				teamCritDamage(true) +
				Math.min(
					trace[3],
					Math.floor(Math.max(0, attack - trace[0]) / trace[1]) * trace[2],
				),
			damageBonus:
				config.cerydraDamageBonus +
				(cerydraCone && cerydraTurns <= cerydraConeExpiry
					? cerydraCone[2]
					: 0) +
				(cerydra && cerydra.eidolon >= 2 && merit?.target
					? rankParameters("1412", 2)[1]
					: 0) +
				(hasRobin && robinTurns <= robinSkillExpiry
					? supportParameters("1309", "02")[0]
					: 0),
			defenseIgnore: config.defenseIgnore,
			resistancePenetration:
				config.resistancePenetration +
				(cerydra && cerydra.eidolon >= 6 && merit?.target
					? rankParameters("1412", 6)[0]
					: 0) +
				(robinActive && (member("1309")?.eidolon ?? 0) >= 1
					? rankParameters("1309", 1)[0]
					: 0),
		};
	};

	const snapshot = (
		skill = "",
	): {
		attack: number;
		factors: DamageFactors;
		labels: string[];
	} => {
		const active = activeBuffs();
		const cerydraBuff = merit?.bonuses(phainon.id, skill === "E");
		const talentRatio = domain
			? skillParameters("1408", "05", config.talentLevel)[3]
			: 0;
		const ownRatio = traceParameters("1408", "103")[0] * selfAttackStacks;
		const bonusStacks =
			sparkleExpiry >= (sparkleEnhanced ? sparkleTurns : turn)
				? sparkleStacks
				: 0;
		const mystery = active.some((buff) => buff.id === "sparkleQ");
		const attack =
			config.attack +
			config.baseAttack *
				(ownRatio +
					talentRatio +
					teamAttackRatio() +
					active.reduce((sum, buff) => sum + (buff.attackRatio ?? 0), 0)) +
			robinFlatAttackNow() +
			(cerydraBuff?.attackRatio ?? 0) * cerydraAttackNow();
		const factors: DamageFactors = {
			...config,
			damageBonus:
				config.damageBonus +
				(cerydraBuff?.damageBonus ?? 0) +
				(cerydraCone && cerydraTurns <= cerydraConeExpiry
					? cerydraCone[2]
					: 0) +
				(hasBronya ? traceParameters("1101", "103")[0] : 0) +
				(hasRobin && robinTurns <= robinSkillExpiry
					? supportParameters("1309", "02")[0]
					: 0) +
				(!sparkleEnhanced && hasSparkle
					? bonusStacks *
						(supportParameters("1306", "04")[1] +
							(mystery ? supportParameters("1306", "03")[2] : 0))
					: 0) +
				active.reduce((sum, buff) => sum + (buff.damageBonus ?? 0), 0),
			vulnerability:
				config.vulnerability +
				(hasSparkle && sparkleEnhanced
					? bonusStacks *
						(supportParameters("1306", "04")[1] +
							(mystery ? supportParameters("1306", "03")[2] : 0))
					: 0),
			critDamage:
				config.critDamage +
				(cerydraBuff?.critDamage ?? 0) +
				(hasRobin ? supportParameters("1309", "04")[0] : 0) +
				active.reduce((sum, buff) => sum + (buff.critDamage ?? 0), 0) +
				(priestExpiry >= turn ? priestStacks * 0.18 : 0),
			defenseIgnore:
				config.defenseIgnore +
				(cerydraBuff?.defenseIgnore ?? 0) +
				(dawn ? coneParameters(phainon)[1] : 0),
			resistancePenetration:
				config.resistancePenetration +
				(cerydraBuff?.resistancePenetration ?? 0) +
				(domain && phainon.eidolon >= 2 ? rankParameters("1408", 2)[1] : 0) +
				(robinActive && (member("1309")?.eidolon ?? 0) >= 1
					? rankParameters("1309", 1)[0]
					: 0) +
				(sparkleEnhanced && active.some((buff) => buff.id === "sparkleE")
					? traceParameters("11306", "103")[1]
					: 0),
		};
		const labels = [
			`负世行迹×${selfAttackStacks}`,
			...active.map((buff) => buff.name),
		];
		if (merit?.target === phainon.id)
			labels.push(
				`刻律德菈·${merit.crowned ? "爵位" : "军功"}（${merit.charges}）`,
			);
		if (domain) labels.push("变身攻击力");
		if (hasBronya) labels.push("军势");
		if (hasSparkle)
			labels.push(
				sparkleEnhanced ? "强化夜想曲" : "夜想曲",
				`${sparkleEnhanced ? "幻相·易伤" : "红鲱鱼"}×${bonusStacks}`,
			);
		if (priestExpiry >= turn && priestStacks)
			labels.push(`司铎×${priestStacks}`);
		if (dawn) labels.push("黎明·无视防御");
		if (domain && phainon.eidolon >= 2) labels.push("2魂物理穿透");
		if (robinActive && (member("1309")?.eidolon ?? 0) >= 1)
			labels.push("知更鸟1魂穿透");
		if (hasRobin) labels.push("调性合颂");
		if (hasRobin && robinTurns <= robinSkillExpiry) labels.push("知更鸟战技");
		if (robinActive) labels.push("协奏攻击力（实时）");
		return { attack, factors, labels };
	};
	const record = (
		action: GeneratedAction,
		description: string,
		multipliers: number[],
		notes: string[] = [],
		isCopy = false,
	) => {
		const state = snapshot(action.skill);
		const isWhiteAttack =
			action.characterId === phainon.id &&
			multipliers.some((multiplier) => multiplier > 0);
		const ambush =
			!isCopy &&
			isWhiteAttack &&
			action.skill !== "秘技" &&
			(merit?.beginAttack(phainon.id, action.skill) ?? false);
		if (ambush)
			record(
				{ ...action, key: `${action.key}-cerydra-copy` },
				`奇袭·${description}`,
				multipliers,
				[],
				true,
			);
		if (isWhiteAttack && action.skill !== "秘技") noteAttack();
		if (
			isWhiteAttack &&
			!action.isDomainFinalAction &&
			action.skill !== "秘技" &&
			(whiteSets["309"] ?? 0) >= 2 &&
			state.factors.critRate >= 0.7
		) {
			state.factors.damageBonus += 0.2;
			state.labels.push("繁星竞技场");
		}
		const damages = multipliers.map((multiplier) =>
			calculateDamage(state.attack * multiplier, state.factors),
		);
		const expected = damages.reduce((sum, damage) => sum + damage.expected, 0);
		cumulative += expected;
		rows.push({
			key: action.key,
			actionValue: action.actionValue,
			actor:
				input.characters.find(
					(character) => character.id === action.characterId,
				)?.name ?? "白厄",
			skill: action.skill,
			description,
			attack: state.attack,
			damageBonus: state.factors.damageBonus,
			critDamage: state.factors.critDamage,
			factors: state.factors,
			energy: energy.snapshot(),
			energyEvents: energy.takeEvents(),
			multipliers,
			buffs: state.labels,
			perTarget: damages.map((damage) => damage.expected),
			expected,
			crit: damages.reduce((sum, damage) => sum + damage.crit, 0),
			cumulative,
			ruin,
			seeds,
			seedOverflow,
			skillPoints,
			warnings: notes,
			cerydra: merit
				? {
						target: merit.target,
						charges: merit.charges,
						crowned: merit.crowned,
						extraHits: merit.extraHits,
					}
				: undefined,
		});
		// 协奏期间我方每次攻击后，知更鸟追加一次 72% 自身攻击力的物理伤害，固定 100% 暴击 / 150% 暴伤。
		if (isWhiteAttack && action.skill !== "秘技" && robinActive && hasRobin) {
			const parameters = supportParameters("1309", "03");
			const attack =
				config.robinAttack + config.robinBaseAttack * teamAttackRatio();
			const damage = calculateDamage(attack * parameters[3], {
				...state.factors,
				damageBonus: 0,
				critRate: 1,
				critDamage: parameters[5],
			}).expected;
			cumulative += damage;
			rows.push({
				key: `${action.key}-robin-extra`,
				actionValue: action.actionValue,
				actor: member("1309")?.name ?? "知更鸟",
				skill: "协奏",
				description: "知更鸟·协奏附加伤害",
				attack,
				damageBonus: 0,
				critDamage: parameters[5],
				buffs: ["协奏附加"],
				perTarget: [damage],
				expected: damage,
				crit: damage,
				cumulative,
				factors: {
					...state.factors,
					damageBonus: 0,
					critRate: 1,
					critDamage: parameters[5],
				},
				energy: energy.snapshot(),
				energyEvents: energy.takeEvents(),
				seedOverflow,
				multipliers: [parameters[3]],
				ruin,
				seeds,
				skillPoints,
				warnings: [],
			});
		}
		if (
			isWhiteAttack &&
			action.skill !== "秘技" &&
			merit?.takeExtraHit(phainon.id) &&
			cerydra
		) {
			const attack = cerydraAttackNow();
			const factors = cerydraFactors();
			const critDamage = factors.critDamage;
			const multiplier =
				merit.talent[2] *
				(cerydra.eidolon >= 6 ? 1 + rankParameters("1412", 6)[1] : 1);
			const damage = calculateDamage(attack * multiplier, factors);
			cumulative += damage.expected;
			rows.push({
				...rows[rows.length - 1],
				key: `${action.key}-cerydra-extra`,
				actor: cerydra.name,
				skill: "附加伤害",
				description: "刻律德菈·军功附加伤害",
				attack,
				critDamage,
				damageBonus: factors.damageBonus,
				factors,
				buffs: ["军功附加伤害"],
				multipliers: [multiplier],
				perTarget: [damage.expected],
				expected: damage.expected,
				crit: damage.crit,
				cumulative,
				warnings: [],
				energyEvents: [],
			});
		}
		if (
			!isCopy &&
			action.characterId === phainon.id &&
			["A", "E"].includes(action.skill) &&
			merit?.target === phainon.id
		) {
			merit.finishAttack(phainon.id, action.skill);
			if ((action.skill === "A" || action.skill === "E") && cerydra)
				energy.gain(
					cerydra.id,
					traceParameters("1412", "103")[0],
					"刻律德菈·军功目标行动回能",
				);
		}
		if (isCopy && cerydra && ["A", "E"].includes(action.skill))
			energy.gain(
				cerydra.id,
				traceParameters("1412", "103")[0],
				"刻律德菈·奇袭技能回能",
			);

		if (merit && rows.length) {
			const last = rows[rows.length - 1];
			last.energy = energy.snapshot();
			last.energyEvents.push(...energy.takeEvents());
		}

		if (merit && rows.length)
			rows[rows.length - 1].cerydra = {
				target: merit.target,
				charges: merit.charges,
				crowned: merit.crowned,
				extraHits: merit.extraHits,
			};
		if (merit) {
			const ownRow = rows.find((row) => row.key === action.key);
			if (ownRow)
				ownRow.cerydra = {
					target: merit.target,
					charges: merit.charges,
					crowned: merit.crowned,
					extraHits: merit.extraHits,
				};
		}
	};
	/**
	 * 增益持续回合的口径（用户实战确认）：扣减发生在技能目标的回合开始时。
	 * 因此在目标回合开始之后才施加的增益不吃当回合那一层：
	 * 「2回合」覆盖3次行动，「1回合」覆盖2次；
	 * 在目标回合开始之前施加（例如他的上一个行动者结算完）则只覆盖 d 次。
	 */
	const buffExpiry = (duration: number) => turn + duration;
	const gainTarget = () => {
		seeds = Math.min(15, seeds + 1);
		helpStacks = Math.min(2, helpStacks + 1);
		addBuff({
			id: "targetTalent",
			name: "此身为炬·暴伤",
			expires: buffExpiry(
				Number(skillParameters("1408", "04", config.talentLevel)[1]),
			),
			critDamage: skillParameters("1408", "04", config.talentLevel)[0],
		});
	};
	const spendSkillPoint = (notes: string[], actorId: string) => {
		if (skillPoints < 1) notes.push("战技点不足：本行动为假设施放");
		skillPoints = Math.max(0, skillPoints - 1);
		if (hasSparkle) {
			const tick = sparkleEnhanced ? sparkleTurns : turn;
			sparkleStacks = Math.min(
				3,
				sparkleExpiry >= tick ? sparkleStacks + 1 : 1,
			);
			sparkleExpiry = tick + 2;
		}
		if (
			sparkleEnhanced &&
			actorId === phainon.id &&
			activeBuffs().some((buff) => buff.id === "sparkleE")
		) {
			const sparkle = member("1306");
			if (sparkle)
				energy.gain(
					sparkle.id,
					traceParameters("11306", "101")[1],
					"花火·岁时记耗点回能",
				);
		}
	};
	const enterDomain = (notes: string[]) => {
		if (seeds < 12) notes.push(`火种仅${seeds}，不足12：本次开大为假设施放`);
		seedOverflow = Math.min(
			skillParameters("1408", "04", config.talentLevel)[2],
			Math.max(0, seeds - 12),
		);
		seeds = 0;
		domain = true;
		if ((whiteSets["126"] ?? 0) >= 4 && helpStacks === 2) {
			helpStacks = 0;
			addBuff({
				id: "captain",
				name: "船长·助力",
				expires: turn + 1,
				attackRatio: 0.48,
			});
		}
		if (phainon.eidolon >= 1)
			addBuff({
				id: "eidolon1",
				name: "1魂·暴伤",
				expires: turn + rankParameters("1408", 1)[2],
				critDamage: rankParameters("1408", 1)[1],
			});
		if (dawn)
			addBuff({
				id: "dawn",
				name: "烈阳",
				expires: turn,
				damageBonus: coneParameters(phainon)[2],
			});
		ruin = Math.min(
			7,
			ruin + skillParameters("1408", "05", config.talentLevel)[0],
		);
		if (currentTurnOwner === phainon.id)
			for (const buff of activeBuffs()) buff.expires += 1;
	};
	const bronya = member("1101");
	if (bronya?.techniqueOn)
		addBuff({
			id: "bronyaTechnique",
			name: "布洛妮娅秘技",
			expires: 2,
			attackRatio: skillParameters("1101", "07", 1)[0],
		});
	if (member("1306")?.techniqueOn)
		skillPoints = Math.min(
			7,
			skillPoints +
				skillParameters(sparkleEnhanced ? "11306" : "1306", "07", 1)[0],
		);
	if (cerydra?.techniqueOn && merit) {
		const initialTarget =
			input.meritTarget ?? input.defaultSkillTargets?.[cerydra.id];
		if (initialTarget) {
			energy.gain(cerydra.id, 30, "刻律德菈·秘技自动战技");
			merit.castSkill(initialTarget);
			if (initialTarget === phainon.id) gainTarget();
			if (cerydra.eidolon >= 1)
				energy.gain(
					initialTarget,
					rankParameters("1412", 1)[2],
					"刻律德菈1魂·秘技战技",
				);
		} else warnings.push("刻律德菈秘技未设置军功目标");
	}
	if (phainon.techniqueOn) {
		const technique = skillParameters("1408", "07", 1);
		ruin = technique[1];
		skillPoints = Math.min(hasSparkle ? 7 : 5, skillPoints + technique[3]);
		record(
			{
				key: `${phainon.id}-damage-technique`,
				characterId: phainon.id,
				actionValue: 0,
				actionNo: 0,
				skill: "秘技",
				speed: 0,
			},
			"秘技·每波次开场伤害（首波）",
			Array(config.enemyCount).fill(technique[0]),
		);
	}
	const actionByKey = new Map(
		input.actions.map((action) => [action.key, action]),
	);
	const begunTurns = new Set<string>();
	for (const action of input.actions) {
		const parent =
			action.interruptTiming === "before"
				? actionByKey.get(action.key.replace(/-interrupt-\d+$/, ""))
				: action;
		const startsTurn =
			!!parent &&
			!parent.isDomainAction &&
			parent.actionNo > 0 &&
			!parent.isFuaAction &&
			!begunTurns.has(parent.key);
		if (!domain && currentTurnOwner === phainon.id && startsTurn) {
			for (let index = buffs.length - 1; index >= 0; index--)
				if (buffs[index].expires <= turn) buffs.splice(index, 1);
			if (priestExpiry <= turn) priestExpiry = -1;
			if (!sparkleEnhanced && sparkleExpiry <= turn) sparkleExpiry = -1;
		}
		if (startsTurn && parent && !domain) {
			begunTurns.add(parent.key);
			currentTurnOwner = parent.characterId;
			const owner = party.find(
				(character) => character.id === parent.characterId,
			);
			const ownerCid = owner ? getCharacterCid(owner.name) : undefined;
			if (parent.characterId === phainon.id) {
				turn += 1;
				const index = buffs.findIndex((buff) => buff.id === "dawn");
				if (index >= 0) buffs.splice(index, 1);
			}
			if (ownerCid === "1306") sparkleTurns += 1;
			if (ownerCid === "1412") cerydraTurns += 1;
			if (ownerCid === "1309") {
				robinTurns += 1;
				robinActive = false;
			}
			if (pendingCone && owner && owner.id !== pendingCone.id) {
				if (owner.id === phainon.id)
					addBuff({
						id: "bronyaCone",
						name: "但战斗还未结束",
						expires: turn,
						damageBonus: coneParameters(pendingCone)[1],
					});
				pendingCone = undefined;
			}
		}
		const enemy = input.characters.find(
			(character) =>
				character.id === action.characterId && character.kind === "敌人",
		);
		if (enemy) {
			currentTurnOwner = enemy.id;
			if (!domain) seeds = Math.min(15, seeds + 1);
			energy.onEnemyAoe(domain);
			record(
				action,
				domain ? "敌方群攻·境界内不获得火种" : "敌方群攻·火种+1",
				Array(config.enemyCount).fill(0),
			);
			continue;
		}
		const actor = party.find(
			(character) => character.id === action.characterId,
		);
		if (!actor) continue;
		const cid = getCharacterCid(actor.name);
		if (!supported.has(cid ?? "")) continue;
		const notes: string[] = [];
		if (
			domain &&
			!action.isDomainAction &&
			(actor.id !== phainon.id || action.skill === "Q")
		) {
			notes.push(
				actor.id === phainon.id
					? "白厄境界内不能再次施放终结技"
					: "境界内队友离场，不能施放技能",
			);
			record(
				action,
				"非法境界内插入，未结算",
				Array(config.enemyCount).fill(0),
				notes,
			);
			continue;
		}
		const isNormalTurn =
			!action.isDomainAction && action.actionNo > 0 && !action.isFuaAction;
		const target =
			input.skillTargets?.[action.key] ?? input.defaultSkillTargets?.[actor.id];
		if (actor.id !== phainon.id) {
			if (cid === "1309" && robinActive && !isNormalTurn) {
				notes.push("知更鸟协奏期间不能再次施放技能");
				record(
					action,
					"非法协奏期间插入，未结算",
					Array(config.enemyCount).fill(0),
					notes,
				);
				continue;
			}
			if (cid === "1412" && action.skill === "Q" && cerydraCone) {
				energy.changeRegeneration(actor.id, -songStacks * cerydraCone[0]);
				songStacks = 0;
				cerydraConeExpiry = cerydraTurns + cerydraCone[4];
			}
			energy.onSkill(actor, action.skill, notes);
			if (action.skill === "E") {
				spendSkillPoint(notes, actor.id);
				if (cid === "1412" && merit) {
					if (target) {
						merit.castSkill(target);
						if (target === phainon.id) gainTarget();
						if (actor.eidolon >= 1)
							energy.gain(
								target,
								rankParameters("1412", 1)[2],
								"刻律德菈1魂·战技回能",
							);
					} else notes.push("未设置刻律德菈军功目标");
				} else if (cid === "1101" && target === phainon.id) {
					gainTarget();
					addBuff({
						id: "bronyaE",
						name: "作战再部署",
						expires: buffExpiry(supportParameters("1101", "02")[2]),
						damageBonus: supportParameters("1101", "02")[0],
					});
					if ((gear("1101")?.sets["121"] ?? 0) >= 4) {
						priestStacks = Math.min(
							2,
							priestExpiry >= turn ? priestStacks + 1 : 1,
						);
						priestExpiry = turn + 2;
					}
				} else if (cid === "1306" && target === phainon.id) {
					gainTarget();
					const parameters = supportParameters("1306", "02");
					addBuff({
						id: "sparkleE",
						name: "梦游鱼·人造花",
						expires: buffExpiry(parameters[2]),
						critDamage:
							(config.sparkleCritDamage + teamCritDamage(true)) *
								parameters[0] +
							parameters[1],
					});
				} else if (cid === "1309") {
					robinSkillExpiry =
						robinTurns + supportParameters("1309", "02")[1] - 1;
				}
				if (actor.lc_id === 23003) pendingCone = actor;
				if ((cid === "1101" || cid === "1306") && !target)
					notes.push("未设置战技目标，未给白厄施加单体增益");
			} else if (action.skill === "Q") {
				if (cid === "1101" || cid === "1306") gainTarget();
				if (cid === "1412" && merit) {
					merit.castUltimate(party[0]?.id, supportParameters("1412", "03")[1]);
					noteAttack();
				}
				if (cid === "1101") {
					const parameters = supportParameters("1101", "03");
					addBuff({
						id: "bronyaQ",
						name: "布洛妮娅终结技",
						expires: buffExpiry(parameters[3]),
						attackRatio: parameters[0],
						critDamage:
							(config.bronyaCritDamage + teamCritDamage(false)) *
								parameters[1] +
							parameters[2],
					});
					bronyaUltimates += 1;
					if (actor.lc_id === 23003 && bronyaUltimates % 2 === 1)
						skillPoints = Math.min(hasSparkle ? 7 : 5, skillPoints + 1);
				} else if (cid === "1306") {
					const parameters = supportParameters("1306", "03");
					if (sparkleEnhanced)
						overflowSkillPoints = Math.min(
							parameters[4],
							overflowSkillPoints +
								Math.max(0, skillPoints + parameters[1] - 7),
						);
					skillPoints = Math.min(7, skillPoints + parameters[1]);
					addBuff({
						id: "sparkleQ",
						name: "谜诡",
						expires: buffExpiry(
							sparkleEnhanced ? parameters[3] : parameters[0],
						),
					});
				} else if (cid === "1309") {
					// 协奏只标记进入状态，攻击力加成在每次结算时按当前加成实时取。
					robinActive = true;
				}
				if (actor.lc_id === 23019) {
					const parameters = coneParameters(actor);
					addBuff({
						id: `pastSelf-${actor.id}`,
						name: "镜中故我",
						expires: buffExpiry(parameters[2]),
						damageBonus: parameters[1],
					});
					if ((config.gear[actor.id]?.breakEffect ?? 0) >= parameters[3])
						skillPoints = Math.min(hasSparkle ? 7 : 5, skillPoints + 1);
				}
			} else if (action.skill === "A") {
				skillPoints = Math.min(hasSparkle ? 7 : 5, skillPoints + 1);
				noteAttack();
			}
			if (["A", "E", "Q"].includes(action.skill))
				record(
					action,
					`${actor.name}${action.skill}后增益`,
					Array(config.enemyCount).fill(0),
					notes,
				);
			if (
				cid === "1412" &&
				(action.skill === "A" || action.skill === "Q") &&
				!input.attackDisabled?.[action.key]
			) {
				const row = rows[rows.length - 1];
				const multiplier =
					action.skill === "A"
						? skillParameters("1412", "01", 6)[0]
						: supportParameters("1412", "03")[0] +
							(actor.eidolon >= 4 ? rankParameters("1412", 4)[0] : 0);
				const factors = cerydraFactors();
				const attack = cerydraAttackNow();
				const damage = calculateDamage(attack * multiplier, factors);
				const targets = action.skill === "A" ? 1 : config.enemyCount;
				cumulative += damage.expected * targets;
				Object.assign(row, {
					attack,
					critDamage: factors.critDamage,
					damageBonus: factors.damageBonus,
					factors,
					multipliers: Array(targets).fill(multiplier),
					perTarget: Array(targets).fill(damage.expected),
					expected: damage.expected * targets,
					crit: damage.crit * targets,
					cumulative,
					description: `刻律德菈${action.skill === "A" ? "普攻" : "终结技"}`,
				});
			}

			if (sparkleEnhanced && isNormalTurn && overflowSkillPoints > 0) {
				const refill = Math.min(7 - skillPoints, overflowSkillPoints);
				skillPoints += refill;
				overflowSkillPoints -= refill;
			}
			continue;
		}
		const override = config.actionOverrides[action.key];
		const targetIndex = override?.targetIndex ?? config.targetIndex;
		const single = (main: number, adjacent = 0) =>
			Array.from({ length: config.enemyCount }, (_, index) =>
				index === targetIndex
					? main
					: Math.abs(index - targetIndex) === 1
						? adjacent
						: 0,
			);
		if (targetIndex >= config.enemyCount) {
			notes.push("主目标超出敌人范围");
			record(
				action,
				"目标无效，跳过伤害",
				Array(config.enemyCount).fill(0),
				notes,
			);
			continue;
		}
		if (action.isDomainAction) {
			if (!domain) enterDomain(notes);
			if (override?.ruin !== undefined) ruin = override.ruin;
			if (action.isDomainFinalAction) {
				const remaining = Math.max(0, 8 - action.actionNo);
				const multiplier =
					skillParameters("1408", "03", config.ultimateLevel)[0] *
					Math.max(
						0,
						1 -
							remaining * skillParameters("1408", "05", config.talentLevel)[2],
					);
				record(
					action,
					`最后一击${remaining ? `（提前${remaining}回合）` : ""}`,
					input.attackDisabled?.[action.key]
						? Array(config.enemyCount).fill(0)
						: Array(config.enemyCount).fill(multiplier / config.enemyCount),
					notes,
				);
				domain = false;
				// 负世行迹在退场后才叠到 100%，最后一击本身仍按 50% 结算。
				selfAttackStacks = Math.min(2, selfAttackStacks + 1);
				seeds = Math.min(15, seedOverflow + traceParameters("1408", "101")[0]);
				seedOverflow = 0;
				for (const row of rows)
					if (row.key === action.key || row.key.startsWith(`${action.key}-`)) {
						row.seeds = seeds;
						row.seedOverflow = 0;
					}
			} else if (action.skill === "A") {
				const parameters = skillParameters("1408", "08", config.basicLevel);
				ruin = Math.min(7, ruin + parameters[2]);
				record(
					action,
					"创生·强化普攻",
					input.attackDisabled?.[action.key]
						? Array(config.enemyCount).fill(0)
						: single(parameters[0], parameters[1]),
					notes,
				);
			} else if (["E", "EA", "EW"].includes(action.skill)) {
				const parameters = skillParameters("1408", "11", config.skillLevel);
				const spent = Math.min(parameters[3], ruin);
				ruin -= spent;
				if (!spent) notes.push("毁伤为0，本次战技不造成伤害");
				const multiplier =
					spent * parameters[2] * parameters[1] +
					(spent === parameters[3] ? parameters[0] : 0);
				const combined = action.skill.length === 2;
				if (combined && (phainon.eidolon < 2 || spent < 4))
					notes.push("前段E未消耗4毁伤，不结算2魂额外回合");
				if (!combined && phainon.eidolon >= 2 && spent === 4)
					notes.push("2魂额外回合未填写：本行只计算E，可改为EA或EW");
				record(
					combined
						? { ...action, key: `${action.key}-damage-E`, skill: "E" }
						: action,
					`死星天裁·消耗${spent}毁伤`,
					input.attackDisabled?.[action.key]
						? Array(config.enemyCount).fill(0)
						: Array(config.enemyCount).fill(multiplier / config.enemyCount),
					notes,
				);
				if (combined && phainon.eidolon >= 2 && spent === 4) {
					const extra = action.skill[1];
					const extraAction = {
						...action,
						key: `${action.key}-damage-extra-${extra}`,
						skill: extra,
					};
					if (extra === "A") {
						const parameters = skillParameters("1408", "08", config.basicLevel);
						ruin = Math.min(7, ruin + parameters[2]);
						record(
							extraAction,
							"2魂额外回合·强化普攻",
							input.attackDisabled?.[action.key]
								? Array(config.enemyCount).fill(0)
								: single(parameters[0], parameters[1]),
						);
					} else {
						const parameters = skillParameters("1408", "09", config.skillLevel);
						ruin = Math.min(7, ruin + config.enemyCount);
						const stacks = override?.counterStacks ?? config.enemyCount + 1;
						record(
							extraAction,
							`2魂额外回合·反击${stacks}层`,
							input.attackDisabled?.[action.key]
								? Array(config.enemyCount).fill(0)
								: Array(config.enemyCount).fill(
										(parameters[0] +
											(parameters[2] * parameters[3]) / config.enemyCount) *
											(1 + stacks * parameters[4]),
									),
						);
					}
				}
			} else if (action.skill === "W") {
				const parameters = skillParameters("1408", "09", config.skillLevel);
				const stacks = override?.counterStacks ?? config.enemyCount + 1;
				ruin = Math.min(7, ruin + config.enemyCount);
				const perTarget =
					(parameters[0] +
						(parameters[2] * parameters[3]) / config.enemyCount) *
					(1 + stacks * parameters[4]);
				record(
					action,
					`弑魂焚诏·反击${stacks}层（按每敌1次行动）`,
					input.attackDisabled?.[action.key]
						? Array(config.enemyCount).fill(0)
						: Array(config.enemyCount).fill(perTarget),
					notes,
				);
			} else {
				notes.push("领域技能未填写或不在0魂支持范围，未计入伤害");
				record(
					action,
					"领域行动未结算",
					Array(config.enemyCount).fill(0),
					notes,
				);
			}
		} else if (action.skill === "Q") {
			if (!domain) {
				merit?.targetUltimate(phainon.id);
				enterDomain(notes);
			}
			record(
				action,
				"终结技·展开境界（此时无直接伤害）",
				Array(config.enemyCount).fill(0),
				notes,
			);
		} else if (action.skill === "A" || action.skill === "E") {
			const parameters = skillParameters(
				"1408",
				action.skill === "A" ? "01" : "02",
				action.skill === "A" ? config.basicLevel : config.skillLevel,
			);
			if (action.skill === "E") {
				spendSkillPoint(notes, actor.id);
				seeds = Math.min(15, seeds + parameters[2]);
			} else skillPoints = Math.min(hasSparkle ? 7 : 5, skillPoints + 1);
			record(
				action,
				action.skill === "A" ? "普通普攻" : "普通战技",
				input.attackDisabled?.[action.key]
					? Array(config.enemyCount).fill(0)
					: single(parameters[0], action.skill === "E" ? parameters[1] : 0),
				notes,
			);
		}
		if (sparkleEnhanced && isNormalTurn && overflowSkillPoints > 0) {
			const refill = Math.min(7 - skillPoints, overflowSkillPoints);
			skillPoints += refill;
			overflowSkillPoints -= refill;
		}
	}
	return { rows, warnings };
}
