import { useCallback, useMemo, useState } from "react";
import * as XLSX from "xlsx";
import { useActionSequence } from "../contexts/ActionSequenceContext";
import { getEffectiveCharacterBaseSpeed } from "../mechanics/lightconeEffects";
import {
	ensureFileExtension,
	formatActionValue,
	getErrorMessage,
	isAllyTarget,
} from "../utils/action-sequence";
import { getBackendPort } from "../utils/backend";
import {
	buildExportNameMap,
	CHARACTER_EXPORT_HEADERS,
	getExportDisplayName,
	getLightConeDisplayName,
} from "../utils/excelExport";

export default function ExportExcelButton() {
	const ctx = useActionSequence();
	const [exporting, setExporting] = useState(false);
	const backendPort = useMemo(() => getBackendPort(), []);

	const doExport = useCallback(async () => {
		if (ctx.actions.length === 0) {
			ctx.setMessage("没有行动数据可导出");
			return;
		}
		try {
			setExporting(true);
			const exportNames = buildExportNameMap(
				ctx.characters,
				ctx.memospriteTargets,
				ctx.actions,
			);

			// 行动序列工作表
			const header = ["序号", "角色", "动数", "行动值", "技能"];
			for (const r of ctx.resources) {
				header.push(r || `资源`);
			}
			// 收集境界区间（白厄开大后的域），用于遮蔽域内无关友方行动
			const domainRanges: {
				casterId: string;
				startAV: number;
				endAV: number;
			}[] = [];
			for (const a of ctx.actions) {
				if (a.isDomainAction && !a.isDomainFinalAction) {
					const existing = domainRanges.find(
						(r) => r.casterId === a.characterId && r.endAV === 0,
					);
					if (!existing) {
						domainRanges.push({
							casterId: a.characterId,
							startAV: a.actionValue,
							endAV: 0,
						});
					}
				}
				if (a.isDomainFinalAction) {
					const range = domainRanges.find(
						(r) => r.casterId === a.characterId && r.endAV === 0,
					);
					if (range) range.endAV = a.actionValue;
				}
			}

			const isInsideDomain = (
				action: (typeof ctx.actions)[number],
			): boolean => {
				if (action.isDomainAction) return false; // 域内行动保留
				if (action.isAhaInstant) return false; // 阿哈时刻保留
				const charKind = ctx.characterKinds[action.characterId] ?? "角色";
				if (!isAllyTarget(charKind)) return false; // 敌方可以穿插
				return domainRanges.some(
					(r) =>
						r.casterId !== action.characterId &&
						action.actionValue >= r.startAV &&
						action.actionValue <= r.endAV,
				);
			};

			const visibleActions = ctx.actions.filter((a) => !isInsideDomain(a));
			const rows = visibleActions.map((a, i) => {
				const skillTargetId = ctx.skillTargets[a.key];
				const odeSelection = ctx.odeSelections[a.key];
				const memeTargetId = ctx.memeSelections[a.key];
				let skillDisplay = a.skill;
				if (odeSelection) {
					const odeTargetName = getExportDisplayName(
						exportNames,
						odeSelection.targetId,
						"未知目标",
					);
					skillDisplay = `${a.skill}→${odeTargetName}`;
				} else if (skillTargetId) {
					skillDisplay = `${a.skill}→${getExportDisplayName(
						exportNames,
						skillTargetId,
						"未知目标",
					)}`;
				} else if (memeTargetId) {
					skillDisplay = `${a.skill}→${getExportDisplayName(
						exportNames,
						memeTargetId,
						"未知目标",
					)}`;
				}
				const row: (string | number)[] = [
					i + 1,
					a.displayName?.trim() ||
						getExportDisplayName(exportNames, a.characterId, "未知角色"),
					a.isDomainAction ? `境界${a.actionNo}` : `第${a.actionNo}动`,
					Number.parseFloat(formatActionValue(a.actionValue)),
					skillDisplay,
				];
				for (const r of ctx.resources) {
					row.push(ctx.resourceValues[a.key]?.[r] ?? "");
				}
				return row;
			});
			const ws = XLSX.utils.aoa_to_sheet([header, ...rows]);
			ws["!cols"] = [
				{ wch: 6 },
				{ wch: 10 },
				{ wch: 8 },
				{ wch: 10 },
				{ wch: 16 },
				...ctx.resources.map(() => ({ wch: 10 })),
			];

			// ── 角色配置工作表：与当前网页角色卡保持一致 ──
			const charHeader = [...CHARACTER_EXPORT_HEADERS];
			const charRows = ctx.characters.map((c) => [
				c.name.trim() || "未命名角色",
				c.speed,
				getEffectiveCharacterBaseSpeed(c),
				getLightConeDisplayName(c.lc_id),
				c.hasVonwacq ? "是" : "否",
				c.hasWindSet ? "是" : "否",
			]);
			const charWs = XLSX.utils.aoa_to_sheet([charHeader, ...charRows]);
			charWs["!cols"] = [
				{ wch: 12 },
				{ wch: 8 },
				{ wch: 8 },
				{ wch: 16 },
				{ wch: 6 },
				{ wch: 6 },
			];

			const wb = XLSX.utils.book_new();
			XLSX.utils.book_append_sheet(wb, ws, "行动序列");
			XLSX.utils.book_append_sheet(wb, charWs, "角色配置");
			const base64 = XLSX.write(wb, { type: "base64", bookType: "xlsx" });
			const fileName = `action-sequence-${Date.now()}.xlsx`;
			const isWailsRuntime = Boolean(window.go?.main?.App?.SaveFileDialog);
			if (!isWailsRuntime) {
				const binary = atob(base64);
				const bytes = Uint8Array.from(binary, (char) => char.charCodeAt(0));
				const url = URL.createObjectURL(
					new Blob([bytes], {
						type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
					}),
				);
				const download = document.createElement("a");
				download.href = url;
				download.download = fileName;
				download.style.display = "none";
				document.body.append(download);
				download.click();
				download.remove();
				URL.revokeObjectURL(url);
				ctx.setMessage(`已下载 Excel 文件：${fileName}`);
				return;
			}

			const selectedPath = await backendPort.save({
				title: "导出 Excel",
				defaultPath: fileName,
				filters: [{ name: "Excel", extensions: ["xlsx"] }],
			});
			if (!selectedPath) {
				setExporting(false);
				return;
			}
			const filePath = ensureFileExtension(selectedPath, ".xlsx");
			await backendPort.invoke("write_base64_file", {
				path: filePath,
				dataBase64: base64,
			});
			ctx.setMessage(`已导出 Excel 文件：${filePath}`);
		} catch (error) {
			ctx.setMessage(`Excel 导出失败：${getErrorMessage(error)}`);
		} finally {
			setExporting(false);
		}
	}, [
		ctx.actions,
		ctx.resources,
		ctx.resourceValues,
		ctx.characters,
		ctx.skillTargets,
		ctx.odeSelections,
		ctx.memeSelections,
		ctx.setMessage,
		backendPort,
		ctx.characterKinds,
		ctx.memospriteTargets,
	]);

	return (
		<button
			type="button"
			onClick={doExport}
			disabled={exporting}
			className="rounded-lg bg-emerald-600 px-4 py-2 font-medium text-white hover:bg-emerald-500 disabled:cursor-not-allowed disabled:bg-gray-600"
		>
			{exporting ? "生成中..." : "导出 Excel"}
		</button>
	);
}
