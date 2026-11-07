import { rankParameters, skillParameters } from "./metadata";

/** Military Merit belongs to Cerydra; changing its recipient clears its charges. */
export class CerydraMerit {
	target: string | undefined;
	charges = 0;
	extraHits = 0;
	private ultimateChargeUsed = false;
	private ambushing = false;
	constructor(
		readonly eidolon: number,
		readonly skillLevel = 10,
		readonly talentLevel = 10,
	) {}
	get crowned() {
		return this.charges >= this.skill[3];
	}
	private get skill() {
		return skillParameters("1412", "02", this.skillLevel);
	}
	get talent() {
		return skillParameters("1412", "04", this.talentLevel);
	}
	private gain(amount: number) {
		this.charges = Math.min(this.skill[2], this.charges + amount);
	}
	assign(target: string) {
		if (target !== this.target) {
			this.target = target;
			this.charges = 0;
		}
	}
	castSkill(target: string) {
		this.assign(target);
		this.gain(this.skill[1]);
	}
	castUltimate(firstAlly: string | undefined, amount: number) {
		if (!this.target && firstAlly) this.assign(firstAlly);
		this.gain(amount);
		this.extraHits = 0;
	}
	targetUltimate(actor: string) {
		if (
			actor === this.target &&
			!this.ultimateChargeUsed &&
			this.charges < this.skill[2]
		) {
			this.gain(1);
			this.ultimateChargeUsed = true;
		}
	}
	beginAttack(actor: string, skill: string) {
		this.ambushing = actor === this.target && this.crowned && skill === "E";
		return this.ambushing;
	}
	finishAttack(actor: string, skill: string) {
		if (actor !== this.target) return;
		if (this.ambushing)
			this.charges = Math.max(0, this.charges - this.skill[3]);
		else if (skill === "A" || skill === "E") this.gain(this.talent[0]);
		this.ambushing = false;
	}
	takeExtraHit(actor: string) {
		if (actor !== this.target || this.extraHits >= this.talent[3]) return false;
		this.extraHits += 1;
		return true;
	}
	bonuses(actor: string, isSkill: boolean) {
		const active = actor === this.target;
		const crowned = active && this.crowned;
		return {
			attackRatio: active ? this.talent[1] : 0,
			critDamage: crowned && isSkill ? this.skill[0] : 0,
			resistancePenetration:
				(crowned ? this.skill[4] : 0) +
				(active && this.eidolon >= 6 ? rankParameters("1412", 6)[0] : 0),
			defenseIgnore:
				active && this.eidolon >= 1
					? rankParameters("1412", 1)[0] +
						(crowned && isSkill ? rankParameters("1412", 1)[1] : 0)
					: 0,
			damageBonus:
				active && this.eidolon >= 2 ? rankParameters("1412", 2)[0] : 0,
		};
	}
}
