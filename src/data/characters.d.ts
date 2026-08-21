export interface CharacterEntry {
	cid: string;
	names: string[];
	path?: string;
	baseSpeed: number;
}

export interface CharacterMechanicsEntry {
	cid: string;
	effects?: Record<string, string>;
	effectRules?: Record<string, unknown>;
	passives?: string[];
	semantics?: string[];
	participantId?: number;
}

export interface CharacterMechanicsData {
	characters: CharacterMechanicsEntry[];
	_defaults?: Record<string, unknown>;
}

export interface CharacterData {
	characters: CharacterEntry[];
	_defaults?: Record<string, unknown>;
}
