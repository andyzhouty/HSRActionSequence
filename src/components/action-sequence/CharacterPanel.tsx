import { useState } from "react";
import { useActionSequence } from "../../contexts/ActionSequenceContext";
import {
	defaultCharacters,
	defaultResources,
	getCounterWDomainRule,
	getTargetDefaultName,
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
		ctx.setCharacters(defaultCharacters);
		ctx.setLimitPreset("150");
		ctx.setCustomLimit("");
		ctx.setDisplayedLimit("250");
		ctx.setResources(defaultResources);
		ctx.setOverrides({});
		ctx.setUltOverrides({});
		ctx.setSkillOverrides({});
		ctx.setDomainEndOverrides({});
		ctx.setSpeedAdjustments({});
		ctx.setSkillTargets({});
		ctx.setDefaultSkillTargets({});
		ctx.setOdeSelections({});
		ctx.setMemeSelections({});
		ctx.setUltInterrupts({});
		ctx.setResourceValues({});
		ctx.setSelectedActionKeys(new Set());
		ctx.closeActionMenu();
		ctx.setImportText("");
		ctx.setMessage("已清空所有排轴数据");
	};

	const resetCurrentActionValues = () => {
		ctx.setOverrides({});
		ctx.setUltOverrides({});
		ctx.setSpeedAdjustments({});
		ctx.setSkillOverrides((prev) => {
			const next = { ...prev };
			for (const [actionKey, skill] of Object.entries(prev)) {
				if (!skill.includes("F")) continue;
				const restoredSkill = skill.replace(/F/g, "");
				if (restoredSkill === "") delete next[actionKey];
				else next[actionKey] = restoredSkill;
			}
			return next;
		});
		ctx.setUltInterrupts({});
		ctx.setResourceValues({});
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
				<CharacterCard
					key={character.id}
					character={character}
					index={index}
				/>
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
	const counterWDomainRule = getCounterWDomainRule(character.name);

	return (
		<div
			className="rounded-2xl border border-gray-700 bg-gray-800 p-4 shadow"
		>
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
							const previousDefaultName = getTargetDefaultName(prev.kind, index);
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
								const next = {
									...prev,
									name: value,
								};
								return hasSkillEffect(value, "W", "counterW")
									? { ...next, hasDance: false }
									: next;
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
					isCharacterTarget(character) ? "grid-cols-4" : "grid-cols-1"
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
				{isCharacterTarget(character) && (
					<>
						<NumberInput
							label="基础速度 v₀"
							labelClassName="text-xs whitespace-nowrap leading-5"
							placeholder={
								hasSkillEffect(character.name, "W", "counterW") &&
								ctx.actions.some(
									(a) => a.characterId === character.id && a.skill.includes("Q"),
								)
									? "请输入"
									: "可不填"
							}
							title={
								hasSkillEffect(character.name, "W", "counterW") &&
								character.baseSpeed === ""
									? `默认 ${counterWDomainRule.defaultBaseSpeed}`
									: undefined
							}
							value={character.baseSpeed}
							onChange={(value) =>
								ctx.updateCharacter(character.id, (prev) => ({
									...prev,
									baseSpeed: value,
								}))
							}
						/>
						<NumberInput
							label="X 动一大"
							labelClassName="text-xs whitespace-nowrap leading-5"
							placeholder="可不填"
							value={character.ultCycle}
							onChange={(value) =>
								ctx.updateCharacter(character.id, (prev) => ({
									...prev,
									ultCycle: value,
								}))
							}
						/>
						<NumberInput
							label="第 K 动开大"
							labelClassName="text-xs whitespace-nowrap leading-5"
							placeholder="可不填"
							value={character.ultOffset}
							onChange={(value) =>
								ctx.updateCharacter(character.id, (prev) => ({
									...prev,
									ultOffset: value,
								}))
							}
						/>
					</>
				)}
			</div>

			{isCharacterTarget(character) && (
				<div className="mt-4 grid grid-cols-3 gap-2">
					<Toggle
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
						label="风套"
						checked={character.hasWindSet}
						onChange={() =>
							ctx.updateCharacter(character.id, (prev) => ({
								...prev,
								hasWindSet: !prev.hasWindSet,
							}))
						}
					/>
					{!hasSkillEffect(character.name, "W", "counterW") && (
						<Toggle
							label="舞舞舞"
							checked={character.hasDance}
							onChange={() =>
								ctx.updateCharacter(character.id, (prev) => ({
									...prev,
									hasDance: !prev.hasDance,
								}))
							}
						/>
					)}
					{hasSkillEffect(character.name, "W", "counterW") && (
						<Toggle
							label="1魂"
							checked={character.hasEidolon1}
							onChange={() =>
								ctx.updateCharacter(character.id, (prev) => ({
									...prev,
									hasEidolon1: !prev.hasEidolon1,
								}))
							}
						/>
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
