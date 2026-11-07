import { existsSync, readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { readTrialEquipment } from "../../../src/damage/equipment";
import { calculatePhainonTrial } from "../../../src/damage/phainonTrial";
import { createPhainonTrialPreset } from "../../../src/damage/preset";
import { toNormalizedSavedData } from "../../../src/pages/action-sequence/savedData";
import { simulateActions } from "../../../src/simulate/actions";
import { getDisplayOrderedActions } from "../../../src/utils/actionDisplayOrder";

const source = process.env.HSR_FREESR_TEST_FILE;
describe("Cerydra actual equipped profile", () => {
	it.skipIf(!source || !existsSync(source))(
		"imports the actual E1/S2 gear and replays the support team",
		() => {
			if (!source) throw new Error("Missing FreeSR file");
			const raw = JSON.parse(
				readFileSync(source, "utf8").replace(/^\uFEFF/, ""),
			);
			const profiles = readTrialEquipment(raw, [
				"1408",
				"1101",
				"1412",
				"1309",
			]);
			const cerydra = profiles[2];
			expect(cerydra.character).toMatchObject({
				eidolon: 1,
				lc_id: 23026,
				superimpose: 2,
			});
			expect(cerydra.gear).toMatchObject({
				skillLevel: 10,
				ultimateLevel: 10,
				talentLevel: 10,
				sets: { "110": 4, "308": 2 },
			});
			const saved = toNormalizedSavedData(
				createPhainonTrialPreset(raw, source, "cerydra"),
			);
			if (!saved.phainonDamageTrial)
				throw new Error("Missing damage configuration");
			expect(saved.phainonDamageTrial.cerydraAttack).toBeCloseTo(
				cerydra.attack,
			);
			const actions = getDisplayOrderedActions(
				simulateActions({
					...saved,
					limit: 300,
					legacyUltOverrides: saved.ultOverrides,
				}),
				saved.sameAVOrder,
			);
			const result = calculatePhainonTrial({
				...saved,
				actions,
				config: saved.phainonDamageTrial,
			});
			expect(result.warnings).toEqual([]);
			expect(result.rows.flatMap((row) => row.warnings)).toEqual([]);
			expect(
				result.rows.some(
					(row) => row.cerydra?.target === profiles[0].character.id,
				),
			).toBe(true);
			expect(
				result.rows.some((row) => row.description === "刻律德菈·军功附加伤害"),
			).toBe(true);
			expect(result.rows.every((row) => Number.isFinite(row.expected))).toBe(
				true,
			);
		},
	);
});
