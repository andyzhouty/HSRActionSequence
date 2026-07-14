import { useEffect, useRef, useState } from "react";

/**
 * 资源名只会影响表头与资源映射，不需要在每个按键时重算行动轴。
 * 保留本地草稿，失焦或回车时再提交给保存状态。
 */
export function ResourceNameInput({
	value,
	onCommit,
	disabled = false,
	title,
}: {
	value: string;
	onCommit: (value: string) => void;
	disabled?: boolean;
	title?: string;
}) {
	const [draft, setDraft] = useState(value);
	const isFocused = useRef(false);

	useEffect(() => {
		if (!isFocused.current) setDraft(value);
	}, [value]);

	const commit = () => {
		isFocused.current = false;
		if (draft !== value) onCommit(draft);
	};

	return (
		<input
			type="text"
			value={draft}
			placeholder="资源名称"
			disabled={disabled}
			title={title}
			onFocus={() => {
				isFocused.current = true;
			}}
			onChange={(event) => setDraft(event.target.value)}
			onBlur={commit}
			onKeyDown={(event) => {
				if (event.key === "Enter") event.currentTarget.blur();
				if (event.key === "Escape") {
					setDraft(value);
					event.currentTarget.blur();
				}
			}}
			className="h-10 w-full rounded-lg border border-gray-600 bg-gray-700 px-3 text-white placeholder:text-gray-500 focus:outline-none focus:ring-2 focus:ring-blue-500 disabled:cursor-not-allowed disabled:opacity-50"
		/>
	);
}
