import { useActionSequence } from "../../contexts/ActionSequenceContext";
import { getCharacterCid } from "../../utils/actionSequence";

/** Evanescia（绯英）专属的 Z 追击插入开关，不代表所有追击机制。 */
export function EvanesciaFuaToggleSection() {
	const ctx = useActionSequence();
	if (
		!ctx.characters.some(
			(character) => getCharacterCid(character.name) === "1505",
		)
	)
		return null;
	const firstKey = [...ctx.selectedActionKeys][0];
	if (!firstKey) return null;
	const action = ctx.actions.find((candidate) => candidate.key === firstKey);
	if (
		!action ||
		action.isFuaAction ||
		action.isElationSkill ||
		action.isDomainAction ||
		action.isSouldragonAction ||
		action.isPolluxAction ||
		action.isEveyAction ||
		action.isAglaeaGarmentmakerAction ||
		action.isAssistAction ||
		action.isOdeExtraAction
	)
		return null;
	const isEnabled = ctx.fuaToggles[firstKey] === true;
	return (
		<div className="flex flex-wrap items-center gap-3 border-t border-gray-700 pt-3">
			<span className="whitespace-nowrap text-sm text-gray-300">
				绯英追击：
			</span>
			<button
				type="button"
				onClick={() =>
					ctx.setFuaToggles((previous) => {
						const next = { ...previous };
						if (isEnabled) delete next[firstKey];
						else next[firstKey] = true;
						return next;
					})
				}
				className={`rounded-md px-3 py-1 text-xs font-medium ${isEnabled ? "bg-fuchsia-700 text-fuchsia-100" : "bg-gray-700 text-gray-400 hover:bg-gray-600"}`}
			>
				{isEnabled ? "已插入追击（Z）" : "插入追击（Z）"}
			</button>
		</div>
	);
}
