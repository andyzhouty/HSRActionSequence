import { readFile } from "node:fs/promises";
import process from "node:process";

const characterFile = new URL("../src/data/characters.json", import.meta.url);
const mechanicsFile = new URL(
	"../src/data/characterMechanics.json",
	import.meta.url,
);
const characterData = JSON.parse(await readFile(characterFile, "utf8"));
const mechanicsData = JSON.parse(await readFile(mechanicsFile, "utf8"));
const validPaths = new Set([
	"Harmony",
	"Destruction",
	"Hunt",
	"Erudition",
	"Nihility",
	"Preservation",
	"Abundance",
	"Remembrance",
	"Elation",
]);
const errors = [];
const characters = characterData?.characters;
const mechanicEntries = mechanicsData?.characters;
const basicKeys = new Set(["cid", "names", "path", "baseSpeed"]);
const mechanicKeys = new Set([
	"cid",
	"effects",
	"effectRules",
	"passives",
	"semantics",
	"participantId",
]);
const cids = new Set();
const names = new Map();

if (!Array.isArray(characters)) {
	errors.push("characters.json 缺少 characters 数组");
}

if (!Array.isArray(mechanicEntries)) {
	errors.push("characterMechanics.json 缺少 characters 数组");
}

if (Array.isArray(characters)) {
	for (const [index, character] of characters.entries()) {
		const prefix = `characters[${index}]`;
		if (!character || typeof character !== "object") {
			errors.push(`${prefix} 必须是对象`);
			continue;
		}
		for (const key of Object.keys(character)) {
			if (!basicKeys.has(key)) {
				errors.push(`${prefix} 不应包含技能或机制字段：${key}`);
			}
		}
		if (typeof character.cid !== "string" || !/^\d+$/.test(character.cid)) {
			errors.push(`${prefix}.cid 必须是数字字符串`);
		} else if (cids.has(character.cid)) {
			errors.push(`${prefix}.cid 重复：${character.cid}`);
		} else {
			cids.add(character.cid);
		}
		if (
			!Array.isArray(character.names) ||
			character.names.length === 0 ||
			character.names.some((name) => typeof name !== "string" || !name.trim())
		) {
			errors.push(`${prefix}.names 必须是非空字符串数组`);
		} else {
			for (const name of character.names) {
				const normalized = name
					.trim()
					.replace(/\s+/g, "")
					.toLocaleLowerCase();
				const previous = names.get(normalized);
				if (previous && previous !== character.cid) {
					errors.push(
						`${prefix}.names 中的“${name}”与 CID ${previous} 重复`,
					);
				} else {
					names.set(normalized, character.cid);
				}
			}
		}
		if (
			typeof character.baseSpeed !== "number" ||
			!Number.isFinite(character.baseSpeed) ||
			character.baseSpeed <= 0
		) {
			errors.push(`${prefix}.baseSpeed 必须是正数`);
		}
		if (character.path !== undefined && !validPaths.has(character.path)) {
			errors.push(`${prefix}.path 无效：${String(character.path)}`);
		}
	}
}

if (Array.isArray(mechanicEntries)) {
	const mechanicCids = new Set();
	for (const [index, character] of mechanicEntries.entries()) {
		const prefix = `characterMechanics.json.characters[${index}]`;
		if (!character || typeof character !== "object") {
			errors.push(`${prefix} 必须是对象`);
			continue;
		}
		for (const key of Object.keys(character)) {
			if (!mechanicKeys.has(key)) {
				errors.push(`${prefix} 包含未知字段：${key}`);
			}
		}
		if (typeof character.cid !== "string" || !/^\d+$/.test(character.cid)) {
			errors.push(`${prefix}.cid 必须是数字字符串`);
		} else if (mechanicCids.has(character.cid)) {
			errors.push(`${prefix}.cid 重复：${character.cid}`);
		} else {
			mechanicCids.add(character.cid);
			if (!cids.has(character.cid)) {
				errors.push(
					`${prefix}.cid ${character.cid} 不存在于 characters.json`,
				);
			}
		}
		const effects = character.effects ?? {};
		const effectRules = character.effectRules ?? {};
		if (!effects || typeof effects !== "object" || Array.isArray(effects)) {
			errors.push(`${prefix}.effects 必须是对象`);
		}
		if (
			!effectRules ||
			typeof effectRules !== "object" ||
			Array.isArray(effectRules)
		) {
			errors.push(`${prefix}.effectRules 必须是对象`);
		} else {
			for (const effect of Object.keys(effectRules)) {
				if (
					!Object.values(effects).includes(effect) &&
					!(effect in (mechanicsData._defaults ?? {}))
				) {
					errors.push(`${prefix}.effectRules 引用了未知 effect：${effect}`);
				}
			}
		}
	}
}

if (
	mechanicsData._defaults !== undefined &&
	(!mechanicsData._defaults ||
		typeof mechanicsData._defaults !== "object" ||
		Array.isArray(mechanicsData._defaults))
) {
	errors.push("characterMechanics.json._defaults 必须是对象");
}

const visit = (value, path) => {
	if (Array.isArray(value)) {
		value.forEach((item, index) => visit(item, `${path}[${index}]`));
		return;
	}
	if (!value || typeof value !== "object") return;
	for (const [key, nested] of Object.entries(value)) {
		const nestedPath = `${path}.${key}`;
		if (key === "targetCid" && (!cids.has(nested) || typeof nested !== "string")) {
			errors.push(`${nestedPath} 引用了不存在的 targetCid：${String(nested)}`);
			continue;
		}
		visit(nested, nestedPath);
	}
};
visit(mechanicsData, "characterMechanics.json");

if (errors.length > 0) {
	console.error(`数据校验失败（${errors.length} 项）：`);
	for (const error of errors) console.error(`- ${error}`);
	process.exitCode = 1;
} else {
	console.log(
		`数据校验通过：${characters.length} 个角色，${mechanicEntries.length} 个角色机制配置`,
	);
}
