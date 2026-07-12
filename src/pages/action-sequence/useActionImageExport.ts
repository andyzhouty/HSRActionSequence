import { domToPng } from "modern-screenshot";
import { useRef, useState } from "react";
import {
	ensureFileExtension,
	getErrorMessage,
	getTimestampedFileName,
} from "../../utils/actionSequence";
import { invoke, save } from "../../utils/backend";

type UseActionImageExportParams = {
	actionCount: number;
	resources: string[];
	setMessage: (message: string) => void;
};

export function useActionImageExport({
	actionCount,
	setMessage,
}: UseActionImageExportParams) {
	const [isExportingImage, setIsExportingImage] = useState(false);
	const imageExportRef = useRef<HTMLDivElement>(null);

	const exportImage = async () => {
		if (!imageExportRef.current) return;
		if (actionCount > 100) {
			setMessage("当前行动数超过 100，已锁定图片导出以避免图片过大");
			return;
		}

		try {
			setIsExportingImage(true);
			setMessage("正在生成行动序列图片...");

			const target = imageExportRef.current;
			const exportPadding = 32;
			const cleanColor = (css: string) =>
				css.replace(/oklch\([^)]*\)|oklab\([^)]*\)/gi, "rgba(0,0,0,0)");
			const exportWidth = Math.ceil(target.scrollWidth);
			const dataUrl = await domToPng(target, {
				backgroundColor: "#1f2937",
				scale: Math.min(window.devicePixelRatio || 1, 2),
				width: exportWidth,
				height: target.scrollHeight + exportPadding,
				style: {
					boxSizing: "border-box",
					paddingBottom: `${exportPadding}px`,
					overflow: "visible",
					width: `${exportWidth}px`,
				},
				onCloneNode: (cloned) => {
					if (!(cloned instanceof HTMLElement)) return;
					// 图片导出时注入展开的欢愉技行（不影响页面实际状态）
					const elationData = cloned.getAttribute("data-elation-skills");
					if (elationData) {
						cloned.removeAttribute("data-elation-skills");
						try {
							const skillsMap: Record<
								string,
								{
									id: string;
									name: string;
									av: number;
									resources: Record<string, string>;
								}[]
							> = JSON.parse(elationData);
							cloned
								.querySelectorAll<HTMLTableRowElement>("tr[data-action-key]")
								.forEach((tr) => {
									const ahaKey = tr.dataset.actionKey;
									if (!ahaKey || !skillsMap[ahaKey]) return;
									const skills = skillsMap[ahaKey];
									skills.forEach((es) => {
										const resourceCells =
											tr.querySelectorAll("td").length > 4
												? Object.entries(es.resources)
														.map(
															([, val]) =>
																`<td style="white-space:nowrap;padding:0.5rem"><div style="display:flex;align-items:center;box-sizing:border-box;border-radius:0.5rem;border:1px solid #4b5563;background:#374151;color:#fff;height:40px;padding:0 0.5rem;white-space:nowrap">${val}</div></td>`,
														)
														.join("")
												: Array.from(
														{
															length: Math.max(
																0,
																tr.querySelectorAll("td").length - 4,
															),
														},
														() =>
															'<td style="white-space:nowrap;padding:0.5rem"></td>',
													).join("");
										const esRow = document.createElement("tr");
										esRow.style.backgroundColor = "#9a341210";
										esRow.innerHTML = [
											`<td style="width:3rem;min-width:3rem;max-width:3rem;white-space:nowrap;padding:0.5rem;text-align:center;font-size:0.75rem;color:#fb923c99">ES</td>`,
											`<td style="width:1%;max-width:8rem;white-space:nowrap;padding:0.5rem 0.75rem"><div style="overflow:hidden;text-overflow:ellipsis;white-space:nowrap;font-size:0.875rem;font-weight:500;color:#fed7aacc">${es.name}</div></td>`,
											`<td style="white-space:nowrap;padding:0.5rem;text-align:center;font-size:0.75rem;color:#fdba7499">${es.av.toFixed(2)}</td>`,
											`<td style="white-space:nowrap;padding:0.5rem"><span style="border-radius:0.25rem;background:#f9731620;padding:0.125rem 0.375rem;font-family:monospace;font-size:0.75rem;font-weight:700;color:#fdba74">ES</span></td>`,
											resourceCells,
										].join("");
										tr.after(esRow);
									});
								});
						} catch {
							/* JSON parse error, skip */
						}
					}
					// 导出宽度已扩展到完整表格，不能保留页面用的横向滚动容器。
					cloned.classList.remove("overflow-x-auto");
					cloned.style.setProperty("overflow", "visible", "important");
					cloned.style.setProperty("overflow-x", "visible", "important");
					cloned.style.setProperty("overflow-y", "visible", "important");
					cloned.style.setProperty("scrollbar-width", "none", "important");
					cloned.style.setProperty("-ms-overflow-style", "none", "important");
					cloned.style.width = `${exportWidth}px`;
					const hideScrollbarStyle = document.createElement("style");
					hideScrollbarStyle.textContent =
						"* { scrollbar-width: none !important; } *::-webkit-scrollbar { display: none !important; }";
					cloned.prepend(hideScrollbarStyle);
					cloned.querySelectorAll("style").forEach((style) => {
						style.textContent = cleanColor(style.textContent);
					});
					cloned.querySelectorAll("input").forEach((input) => {
						const inputElement = input as HTMLInputElement;
						const replacement = document.createElement("div");
						const isSkillInput = inputElement.classList.contains("font-bold");
						const isActionValue =
							inputElement.classList.contains("font-mono") && !isSkillInput;
						const isDomainSkill =
							inputElement.dataset.exportKind === "domain-skill";
						const parentTd = inputElement.closest("td");
						const isResourceInput =
							!isActionValue &&
							!isDomainSkill &&
							!isSkillInput &&
							parentTd?.cellIndex !== undefined &&
							parentTd.cellIndex >= 4;
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
						replacement.style.fontSize = isSkillInput ? "0.875rem" : "inherit";
						replacement.style.fontWeight = isDomainSkill
							? "700"
							: isSkillInput
								? "700"
								: "400";
						replacement.style.justifyContent =
							isDomainSkill || isSkillInput ? "center" : "flex-start";
						replacement.style.fontFamily =
							isActionValue || isSkillInput
								? '"Inconsolata Nerd Font", monospace'
								: "inherit";
						// 与技能栏的 h-10 按钮、选择器保持一致。
						replacement.style.height = "40px";
						replacement.style.lineHeight = "1";
						replacement.style.padding = isDomainSkill
							? "0 4px"
							: isSkillInput
								? "0 4px"
								: "0 8px";
						replacement.style.whiteSpace = "nowrap";
						replacement.style.width = isDomainSkill
							? "32px"
							: isSkillInput
								? "40px"
								: isActionValue
									? "72px"
									: isResourceInput
										? "100%"
										: "80px";
						if (isResourceInput) {
							replacement.style.flexShrink = "0";
						}
						inputElement.replaceWith(replacement);
					});
					cloned.querySelectorAll(".truncate").forEach((element) => {
						const exportText = element as HTMLElement;
						exportText.style.overflow = "visible";
						exportText.style.textOverflow = "clip";
						exportText.style.whiteSpace = "nowrap";
						exportText.style.maxWidth = "none";
					});
				},
			});
			const fileName = getTimestampedFileName("action-sequence", ".png");
			const isWailsRuntime = Boolean(window.go?.main?.App?.SaveFileDialog);
			if (!isWailsRuntime) {
				const download = document.createElement("a");
				download.href = dataUrl;
				download.download = fileName;
				download.style.display = "none";
				document.body.append(download);
				download.click();
				download.remove();
				setMessage(`已下载行动序列图片：${fileName}`);
				return;
			}

			const selectedPath = await save({
				title: "导出行动序列图片",
				defaultPath: fileName,
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
				dataUrl,
			});
			setMessage(`已导出行动序列图片：${filePath}`);
		} catch (error) {
			setMessage(`图片导出失败：${getErrorMessage(error)}`);
		} finally {
			setIsExportingImage(false);
		}
	};

	return {
		imageExportRef,
		isExportingImage,
		setIsExportingImage,
		exportImage,
	};
}
