import characterData from "./characters.json";

type CharacterEntry = {
	names: string[];
	effects?: Record<string, string>;
	effectRules?: Record<string, unknown>;
	passives?: string[];
	semantics?: string[];
	path?: string;
};

const data = characterData as {
	characters: CharacterEntry[];
	_defaults?: Record<string, unknown>;
};
const characters = data.characters;

export function getDefaultEffectRule<T = unknown>(
	effect: string,
): T | undefined {
	return data._defaults?.[effect] as T | undefined;
}

export function normalizeName(name: string) {
	return name.trim().replace(/\s+/g, "");
}

function findCharacterEntry(name: string) {
	const normalized = normalizeName(name);
	return characters.find((entry) =>
		entry.names.some((n) => normalizeName(n) === normalized),
	);
}

export function getCharacterDisplayName(name: string): string | null {
	const entry = findCharacterEntry(name);
	return entry ? entry.names[0] : null;
}

export function getCharacterPath(name: string): string | undefined {
	const entry = findCharacterEntry(name);
	return entry?.path;
}

export function hasSkillEffect(
	name: string,
	skill: string,
	effect: string,
): boolean {
	const entry = findCharacterEntry(name);
	return entry?.effects?.[skill] === effect;
}

export function getSkillEffectOwnerNames(skill: string, effect: string) {
	return characters
		.filter((entry) => entry.effects?.[skill] === effect)
		.map((entry) => entry.names[0])
		.filter((name): name is string => Boolean(name));
}

export function hasPassive(name: string, passive: string): boolean {
	const entry = findCharacterEntry(name);
	return entry?.passives?.includes(passive) ?? false;
}

export function hasSemanticFlag(name: string, semantic: string): boolean {
	const entry = findCharacterEntry(name);
	return entry?.semantics?.includes(semantic) ?? false;
}

export function getEffectRule<T = unknown>(
	name: string,
	effect: string,
): T | undefined {
	const entry = findCharacterEntry(name);
	return entry?.effectRules?.[effect] as T | undefined;
}

export function getSpecialActionHint(name: string) {
	const entry = findCharacterEntry(name);
	if (!entry) return "";
	const displayName = entry.names[0];
	if (entry.semantics?.includes("ambiguousBaseName")) {
		const alternatives = characters
			.filter((other) => {
				if (other === entry) return false;
				const otherName = other.names[0];
				const thisName = entry.names[0];
				return otherName.includes(thisName) || thisName.includes(otherName);
			})
			.map((other) => other.names[0]);
		if (alternatives.length > 0) {
			return `已识别：${displayName}。若指${alternatives.join("、")}，请输入全名。`;
		}
	}
	return `已识别：${displayName}`;
}

export const validSkillChars = ["A", "E", "Q", "W", "F"];

export function isQFrontCombo(skill: string) {
	return skill.length > 1 && skill.startsWith("Q");
}
