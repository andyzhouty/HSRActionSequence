import { useActionSequence } from "../../contexts/ActionSequenceContext";
import { hasSilverWolfGodmode } from "../../mechanics/silverWolfGodmode";
import type { GeneratedAction } from "../../utils/actionSequence";
import {
	getCharacterCid,
	hasSkillEffect,
	isBasicAttackSkill,
	isNonAttackSkill,
} from "../../utils/actionSequence";

export function AttackInline({ action }: { action: GeneratedAction }) {
	const ctx = useActionSequence();
	const attacker = ctx.charactersById[action.characterId];
	const hasSouldragonOwner = ctx.characters.some(
		(character) => getCharacterCid(character.name) === "1414",
	);
	const hasArcherOwner = ctx.characters.some((character) =>
		hasSkillEffect(character.name, "Q", "archerUltimate"),
	);
	if (action.isSouldragonAction) {
		const isEnabled = ctx.attackDisabled[action.key] !== true;
		return (
			<button
				type="button"
				aria-pressed={isEnabled}
				onClick={(event) => {
					event.stopPropagation();
					ctx.setAttackDisabled((prev) => {
						const next = { ...prev };
						if (isEnabled) next[action.key] = true;
						else delete next[action.key];
						return next;
					});
				}}
				className={`h-10 shrink-0 rounded-lg border px-2 text-xs font-medium ${
					isEnabled
						? "border-red-500/60 bg-red-900/50 text-red-100 hover:bg-red-800/60"
						: "border-gray-600 bg-gray-800 text-gray-500"
				}`}
			>
				攻击
			</button>
		);
	}
	if (
		(!hasSouldragonOwner && !hasArcherOwner) ||
		!attacker ||
		attacker.kind !== "角色"
	) {
		return null;
	}
	if (
		action.isElationSkill ||
		action.isArcherFua ||
		action.isAssistAction ||
		action.isGilgameshTechniqueAction
	)
		return null;
	if (
		hasSkillEffect(attacker.name, "Q", "archerUltimate") &&
		["A", "E", "Q"].includes(action.skill)
	)
		return null;
	if (isBasicAttackSkill(action.skill)) return null;
	if (
		hasSilverWolfGodmode(attacker.name) &&
		(action.skill === "E" || action.skill === "Q")
	)
		return null;
	if (isNonAttackSkill(attacker, action.skill)) return null;
	const isEnabled = ctx.attackDisabled[action.key] !== true;

	return (
		<button
			type="button"
			aria-pressed={isEnabled}
			onClick={(event) => {
				event.stopPropagation();
				ctx.setAttackDisabled((prev) => {
					const next = { ...prev };
					if (isEnabled) next[action.key] = true;
					else delete next[action.key];
					return next;
				});
			}}
			className={`h-10 shrink-0 rounded-lg border px-2 text-xs font-medium ${
				isEnabled
					? "border-red-500/60 bg-red-900/50 text-red-100 hover:bg-red-800/60"
					: "border-gray-600 bg-gray-800 text-gray-500"
			}`}
		>
			攻击
		</button>
	);
}
