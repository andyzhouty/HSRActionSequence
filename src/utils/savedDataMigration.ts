/**
 * SavedData 迁移链
 *
 * 当 SavedData 结构变更时，在此文件按版本顺序编写迁移函数。
 * 旧版 JSON 导入时会自动应用迁移链到最新版本。
 */

import type { SavedData } from "./actionSequence";
import { CURRENT_SAVEDATA_VERSION } from "./actionSequence";

type SavedDataMigration = (data: SavedData) => SavedData;

/**
 * 版本 0 → 1: 初始版本，无变更。
 * 未来版本迁移函数按顺序追加到此数组中。
 */
const migrations: SavedDataMigration[] = [
	// 示例：v1 → v2 时在此添加迁移函数
	// (data: SavedData) => {
	//   // 将 oldField 重命名为 newField
	//   return { ...data, newField: (data as any).oldField };
	// },
];

/**
 * 将任意版本的 SavedData 迁移到最新版本。
 */
export function migrateSavedData(parsed: Partial<SavedData>): Partial<SavedData> {
	let data = parsed;
	const startVersion = data.schemaVersion ?? 0;

	if (startVersion > CURRENT_SAVEDATA_VERSION) {
		console.warn(
			`SavedData version ${startVersion} is newer than current ${CURRENT_SAVEDATA_VERSION}. ` +
			"Some fields may not be recognized.",
		);
		return data;
	}

	for (let v = startVersion; v < CURRENT_SAVEDATA_VERSION; v++) {
		const migration = migrations[v];
		if (migration) {
			data = migration({ schemaVersion: v, ...data } as SavedData);
		}
	}

	data.schemaVersion = CURRENT_SAVEDATA_VERSION;
	return data;
}
