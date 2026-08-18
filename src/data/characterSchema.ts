/**
 * 角色数据运行时 schema 校验。
 *
 * 校验规则：
 * - CID 唯一性
 * - names 非空
 * - effectRules 引用的 effect 存在于 _defaults 或角色自身 effects
 * - 诗篇 targetCid 存在于角色数据
 */

import { isCharacterId, toCharacterId } from "../domain/identity";
import { isSkillCode, SKILL_TOKENS } from "../domain/skills";
import characterData from "./characters.json";

export class CharacterValidationError extends Error {
	constructor(message: string) {
		super(message);
		this.name = "CharacterValidationError";
	}
}

type CharacterEntry = {
	cid: string;
	names: string[];
	baseSpeed?: number;
	effects?: Record<string, string>;
	effectRules?: Record<string, unknown>;
	passives?: string[];
	semantics?: string[];
	path?: string;
};

type CharacterDataFile = {
	characters: CharacterEntry[];
	_defaults?: Record<string, unknown>;
};

const skillTokenSet = new Set<string>(SKILL_TOKENS);

const allCids = new Set<import("../domain/identity").CharacterId>();

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

/** 运行全部校验，抛出第一个错误。 */
export function validateCharacterSchema(): void {
	const data = characterData as unknown as CharacterDataFile;
	if (!data.characters || !Array.isArray(data.characters)) {
		throw new CharacterValidationError("characters.json 缺少 characters 数组");
	}

	allCids.clear();

	// 收集所有 CID
	const allCharacterCids = new Set<string>();
	for (const character of data.characters) {
		if (!character.cid) {
			throw new CharacterValidationError(
				`角色 ${character.names?.[0] ?? "无名称"} 缺少 cid`,
			);
		}
		if (!isCharacterId(character.cid)) {
			throw new CharacterValidationError(
				`角色 ${character.names?.[0] ?? "无名称"} 的 CID 必须是数字字符串`,
			);
		}
		if (allCharacterCids.has(character.cid)) {
			throw new CharacterValidationError(
				`CID 重复: ${character.cid} (${character.names?.[0] ?? "无名称"})`,
			);
		}
		allCharacterCids.add(character.cid);
		allCids.add(toCharacterId(character.cid));
	}

	// 校验每个角色
	for (const character of data.characters) {
		validateCharacterEntry(character, data._defaults);
	}

	// 校验默认效果规则
	if (data._defaults) {
		for (const [effect, rule] of Object.entries(data._defaults)) {
			if (rule === null || rule === undefined) {
				throw new CharacterValidationError(`_defaults.${effect} 的值为空`);
			}
		}
		validateRuleSkillFields("_defaults", data._defaults);
	}
}

function validateCharacterEntry(
	character: CharacterEntry,
	defaults: Record<string, unknown> | undefined,
): void {
	// names 非空
	if (!character.names || character.names.length === 0) {
		throw new CharacterValidationError(`CID ${character.cid} 的 names 为空`);
	}

	// names 中的值非空字符串
	for (const name of character.names) {
		if (!name || name.trim() === "") {
			throw new CharacterValidationError(
				`CID ${character.cid} 的 names 包含空字符串`,
			);
		}
	}

	// path 校验
	if (character.path && !validPaths.has(character.path)) {
		throw new CharacterValidationError(
			`CID ${character.cid} 的 path "${character.path}" 无效`,
		);
	}

	if (
		typeof character.baseSpeed !== "number" ||
		!Number.isFinite(character.baseSpeed) ||
		character.baseSpeed <= 0
	) {
		throw new CharacterValidationError(
			`CID ${character.cid} 的 baseSpeed 必须是正数`,
		);
	}

	if (character.effects !== undefined) {
		if (typeof character.effects !== "object") {
			throw new CharacterValidationError(
				`CID ${character.cid} 的 effects 必须是对象`,
			);
		}
		for (const [skill, effect] of Object.entries(character.effects)) {
			if (!skillTokenSet.has(skill)) {
				throw new CharacterValidationError(
					`CID ${character.cid} 的 effects 使用了未知技能标识 "${skill}"`,
				);
			}
			if (typeof effect !== "string" || effect.trim() === "") {
				throw new CharacterValidationError(
					`CID ${character.cid} 的 effects.${skill} 必须是非空字符串`,
				);
			}
		}
	}

	// effectRules 校验
	if (character.effectRules) {
		for (const effect of Object.keys(character.effectRules)) {
			const hasEffect = character.effects
				? Object.values(character.effects).includes(effect)
				: false;
			const hasDefault = defaults?.[effect] !== undefined;
			if (!hasEffect && !hasDefault) {
				throw new CharacterValidationError(
					`CID ${character.cid} 的 effectRules 引用了不存在的 effect "${effect}"`,
				);
			}
		}
		validateRuleSkillFields(character.cid, character.effectRules);
	}

	validateTargetCids(character);
}

function validateRuleSkillFields(
	cid: string,
	rules: Record<string, unknown>,
): void {
	const visit = (value: unknown, path: string) => {
		if (!value || typeof value !== "object") return;
		if (Array.isArray(value)) {
			value.forEach((item, index) => {
				visit(item, `${path}[${index}]`);
			});
			return;
		}
		for (const [key, nested] of Object.entries(value)) {
			const nestedPath = `${path}.${key}`;
			if (
				(key === "allowedSkills" ||
					key === "enemyTriggerSkills" ||
					key === "finalSkill") &&
				nested !== undefined
			) {
				const values = Array.isArray(nested) ? nested : [nested];
				for (const skill of values) {
					if (typeof skill !== "string" || !isSkillCode(skill)) {
						throw new CharacterValidationError(
							`CID ${cid} 的 ${nestedPath} 包含非法技能 "${String(skill)}"`,
						);
					}
				}
				continue;
			}
			visit(nested, nestedPath);
		}
	};

	visit(rules, "effectRules");
}

function validateTargetCids(character: CharacterEntry): void {
	const visit = (value: unknown, path: string) => {
		if (Array.isArray(value)) {
			value.forEach((item, index) => {
				visit(item, `${path}[${index}]`);
			});
			return;
		}
		if (!value || typeof value !== "object") return;
		for (const [key, nested] of Object.entries(value)) {
			const nestedPath = `${path}.${key}`;
			if (key === "targetCid" && nested !== undefined) {
				if (!isCharacterId(nested) || !allCids.has(nested)) {
					throw new CharacterValidationError(
						`CID ${character.cid} 的 ${nestedPath} 引用了不存在的 targetCid "${String(nested)}"`,
					);
				}
				continue;
			}
			visit(nested, nestedPath);
		}
	};

	visit(character.effectRules, "effectRules");
}

/** 工具函数：获取所有已注册的 CID 集合。 */
export function getAllCids(): Set<import("../domain/identity").CharacterId> {
	return new Set(allCids);
}
