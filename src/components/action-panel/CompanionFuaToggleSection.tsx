import { useActionSequence } from "../../contexts/ActionSequenceContext";
import { hasArcher } from "../../mechanics/archer";
import { hasAshveil, hasKafka } from "../../mechanics/companionFollowUp";
import {
	isBasicAttackSkill,
	isNonAttackSkill,
} from "../../utils/action-sequence";

/** 不死途与卡芙卡的默认追加攻击可在触发来源的右键菜单中取消。 */
export function CompanionFuaToggleSection() {
	const ctx = useActionSequence();
	const key = [...ctx.selectedActionKeys][0];
	if (!key) return null;
	const action = ctx.actions.find((candidate) => candidate.key === key);
	const attacker = action && ctx.charactersById[action.characterId];
	const isArcherFixedAttack =
		hasArcher(attacker) && ["A", "E", "Q"].includes(action?.skill ?? "");
	const isForcedAttack =
		isBasicAttackSkill(action?.skill ?? "") ||
		action?.isAssistAction === true ||
		action?.isGilgameshTechniqueAction === true ||
		isArcherFixedAttack;
	if (
		!action ||
		!attacker ||
		attacker.kind !== "角色" ||
		action.isFuaAction ||
		action.isDomainAction ||
		(!isForcedAttack && ctx.attackDisabled[key] === true) ||
		(!isForcedAttack && isNonAttackSkill(attacker, action.skill))
	)
		return null;
	const ashveil = ctx.characters.find(hasAshveil);
	const kafka = ctx.characters.find(hasKafka);
	const canToggleAshveil =
		ashveil !== undefined && ashveil.id !== action.characterId;
	const canToggleKafka = kafka !== undefined && kafka.id !== action.characterId;
	if (!canToggleAshveil && !canToggleKafka) return null;
	return (
		<div className="flex flex-wrap items-center gap-3 border-t border-gray-700 pt-3">
			{canToggleAshveil && (
				<CancelButton
					label="不死途追击"
					cancelled={ctx.ashveilFuaToggles[key] === false}
					onToggle={() =>
						ctx.setAshveilFuaToggles((previous) => {
							const next = { ...previous };
							if (next[key] === false) delete next[key];
							else next[key] = false;
							return next;
						})
					}
				/>
			)}
			{canToggleKafka && (
				<CancelButton
					label="卡芙卡追击"
					cancelled={ctx.kafkaFuaToggles[key] === false}
					onToggle={() =>
						ctx.setKafkaFuaToggles((previous) => {
							const next = { ...previous };
							if (next[key] === false) delete next[key];
							else next[key] = false;
							return next;
						})
					}
				/>
			)}
		</div>
	);
}

function CancelButton({
	label,
	cancelled,
	onToggle,
}: {
	label: string;
	cancelled: boolean;
	onToggle: () => void;
}) {
	return (
		<button
			type="button"
			onClick={onToggle}
			className={`rounded-md px-3 py-1 text-xs font-medium ${cancelled ? "bg-gray-700 text-gray-400 hover:bg-gray-600" : "bg-purple-800 text-purple-100"}`}
		>
			{cancelled ? `恢复${label}` : `取消${label}`}
		</button>
	);
}
