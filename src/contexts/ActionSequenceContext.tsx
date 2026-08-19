import { createContext, type ReactNode, useContext } from "react";
import type {
	ActionSequenceCommandsContextValue,
	ActionSequenceContextType,
	ActionSequenceDerivedState,
	ActionSequenceUiContextValue,
	SavedDataContextValue,
} from "./actionSequenceTypes";

export type { ActionSequenceContextType } from "./actionSequenceTypes";

export const SavedDataCtx = createContext<SavedDataContextValue | null>(null);
export const ActionSequenceUiCtx =
	createContext<ActionSequenceUiContextValue | null>(null);
export const ActionSequenceDerivedCtx =
	createContext<ActionSequenceDerivedState | null>(null);
export const ActionSequenceCommandsCtx =
	createContext<ActionSequenceCommandsContextValue | null>(null);

export function ActionSequenceProviders({
	value,
	children,
}: {
	value: ActionSequenceContextType;
	children: ReactNode;
}) {
	return (
		<SavedDataCtx.Provider value={value}>
			<ActionSequenceUiCtx.Provider value={value}>
				<ActionSequenceDerivedCtx.Provider value={value}>
					<ActionSequenceCommandsCtx.Provider value={value}>
						{children}
					</ActionSequenceCommandsCtx.Provider>
				</ActionSequenceDerivedCtx.Provider>
			</ActionSequenceUiCtx.Provider>
		</SavedDataCtx.Provider>
	);
}

export function useActionSequence(): ActionSequenceContextType {
	const savedData = useSavedDataContext();
	const ui = useActionSequenceUiContext();
	const derived = useActionSequenceDerivedContext();
	const commands = useActionSequenceCommandsContext();
	return { ...savedData, ...ui, ...derived, ...commands };
}

export function useSavedDataContext(): SavedDataContextValue {
	const ctx = useContext(SavedDataCtx);
	if (!ctx) throw new Error("useSavedDataContext 必须在排轴页面上下文中使用");
	return ctx;
}

export function useActionSequenceUiContext(): ActionSequenceUiContextValue {
	const ctx = useContext(ActionSequenceUiCtx);
	if (!ctx)
		throw new Error("useActionSequenceUiContext 必须在排轴页面上下文中使用");
	return ctx;
}

export function useActionSequenceDerivedContext(): ActionSequenceDerivedState {
	const ctx = useContext(ActionSequenceDerivedCtx);
	if (ctx) return ctx;
	throw new Error("useActionSequenceDerivedContext 必须在排轴页面上下文中使用");
}

export function useActionSequenceCommandsContext(): ActionSequenceCommandsContextValue {
	const ctx = useContext(ActionSequenceCommandsCtx);
	if (!ctx)
		throw new Error(
			"useActionSequenceCommandsContext 必须在排轴页面上下文中使用",
		);
	return ctx;
}
