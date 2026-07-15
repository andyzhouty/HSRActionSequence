import { useActionSequence } from "../../contexts/ActionSequenceContext";
import {
	getSpBladeExtraTurnThreshold,
	hasSpBlade,
} from "../../mechanics/spBlade";

export function SpBladeExtraTurnSection() {
	const ctx = useActionSequence();
	const key = [...ctx.selectedActionKeys][0];
	if (!key) return null;
	const action = ctx.actions.find((candidate) => candidate.key === key);
	const blade = ctx.characters.find(hasSpBlade);
	if (
		!action ||
		!blade ||
		action.isSpBladeExtraAction ||
		action.isSpBladeCountdownAction ||
		!action.spBladeInfiniteFury ||
		(action.spBladeStacks ?? 0) < getSpBladeExtraTurnThreshold(blade.eidolon)
	)
		return null;
	const cancelled = ctx.spBladeExtraTurnToggles[key] === false;
	return (
		<div className="border-t border-gray-700 pt-3">
			<button
				type="button"
				onClick={() =>
					ctx.setSpBladeExtraTurnToggles((previous) => {
						const next = { ...previous };
						if (next[key] === false) delete next[key];
						else next[key] = false;
						return next;
					})
				}
				className="rounded-md bg-red-800 px-3 py-1 text-xs font-medium text-red-100"
			>
				{cancelled ? "恢复sp刃额外回合" : "取消sp刃额外回合"}
			</button>
		</div>
	);
}
