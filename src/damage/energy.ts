import { getCharacterCid } from "../data/characters";
import metadata from "../data/damageMetadata.json";
import type { CharacterConfig } from "../utils/action-sequence/types";
import type { PhainonTrialConfig } from "./types";

export type EnergySnapshot = Record<
	string,
	{ current: number; maximum: number; regeneration: number }
>;
export type EnergyEvent = {
	targetId: string;
	source: string;
	base: number;
	fixed: boolean;
	amount: number;
};

export function createEnergyTracker(
	characters: readonly CharacterConfig[],
	config: PhainonTrialConfig,
) {
	const balances: EnergySnapshot = {};
	let events: EnergyEvent[] = [];
	const party = characters.filter((character) => character.kind === "角色");
	const raw = metadata.characters as unknown as Record<
		string,
		{ ultimateCost: number; skills: Record<string, { energyGain: number }> }
	>;
	for (const character of party) {
		const cid = getCharacterCid(character.name);
		if (!cid || cid === "1408" || !raw[cid]) continue;
		const gear = config.gear[character.id];
		const maximum = gear?.ultimateCost || raw[cid].ultimateCost;
		balances[character.id] = {
			maximum,
			current: Math.min(maximum, gear?.initialEnergy ?? maximum / 2),
			regeneration: 1 + (gear?.energyRegen ?? 0),
		};
	}
	const gain = (id: string, base: number, source: string, fixed = false) => {
		const state = balances[id];
		if (state) {
			const amount = base * (fixed ? 1 : state.regeneration);
			events.push({ targetId: id, source, base, fixed, amount });
			state.current = Math.min(state.maximum, state.current + amount);
		}
	};
	const find = (cid: string) =>
		party.find((character) => getCharacterCid(character.name) === cid);
	if (find("1408")?.techniqueOn)
		for (const id of Object.keys(balances)) gain(id, 25, "白厄秘技");
	if (party.some((character) => character.lc_id === 23019))
		for (const id of Object.keys(balances)) gain(id, 10, "镜中故我·开场");
	const sparkle = find("1306");
	if (sparkle?.techniqueOn && config.gear[sparkle.id]?.enhanced)
		gain(sparkle.id, 20, "花火强化秘技");
	const robin = find("1309");
	if (robin?.techniqueOn) gain(robin.id, 5, "知更鸟秘技");
	return {
		gain,
		changeRegeneration: (id: string, delta: number) => {
			if (balances[id]) balances[id].regeneration += delta;
		},
		takeEvents: () => {
			const result = events;
			events = [];
			return result;
		},
		snapshot: (): EnergySnapshot =>
			Object.fromEntries(
				Object.entries(balances).map(([id, value]) => [id, { ...value }]),
			),
		onEnemyAoe: (inDomain: boolean) => {
			if (!inDomain)
				for (const id of Object.keys(balances)) gain(id, 10, "敌方群攻·受击");
		},
		onAttack: () => {
			if (robin) gain(robin.id, 2, "知更鸟天赋·攻击回能");
		},
		onSkill: (character: CharacterConfig, skill: string, notes: string[]) => {
			const cid = getCharacterCid(character.name);
			const state = balances[character.id];
			if (!cid || !state || !["A", "E", "Q"].includes(skill)) return;
			if (skill === "Q") {
				if (state.current + 1e-7 < state.maximum)
					notes.push(
						`${character.name}能量不足（${state.current.toFixed(3)}/${state.maximum}），本次终结技为假设施放`,
					);
				state.current = Math.max(0, state.current - state.maximum);
				events.push({
					targetId: character.id,
					source: "终结技消耗",
					base: -state.maximum,
					fixed: true,
					amount: -state.maximum,
				});
			}
			const prefix =
				cid === "1306" && config.gear[character.id]?.enhanced ? "11306" : cid;
			const suffix = skill === "A" ? "01" : skill === "E" ? "02" : "03";
			gain(
				character.id,
				raw[cid]?.skills[`${prefix}${suffix}`]?.energyGain ?? 0,
				`${character.name}${skill}基础回能`,
			);
			if (cid === "1306" && skill === "A")
				gain(character.id, 10, "花火·岁时记");
			if (cid === "1309" && skill === "E")
				gain(character.id, 5, "知更鸟·模进乐段");
		},
	};
}
