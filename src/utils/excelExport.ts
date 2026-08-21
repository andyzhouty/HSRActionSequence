import lightConeData from "../data/lightcones.json";
import type { CharacterConfig, GeneratedAction } from "./action-sequence";

const lightConeNames = new Map(
	lightConeData.lightcones.map((lightCone) => [lightCone.id, lightCone.name]),
);

export type ExportNameMap = Record<string, string>;

export const CHARACTER_EXPORT_HEADERS = [
	"角色",
	"速度",
	"基础速度",
	"光锥",
	"翁瓦克",
	"风套",
] as const;

/** 汇总角色、忆灵目标和行动展示名，供 Excel 导出统一使用。 */
export function buildExportNameMap(
	characters: Pick<CharacterConfig, "id" | "name">[],
	memospriteTargets: Pick<CharacterConfig, "id" | "name">[],
	actions: Pick<GeneratedAction, "characterId" | "displayName">[],
): ExportNameMap {
	const names: ExportNameMap = {};
	for (const target of [...characters, ...memospriteTargets]) {
		if (target.name.trim()) names[target.id] = target.name.trim();
	}
	for (const action of actions) {
		if (action.displayName?.trim()) {
			names[action.characterId] = action.displayName.trim();
		}
	}
	return names;
}

/** 将内部目标标识转换为可读名称，未知对象不暴露内部 ID。 */
export function getExportDisplayName(
	names: ExportNameMap,
	id: string | undefined,
	fallback: string,
): string {
	if (!id) return "";
	return names[id] ?? fallback;
}

/** 将光锥 ID 转换为网页中使用的光锥名称。 */
export function getLightConeDisplayName(id: number): string {
	if (id === 0) return "无光锥";
	return lightConeNames.get(id) ?? "未知光锥";
}
