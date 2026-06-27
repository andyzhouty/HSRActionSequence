import { confirm } from "@tauri-apps/plugin-dialog";
import { useActionSequence } from "../../contexts/ActionSequenceContext";
import {
	defaultCharacters,
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

	return (
		<section className="space-y-3">
			<button
				type="button"
				onClick={async () => {
					const confirmed = await confirm(
						"确定要清空所有排轴数据吗？此操作不可撤销。",
						{ title: "清空排轴", kind: "warning" },
					);
					if (confirmed) {
						ctx.setCharacters(defaultCharacters);
						ctx.setLimitPreset("150");
						ctx.setCustomLimit("");
						ctx.setResources(["战技点"]);
						ctx.setOverrides({});
						ctx.setUltOverrides({});
						ctx.setSkillOverrides({});
						ctx.setSpeedAdjustments({});
						ctx.setSkillTargets({});
						ctx.setUltInterrupts({});
						ctx.setResourceValues({});
						ctx.setSelectedActionKeys(new Set());
						ctx.closeActionMenu();
						ctx.setImportText("");
						ctx.setMessage("已清空所有排轴数据");
					}
				}}
				className="h-11 w-full rounded-xl border border-red-800/50 bg-red-950/30 font-medium text-red-200 hover:bg-red-950/50"
			>
				清空排轴
			</button>
			<button
				type="button"
				onClick={async () => {
					const confirmed = await confirm(
						"将清空以下手动调整的数据：\n\n• 行动值手动覆盖\n• 速度调整（加速/减速）\n• 资源备注",
						{ title: "恢复默认行动值", kind: "warning" },
					);
					if (!confirmed) return;
					ctx.setOverrides({});
					ctx.setUltOverrides({});
					ctx.setSpeedAdjustments({});
					ctx.setResourceValues({});
					ctx.setSelectedActionKeys(new Set());
					ctx.closeActionMenu();
					ctx.setMessage("已恢复默认行动值");
				}}
				className="h-11 w-full rounded-xl border border-amber-700/50 bg-amber-900/30 font-medium text-amber-200 hover:bg-amber-900/50"
			>
				恢复当前配置默认行动值
			</button>

			{ctx.characters.map((character, index) => (
				<div
					key={character.id}
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
									ctx.updateCharacter(character.id, (prev) => ({
										...prev,
										name: value,
									}))
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
											(a) =>
												a.characterId === character.id &&
												a.skill.includes("Q"),
										)
											? "请输入"
											: "可不填"
									}
									title={
										hasSkillEffect(character.name, "W", "counterW") &&
										character.baseSpeed === ""
											? "默认 106.0"
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
						<div
							className={`mt-4 grid gap-2 ${
								hasSkillEffect(character.name, "W", "counterW")
									? "grid-cols-4"
									: "grid-cols-3"
							}`}
						>
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
			))}
			<button
				type="button"
				onClick={ctx.addTarget}
				className="h-11 w-full rounded-xl border border-[#3b82f666] bg-[#1725544d] font-medium text-blue-100 hover:bg-[#1e3a8a66]"
			>
				添加场上目标
			</button>
		</section>
	);
}
