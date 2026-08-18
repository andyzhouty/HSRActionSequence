import { getCharacterCid } from "../data/characters";
import { CHARACTER_IDS } from "../domain/identity";
import type { CharacterConfig } from "../utils/action-sequence";

/** Saber（阿尔托莉雅）的角色判定。 */
export function hasSaber(character: CharacterConfig | undefined): boolean {
	return getCharacterCid(character?.name ?? "") === CHARACTER_IDS.saber;
}

/** 将 Saber 的下一正常行动置于指定行动后，不受常规拉条屏蔽影响。 */
export function advanceSaberAfterAction(
	states: Array<{ character: CharacterConfig; nextActionValue: number }>,
	saberAdvanceToggles: Record<string, boolean> | undefined,
	actionKey: string,
	actionValue: number,
): void {
	if (!saberAdvanceToggles?.[actionKey]) return;
	const saber = states.find((state) => hasSaber(state.character));
	if (saber) saber.nextActionValue = actionValue;
}
