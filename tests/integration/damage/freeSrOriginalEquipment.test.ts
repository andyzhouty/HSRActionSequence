import { existsSync, readFileSync } from "node:fs";
import { expect, it } from "vitest";
import { createElationTeamPreset } from "../../../src/damage/elationPreset";
import { readTrialEquipment } from "../../../src/damage/equipment";

const source = process.env.HSR_FREESR_TEST_FILE;
it.skipIf(!source || !existsSync(source))(
	"preserves actual rank, cone and relic settings in the public import mode",
	() => {
		if (!source) throw new Error("Missing FreeSR file");
		const raw = JSON.parse(readFileSync(source, "utf8").replace(/^\uFEFF/, ""));
		raw.avatars["1506"].data.rank = 0;
		raw.lightcones.find(
			(c: { equip_avatar: number }) => String(c.equip_avatar) === "1506",
		).rank = 2;
		const before = JSON.stringify(raw);
		const imported = createElationTeamPreset(
			raw,
			source,
			"mc",
			"huo",
			"third",
			true,
		);
		expect(imported.profiles).toEqual(
			readTrialEquipment(raw, ["1506", "1502", "1503", "1511"]),
		);
		expect(imported.profiles[0].character.eidolon).toBe(0);
		expect(imported.profiles[0].character.superimpose).toBe(2);
		const legacy = createElationTeamPreset(raw, source);
		expect(legacy.profiles[0].character.eidolon).toBe(2);
		expect(legacy.profiles[0].character.superimpose).toBe(1);
		expect(JSON.stringify(raw)).toBe(before);
	},
);
