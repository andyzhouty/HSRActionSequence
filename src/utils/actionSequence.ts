import { hasSkillEffect, validSkillChars } from "../data/characters";

export {
	getCharacterDisplayName,
	getSpecialActionHint,
	hasPassive,
	hasSkillEffect,
	isQFrontCombo,
	normalizeName,
} from "../data/characters";

export type TargetKind = "角色" | "忆灵" | "非忆灵" | "敌人";

export type CharacterConfig = {
	id: string;
	kind: TargetKind;
	name: string;
	speed: string;
	baseSpeed: string;
	hasVonwacq: boolean;
	hasWindSet: boolean;
	hasDance: boolean;
	hasEidolon1: boolean;
	ultCycle: string;
	ultOffset: string;
};

export type SkillCode = string;
export type SpeedChangeMode = "absolute" | "relative";

export type GeneratedAction = {
	key: string;
	characterId: string;
	actionNo: number;
	actionValue: number;
	skill: SkillCode;
	speed: number;
	isDomainAction?: boolean;
	isDomainFinalAction?: boolean;
};

export type SpeedAdjustment = {
	value: string;
	mode: SpeedChangeMode;
};

export type UltInterrupt = {
	casterId: string;
	timing: "before" | "after";
};

export type SavedData = {
	limitPreset: string;
	customLimit: string;
	characters: CharacterConfig[];
	resources: string[];
	overrides: Record<string, string>;
	ultOverrides?: Record<string, boolean>;
	skillOverrides?: Record<string, SkillCode>;
	domainEndOverrides?: Record<string, boolean>;
	speedAdjustments?: Record<string, SpeedAdjustment>;
	skillTargets?: Record<string, string>;
	ultInterrupts?: Record<string, UltInterrupt[]>;
	resourceValues: Record<string, Record<string, string>>;
};

export const targetKinds: TargetKind[] = ["角色", "忆灵", "非忆灵", "敌人"];
export const limitPresets = ["150", "300", "500", "自定义"];
export const maxResources = 6;

export function isCharacterTarget(character: CharacterConfig) {
	return character.kind === "角色";
}

export function isAllyTarget(kind: TargetKind | undefined) {
	return kind === "角色" || kind === "忆灵";
}

export function isEnemyTarget(kind: TargetKind | undefined) {
	return kind === "敌人";
}

export function canUseSkillCode(character: CharacterConfig, skill: SkillCode) {
	if (skill === "") return true;
	if (!isCharacterTarget(character)) return false;

	const chars = [...skill];
	for (const c of chars) {
		if (!validSkillChars.includes(c)) return false;
		if (c === "W" && !hasSkillEffect(character.name, "W", "counterW"))
			return false;
		if (c === "F" && !hasSkillEffect(character.name, "F", "assistF"))
			return false;
	}

	// AE/EA 不能组合
	if (skill.includes("A") && skill.includes("E")) return false;

	return true;
}

export function getTargetDefaultName(kind: TargetKind, index: number) {
	if (kind === "非忆灵") return `召唤物 ${index + 1}`;
	return `${kind} ${index + 1}`;
}

export function createTarget(
	id: string,
	index: number,
	kind: TargetKind = "角色",
) {
	return {
		id,
		kind,
		name: getTargetDefaultName(kind, index),
		speed: "",
		baseSpeed: "",
		hasVonwacq: false,
		hasWindSet: false,
		hasDance: false,
		hasEidolon1: false,
		ultCycle: "",
		ultOffset: "",
	};
}

export function withoutCharacterOnlyEffects(
	character: CharacterConfig,
): CharacterConfig {
	if (isCharacterTarget(character)) return character;
	return {
		...character,
		baseSpeed: "",
		hasVonwacq: false,
		hasWindSet: false,
		hasDance: false,
		hasEidolon1: false,
		ultCycle: "",
		ultOffset: "",
	};
}

export const defaultCharacters: CharacterConfig[] = Array.from(
	{ length: 4 },
	(_, index) => createTarget(`c${index + 1}`, index),
);

export function ensureFileExtension(path: string, extension: string) {
	return path.toLowerCase().endsWith(extension) ? path : `${path}${extension}`;
}

export function getTimestampedFileName(prefix: string, extension: string) {
	return `${prefix}-${Date.now()}${extension}`;
}

export function getErrorMessage(error: unknown) {
	return error instanceof Error ? error.message : String(error);
}

export function canvasToPngDataUrl(canvas: HTMLCanvasElement) {
	const dataUrl = canvas.toDataURL("image/png");
	if (!dataUrl.startsWith("data:image/png;base64,")) {
		throw new Error("图片编码失败");
	}
	return dataUrl;
}

export function toPositiveNumber(value: string, fallback = 0) {
	const parsed = Number.parseFloat(value);
	return Number.isFinite(parsed) && parsed > 0 ? parsed : fallback;
}

export function toSignedNumber(value: string | undefined, fallback = 0) {
	if (value === undefined || value === "") return fallback;
	const parsed = Number.parseFloat(value);
	return Number.isFinite(parsed) ? parsed : fallback;
}

function toPositiveInteger(value: string, fallback = 0) {
	const parsed = Number.parseInt(value, 10);
	return Number.isFinite(parsed) && parsed > 0 ? parsed : fallback;
}

export function formatActionValue(value: number) {
	return Number.isInteger(value) ? String(value) : value.toFixed(2);
}

export function formatEditableNumber(value: number) {
	return Number.isInteger(value)
		? String(value)
		: value.toFixed(4).replace(/0+$/, "").replace(/\.$/, "");
}

function isUltimateAction(character: CharacterConfig, actionNo: number) {
	if (!isCharacterTarget(character)) return false;
	const cycle = toPositiveInteger(character.ultCycle);
	const offset = toPositiveInteger(character.ultOffset, cycle);
	if (cycle === 0 || offset === 0 || actionNo < offset) return false;
	return (actionNo - offset) % cycle === 0;
}

export function getDefaultSkill(
	character: CharacterConfig,
	actionNo: number,
): SkillCode {
	return isUltimateAction(character, actionNo) ? "Q" : "";
}
