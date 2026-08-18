import { describe, expect, it } from "vitest";
import {
	parseSavedDataJson,
	SavedDataValidationError,
	validateSavedDataInput,
} from "../../../src/domain/saved-data";
import { migrateSavedData } from "../../../src/utils/savedDataMigration";

const character = {
	id: "c1",
	kind: "角色",
	name: "测试角色",
	speed: "100",
	baseSpeed: "100",
};

describe("保存数据输入边界", () => {
	it("允许旧版本缺少 schemaVersion", () => {
		const parsed = parseSavedDataJson(
			JSON.stringify({ characters: [character] }),
		);
		expect(parsed.characters).toHaveLength(1);
	});

	it("拒绝错误的根结构和角色字段", () => {
		expect(() => validateSavedDataInput([])).toThrow(SavedDataValidationError);
		expect(() =>
			validateSavedDataInput({ characters: [{ ...character, id: 1 }] }),
		).toThrow("characters[0].id 必须是字符串");
	});

	it("拒绝未来版本，防止未知字段静默进入模拟器", () => {
		const parsed = parseSavedDataJson(
			JSON.stringify({ schemaVersion: 999, characters: [character] }),
		);
		expect(() => migrateSavedData(parsed)).toThrow("高于当前版本");
	});

	it("拒绝未知技能并保证迁移幂等", () => {
		expect(() =>
			validateSavedDataInput({
				characters: [character],
				skillOverrides: { "c1-1": "INVALID" },
			}),
		).toThrow("不是合法技能标识");

		const oldData = { schemaVersion: 0, characters: [character] };
		const migrated = migrateSavedData(oldData);
		expect(migrateSavedData(migrated)).toEqual(migrated);
	});
});
