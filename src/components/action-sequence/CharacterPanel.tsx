import { useState } from "react";
import lightConeData from "../../data/lightcones.json";
import { useActionSequence } from "../../contexts/ActionSequenceContext";
import {
	defaultCharacters,
	getCharacterPath,
	getTargetDefaultName,
	hasPassive,
	hasSkillEffect,
	isCharacterTarget,
	type TargetKind,
	targetKinds,
	withoutCharacterOnlyEffects,
} from "../../utils/actionSequence";
import {
	CharacterNameInput,
	NumberInput,
	SelectInput,
	TextInput,
	Toggle,
} from "./Controls";

export default function CharacterPanel() {
	const ctx = useActionSequence();
	const [confirmAction, setConfirmAction] = useState<
		"clearAll" | "resetActions" | null
	>(null);

	const clearAllData = () => {
		ctx.resetSavedData();
		ctx.setLastMemeTarget("");
		ctx.setMeritTarget(undefined);
		ctx.setDancePartner(undefined);
		ctx.setBondmateTarget(undefined);
		ctx.setAttackDisabled({});
		ctx.setSelectedActionKeys(new Set());
		ctx.setActionOperation("advance");
		ctx.setOperationValue("");
		ctx.setAdvanceCeiling("");
		ctx.setOperationSpeedMode("absolute");
		ctx.setDraftInterruptCaster("");
		ctx.setDraftInterruptTiming("before");
		ctx.closeActionMenu();
		ctx.setImportText("");
		ctx.clearAutosaveFile();
		ctx.setMessage("已清空所有排轴数据");
	};

	const resetCurrentActionValues = () => {
		ctx.setOverrides({});
		ctx.setUltOverrides({});
		ctx.setMemeSelections({});
		ctx.setSpeedAdjustments({});
		ctx.setSkillOverrides((prev) => {
			const next = { ...prev };
			for (const [actionKey, skill] of Object.entries(prev)) {
				// 清除 Q（含 QA/AQ/EQ/QE）和 F（姬子助战）
				if (skill.includes("Q") || skill.includes("F")) {
					const restored = skill.replace(/Q/g, "").replace(/F/g, "");
					if (restored === "") delete next[actionKey];
					else next[actionKey] = restored;
				}
			}
			return next;
		});
		ctx.setUltInterrupts({});
		ctx.setResourceValues({});
		ctx.setFireflyBreakCounters({});
		ctx.setAttackDisabled({});
		ctx.setGodmodeExtraActions({});
		ctx.setOdeSelections({});
		ctx.setDomainEndOverrides({});
		ctx.setSelectedActionKeys(new Set());
		ctx.closeActionMenu();
		ctx.setMessage("已恢复默认行动值");
	};

	const runConfirmedAction = () => {
		if (confirmAction === "clearAll") clearAllData();
		if (confirmAction === "resetActions") resetCurrentActionValues();
		setConfirmAction(null);
	};

	return (
		<section className="space-y-3">
			<button
				type="button"
				onClick={() => setConfirmAction("clearAll")}
				className="h-11 w-full rounded-xl border border-red-800/50 bg-red-950/30 font-medium text-red-200 hover:bg-red-950/50"
			>
				清空排轴
			</button>
			<button
				type="button"
				onClick={() => setConfirmAction("resetActions")}
				className="h-11 w-full rounded-xl border border-amber-700/50 bg-amber-900/30 font-medium text-amber-200 hover:bg-amber-900/50"
			>
				恢复当前配置默认行动值
			</button>
			<ConfirmDialog
				action={confirmAction}
				onCancel={() => setConfirmAction(null)}
				onConfirm={runConfirmedAction}
			/>

			{ctx.characters.map((character, index) => (
				<CharacterCard key={character.id} character={character} index={index} />
			))}
			<button
				type="button"
				onClick={ctx.addTarget}
				className="h-11 w-full rounded-xl bg-blue-600 font-medium text-white hover:bg-blue-500"
			>
				添加目标
			</button>
		</section>
	);
}

