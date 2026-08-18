import { getSummerSongbirdsRule } from "../../mechanics/spRobin";
import type {
	CharacterConfig,
	GeneratedAction,
} from "../../utils/action-sequence";
import {
	getCyreneUltimateRule,
	getEveyRule,
	getGarmentmakerRule,
	getMemeAdvanceRule,
	getPolluxRule,
	getTargetDefaultName,
	hasSkillEffect,
	toPositiveNumber,
} from "../../utils/action-sequence";

/** 根据队伍配置生成可供 UI 选择的忆灵目标。 */
export function buildMemospriteTargets(
	characters: CharacterConfig[],
): CharacterConfig[] {
	return characters.flatMap((character) => {
		const memos: CharacterConfig[] = [];
		if (hasSkillEffect(character.name, "E", "summonGarmentmaker")) {
			const rule = getGarmentmakerRule(character.name);
			memos.push({
				...character,
				id: `${character.id}-garmentmaker`,
				kind: "忆灵",
				name: rule.memospriteName,
				speed: String(rule.memospriteSpeed),
				baseSpeed: String(rule.memospriteSpeed),
				hasVonwacq: false,
				hasWindSet: false,
				hasDance: false,
				eidolon: 0,
				superimpose: 1,
				lc_id: 0,
			});
		}
		if (hasSkillEffect(character.name, "E", "summonMeme")) {
			const rule = getMemeAdvanceRule(character.name);
			memos.push({
				...character,
				id: `${character.id}-meme`,
				kind: "忆灵",
				name: rule.memospriteName,
				speed: String(rule.memospriteSpeed),
				baseSpeed: String(rule.memospriteSpeed),
				hasVonwacq: false,
				hasWindSet: false,
				hasDance: false,
				eidolon: 0,
				superimpose: 1,
				lc_id: 0,
			});
		}
		if (hasSkillEffect(character.name, "Q", "cyreneUltimate")) {
			const rule = getCyreneUltimateRule(character.name);
			memos.push({
				...character,
				id: `${character.id}-memosprite`,
				kind: "忆灵",
				name: rule.memospriteName,
				speed: "0",
				baseSpeed: "0",
				hasVonwacq: false,
				hasWindSet: false,
				hasDance: false,
				eidolon: 0,
				superimpose: 1,
				lc_id: 0,
			});
		}
		if (hasSkillEffect(character.name, "Q", "summonPollux")) {
			const rule = getPolluxRule(character.name);
			memos.push({
				...character,
				id: `${character.id}-pollux`,
				kind: "忆灵",
				name: rule.memospriteName,
				speed: String(rule.memospriteSpeed),
				baseSpeed: String(rule.memospriteSpeed),
				hasVonwacq: false,
				hasWindSet: false,
				hasDance: false,
				eidolon: 0,
				superimpose: 1,
				lc_id: 0,
			});
		}
		if (hasSkillEffect(character.name, "E", "summonEvey")) {
			const rule = getEveyRule(character.name);
			memos.push({
				...character,
				id: `${character.id}-evey`,
				kind: "忆灵",
				name: rule.memospriteName,
				speed: String(rule.memospriteSpeed),
				baseSpeed: String(rule.memospriteSpeed),
				hasVonwacq: false,
				hasWindSet: false,
				eidolon: 0,
				superimpose: 1,
				lc_id: 0,
			});
		}
		if (hasSkillEffect(character.name, "E", "summonSummerSongbirds")) {
			const rule = getSummerSongbirdsRule(character.name);
			const panelSpeed = toPositiveNumber(character.speed, 95);
			const songbirdsSpeed = panelSpeed * rule.memospriteSpeedRatio;
			memos.push({
				...character,
				id: `${character.id}-songbirds`,
				kind: "忆灵",
				name: rule.memospriteName,
				speed: String(songbirdsSpeed),
				baseSpeed: String(songbirdsSpeed),
				hasVonwacq: false,
				hasWindSet: false,
				hasDance: false,
				eidolon: 0,
				superimpose: 1,
				lc_id: 0,
			});
		}
		if (hasSkillEffect(character.name, "E", "summonIca")) {
			memos.push({
				...character,
				id: `${character.id}-ica`,
				kind: "忆灵",
				name: "小伊卡",
				speed: "0",
				baseSpeed: "0",
				hasVonwacq: false,
				hasWindSet: false,
				eidolon: 0,
				superimpose: 1,
				lc_id: 0,
			});
		}
		return memos;
	});
}

/** 为页面提供稳定的查询结果；不会修改保存数据或模拟结果。 */
export function buildCharacterSelectors(
	characters: CharacterConfig[],
	memospriteTargets: CharacterConfig[],
	actions: GeneratedAction[],
) {
	const characterNames: Record<string, string> = Object.fromEntries(
		characters.map((character, index) => [
			character.id,
			character.name.trim() || getTargetDefaultName(character.kind, index),
		]),
	);
	for (const action of actions) {
		if (action.displayName)
			characterNames[action.characterId] = action.displayName;
	}

	const characterKinds: Record<string, CharacterConfig["kind"]> =
		Object.fromEntries([
			...characters.map((character) => [character.id, character.kind] as const),
			...memospriteTargets.map(
				(memosprite) => [memosprite.id, memosprite.kind] as const,
			),
		]);
	for (const action of actions) {
		if (action.targetKind)
			characterKinds[action.characterId] = action.targetKind;
	}

	const charactersById: Record<string, CharacterConfig> = Object.fromEntries([
		...characters.map((character) => [character.id, character] as const),
		...memospriteTargets.map(
			(memosprite) => [memosprite.id, memosprite] as const,
		),
	]);

	return { characterNames, characterKinds, charactersById };
}
