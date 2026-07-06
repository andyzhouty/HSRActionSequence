import {
	canSelectSkillTargetForAction,
	canUseSkillCode,
	type CharacterConfig,
	type GeneratedAction,
	getCharacterCid,
	getCounterWDomainRule,
	getDefaultSkill,
	getFireflyCombustionRule,
	getSkillEffectOwnerNames,
	hasSemanticFlag,
	hasSkillEffect,
	isAllyTarget,
	isCharacterTarget,
	shouldRememberSkillTarget,
	type SkillCode,
} from "../../utils/actionSequence";

export function getCanceledNovaAssistSkill(
	currentSkill: SkillCode | string,
	assistIndex: number,
): SkillCode | null {
	if (!currentSkill.includes("F")) return null;
	const baseSkill = currentSkill.replace(/F/g, "") as SkillCode;
	return (assistIndex >= 2 ? `F${baseSkill}` : baseSkill) as SkillCode;
}

export function getCanceledNovaAssistMessage(assistIndex: number) {
	return assistIndex >= 2
		? "已取消第二个姬子·启行助战技，恢复额外回合"
		: "已取消姬子·启行助战技，恢复原回合";
}

export function updateActionSkillTargetRecord(params: {
	actionKey: string;
	canSelect: boolean;
	record: Record<string, string>;
	targetId: string;
}) {
	const { actionKey, canSelect, record, targetId } = params;
	const next = { ...record };
	if (targetId === "" || !canSelect) delete next[actionKey];
	else next[actionKey] = targetId;
	return next;
}

export function shouldRememberTargetForCharacter(characterName: string) {
	return shouldRememberSkillTarget(characterName);
}

export function canSelectSkillTarget(params: {
	character: CharacterConfig | undefined;
	target: CharacterConfig | undefined;
}) {
	const { character, target } = params;
	return Boolean(
		character && target && canSelectSkillTargetForAction(character, target),
	);
}

export function getSavedSkillCode(
	action: GeneratedAction,
	nextSkill: SkillCode,
): SkillCode {
	return action.isAssistFollowUp
		? ((nextSkill.includes("F")
				? "FF"
				: `F${nextSkill.replace(/F/g, "")}`) as SkillCode)
		: nextSkill;
}

export function validateActionSkillInput(params: {
	action: GeneratedAction;
	character: CharacterConfig;
	characters: CharacterConfig[];
	nextSkill: SkillCode;
}) {
	const { action, character, characters, nextSkill } = params;
	if (action.isCombustionAction) {
		const chars = nextSkill.replace(/F/g, "");
		const combustionRule = getFireflyCombustionRule(character.name);
		const allowed = new Set(combustionRule.allowedSkills);
		if (![...chars].every((skill) => allowed.has(skill))) {
			return `完全燃烧状态下只能填写 ${combustionRule.allowedSkills
				.filter(Boolean)
				.join("、")}`;
		}
	}

	if (action.isDomainFinalAction) return "__IGNORE__";
	const domainRule = getCounterWDomainRule(character.name);
	const allowedDomainSkills = new Set(domainRule.allowedSkills);
	if (action.isAglaeaSupremeAction && nextSkill === "Q") {
		return "Q 不能单独使用，请配合 A/E 使用（如 AQ、EQ）";
	}
	if (action.isPolluxAction) {
		const allowedPolluxSkills = new Set(["", "A", "E", "EA"]);
		if (!allowedPolluxSkills.has(nextSkill)) {
			return "死龙只能填写 A、E 或 EA";
		}
	}
	if (action.isDomainAction && !allowedDomainSkills.has(nextSkill)) {
		return `白厄境界内只能填写 ${domainRule.allowedSkills
			.filter(Boolean)
			.join("、")}`;
	}
	if (
		action.isDomainAction &&
		character.eidolon < 2 &&
		(nextSkill === "EA" || nextSkill === "EW")
	) {
		return "白厄 2 魂解锁 EA（强化普攻）和 EW（强化反击），当前未勾选 2 魂";
	}
	if (
		!action.isDomainAction &&
		!action.isAssistFollowUp &&
		nextSkill.includes("F")
	) {
		const hasHimekoNovaAssist = characters.some((candidate) =>
			hasSkillEffect(candidate.name, "F", "himekoNovaAssist"),
		);
		if (!hasHimekoNovaAssist) {
			const ownerNames =
				getSkillEffectOwnerNames("F", "himekoNovaAssist").join("、") ||
				"对应角色";
			return `队伍中需要有 ${ownerNames} 才能填写 F`;
		}
		if (!isAllyTarget(character.kind)) {
			return "F 只能在我方队友回合填写";
		}
		if (
			hasSkillEffect(character.name, "F", "himekoNovaAssist") &&
			(nextSkill.match(/F/g)?.length ?? 0) >= 2
		) {
			return "sp 姬子自己回合不能使用 FF 连招";
		}
		const novaChar = characters.find((candidate) =>
			hasSkillEffect(candidate.name, "F", "himekoNovaAssist"),
		);
		if (novaChar && novaChar.eidolon < 2) {
			const novaFFCidWhitelist = new Set([
				"1002",
				"1414",
				"1001",
				"1224",
				"1413",
				"1004",
				"8002",
				"8004",
				"8006",
				"8008",
				"8010",
				"1313",
				"1003",
			]);
			const characterCid = getCharacterCid(character.name);
			const isNovaFFWhitelisted =
				characterCid !== undefined && novaFFCidWhitelist.has(characterCid);
			if (
				!isNovaFFWhitelisted &&
				(nextSkill.match(/F/g)?.length ?? 0) >= 2
			) {
				return "当前 sp 姬子未达 2 魂，此角色不可使用 FF 连招";
			}
		}
	}
	if (
		!action.isPolluxAction &&
		!action.isDomainAction &&
		!canUseSkillCode(character, nextSkill)
	) {
		if (nextSkill.includes("A") && nextSkill.includes("E")) {
			return "A（普攻）和 E（战技）不能组合";
		}
		if (
			nextSkill.includes("W") &&
			hasSkillEffect(character.name, "W", "counterW") &&
			hasSemanticFlag(character.name, "wOnlyInDomain")
		) {
			return "W 只能在境界内填写";
		}
		if (
			nextSkill.includes("W") &&
			!hasSkillEffect(character.name, "W", "counterW")
		) {
			const ownerNames =
				getSkillEffectOwnerNames("W", "counterW").join("、") || "对应角色";
			return `只有 ${ownerNames} 可以填写 W`;
		}
		if (!isCharacterTarget(character)) {
			return "只有角色可以填写技能";
		}
	}

	return null;
}

export function updateSkillOverrideRecord(params: {
	action: GeneratedAction;
	character: CharacterConfig;
	nextSkill: SkillCode;
	record: Record<string, SkillCode>;
	savedSkill: SkillCode;
}) {
	const { action, character, nextSkill, record, savedSkill } = params;
	const next = { ...record };
	const defaultSkill = action.isDomainAction
		? ""
		: getDefaultSkill(character, action.actionNo);
	if (!action.isAssistFollowUp && nextSkill === defaultSkill) {
		delete next[action.key];
	} else {
		next[action.key] = savedSkill;
	}
	return next;
}

export function removeActionBooleanOverride(
	record: Record<string, boolean>,
	actionKey: string,
) {
	const next = { ...record };
	delete next[actionKey];
	return next;
}

export function clearActionSkillTarget(
	record: Record<string, string>,
	actionKey: string,
) {
	const next = { ...record };
	delete next[actionKey];
	return next;
}
