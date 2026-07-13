import { useActionSequence } from "../../contexts/ActionSequenceContext";
import { hasHyacineIca } from "../../mechanics/hyacineIca";

export function HyacineE2Section() {
	const ctx = useActionSequence();
	if (!ctx.characters.some((character) => hasHyacineIca(character.name)))
		return null;
	const isEnabled = ctx.hyacineE2Active;
	return (
		<div className="flex flex-wrap items-center gap-3 border-t border-gray-700 pt-3">
			<span className="whitespace-nowrap text-sm text-gray-300">
				风堇 E2 全队加速：
			</span>
			<button
				type="button"
				onClick={() => ctx.setHyacineE2Active(!isEnabled)}
				className={`inline-flex items-center gap-1.5 rounded-md border px-3 py-1.5 text-xs font-medium transition-colors ${isEnabled ? "border-emerald-500/70 bg-emerald-500/20 text-emerald-200 hover:bg-emerald-500/30" : "border-gray-600 bg-gray-700 text-gray-300 hover:bg-gray-600"}`}
			>
				{isEnabled ? "已开启" : "已关闭"}
			</button>
			{isEnabled && (
				<span className="text-xs text-gray-400">
					全队 speed += baseSpeed × 30%
				</span>
			)}
		</div>
	);
}
