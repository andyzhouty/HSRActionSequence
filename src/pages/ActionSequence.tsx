import { invoke } from "@tauri-apps/api/core";
import { open, save } from "@tauri-apps/plugin-dialog";
import html2canvas from "html2canvas";
import { useEffect, useMemo, useRef, useState } from "react";
import ActionPanel from "../components/action-sequence/ActionPanel";
import CharacterPanel from "../components/action-sequence/CharacterPanel";
import { ActionSequenceCtx } from "../contexts/ActionSequenceContext";
import {
	type CharacterConfig,
	canUseSkillCode,
	canvasToPngDataUrl,
	createTarget,
	defaultCharacters,
	ensureFileExtension,
	formatEditableNumber,
	type GeneratedAction,
	getDefaultSkill,
	getErrorMessage,
	getTargetDefaultName,
	getTimestampedFileName,
	hasSkillEffect,
	isCharacterTarget,
	limitPresets,
	maxResources,
	type SavedData,
	type SkillCode,
	type SpeedAdjustment,
	type SpeedChangeMode,
	type TargetKind,
	targetKinds,
	toPositiveNumber,
	toSignedNumber,
	type UltInterrupt,
	withoutCharacterOnlyEffects,
} from "../utils/actionSequence";
import { simulateActions } from "../utils/simulateActions";

