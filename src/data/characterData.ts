import characterMechanics from "./characterMechanics.json";
import characterBasics from "./characters.json";

export type CharacterBasicEntry = {
	cid: string;
	names: string[];
	path?: string;
	baseSpeed: number;
};

export type CharacterMechanicsEntry = {
	cid: string;
	effects?: Record<string, string>;
	effectRules?: Record<string, unknown>;
	passives?: string[];
	semantics?: string[];
	participantId?: number;
};

export type CharacterEntry = CharacterBasicEntry &
	Omit<CharacterMechanicsEntry, "cid">;

export type CharacterDataFile = {
	characters: CharacterEntry[];
	_defaults?: Record<string, unknown>;
};

type CharacterBasicsFile = {
	characters: CharacterBasicEntry[];
};

type CharacterMechanicsFile = {
	characters: CharacterMechanicsEntry[];
	_defaults?: Record<string, unknown>;
};

export const characterBasicsData =
	characterBasics as unknown as CharacterBasicsFile;
export const characterMechanicsData =
	characterMechanics as unknown as CharacterMechanicsFile;

const mechanicsByCid = new Map(
	characterMechanicsData.characters.map((entry) => [entry.cid, entry]),
);

/** 将基础角色目录与技能机制配置合并为运行时数据。 */
export const characterData: CharacterDataFile = {
	characters: characterBasicsData.characters.map((character) => ({
		...character,
		...mechanicsByCid.get(character.cid),
	})),
	_defaults: characterMechanicsData._defaults,
};
