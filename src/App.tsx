import { useState } from "react";
import ActionPage from "./pages/ActionSequence";
import Guide from "./pages/Guide";

function App() {
	const [page, setPage] = useState<"action-sequence" | "guide">(
		"action-sequence",
	);
	return page === "guide" ? (
		<Guide onBack={() => setPage("action-sequence")} />
	) : (
		<ActionPage onOpenGuide={() => setPage("guide")} />
	);
}

export default App;
