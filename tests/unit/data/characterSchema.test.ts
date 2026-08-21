import { describe, expect, it } from "vitest";
import {
	characterBasicsData,
	characterData,
	characterMechanicsData,
} from "../../../src/data/characterData";
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

	it("将基础角色目录与技能机制配置分离并按 CID 合并", () => {
		const basicKeys = Object.keys(characterBasicsData.characters[0]).sort();
		expect(basicKeys).toEqual(["baseSpeed", "cid", "names", "path"]);
		expect(characterMechanicsData.characters.length).toBeGreaterThan(0);

		const aglaea = characterData.characters.find(
			(character) => character.cid === "1402",
		);
		expect(aglaea?.baseSpeed).toBe(102);
		expect(aglaea?.effects?.E).toBe("summonGarmentmaker");
	});

	it("为男女开拓者保留成对的角色目录与机制", () => {
		const catalog = getCharacterCatalog();
		const cids = new Set(catalog.map((character) => character.cid));
		for (const cid of [
			"8001",
			"8002",
			"8003",
			"8004",
			"8005",
			"8006",
			"8007",
			"8008",
			"8009",
			"8010",
		]) {
			expect(cids.has(cid as never)).toBe(true);
		}

		const maleMemory = characterData.characters.find(
			(character) => character.cid === "8007",
		);
		const maleElation = characterData.characters.find(
			(character) => character.cid === "8009",
		);
		expect(maleMemory?.effects?.E).toBe("summonMeme");
		expect(maleElation?.effects?.Q).toBe("elationTrailblazerUltimate");
	});
});
