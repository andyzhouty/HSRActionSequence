import characterData from "./characters.json";

export function normalizeName(name: string) {
	return name.trim().replace(/\s+/g, "");
}

function findCharacterEntry(name: string) {
	const normalized = normalizeName(name);
	return characterData.characters.find((entry) =>
		entry.names.some((n) => normalizeName(n) === normalized),
	);
}

export function getCharacterDisplayName(name: string): string | null {
	const entry = findCharacterEntry(name);
	return entry ? entry.names[0] : null;
}

export function hasSkillEffect(
	name: string,
	skill: string,
	effect: string,
): boolean {
	const entry = findCharacterEntry(name);
	if (!entry) return false;
	const effects = entry.effects as unknown as Record<string, string>;
	return effects[skill] === effect;
}

export function hasPassive(name: string, passive: string): boolean {
	const entry = findCharacterEntry(name);
	if (!entry?.passives) return false;
	return (entry.passives as string[]).includes(passive);
}

export function getSpecialActionHint(name: string) {
	const displayName = getCharacterDisplayName(name);
	return displayName ? `已识别：${displayName}` : "";
}

export const validSkillChars = ["A", "E", "Q", "W", "F"];

export function isQFrontCombo(skill: string) {
	return skill.length > 1 && skill.startsWith("Q");
}
