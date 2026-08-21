import { useEffect, useRef, useState } from "react";
import { getCharacterCatalog, normalizeName } from "../data/characters";
import { getSpecialActionHint } from "../utils/action-sequence";
import { CharacterAvatar } from "./CharacterAvatar";

const characterOptions = getCharacterCatalog();

export type SelectOption = {
	value: string;
	label: string;
	title?: string;
	className?: string;
};

export function NumberInput({
	label,
	value,
	onChange,
	disabled = false,
	placeholder = "请输入",
	labelClassName = "",
	title,
}: {
	label: string;
	value: string;
	onChange: (value: string) => void;
	disabled?: boolean;
	placeholder?: string;
	labelClassName?: string;
	title?: string;
}) {
	return (
		<label className="block">
			<span className={`mb-1 block text-sm text-gray-300 ${labelClassName}`}>
				{label}
			</span>
			<input
				type="text"
				inputMode="decimal"
				value={value}
				disabled={disabled}
				placeholder={placeholder}
				title={title}
				onChange={(event) => {
					const nextValue = event.target.value;
					if (nextValue === "" || /^\d*\.?\d*$/.test(nextValue)) {
						onChange(nextValue);
					}
				}}
				className="w-full rounded-lg border border-gray-600 bg-gray-700 p-2 text-white placeholder:text-gray-500 focus:outline-none focus:ring-2 focus:ring-blue-500 disabled:cursor-not-allowed disabled:opacity-50"
			/>
		</label>
	);
}

export function TextInput({
	value,
	onChange,
	placeholder,
	disabled = false,
	title,
}: {
	value: string;
	onChange: (value: string) => void;
	placeholder?: string;
	disabled?: boolean;
	title?: string;
}) {
	return (
		<input
			type="text"
			value={value}
			placeholder={placeholder}
			disabled={disabled}
			title={title}
			onChange={(event) => onChange(event.target.value)}
			className="h-10 w-full rounded-lg border border-gray-600 bg-gray-700 px-3 text-white placeholder:text-gray-500 focus:outline-none focus:ring-2 focus:ring-blue-500 disabled:cursor-not-allowed disabled:opacity-50"
		/>
	);
}

export function SelectInput({
	value,
	options,
	onChange,
	disabled = false,
	className = "",
	id,
}: {
	value: string;
	options: SelectOption[];
	onChange: (value: string) => void;
	disabled?: boolean;
	className?: string;
	id?: string;
}) {
	const [isOpen, setIsOpen] = useState(false);
	const selectedOption = options.find((option) => option.value === value);

	return (
		<div className={`relative ${className}`}>
			<button
				type="button"
				id={id}
				disabled={disabled}
				title={selectedOption?.title}
				onClick={() => setIsOpen((prev) => !prev)}
				onBlur={() => window.setTimeout(() => setIsOpen(false), 120)}
				className="flex h-10 w-full items-center justify-between rounded-lg border border-gray-600 bg-gray-700 px-3 text-left text-white transition-colors hover:bg-gray-600 focus:outline-none focus:ring-2 focus:ring-blue-500 disabled:cursor-not-allowed disabled:opacity-50"
			>
				<span className="truncate">{selectedOption?.label ?? value}</span>
				<span className="ml-2 text-xs text-gray-300">▼</span>
			</button>
			{isOpen && !disabled && (
				<div
					className="absolute left-0 right-0 top-12 z-30 overflow-y-auto rounded-lg border border-gray-600 bg-gray-800 p-1 shadow-xl"
					style={{ maxHeight: "20rem" }}
				>
					{options.map((option) => (
						<button
							key={option.value}
							type="button"
							title={option.title}
							onMouseDown={(event) => event.preventDefault()}
							onClick={() => {
								onChange(option.value);
								setIsOpen(false);
							}}
							className={`h-8 w-full truncate rounded-md px-2 text-left text-xs transition-colors ${
								option.value === value
									? "bg-blue-600 text-white"
									: `bg-gray-700 text-gray-200 hover:bg-gray-600 ${option.className ?? ""}`
							}`}
						>
							{option.label}
						</button>
					))}
				</div>
			)}
		</div>
	);
}

