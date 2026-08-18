/** 技能输入允许使用的原子标识。 */
export const SKILL_TOKENS = ["A", "E", "Q", "W", "F", "M", "S", "Z"] as const;

export type SkillToken = (typeof SKILL_TOKENS)[number];

export type ParsedSkillCode = {
	raw: string;
	tokens: SkillToken[];
	/** 红A 的连续战技数量；普通 E 为 1。 */
	archerExtraECount?: number;
};

export class SkillCodeParseError extends Error {
	constructor(message: string) {
		super(message);
		this.name = "SkillCodeParseError";
	}
}

function isSkillToken(value: string): value is SkillToken {
	return (SKILL_TOKENS as readonly string[]).includes(value);
}

/**
 * 将用户输入的技能字符串解析为结构化技能。
 * 角色是否允许该技能由上层根据角色机制另行判断。
 */
export function parseSkillCode(value: string): ParsedSkillCode {
	if (typeof value !== "string") {
		throw new SkillCodeParseError("技能必须是字符串");
	}

	const raw = value.trim().toUpperCase();
	if (raw === "") return { raw, tokens: [] };

	const archerMatch = /^(\d*)E$/.exec(raw);
	if (archerMatch) {
		if (!archerMatch[1]) return { raw, tokens: ["E"] };
		const count = archerMatch[1] ? Number.parseInt(archerMatch[1], 10) : 1;
		if (!Number.isInteger(count) || count < 1) {
			throw new SkillCodeParseError(`无效的连续战技数量：${value}`);
		}
		return {
			raw,
			tokens: ["E"],
			archerExtraECount: count,
		};
	}

	const tokens = [...raw];
	if (tokens.some((token) => !isSkillToken(token))) {
		const invalid = tokens.find((token) => !isSkillToken(token));
		throw new SkillCodeParseError(`技能包含未知标识：${invalid ?? raw}`);
	}
	return { raw, tokens: tokens as SkillToken[] };
}

export function tryParseSkillCode(value: string): ParsedSkillCode | null {
	try {
		return parseSkillCode(value);
	} catch {
		return null;
	}
}

export function isSkillCode(value: string): boolean {
	return tryParseSkillCode(value) !== null;
}
