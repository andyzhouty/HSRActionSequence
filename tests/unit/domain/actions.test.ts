import { describe, expect, it } from "vitest";
import {
	toActionViewModel,
	toPersistedAction,
} from "../../../src/domain/actions";

describe("行动边界模型", () => {
	it("从最小行动意图生成展示模型和持久化模型", () => {
		const intent = {
			key: "c1-1",
			characterId: "c1",
			actionNo: 1,
			actionValue: 100,
			skill: "E",
			speed: 100,
		};
		expect(
			toActionViewModel({
				...intent,
				displayName: "角色一",
				targetKind: "角色",
			}),
		).toMatchObject({ displayName: "角色一", tags: ["角色"] });
		expect(toPersistedAction(intent)).toEqual({
			key: "c1-1",
			characterId: "c1",
			actionNo: 1,
			skill: "E",
		});
	});
});
