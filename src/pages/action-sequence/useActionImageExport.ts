import { useRef, useState } from "react";
import { domToPng } from "modern-screenshot";
import { invoke, save } from "../../utils/backend";
import {
	ensureFileExtension,
	getErrorMessage,
	getTimestampedFileName,
} from "../../utils/actionSequence";

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
					overflowX: "visible",
					width: `${exportWidth}px`,
				},
				onCloneNode: (cloned) => {
					if (!(cloned instanceof HTMLElement)) return;
					cloned.style.overflowX = "visible";
					cloned.style.width = `${exportWidth}px`;
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
						replacement.style.height = "32px";
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