function ConfirmDialog({
	action,
	onCancel,
	onConfirm,
}: {
	action: "clearAll" | "resetActions" | null;
	onCancel: () => void;
	onConfirm: () => void;
}) {
	if (action === null) return null;
	const isClearAll = action === "clearAll";

	return (
		<div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/60 p-4">
			<div className="w-full max-w-md rounded-xl border border-gray-700 bg-gray-900 p-5 shadow-2xl">
				<h2 className="text-lg font-semibold text-white">
					{isClearAll ? "清空排轴" : "恢复默认行动值"}
				</h2>
				{isClearAll ? (
					<p className="mt-3 text-sm leading-6 text-gray-300">
						确定要清空所有排轴数据吗？此操作不可撤销。
					</p>
				) : (
					<div className="mt-3 text-sm leading-6 text-gray-300">
						<p>将清空以下手动调整的数据：</p>
						<ul className="mt-2 list-disc space-y-1 pl-5">
							<li>行动值手动覆盖</li>
							<li>速度调整（加速/减速）</li>
							<li>资源备注</li>
							<li>姬子·启行助战技</li>
							<li>插队大招</li>
						</ul>
					</div>
				)}
				<div className="mt-5 flex justify-end gap-2">
					<button
						type="button"
						onClick={onCancel}
						className="h-9 rounded-lg border border-gray-600 bg-gray-800 px-4 text-sm font-medium text-gray-200 hover:bg-gray-700"
					>
						取消
					</button>
					<button
						type="button"
						onClick={onConfirm}
						className={`h-9 rounded-lg px-4 text-sm font-medium text-white ${
							isClearAll
								? "bg-red-700 hover:bg-red-600"
								: "bg-amber-700 hover:bg-amber-600"
						}`}
					>
						确认
					</button>
				</div>
			</div>
		</div>
	);
}

