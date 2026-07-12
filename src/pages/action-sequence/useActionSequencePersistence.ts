import { useEffect, useRef, useState } from "react";
import {
	ensureFileExtension,
	getErrorMessage,
	getTimestampedFileName,
	type SavedData,
} from "../../utils/actionSequence";
import { invoke, open, save } from "../../utils/backend";
import { toNormalizedSavedData } from "./savedData";

type ApplyImportedData = (
	parsed: Partial<SavedData>,
	options?: {
		message?: string;
		resetSelection?: boolean;
		closeMenu?: boolean;
	},
) => void;

type UseActionSequencePersistenceParams = {
	exportData: SavedData;
	applyImportedData: ApplyImportedData;
};

export function useActionSequencePersistence({
	exportData,
	applyImportedData,
}: UseActionSequencePersistenceParams) {
	const [importText, setImportText] = useState("");
	const autosavePathRef = useRef<string | null>(null);
	const autosaveTimerRef = useRef<number | null>(null);
	const lastImportedJsonRef = useRef("");
	const didRestoreInitialDataRef = useRef(false);

	useEffect(() => {
		if (didRestoreInitialDataRef.current) return;
		didRestoreInitialDataRef.current = true;
		let cancelled = false;

		void (async () => {
			try {
				const autosavePath = await invoke<string>("get_autosave_path");
				autosavePathRef.current = autosavePath;

				const text = await invoke<string>("read_text_file", {
					path: autosavePath,
				});
				if (cancelled || !text.trim()) return;

				const parsed = JSON.parse(text) as Partial<SavedData>;
				if (
					!Array.isArray(parsed.characters) ||
					parsed.characters.length === 0
				) {
					return;
				}
				lastImportedJsonRef.current = JSON.stringify(
					toNormalizedSavedData(parsed),
				);
				applyImportedData(parsed, { message: "已自动恢复上次的排轴数据" });
			} catch {
				// 首次使用或无上次保存数据，静默忽略
			}
		})();

		return () => {
			cancelled = true;
		};
	}, [applyImportedData]);

	useEffect(() => {
		const normalizedJson = JSON.stringify(toNormalizedSavedData(exportData));
		if (normalizedJson === lastImportedJsonRef.current) return;
		lastImportedJsonRef.current = normalizedJson;
		setImportText(normalizedJson);
	}, [exportData]);

	useEffect(() => {
		if (autosaveTimerRef.current !== null) {
			window.clearTimeout(autosaveTimerRef.current);
		}
		if (autosavePathRef.current === null) return;

		autosaveTimerRef.current = window.setTimeout(() => {
			const path = autosavePathRef.current;
			if (!path) return;

			invoke("write_text_file", {
				path,
				contents: JSON.stringify(exportData, null, 2),
			}).catch(() => {
				// 自动保存失败不影响用户操作
			});
		}, 800);

		return () => {
			if (autosaveTimerRef.current !== null) {
				window.clearTimeout(autosaveTimerRef.current);
			}
		};
	}, [exportData]);

	const exportJson = async (setMessage: (message: string) => void) => {
		const json = JSON.stringify(exportData, null, 2);
		const hasWailsSaveDialog = Boolean(window?.go?.main?.App?.SaveFileDialog);

		if (!hasWailsSaveDialog) {
			setImportText(json);
			try {
				await navigator.clipboard.writeText(json);
				setMessage("当前为浏览器开发模式，已将 JSON 填入文本框并复制到剪贴板");
			} catch {
				setMessage("当前为浏览器开发模式，已将 JSON 填入文本框");
			}
			return;
		}

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

	const importJson = (
		setMessage: (message: string) => void,
		rawText = importText,
	) => {
		try {
			const parsed = JSON.parse(rawText) as Partial<SavedData>;
			if (!Array.isArray(parsed.characters)) {
				throw new Error("characters 缺失");
			}
			lastImportedJsonRef.current = JSON.stringify(
				toNormalizedSavedData(parsed),
			);
			setImportText(rawText);
			applyImportedData(parsed, {
				message: "导入成功",
				resetSelection: true,
				closeMenu: true,
			});
		} catch {
			setMessage("导入失败，请检查 JSON 格式");
		}
	};

	const importFromFile = async (setMessage: (message: string) => void) => {
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
			importJson(setMessage, text);
		} catch (error) {
			setMessage(`从文件导入失败：${getErrorMessage(error)}`);
		}
	};

	const clearAutosaveFile = () => {
		const path = autosavePathRef.current;
		if (!path) return;
		invoke("write_text_file", {
			path,
			contents: "{}",
		}).catch(() => {
			// 清空失败不影响用户操作
		});
	};

	return {
		importText,
		setImportText,
		exportJson,
		importJson,
		importFromFile,
		clearAutosaveFile,
	};
}
