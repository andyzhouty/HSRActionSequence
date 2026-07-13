import { useActionSequence } from "../../contexts/ActionSequenceContext";
import { getDisplayOrderedActions } from "../../utils/actionDisplayOrder";
import type {
	CharacterConfig,
	GeneratedAction,
} from "../../utils/actionSequence";
import {
	canSelectAllyForSkill,
	canSelectSkillTargetForAction,
	getCharacterCid,
	getCyreneUltimateRule,
	getFireflyCombustionRule,
	getOdeRuleForTarget,
	getTargetDefaultName,
	hasSkillEffect,
	isAllyTarget,
	isCharacterTarget,
	shouldRememberSkillTarget,
	toPositiveNumber,
} from "../../utils/actionSequence";
import { SelectInput } from "../Controls";

function getMemeTargetOptions(ctx: ReturnType<typeof useActionSequence>) {
	return [...ctx.characters, ...ctx.memospriteTargets]
		.filter(
			(character, index, targets) =>
				targets.findIndex((candidate) => candidate.id === character.id) ===
					index &&
				(character.kind === "角色" || character.kind === "忆灵") &&
				toPositiveNumber(character.speed, 0) > 0,
		)
		.map((character) => ({
			value: character.id,
			label: character.name.trim() || character.id,
		}));
}

/** 判断战内召唤的忆灵在当前行动前是否已出场。 */
function isMemospriteAvailableForAction(
	ctx: ReturnType<typeof useActionSequence>,
	memosprite: CharacterConfig,
	currentActionKey: string,
): boolean {
	const orderedActions = getDisplayOrderedActions(ctx.actions);
	const suffix = ["-garmentmaker", "-meme", "-memosprite", "-evey"].find(
		(candidate) => memosprite.id.endsWith(candidate),
	);
	if (!suffix) return true;
	const ownerId = memosprite.id.slice(0, -suffix.length);
	const selectedIndex = orderedActions.findIndex(
		(action) => action.key === currentActionKey,
	);
	if (selectedIndex <= 0) return suffix === "-evey";

	if (suffix === "-evey") {
		let onField = true;
		for (const action of orderedActions.slice(0, selectedIndex)) {
			if (
				action.characterId === ownerId &&
				!action.isDomainAction &&
				!action.isMemospriteAction
			) {
				const skill = ctx.skillOverrides[action.key] ?? action.skill;
				if (!onField && (skill.includes("E") || skill.includes("Q")))
					onField = true;
			}
			if (action.characterId === `${ownerId}-evey`) {
				const skill = ctx.skillOverrides[action.key] ?? action.skill;
				if ((skill || "A") === "E") onField = false;
			}
		}
		return onField;
	}

	return orderedActions.slice(0, selectedIndex).some((action) => {
		if (
			action.characterId !== ownerId ||
			action.isDomainAction ||
			action.isMemospriteAction
		) {
			return false;
		}
		const skill = ctx.skillOverrides[action.key] ?? action.skill;
		return skill.includes("E") || skill.includes("Q");
	});
}

export function OdeInline({ action }: { action: GeneratedAction }) {
	const ctx = useActionSequence();
	if (
		action.isMemeAction ||
		action.isEpicTriggeredMemosprite ||
		action.isCyreneEnhancedQ ||
		!action.isMemospriteAction ||
		!action.memospriteOwnerId
	)
		return null;
	const owner = ctx.charactersById[action.memospriteOwnerId];
	if (!owner || !hasSkillEffect(owner.name, "Q", "cyreneUltimate")) return null;
	const rule = getCyreneUltimateRule(owner.name);
	const selection = ctx.odeSelections[action.key];
	const targetOptions = ctx.characters
		.filter(
			(character) =>
				isAllyTarget(character.kind) &&
				character.id !== owner.id &&
				toPositiveNumber(character.speed, 0) > 0,
		)
		.map((character) => {
			const ode = getOdeRuleForTarget(rule, character.name);
			return {
				value: character.id,
				label:
					character.name.trim() ||
					getTargetDefaultName(
						character.kind,
						ctx.characters.indexOf(character),
					),
				title: ode.fullName,
			};
		});
	const value = targetOptions.some(
		(option) => option.value === selection?.targetId,
	)
		? (selection?.targetId ?? "")
		: "";
	return (
		<SelectInput
			value={value}
			options={[{ value: "", label: "攻击" }, ...targetOptions]}
			onChange={(targetId) => {
				ctx.setOdeSelections((previous) => {
					const next = { ...previous };
					if (!targetId) {
						delete next[action.key];
						return next;
					}
					const target = ctx.characters.find(
						(character) => character.id === targetId,
					);
					next[action.key] = {
						odeCode: target
							? getOdeRuleForTarget(rule, target.name).code
							: rule.genericOde.code,
						targetId,
					};
					return next;
				});
			}}
			className="w-28"
		/>
	);
}