function CharacterCard({
	character,
	index,
}: {
	character: (typeof defaultCharacters)[number];
	index: number;
}) {
	const ctx = useActionSequence();

	return (
		<div className="rounded-2xl border border-gray-700 bg-gray-800 p-4 shadow">
			<div className="mb-4 grid grid-cols-[112px_minmax(0,1fr)] gap-3">
				<SelectInput
					value={character.kind}
					options={targetKinds.map((kind) => ({
						value: kind,
						label: kind,
					}))}
					onChange={(value) =>
						ctx.updateCharacter(character.id, (prev) => {
							const nextKind = value as TargetKind;
							const previousDefaultName = getTargetDefaultName(
								prev.kind,
								index,
							);
							const shouldUseNextDefaultName =
								prev.name.trim() === "" ||
								prev.name.trim() === previousDefaultName;
							return withoutCharacterOnlyEffects({
								...prev,
								kind: nextKind,
								name: shouldUseNextDefaultName
									? getTargetDefaultName(nextKind, index)
									: prev.name,
							});
						})
					}
				/>
				{isCharacterTarget(character) ? (
					<CharacterNameInput
						value={character.name}
						placeholder={getTargetDefaultName(character.kind, index)}
						onChange={(value) =>
							ctx.updateCharacter(character.id, (prev) => {
								const oldPath = getCharacterPath(prev.name);
								const newPath = getCharacterPath(value);
								const allLcs =
									(
										lightConeData as {
											lightcones: {
												id: number;
												name: string;
												rarity: number;
												path: string;
											}[];
										}
									).lightcones ?? [];
								const lcStillValid =
									prev.lc_id === 0 ||
									(newPath
										? allLcs.some(
												(lc) => lc.path === newPath && lc.id === prev.lc_id,
											)
										: false);
								return {
									...prev,
									name: value,
									lc_id:
										oldPath !== newPath && !lcStillValid ? 0 : prev.lc_id,
								};
							})
						}
					/>
				) : (
					<TextInput
						value={character.name}
						placeholder={getTargetDefaultName(character.kind, index)}
						onChange={(value) =>
							ctx.updateCharacter(character.id, (prev) => ({
								...prev,
								name: value,
							}))
						}
					/>
				)}
			</div>

			<div
				className={`grid gap-3 ${
					isCharacterTarget(character) &&
					!hasSkillEffect(character.name, "W", "counterW")
						? "grid-cols-2"
						: "grid-cols-1"
				}`}
			>
				<NumberInput
					label="速度 v"
					labelClassName="text-xs whitespace-nowrap leading-5"
					value={character.speed}
					onChange={(value) =>
						ctx.updateCharacter(character.id, (prev) => ({
							...prev,
							speed: value,
						}))
					}
				/>
				{isCharacterTarget(character) &&
					!hasSkillEffect(character.name, "W", "counterW") && (
						<NumberInput
							label="基础速度 v₀"
							labelClassName="text-xs whitespace-nowrap leading-5"
							placeholder="可不填"
							value={character.baseSpeed}
							onChange={(value) =>
								ctx.updateCharacter(character.id, (prev) => ({
									...prev,
									baseSpeed: value,
								}))
							}
						/>
					)}
			</div>

			{isCharacterTarget(character) && (
				<div className="mt-4 space-y-3">
					<div className="flex flex-wrap gap-2">
						<Toggle
							className="flex-1"
							label="翁瓦克"
							checked={character.hasVonwacq}
							onChange={() =>
								ctx.updateCharacter(character.id, (prev) => ({
									...prev,
									hasVonwacq: !prev.hasVonwacq,
								}))
							}
						/>
						<Toggle
							className="flex-1"
							label="风套"
							checked={character.hasWindSet}
							onChange={() =>
								ctx.updateCharacter(character.id, (prev) => ({
									...prev,
									hasWindSet: !prev.hasWindSet,
								}))
							}
						/>
						{hasSkillEffect(character.name, "Q", "summonPollux") && (
							<Toggle
								className="flex-1"
								label="遐蝶秘技"
								checked={character.hasCastoriceTechnique ?? false}
								onChange={() =>
									ctx.updateCharacter(character.id, (prev) => ({
										...prev,
										hasCastoriceTechnique: !(
											prev.hasCastoriceTechnique ?? false
										),
									}))
								}
							/>
						)}
						{hasSkillEffect(character.name, "E", "summonGarmentmaker") && (
							<Toggle
								className="flex-1"
								label="阿格莱雅秘技"
								checked={character.hasAglaeaTechnique ?? false}
								onChange={() =>
									ctx.updateCharacter(character.id, (prev) => ({
										...prev,
										hasAglaeaTechnique: !(prev.hasAglaeaTechnique ?? false),
									}))
								}
							/>
						)}
					</div>
					<div className="flex gap-2">
						<SelectInput
							value={String(character.eidolon)}
							options={Array.from({ length: 7 }, (_, i) => {
								let hasEffect = false;
								if (
									hasSkillEffect(character.name, "W", "counterW") &&
									(i === 1 || i === 2)
								)
									hasEffect = true;
								if (
									(hasSkillEffect(character.name, "Q", "fireflyCombustion") ||
										hasSkillEffect(character.name, "Q", "teamAdvance24")) &&
									i === 2
								)
									hasEffect = true;
								if (
									hasSkillEffect(character.name, "E", "summonGarmentmaker") &&
									i === 4
								)
									hasEffect = true;
								return {
									value: String(i),
									label: `${i} 魂${hasEffect ? " *" : ""}`,
								};
							})}
							onChange={(value) =>
								ctx.updateCharacter(character.id, (prev) => ({
									...prev,
									eidolon: Number(value),
								}))
							}
							className="flex-1"
						/>
						<SelectInput
							value={String(character.lc_id)}
							options={(() => {
								const charPath = getCharacterPath(character.name);
								const allLcs =
									(
										lightConeData as {
											lightcones: {
												id: number;
												name: string;
												rarity: number;
												path: string;
											}[];
										}
									).lightcones ?? [];
								let matching = allLcs.filter((lc) => lc.path === charPath);
								matching.sort((a, b) => b.rarity - a.rarity || b.id - a.id);
								const dddIndex = matching.findIndex((lc) => lc.id === 21018);
								if (
									dddIndex !== -1 &&
									charPath === "Harmony" &&
									hasSkillEffect(character.name, "Q", "robinUltimate")
								) {
									matching.splice(dddIndex, 1);
								} else if (dddIndex !== -1) {
									const ddd = matching.splice(dddIndex, 1)[0];
									matching.unshift(ddd);
								}
								return [
									{ value: "0", label: "无光锥" },
									...matching.map((lc) => ({
										value: String(lc.id),
										label: lc.name,
										className:
											lc.rarity >= 5
												? "text-yellow-300"
												: lc.rarity >= 4
													? "text-purple-300"
													: "text-sky-300",
									})),
								];
							})()}
							onChange={(value) =>
								ctx.updateCharacter(character.id, (prev) => ({
									...prev,
									lc_id: Number(value),
								}))
							}
							className="flex-1"
						/>
					</div>
					<div className="flex gap-2">
						<SelectInput
							value={String(character.superimpose)}
							options={[
								{ value: "0", label: "叠 0" },
								{ value: "1", label: "叠 1" },
								{ value: "2", label: "叠 2" },
								{ value: "3", label: "叠 3" },
								{ value: "4", label: "叠 4" },
								{ value: "5", label: "叠 5" },
							]}
							onChange={(value) =>
								ctx.updateCharacter(character.id, (prev) => ({
									...prev,
									superimpose: Number(value),
									...(hasSkillEffect(prev.name, "W", "counterW")
										? {
												baseSpeed: String(
													// biome-ignore lint/complexity/noExcessiveNestedConditionals: computed
													prev.lc_id === 23044
														? Number(value) > 0
															? 104 + 2 * Number(value)
															: 94
														: 94,
												),
											}
										: {}),
								}))
							}
							className="flex-1"
						/>
					</div>
					{hasPassive(character.name, "meritSpeedBuff20") && (
						<div className="flex gap-2">
							<SelectInput
								value={String(ctx.meritTarget ?? "")}
								options={[
									{ value: "", label: "无军功" },
									...ctx.characters
										.filter(
											(c) =>
												c.id !== character.id &&
												c.kind === "角色",
										)
										.map((c) => ({
											value: String(c.id),
											label: c.name.trim() || c.id,
										})),
								]}
								onChange={(value) => ctx.setMeritTarget(value || undefined)}
								className="flex-1"
							/>
						</div>
					)}
					{hasPassive(character.name, "dancePartnerSpeedBuff30") && (
						<div className="flex gap-2">
							<SelectInput
								value={String(ctx.dancePartner ?? "")}
								options={[
									{ value: "", label: "无共舞者" },
									...ctx.characters
										.filter(
											(c) =>
												c.id !== character.id &&
												c.kind === "角色",
										)
										.map((c) => ({
											value: String(c.id),
											label: c.name.trim() || c.id,
										})),
								]}
								onChange={(value) => ctx.setDancePartner(value || undefined)}
								className="flex-1"
							/>
						</div>
					)}
					{hasPassive(character.name, "souldragonBondmate") && (
						<div className="grid grid-cols-[88px_minmax(0,1fr)] items-center gap-2">
							<span className="text-sm text-gray-300">初始同袍</span>
							<SelectInput
								value={String(ctx.bondmateTarget ?? "")}
								options={[
									{ value: "", label: "无初始同袍" },
									...ctx.characters
										.filter((candidate) => candidate.kind === "角色")
										.map((candidate) => ({
											value: candidate.id,
											label: candidate.name.trim() || candidate.id,
										})),
								]}
								onChange={(value) =>
									ctx.setBondmateTarget(value)
								}
								className="flex-1"
							/>
						</div>
					)}
				</div>
			)}
			<button
				type="button"
				onClick={() => ctx.removeTarget(character.id)}
				disabled={ctx.characters.length <= 1}
				className="mt-3 h-10 w-full rounded-lg border border-[#ef444466] bg-gray-800 text-xs font-medium text-red-200 whitespace-nowrap hover:bg-[#450a0a4d] disabled:cursor-not-allowed disabled:border-gray-600 disabled:bg-gray-800 disabled:text-gray-500 disabled:hover:bg-gray-800"
			>
				删除目标
			</button>
		</div>
	);
}