export default function ActionSequence() {
	const [characters, setCharacters] =
		useState<CharacterConfig[]>(defaultCharacters);
	const [limitPreset, setLimitPreset] = useState("150");
	const [customLimit, setCustomLimit] = useState("");
	const [resources, setResources] = useState<string[]>(["战技点"]);
	const [overrides, setOverrides] = useState<Record<string, string>>({});
	const [ultOverrides, setUltOverrides] = useState<Record<string, boolean>>({});
	const [skillOverrides, setSkillOverrides] = useState<
		Record<string, SkillCode>
	>({});
	const [domainEndOverrides, setDomainEndOverrides] = useState<
		Record<string, boolean>
	>({});
	const [speedAdjustments, setSpeedAdjustments] = useState<
		Record<string, SpeedAdjustment>
	>({});
	const [selectedActionKeys, setSelectedActionKeys] = useState<Set<string>>(
		() => new Set(),
	);
	const [actionMenuOpen, setActionMenuOpen] = useState(false);
	const [actionMenuKey, setActionMenuKey] = useState<string | null>(null);
	const [actionMenuPos, setActionMenuPos] = useState<number>(0);
	const [actionOperation, setActionOperation] = useState<"advance" | "speed">(
		"advance",
	);
	const [operationValue, setOperationValue] = useState("");
	const [operationSpeedMode, setOperationSpeedMode] =
		useState<SpeedChangeMode>("absolute");
	const [resourceValues, setResourceValues] = useState<
		Record<string, Record<string, string>>
	>({});
	const [skillTargets, setSkillTargets] = useState<Record<string, string>>({});
	const [ultInterrupts, setUltInterrupts] = useState<
		Record<string, UltInterrupt[]>
	>({});
	const [draftInterruptCaster, setDraftInterruptCaster] = useState("");
	const [draftInterruptTiming, setDraftInterruptTiming] = useState<
		"before" | "after"
	>("before");
	const [actions, setActions] = useState<GeneratedAction[]>([]);
	const [importText, setImportText] = useState("");
	const [message, setMessage] = useState("");
	const [isExportingImage, setIsExportingImage] = useState(false);
	const imageExportRef = useRef<HTMLDivElement>(null);
	const autosavePathRef = useRef<string | null>(null);
	const autosaveTimerRef = useRef<number | null>(null);

	const actionLimit = useMemo(() => {
		if (limitPreset === "自定义") {
			return toPositiveNumber(customLimit, 150);
		}
		return toPositiveNumber(limitPreset, 150);
	}, [customLimit, limitPreset]);
	const displayedActionLimit = actionLimit + 100;

	// 启动时自动加载上次保存的状态
	useEffect(() => {
		let cancelled = false;

		void (async () => {
			try {
				const autosavePath = await invoke<string>("get_autosave_path");
				autosavePathRef.current = autosavePath;

				const text = await invoke<string>("read_text_file", {
					path: autosavePath,
				});
				if (cancelled) return;
				if (!text.trim()) return;

				const parsed = JSON.parse(text) as Partial<SavedData>;
				if (!Array.isArray(parsed.characters)) return;
				if (parsed.characters.length === 0) return;

				// 导入状态
				setCharacters(
					parsed.characters.map((character, index) =>
						withoutCharacterOnlyEffects({
							...createTarget(
								String(character.id ?? `autoload-${index + 1}`),
								index,
								(targetKinds.includes(character.kind as TargetKind)
									? character.kind
									: "角色") as TargetKind,
							),
							...character,
							id: String(character.id ?? `autoload-${index + 1}`),
							kind: (targetKinds.includes(character.kind as TargetKind)
								? character.kind
								: "角色") as TargetKind,
							name: String(character.name ?? ""),
							speed: String(character.speed ?? ""),
							baseSpeed: String(character.baseSpeed ?? ""),
							ultCycle: String(character.ultCycle ?? ""),
							ultOffset: String(character.ultOffset ?? ""),
						}),
					),
				);
				setLimitPreset(
					parsed.limitPreset && limitPresets.includes(parsed.limitPreset)
						? parsed.limitPreset
						: "150",
				);
				setCustomLimit(String(parsed.customLimit ?? ""));
				setResources(
					Array.isArray(parsed.resources)
						? parsed.resources.slice(0, maxResources).map(String)
						: [],
				);
				setOverrides(parsed.overrides ?? {});
				setUltOverrides(parsed.ultOverrides ?? {});
				setSkillOverrides(parsed.skillOverrides ?? {});
				setDomainEndOverrides(parsed.domainEndOverrides ?? {});
				setSkillTargets(parsed.skillTargets ?? {});
				setUltInterrupts(parsed.ultInterrupts ?? {});
				setSpeedAdjustments(parsed.speedAdjustments ?? {});
				setResourceValues(parsed.resourceValues ?? {});
				setMessage("已自动恢复上次的排轴数据");
			} catch {
				// 首次使用或无上次保存数据，静默忽略
			}
		})();

		return () => {
			cancelled = true;
		};
	}, []);

	useEffect(() => {
		try {
			const nextActions = simulateActions({
				characters,
				limit: displayedActionLimit,
				overrides,
				skillOverrides,
				domainEndOverrides,
				legacyUltOverrides: ultOverrides,
				speedAdjustments,
				skillTargets,
				ultInterrupts,
			});
			setActions(nextActions);
		} catch (error) {
			setActions([]);
			setMessage(`行动轴计算失败：${getErrorMessage(error)}`);
		}
	}, [
		characters,
		displayedActionLimit,
		overrides,
		skillOverrides,
		domainEndOverrides,
		ultOverrides,
		speedAdjustments,
		skillTargets,
		ultInterrupts,
	]);

	// 状态变化时自动保存（防抖 800ms）
	useEffect(() => {
		if (autosaveTimerRef.current !== null) {
			window.clearTimeout(autosaveTimerRef.current);
		}
		if (autosavePathRef.current === null) return;

		autosaveTimerRef.current = window.setTimeout(() => {
			const path = autosavePathRef.current;
			if (!path) return;

			const data: SavedData = {
				limitPreset,
				customLimit,
				characters: characters.map(withoutCharacterOnlyEffects),
				resources,
				overrides,
				skillOverrides,
				domainEndOverrides,
				speedAdjustments,
				skillTargets,
				ultInterrupts,
				resourceValues,
			};

			invoke("write_text_file", {
				path,
				contents: JSON.stringify(data, null, 2),
			}).catch(() => {
				// 自动保存失败不影响用户操作
			});
		}, 800);

		return () => {
			if (autosaveTimerRef.current !== null) {
				window.clearTimeout(autosaveTimerRef.current);
			}
		};
	}, [
		characters,
		limitPreset,
		customLimit,
		resources,
		overrides,
		skillOverrides,
		domainEndOverrides,
		speedAdjustments,
		skillTargets,
		ultInterrupts,
		resourceValues,
	]);

	const characterNames = useMemo(
		() =>
			Object.fromEntries(
				characters.map((character, index) => [
					character.id,
					character.name.trim() || getTargetDefaultName(character.kind, index),
				]),
			),
		[characters],
	);
	const characterKinds = useMemo(
		() =>
			Object.fromEntries(
				characters.map((character) => [character.id, character.kind]),
			),
		[characters],
	);
	const charactersById = useMemo(
		() =>
			Object.fromEntries(
				characters.map((character) => [character.id, character]),
			),
		[characters],
	);

	const updateCharacter = (
		id: string,
		updater: (character: CharacterConfig) => CharacterConfig,
	) => {
		setCharacters((prev) =>
			prev.map((character) =>
				character.id === id ? updater(character) : character,
			),
		);
	};

	const addTarget = () => {
		setCharacters((prev) => [
			...prev,
			createTarget(`target-${Date.now()}`, prev.length),
		]);
	};

	const removeTarget = (id: string) => {
		if (characters.length <= 1) return;
		setCharacters((prev) =>
			prev.length <= 1 ? prev : prev.filter((character) => character.id !== id),
		);
		setOverrides((prev) =>
			Object.fromEntries(
				Object.entries(prev).filter(
					([actionKey]) => !actionKey.startsWith(`${id}-`),
				),
			),
		);
		setUltOverrides((prev) =>
			Object.fromEntries(
				Object.entries(prev).filter(
					([actionKey]) => !actionKey.startsWith(`${id}-`),
				),
			),
		);
		setSkillOverrides((prev) =>
			Object.fromEntries(
				Object.entries(prev).filter(
					([actionKey]) => !actionKey.startsWith(`${id}-`),
				),
			),
		);
		setDomainEndOverrides((prev) =>
			Object.fromEntries(
				Object.entries(prev).filter(
					([actionKey]) => !actionKey.startsWith(`${id}-`),
				),
			),
		);
		setSpeedAdjustments((prev) =>
			Object.fromEntries(
				Object.entries(prev).filter(
					([actionKey]) => !actionKey.startsWith(`${id}-`),
				),
			),
		);
		setSkillTargets((prev) =>
			Object.fromEntries(
				Object.entries(prev).filter(
					([actionKey]) => !actionKey.startsWith(`${id}-`),
				),
			),
		);
		setUltInterrupts((prev) =>
			Object.fromEntries(
				Object.entries(prev).filter(
					([actionKey]) => !actionKey.startsWith(`${id}-`),
				),
			),
		);
		setResourceValues((prev) =>
			Object.fromEntries(
				Object.entries(prev).filter(
					([actionKey]) => !actionKey.startsWith(`${id}-`),
				),
			),
		);
		setSelectedActionKeys((prev) => {
			const next = new Set(
				[...prev].filter((actionKey) => !actionKey.startsWith(`${id}-`)),
			);
			return next;
		});
		closeActionMenu();
	};

	const updateResourceValue = (
		actionKey: string,
		resourceName: string,
		value: string,
	) => {
		setResourceValues((prev) => ({
			...prev,
			[actionKey]: {
				...(prev[actionKey] ?? {}),
				[resourceName]: value,
			},
		}));
	};

	const updateActionSkill = (action: GeneratedAction, value: string) => {
		const character = charactersById[action.characterId];
		if (!character) return;
		if (action.isDomainFinalAction) return;
		const nextSkill = value.trim().toUpperCase() as SkillCode;
		const allowedDomainSkills = new Set(["", "E", "EW", "EA", "A", "W"]);
		if (action.isDomainAction && !allowedDomainSkills.has(nextSkill)) {
			setMessage("白厄境界内只能填写 E、EW、EA、A 或 W");
			return;
		}
		if (!action.isDomainAction && !canUseSkillCode(character, nextSkill)) {
			if (nextSkill.includes("A") && nextSkill.includes("E")) {
				setMessage("A（普攻）和 E（战技）不能组合");
			} else if (
				nextSkill.includes("W") &&
				!hasSkillEffect(character.name, "W", "counterW")
			) {
				setMessage(
					"只有名称为\u201c白厄\u201d或\u201cPhainon\u201d的角色可以填写 W",
				);
			} else if (
				nextSkill.includes("F") &&
				!hasSkillEffect(character.name, "F", "assistF")
			) {
				setMessage("只有名称包含\u201c姬子\u201d的角色可以填写 F");
			} else if (!isCharacterTarget(character)) {
				setMessage("只有角色可以填写技能");
			}
			return;
		}

		setSkillOverrides((prev) => {
			const next = { ...prev };
			const defaultSkill = action.isDomainAction
				? ""
				: getDefaultSkill(character, action.actionNo);
			if (nextSkill === defaultSkill) {
				delete next[action.key];
			} else {
				next[action.key] = nextSkill;
			}
			return next;
		});
		setUltOverrides((prev) => {
			const next = { ...prev };
			delete next[action.key];
			return next;
		});
		// 技能不再是 E 时，清理技能目标
		if (!nextSkill.includes("E")) {
			setSkillTargets((prev) => {
				const next = { ...prev };
				delete next[action.key];
				return next;
			});
		}
	};

	const selectAction = (actionKey: string, additive: boolean) => {
		setSelectedActionKeys((prev) => {
			if (!additive) return new Set([actionKey]);
			const next = new Set(prev);
			if (next.has(actionKey)) {
				next.delete(actionKey);
			} else {
				next.add(actionKey);
			}
			return next;
		});
	};

	const openActionMenu = (
		actionKey: string,
		additive: boolean,
		clientY: number,
	) => {
		if (actionMenuOpen && actionMenuKey === actionKey && !additive) {
			closeActionMenu();
			return;
		}
		setSelectedActionKeys((prev) => {
			if (prev.has(actionKey) && !additive) return prev;
			if (!additive) return new Set([actionKey]);
			const next = new Set(prev);
			next.add(actionKey);
			return next;
		});
		setActionMenuKey(actionKey);
		setActionMenuPos(clientY);
		setActionMenuOpen(true);
	};

	const closeActionMenu = () => {
		setActionMenuOpen(false);
		setActionMenuKey(null);
	};

	const getPhainonDomainEquivalentSpeed = (action: GeneratedAction) => {
		const character = charactersById[action.characterId];
		if (!character) return action.speed;
		const baseSpeed =
			toPositiveNumber(character.baseSpeed, 0) > 0
				? toPositiveNumber(character.baseSpeed, action.speed)
				: 106.0;
		const coeff = character.hasEidolon1 ? 0.66 : 0.6;
		return baseSpeed * coeff;
	};

	const getPreviousDomainActionValue = (action: GeneratedAction) => {
		const match = action.key.match(/^(.*-domain-)(\d+)$/);
		if (!match) return action.actionValue;
		const previousIndex = Number.parseInt(match[2], 10) - 1;
		if (!Number.isFinite(previousIndex) || previousIndex < 0) {
			return action.actionValue;
		}
		const previousAction = actions.find(
			(candidate) => candidate.key === `${match[1]}${previousIndex}`,
		);
		return previousAction?.actionValue ?? action.actionValue;
	};

	const applyActionOperation = () => {
		const selectedActions = actions.filter((action) =>
			selectedActionKeys.has(action.key),
		);
		if (selectedActions.length === 0) {
			setMessage("请先选中至少一条行动");
			return;
		}

		const value = toSignedNumber(operationValue, Number.NaN);
		if (!Number.isFinite(value)) {
			setMessage("请输入有效数值");
			return;
		}

		if (actionOperation === "advance") {
			const minActionValue = Math.min(
				...selectedActions.map((action) => action.actionValue),
			);
			setOverrides((prev) => {
				const next = { ...prev };
				for (const action of selectedActions) {
					if (action.isDomainAction && value <= 0) continue;
					const actionSpeed = action.isDomainAction
						? getPhainonDomainEquivalentSpeed(action)
						: action.speed;
					const shifted = action.actionValue - (value * 100) / actionSpeed;
					if (action.isDomainAction) {
						const lowerBound = getPreviousDomainActionValue(action);
						next[action.key] = formatEditableNumber(
							Math.max(0, Math.max(lowerBound, shifted)),
						);
						continue;
					}
					const shouldClampToSelectedMinimum =
						value > 0 && action.actionValue > minActionValue;
					const clamped = shouldClampToSelectedMinimum
						? Math.max(minActionValue, shifted)
						: shifted;
					next[action.key] = formatEditableNumber(
						Math.max(0, clamped),
					);
				}
				return next;
			});
			setMessage(`已调整 ${selectedActions.length} 条行动的行动值`);
		} else {
			const missingBaseSpeed = selectedActions.some((action) => {
				const character = charactersById[action.characterId];
				return (
					operationSpeedMode === "relative" &&
					character !== undefined &&
					toPositiveNumber(character.baseSpeed) <= 0
				);
			});
			if (missingBaseSpeed) {
				setMessage("相对变速需要为选中的目标填写基础速度 v₀");
				return;
			}

			setSpeedAdjustments((prev) => {
				const next = { ...prev };
				for (const action of selectedActions) {
					next[action.key] = {
						value: operationValue,
						mode: operationSpeedMode,
					};
				}
				return next;
			});
			setMessage(`已为 ${selectedActions.length} 条行动设置后续变速`);
		}

		closeActionMenu();
	};

	const addResource = () => {
		if (resources.length >= maxResources) return;
		setResources((prev) => [...prev, `资源 ${prev.length + 1}`]);
	};

	const updateResource = (index: number, value: string) => {
		setResources((prev) =>
			prev.map((resource, resourceIndex) =>
				resourceIndex === index ? value : resource,
			),
		);
	};

	const removeResource = (index: number) => {
		const removedName = resources[index];
		setResources((prev) =>
			prev.filter((_, resourceIndex) => resourceIndex !== index),
		);
		setResourceValues((prev) => {
			const next = { ...prev };
			for (const actionKey of Object.keys(next)) {
				const values = { ...next[actionKey] };
				delete values[removedName];
				next[actionKey] = values;
			}
			return next;
		});
	};

	const buildExportData = (): SavedData => ({
		limitPreset,
		customLimit,
		characters: characters.map(withoutCharacterOnlyEffects),
		resources,
		overrides,
		skillOverrides,
		domainEndOverrides,
		speedAdjustments,
		skillTargets,
		ultInterrupts,
		resourceValues,
	});

	const exportJson = async () => {
		const json = JSON.stringify(buildExportData(), null, 2);

		try {
			const selectedPath = await save({
				title: "导出 JSON",
				defaultPath: getTimestampedFileName("action-sequence", ".json"),
				filters: [
					{
						name: "JSON",
						extensions: ["json"],
					},
				],
			});
			if (!selectedPath) {
				setMessage("已取消导出 JSON");
				return;
			}

			const filePath = ensureFileExtension(selectedPath, ".json");
			await invoke("write_text_file", {
				path: filePath,
				contents: json,
			});
			setImportText(json);
			setMessage(`已导出 JSON 文件：${filePath}`);
		} catch (error) {
			setMessage(`JSON 导出失败：${getErrorMessage(error)}`);
		}
	};

	const exportImage = async () => {
		if (!imageExportRef.current) return;

		try {
			setIsExportingImage(true);
			setMessage("正在生成行动序列图片...");

			const target = imageExportRef.current;
			const exportPadding = 32;
			const canvas = await html2canvas(target, {
				backgroundColor: "#1f2937",
				scale: Math.min(window.devicePixelRatio || 1, 2),
				width: target.scrollWidth,
				height: target.scrollHeight + exportPadding,
				windowWidth: Math.max(
					document.documentElement.clientWidth,
					target.scrollWidth,
				),
				windowHeight: Math.max(
					document.documentElement.clientHeight,
					target.scrollHeight + exportPadding,
				),
				onclone: (_clonedDocument, clonedElement) => {
					// 替换所有 oklch/oklab 颜色为十六进制，避免 html2canvas 解析失败
					_clonedDocument.querySelectorAll("style").forEach((style) => {
						style.textContent = style.textContent.replace(
							/oklch\([^)]+\)|oklab\([^)]+\)/g,
							"inherit",
						);
					});
					clonedElement.style.boxSizing = "border-box";
					clonedElement.style.paddingBottom = `${exportPadding}px`;
					clonedElement.querySelectorAll(".truncate").forEach((element) => {
						const exportText = element as HTMLElement;
						exportText.style.lineHeight = "1.25rem";
						exportText.style.minHeight = "1.25rem";
					});
					clonedElement.querySelectorAll("input").forEach((input) => {
						const replacement = document.createElement("div");
						const inputElement = input as HTMLInputElement;
						const isActionValue = inputElement.classList.contains("font-mono");
						const isDomainSkill =
							inputElement.dataset.exportKind === "domain-skill";
						replacement.textContent = inputElement.value;
						replacement.style.alignItems = "center";
						replacement.style.backgroundColor = isDomainSkill
							? "#78350f"
							: "#374151";
						replacement.style.border = isDomainSkill
							? "1px solid #fbbf24"
							: "1px solid #4b5563";
						replacement.style.borderRadius = "0.5rem";
						replacement.style.boxSizing = "border-box";
						replacement.style.color = isDomainSkill ? "#fef3c7" : "#ffffff";
						replacement.style.display = "flex";
						replacement.style.fontWeight = isDomainSkill ? "700" : "400";
						replacement.style.justifyContent = isDomainSkill
							? "center"
							: "flex-start";
						replacement.style.fontFamily = isActionValue
							? '"Inconsolata Nerd Font", monospace'
							: "inherit";
						replacement.style.height = "40px";
						replacement.style.lineHeight = "1";
						replacement.style.padding = isDomainSkill ? "0 4px" : "0 12px";
						replacement.style.whiteSpace = "nowrap";
						replacement.style.width = isDomainSkill
							? "40px"
							: isActionValue
								? "112px"
								: "100%";
						inputElement.replaceWith(replacement);
					});
				},
			});

			const selectedPath = await save({
				title: "导出行动序列图片",
				defaultPath: getTimestampedFileName("action-sequence", ".png"),
				filters: [
					{
						name: "PNG 图片",
						extensions: ["png"],
					},
				],
			});
			if (!selectedPath) {
				setMessage("已取消导出图片");
				return;
			}

			const filePath = ensureFileExtension(selectedPath, ".png");
			await invoke("write_png_file", {
				path: filePath,
				dataUrl: canvasToPngDataUrl(canvas),
			});
			setMessage(`已导出行动序列图片：${filePath}`);
		} catch (error) {
			setMessage(`图片导出失败：${getErrorMessage(error)}`);
		} finally {
			setIsExportingImage(false);
		}
	};

	const importJson = (rawText = importText) => {
		try {
			const parsed = JSON.parse(rawText) as Partial<SavedData>;
			if (!Array.isArray(parsed.characters)) {
				throw new Error("characters 缺失");
			}

			setCharacters(
				parsed.characters.map((character, index) =>
					withoutCharacterOnlyEffects({
						...createTarget(
							String(character.id ?? `target-${index + 1}`),
							index,
							(targetKinds.includes(character.kind as TargetKind)
								? character.kind
								: "角色") as TargetKind,
						),
						...character,
						id: String(character.id ?? `target-${index + 1}`),
						kind: (targetKinds.includes(character.kind as TargetKind)
							? character.kind
							: "角色") as TargetKind,
						name: String(character.name ?? ""),
						speed: String(character.speed ?? ""),
						baseSpeed: String(character.baseSpeed ?? ""),
						ultCycle: String(character.ultCycle ?? ""),
						ultOffset: String(character.ultOffset ?? ""),
					}),
				),
			);
			setLimitPreset(
				parsed.limitPreset && limitPresets.includes(parsed.limitPreset)
					? parsed.limitPreset
					: "150",
			);
			setCustomLimit(String(parsed.customLimit ?? ""));
			setResources(
				Array.isArray(parsed.resources)
					? parsed.resources.slice(0, maxResources).map(String)
					: [],
			);
			setOverrides(parsed.overrides ?? {});
			setUltOverrides(parsed.ultOverrides ?? {});
			setSkillOverrides(parsed.skillOverrides ?? {});
			setDomainEndOverrides(parsed.domainEndOverrides ?? {});
			setSpeedAdjustments(parsed.speedAdjustments ?? {});
			setSkillTargets(parsed.skillTargets ?? {});
			setUltInterrupts(parsed.ultInterrupts ?? {});
			setResourceValues(parsed.resourceValues ?? {});
			setSelectedActionKeys(new Set());
			closeActionMenu();
			setMessage("导入成功");
		} catch {
			setMessage("导入失败，请检查 JSON 格式");
		}
	};

	const importFromFile = async () => {
		try {
			const selectedPath = await open({
				title: "导入 JSON",
				multiple: false,
				filters: [
					{
						name: "JSON",
						extensions: ["json"],
					},
				],
			});
			if (!selectedPath || Array.isArray(selectedPath)) {
				setMessage("已取消从文件导入");
				return;
			}

			const text = await invoke<string>("read_text_file", {
				path: selectedPath,
			});
			setImportText(text);
			importJson(text);
		} catch (error) {
			setMessage(`从文件导入失败：${getErrorMessage(error)}`);
		}
	};

	return (
		<ActionSequenceCtx.Provider
			value={{
				characters,
				setCharacters,
				limitPreset,
				setLimitPreset,
				customLimit,
				setCustomLimit,
				resources,
				setResources,
				overrides,
				setOverrides,
				ultOverrides,
				setUltOverrides,
				skillOverrides,
				setSkillOverrides,
				domainEndOverrides,
				setDomainEndOverrides,
				speedAdjustments,
				setSpeedAdjustments,
				skillTargets,
				setSkillTargets,
				ultInterrupts,
				setUltInterrupts,
				resourceValues,
				setResourceValues,
				actions,
				setActions,
				importText,
				setImportText,
				message,
				setMessage,
				isExportingImage,
				setIsExportingImage,
				selectedActionKeys,
				setSelectedActionKeys,
				actionMenuOpen,
				setActionMenuOpen,
				actionMenuKey,
				setActionMenuKey,
				actionMenuPos,
				setActionMenuPos,
				actionOperation,
				setActionOperation,
				operationValue,
				setOperationValue,
				operationSpeedMode,
				setOperationSpeedMode,
				draftInterruptCaster,
				setDraftInterruptCaster,
				draftInterruptTiming,
				setDraftInterruptTiming,
				actionLimit,
				displayedActionLimit,
				characterNames,
				characterKinds,
				charactersById,
				imageExportRef,
				updateCharacter,
				addTarget,
				removeTarget,
				updateResourceValue,
				updateActionSkill,
				selectAction,
				openActionMenu,
				closeActionMenu,
				applyActionOperation,
				addResource,
				updateResource,
				removeResource,
				buildExportData,
				exportJson,
				exportImage,
				importJson,
				importFromFile,
			}}
		>
			<div className="mx-auto max-w-7xl px-1 py-2">
				<div className="mb-4 rounded-2xl bg-gray-800 p-4 shadow">
					<h2 className="mb-2 text-2xl font-bold text-white">行动排轴器</h2>
					<p className="text-gray-300">
						星穹铁道行动值序列工具，支持翁瓦克、风套、舞舞舞、手动行动值和资源备注。
					</p>
				</div>
				<div className="grid grid-cols-1 gap-4 xl:grid-cols-[420px_minmax(0,1fr)]">
					<CharacterPanel />
					<ActionPanel />
				</div>
			</div>
		</ActionSequenceCtx.Provider>
	);
}