export function CharacterNameInput({
	value,
	placeholder,
	onChange,
}: {
	value: string;
	placeholder: string;
	onChange: (value: string) => void;
}) {
	const inputRef = useRef<HTMLInputElement>(null);
	const [draftValue, setDraftValue] = useState(value);
	const [draftHint, setDraftHint] = useState(() => getSpecialActionHint(value));
	const [isOpen, setIsOpen] = useState(false);
	const [activeIndex, setActiveIndex] = useState(0);

	const suggestions = characterOptions
		.filter((character) => {
			const query = normalizeName(draftValue);
			return (
				query === "" ||
				character.names.some((name) => normalizeName(name).includes(query))
			);
		})
		.slice(0, 12);

	useEffect(() => {
		setDraftValue(value);
		setDraftHint(getSpecialActionHint(value));
	}, [value]);

	const updateDraftValue = (nextValue: string) => {
		setDraftValue(nextValue);
		setDraftHint(getSpecialActionHint(nextValue));
		setActiveIndex(0);
		setIsOpen(true);
	};

	const commitValue = () => {
		setDraftHint(getSpecialActionHint(draftValue));
		setIsOpen(false);
		if (draftValue !== value) {
			onChange(draftValue);
		}
	};

	const selectSuggestion = (name: string) => {
		setDraftValue(name);
		setDraftHint(getSpecialActionHint(name));
		setIsOpen(false);
		if (name !== value) onChange(name);
	};

	return (
		<div className="relative">
			<div className="grid grid-cols-[minmax(0,1fr)_64px] gap-2">
				<input
					ref={inputRef}
					type="text"
					value={draftValue}
					placeholder={placeholder}
					autoComplete="off"
					onFocus={() => setIsOpen(true)}
					onBlur={() => window.setTimeout(() => setIsOpen(false), 120)}
					onChange={(event) => updateDraftValue(event.target.value)}
					onKeyDown={(event) => {
						if (event.key === "ArrowDown" && suggestions.length > 0) {
							event.preventDefault();
							setActiveIndex((index) =>
								Math.min(index + 1, suggestions.length - 1),
							);
						} else if (event.key === "ArrowUp" && suggestions.length > 0) {
							event.preventDefault();
							setActiveIndex((index) => Math.max(index - 1, 0));
						} else if (event.key === "Enter") {
							event.preventDefault();
							if (isOpen && suggestions[activeIndex]) {
								selectSuggestion(suggestions[activeIndex].names[0]);
							} else {
								commitValue();
							}
						} else if (event.key === "Escape") {
							setIsOpen(false);
						}
					}}
					className={`h-10 w-full rounded-lg border px-3 text-white placeholder:text-gray-500 focus:outline-none focus:ring-2 ${
						draftHint
							? "border-[#fbbf2499] bg-[#78350f66] focus:ring-amber-400"
							: "border-gray-600 bg-gray-700 focus:ring-blue-500"
					}`}
				/>
				<button
					type="button"
					onClick={commitValue}
					className="h-10 whitespace-nowrap rounded-lg border border-gray-600 bg-gray-800 px-2 text-xs font-medium text-gray-200 hover:bg-gray-700"
				>
					确定
				</button>
			</div>
			{isOpen && suggestions.length > 0 && (
				<div
					className="absolute left-0 right-[68px] top-12 z-40 max-h-72 overflow-y-auto rounded-lg border border-gray-600 bg-gray-900 p-1 shadow-2xl"
					role="listbox"
					aria-label="角色候选"
				>
					{suggestions.map((character, index) => (
						<button
							key={character.cid}
							type="button"
							role="option"
							aria-selected={index === activeIndex}
							onMouseDown={(event) => event.preventDefault()}
							onMouseEnter={() => setActiveIndex(index)}
							onClick={() => selectSuggestion(character.names[0])}
							className={`flex w-full items-center gap-2 rounded-md px-2 py-1.5 text-left transition-colors ${index === activeIndex ? "bg-blue-700/70 text-white" : "text-gray-200 hover:bg-gray-700"}`}
						>
							<CharacterAvatar
								cid={character.cid}
								alt={character.names[0]}
								className="h-8 w-8 shrink-0"
							/>
							<span className="min-w-0 flex-1">
								<span className="block truncate text-sm font-medium">
									{character.names[0]}
								</span>
								{character.names.length > 1 && (
									<span className="block truncate text-xs text-gray-400">
										{character.names.slice(1, 3).join("、")}
									</span>
								)}
							</span>
						</button>
					))}
				</div>
			)}
			{draftHint && (
				<div className="mt-1 truncate text-xs text-amber-100" title={draftHint}>
					{draftHint}
				</div>
			)}
		</div>
	);
}

export function Toggle({
	label,
	checked,
	onChange,
	className = "",
}: {
	label: string;
	checked: boolean;
	onChange: () => void;
	className?: string;
}) {
	return (
		<button
			type="button"
			role="switch"
			aria-checked={checked}
			onClick={onChange}
			className={`rounded-lg border px-3 py-2 text-sm transition-colors ${className} ${
				checked
					? "border-[#3b82f680] bg-[#1e3a8a66] text-blue-100"
					: "border-gray-600 bg-gray-700 text-gray-300 hover:bg-gray-600"
			}`}
		>
			{label}
		</button>
	);
}
