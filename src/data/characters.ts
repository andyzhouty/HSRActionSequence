import type { CharacterId } from "../domain/identity";
import { toCharacterId } from "../domain/identity";
import { SKILL_TOKENS } from "../domain/skills";
import { type CharacterEntry, characterData } from "./characterData";
import { validateCharacterSchema } from "./characterSchema";

export type CharacterCatalogEntry = Omit<
	Pick<CharacterEntry, "cid" | "names" | "path" | "baseSpeed">,
	"cid"
> & { cid: CharacterId };

const data = characterData;
const characters = data.characters;

validateCharacterSchema();

/** 面向 UI 的角色检索目录；返回副本，避免调用方修改角色配置。 */
export function getCharacterCatalog(): CharacterCatalogEntry[] {
	return characters.map(({ cid, names, path, baseSpeed }) => ({
		cid: toCharacterId(cid),
		names: [...names],
		path,
		baseSpeed,
	}));
}

export function getDefaultEffectRule<T = unknown>(
	effect: string,
): T | undefined {
	return data._defaults?.[effect] as T | undefined;
}

export function normalizeName(name: string) {
	return name.trim().replace(/\s+/g, "").toLocaleLowerCase();
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

export function getCharacterNameByCid(cid: string): string | undefined {
	return characters.find((entry) => entry.cid === cid)?.names[0];
}

export function getCharacterCid(name: string): CharacterId | undefined {
	const entry = findCharacterEntry(name);
	return entry ? toCharacterId(entry.cid) : undefined;
}

export function getCharacterPath(name: string): string | undefined {
	const entry = findCharacterEntry(name);
	return entry?.path;
}

/** 角色数据表中的基础速度；召唤物等运行时实体不在此表内。 */
export function getCharacterBaseSpeed(name: string): number | undefined {
	return findCharacterEntry(name)?.baseSpeed;
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

export const validSkillChars = [...SKILL_TOKENS];

export function getCharacterParticipantId(name: string): number | undefined {
	const entry = findCharacterEntry(name);
	return entry?.participantId;
}

export function isQFrontCombo(skill: string) {
	return skill.length > 1 && skill.startsWith("Q");
}