export function CombustionBreakInline({ action }: { action: GeneratedAction }) {
	const ctx = useActionSequence();
	if (!action.isCombustionAction) return null;
	const rule = getFireflyCombustionRule(
		ctx.charactersById[action.characterId]?.name ?? "",
	);
	const isEnabled = ctx.fireflyBreakCounters[action.key] === true;
	return (
		<button
			type="button"
			title={
				isEnabled
					? `${rule.breakLabel}触发中（点击关闭）`
					: `${rule.breakLabel}关闭（点击开启）`
			}
			onMouseDown={(event) => event.stopPropagation()}
			onPointerDown={(event) => event.stopPropagation()}
			onClick={(event) => {
				event.stopPropagation();
				ctx.setFireflyBreakCounters((previous) => {
					const next = { ...previous };
					if (isEnabled) delete next[action.key];
					else next[action.key] = true;
					return next;
				});
			}}
			className={`flex h-10 shrink-0 items-center rounded-lg px-2 text-xs font-semibold transition-colors ${isEnabled ? "border border-orange-500/70 bg-orange-500/20 text-orange-200" : "border border-gray-600 bg-gray-700 text-gray-500"}`}
		>
			{rule.breakLabel}
		</button>
	);
}

export function PolluxKillInline({ action }: { action: GeneratedAction }) {
	const ctx = useActionSequence();
	if (!action.isPolluxAction || action.skill !== "E") return null;
	const isEnabled = ctx.castoriceKillToggles[action.key] === true;
	return (
		<button
			type="button"
			title={
				isEnabled
					? "击杀：E 后死龙不消失且速度翻倍（点击关闭）"
					: "击杀关闭（点击开启：E 后不消失且速度翻倍）"
			}
			onMouseDown={(event) => event.stopPropagation()}
			onPointerDown={(event) => event.stopPropagation()}
			onClick={(event) => {
				event.stopPropagation();
				ctx.setCastoriceKillToggles((previous) => {
					const next = { ...previous };
					if (isEnabled) delete next[action.key];
					else next[action.key] = true;
					return next;
				});
			}}
			className={`flex h-10 shrink-0 items-center rounded-lg px-2 text-xs font-semibold transition-colors ${isEnabled ? "border border-red-500/70 bg-red-500/20 text-red-200" : "border border-gray-600 bg-gray-700 text-gray-500"}`}
		>
			击杀
		</button>
	);
}

export function MemeInline({ action }: { action: GeneratedAction }) {
	const ctx = useActionSequence();
	if (!action.isMemeAction && !action.isMemeAdvanceAction) return null;
	const options = getMemeTargetOptions(ctx);
	const selected = ctx.memeSelections[action.key] ?? "";
	const value = options.some((option) => option.value === selected)
		? selected
		: "";
	return (
		<SelectInput
			value={value}
			options={[{ value: "", label: "无目标" }, ...options]}
			onChange={(targetId) => {
				ctx.setMemeSelections((previous) => {
					const next = { ...previous };
					if (targetId) next[action.key] = targetId;
					else delete next[action.key];
					return next;
				});
				if (targetId) ctx.setLastMemeTarget(targetId);
			}}
			className="w-32"
		/>
	);
}

export function SkillTargetInline({ action }: { action: GeneratedAction }) {
	const ctx = useActionSequence();
	const character = ctx.charactersById[action.characterId];
	const isSouldragonOwner =
		character && getCharacterCid(character.name) === "1414";
	const isSelfQInterrupt =
		action.key.endsWith("-q") &&
		action.actionNo === 0 &&
		!action.isDomainAction &&
		!action.isMemospriteAction &&
		!action.isAssistAction;
	const parentKey = isSelfQInterrupt ? action.key.slice(0, -2) : action.key;
	const targetId =
		ctx.skillTargets[action.key] ??
		(isSelfQInterrupt ? ctx.skillTargets[parentKey] : undefined) ??
		(isSouldragonOwner ? ctx.bondmateTarget : undefined) ??
		(character && shouldRememberSkillTarget(character.name)
			? ctx.defaultSkillTargets[action.characterId]
			: undefined);
	const override = ctx.skillOverrides[action.key];
	const rawSkill =
		action.isDomainFinalAction || action.isCombustionAction
			? action.skill
			: (override ?? action.skill);
	const skill =
		!action.isDomainAction &&
		!action.isAssistFollowUp &&
		override &&
		/^(?:[AE]Q|Q[AE])$/.test(override)
			? override.replace(/Q/g, "") || ""
			: isSelfQInterrupt
				? "Q"
				: rawSkill;
	const isTargetable = Boolean(
		character &&
			isCharacterTarget(character) &&
			canSelectAllyForSkill(character, skill),
	);
	if (!isTargetable || !character) return null;
	const allies = [
		...ctx.characters,
		...ctx.memospriteTargets.filter((memosprite) =>
			isMemospriteAvailableForAction(ctx, memosprite, action.key),
		),
	].filter(
		(target, index, targets) =>
			targets.findIndex((candidate) => candidate.id === target.id) === index &&
			(canSelectSkillTargetForAction(character, target) ||
				(isSouldragonOwner && target.id === character.id)) &&
			toPositiveNumber(target.speed, 0) > 0,
	);
	const value = allies.some((ally) => ally.id === targetId)
		? (targetId ?? "")
		: "";
	return (
		<SelectInput
			value={value}
			options={[
				{ value: "", label: "无目标" },
				...allies.map((ally) => ({
					value: ally.id,
					label:
						ally.name.trim() ||
						getTargetDefaultName(ally.kind, ctx.characters.indexOf(ally)),
				})),
			]}
			onChange={(targetId) => ctx.updateSkillTarget(action, targetId)}
			className="flex-1 min-w-0"
		/>
	);
}
