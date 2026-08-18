import { describe, expect, it } from "vitest";
import {
	getAllCids,
	validateCharacterSchema,
} from "../../../src/data/characterSchema";
import { getCharacterCatalog } from "../../../src/data/characters";

describe("角色数据 schema", () => {
	it("启动时校验角色数据并保持 CID 唯一", () => {
		expect(() => validateCharacterSchema()).not.toThrow();
		const catalog = getCharacterCatalog();
		const cids = catalog.map((entry) => entry.cid);
		expect(new Set(cids).size).toBe(cids.length);
		expect(getAllCids().size).toBe(catalog.length);
	});
});
