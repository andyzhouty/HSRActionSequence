import { useEffect, useRef, useState } from "react";
import { getSpecialActionHint } from "../utils/actionSequence";

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
	const [draftHint, setDraftHint] = useState(() => getSpecialActionHint(value));

	useEffect(() => {
		if (inputRef.current) {
			inputRef.current.value = value;
			setDraftHint(getSpecialActionHint(value));
		}
	}, [value]);

	const commitValue = () => {
		const nextValue = inputRef.current?.value ?? "";
		setDraftHint(getSpecialActionHint(nextValue));
		if (nextValue !== value) {
			onChange(nextValue);
		}
	};

	return (
		<div>
			<div className="grid grid-cols-[minmax(0,1fr)_64px] gap-2">
				<input
					ref={inputRef}
					type="text"
					defaultValue={value}
					placeholder={placeholder}
					onKeyDown={(event) => {
						if (event.key === "Enter") {
							commitValue();
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
