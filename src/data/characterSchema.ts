/**
 * 角色数据运行时 schema 校验。
 *
 * 校验 rules:
 * - CID 唯一性
 * - names 非空
 * - effectRules 引用的 effect 存在于 _defaults 或角色自身 effects
 * - 诗篇 targetCid 存在于角色数据
 */

import { getCyreneUltimateRule } from "../utils/actionSequence";
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

const allCids = new Set<string>();

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
	const data = characterData as CharacterDataFile;
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
		if (allCharacterCids.has(character.cid)) {
			throw new CharacterValidationError(
				`CID 重复: ${character.cid} (${character.names?.[0] ?? "无名称"})`,
			);
		}
		allCharacterCids.add(character.cid);
		allCids.add(character.cid);
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
	}

	// 诗篇 targetCid 校验
	for (const [skill, effectName] of Object.entries(character.effects ?? {})) {
		if (effectName === "cyreneUltimate" && skill === "Q") {
			const rule = getCyreneUltimateRule(character.names[0]);
			if (rule) {
				for (const ode of rule.odes) {
					if (ode.targetCid && !allCids.has(ode.targetCid)) {
						throw new CharacterValidationError(
							`CID ${character.cid} 的颂诗 "${ode.label ?? ode.code}" 引用了不存在的 targetCid "${ode.targetCid}"`,
						);
					}
				}
				// 通用诗篇无 targetCid，跳过
			}
		}
	}
}

/** 工具函数：获取所有已注册的 CID 集合。 */
export function getAllCids(): Set<string> {
	return allCids;
}
