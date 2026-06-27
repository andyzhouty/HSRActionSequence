export interface CharacterEntry {
	names: string[];
	effects: Record<string, string>;
	passives?: string[];
}

export interface CharacterData {
	characters: CharacterEntry[];
}
