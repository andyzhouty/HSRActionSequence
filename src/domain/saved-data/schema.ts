import type { SavedData } from "../../utils/action-sequence/types";
import { isSkillCode } from "../skills";

export class SavedDataValidationError extends Error {
	constructor(message: string) {
		super(message);
		this.name = "SavedDataValidationError";
	}
}

function isRecord(value: unknown): value is Record<string, unknown> {
	return typeof value === "object" && value !== null && !Array.isArray(value);
}

function validateRecord(value: unknown, field: string): void {
	if (!isRecord(value)) {
		throw new SavedDataValidationError(`${field} 必须是对象`);
	}
}

function validateSkillOverrideRecord(value: unknown): void {
	validateRecord(value, "skillOverrides");
	for (const [key, skill] of Object.entries(value as Record<string, unknown>)) {
		if (typeof skill !== "string" || !isSkillCode(skill)) {
			throw new SavedDataValidationError(
				`skillOverrides.${key} 不是合法技能标识`,
			);
		}
	}
}

function validateCharacter(value: unknown, index: number): void {
	if (!isRecord(value)) {
		throw new SavedDataValidationError(`characters[${index}] 必须是对象`);
	}
	for (const field of ["id", "kind", "name"] as const) {
		if (typeof value[field] !== "string") {
			throw new SavedDataValidationError(
				`characters[${index}].${field} 必须是字符串`,
			);
		}
	}
	for (const field of ["speed", "baseSpeed"] as const) {
		if (value[field] !== undefined && typeof value[field] !== "string") {
			throw new SavedDataValidationError(
				`characters[${index}].${field} 必须是字符串`,
			);
		}
	}
}

/**
 * 校验外部 JSON 的最小结构。
 * 允许旧版本缺少可选字段，但不允许不明确的数据进入归一化流程。
 */
export function validateSavedDataInput(
	value: unknown,
): asserts value is Partial<SavedData> {
	if (!isRecord(value)) {
		throw new SavedDataValidationError("保存数据必须是 JSON 对象");
	}

	if (value.schemaVersion !== undefined) {
		if (
			typeof value.schemaVersion !== "number" ||
			!Number.isInteger(value.schemaVersion) ||
			value.schemaVersion < 0
		) {
			throw new SavedDataValidationError("schemaVersion 必须是非负整数");
		}
	}

	if (!Array.isArray(value.characters)) {
		throw new SavedDataValidationError("characters 必须是数组");
	}
	value.characters.forEach(validateCharacter);

	if (value.resources !== undefined && !Array.isArray(value.resources)) {
		throw new SavedDataValidationError("resources 必须是数组");
	}
	for (const field of [
		"overrides",
		"ultOverrides",
		"skillOverrides",
		"domainEndOverrides",
		"speedAdjustments",
		"skillTargets",
		"defaultSkillTargets",
		"odeSelections",
		"memeSelections",
		"ultInterrupts",
		"resourceValues",
	] as const) {
		if (value[field] !== undefined) {
			if (field === "skillOverrides") validateSkillOverrideRecord(value[field]);
			else validateRecord(value[field], field);
		}
	}
}

export function parseSavedDataJson(text: string): Partial<SavedData> {
	let value: unknown;
	try {
		value = JSON.parse(text);
	} catch {
		throw new SavedDataValidationError("保存数据不是合法 JSON");
	}
	validateSavedDataInput(value);
	return value;
}
