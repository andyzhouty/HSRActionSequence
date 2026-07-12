import { useCallback, useState } from "react";
import * as XLSX from "xlsx";
import { useActionSequence } from "../../contexts/ActionSequenceContext";
import type { UltInterrupt } from "../../utils/actionSequence";
import {
	ensureFileExtension,
	formatActionValue,
	getCharacterPath,
	getErrorMessage,
	isAllyTarget,
} from "../../utils/actionSequence";
import { invoke, save } from "../../utils/backend";

export default function ExportExcelButton() {
	const ctx = useActionSequence();
	const [exporting, setExporting] = useState(false);

	const doExport = useCallback(async () => {
		if (ctx.actions.length === 0) {
			ctx.setMessage("没有行动数据可导出");
			return;
		}
		try {
			setExporting(true);

			// 行动序列 sheet
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
					const odeTargetName =
						ctx.characterNames[odeSelection.targetId] ?? odeSelection.targetId;
					skillDisplay = `${a.skill}→${odeTargetName}`;
				} else if (skillTargetId) {
					skillDisplay = `${a.skill}→${ctx.characterNames[skillTargetId] ?? skillTargetId}`;
				} else if (memeTargetId) {
					skillDisplay = `${a.skill}→${ctx.characterNames[memeTargetId] ?? memeTargetId}`;
				}
				const row: (string | number)[] = [
					i + 1,
					a.displayName ?? ctx.characterNames[a.characterId] ?? a.characterId,
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

			// ── 角色配置 sheet ──
			// 辅助：按角色 ID 前缀过滤覆盖表
			const prefixFor = (charId: string) => `${charId}-`;
			const filterEntries = <T,>(
				rec: Record<string, T>,
				prefix: string,
			): [string, T][] =>
				Object.entries(rec)
					.filter(([k]) => k.startsWith(prefix))
					.sort(([a], [b]) => a.localeCompare(b));
			// 从 action key 中提取动数显示文本
			const actionLabel = (key: string, charId: string): string => {
				const tail = key.slice(prefixFor(charId).length);
				const domainMatch = tail.match(/^domain-(\d+)/);
				if (domainMatch) return `境界${Number(domainMatch[1]) + 1}`;
				const interruptMatch = tail.match(/^interrupt-(\d+)/);
				if (interruptMatch) return `插队#${Number(interruptMatch[1]) + 1}`;
				const no = Number.parseInt(tail, 10);
				return Number.isFinite(no) && no > 0 ? `第${no}动` : tail;
			};
			// 格式化覆盖项列表为可读文本
			const formatEntries = <T,>(
				entries: [string, T][],
				charId: string,
				format: (v: T) => string,
			) =>
				entries
					.map(([k, v]) => `${actionLabel(k, charId)}:${format(v)}`)
					.join("; ");

			const charHeader = [
				"序号",
				"角色",
				"类型",
				"速度",
				"基础速度",
				"翁瓦克",
				"风套",
				"舞舞舞",
				"一魂",
				"命途",
				"速度调整",
				"技能覆盖",
				"行动值覆盖",
				"技能目标",
				"默认技能目标",
				"诗篇选择",
				"迷迷拉条",
				"插队大招",
			];
			const charRows = ctx.characters.map((c, i) => {
				const pf = prefixFor(c.id);
				// 速度调整 key 也是 action key
				const speedAdjEntries = filterEntries(ctx.speedAdjustments, pf);
				const skillOvEntries = filterEntries(ctx.skillOverrides, pf);
				const ovEntries = filterEntries(ctx.overrides, pf);
				const svEntries = filterEntries(ctx.skillTargets, pf);
				const odeEntries = filterEntries(ctx.odeSelections, pf);
				const memeEntries = filterEntries(ctx.memeSelections, pf);
				const interruptEntries = filterEntries(ctx.ultInterrupts, pf);
				return [
					i + 1,
					c.name,
					c.kind,
					c.speed,
					c.baseSpeed,
					c.hasVonwacq ? "是" : "否",
					c.hasWindSet ? "是" : "否",
					c.hasDance ? "是" : "否",
					c.eidolon >= 1 ? "是" : "否",
					getCharacterPath(c.name) ?? "",
					formatEntries(speedAdjEntries, c.id, (v) =>
						v.mode === "absolute" ? `${v.value}` : `${v.value}%`,
					),
					formatEntries(skillOvEntries, c.id, (v) => v),
					formatEntries(ovEntries, c.id, (v) => v),
					formatEntries(svEntries, c.id, (v) => ctx.characterNames[v] ?? v),
					ctx.defaultSkillTargets[c.id] ?? "",
					formatEntries(odeEntries, c.id, (v) =>
						v.odeCode === "generic"
							? `通用→${ctx.characterNames[v.targetId] ?? v.targetId}`
							: `${v.odeCode}→${ctx.characterNames[v.targetId] ?? v.targetId}`,
					),
					formatEntries(memeEntries, c.id, (v) => ctx.characterNames[v] ?? v),
					formatEntries(interruptEntries, c.id, (arr) =>
						(arr as UltInterrupt[])
							.map(
								(u) => `${u.casterId}(${u.timing === "before" ? "前" : "后"})`,
							)
							.join(","),
					),
				];
			});
			const charWs = XLSX.utils.aoa_to_sheet([charHeader, ...charRows]);
			charWs["!cols"] = [
				{ wch: 6 },
				{ wch: 12 },
				{ wch: 6 },
				{ wch: 8 },
				{ wch: 8 },
				{ wch: 6 },
				{ wch: 6 },
				{ wch: 6 },
				{ wch: 6 },
				{ wch: 10 },
				{ wch: 24 },
				{ wch: 24 },
				{ wch: 24 },
				{ wch: 24 },
				{ wch: 16 },
				{ wch: 24 },
				{ wch: 20 },
				{ wch: 24 },
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

			const selectedPath = await save({
				title: "导出 Excel",
				defaultPath: fileName,
				filters: [{ name: "Excel", extensions: ["xlsx"] }],
			});
			if (!selectedPath) {
				setExporting(false);
				return;
			}
			const filePath = ensureFileExtension(selectedPath, ".xlsx");
			await invoke("write_base64_file", {
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
		ctx.characterNames,
		ctx.resources,
		ctx.resourceValues,
		ctx.characters,
		ctx.speedAdjustments,
		ctx.skillOverrides,
		ctx.overrides,
		ctx.skillTargets,
		ctx.defaultSkillTargets,
		ctx.odeSelections,
		ctx.memeSelections,
		ctx.ultInterrupts,
		ctx.setMessage,
		ctx.characterKinds,
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
