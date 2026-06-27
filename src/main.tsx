import React from "react";
import ReactDOM from "react-dom/client";
import ActionSequence from "./pages/ActionSequence";
import "./index.css";

// 根据屏幕分辨率自适应根字体大小，解决 Wayland scale=1 下字体过小的问题
(function adjustFontSize() {
	const dpr = window.devicePixelRatio || 1;
	const widthRatio = window.screen.width / 1920;
	// 仅在屏幕显著大于 1920 时温和提升字体
	const boost = widthRatio > 1.2 ? Math.min(0.2, (widthRatio - 1) * 0.3) : 0;
	const scale = Math.max(dpr, 1 + boost);
	const clamped = Math.min(1.2, Math.max(1, scale));
	document.documentElement.style.fontSize = `${Math.round(16 * clamped)}px`;
})();

// 全局禁用右键菜单（保留自定义右键处理）
window.addEventListener("contextmenu", (event) => event.preventDefault());

ReactDOM.createRoot(document.getElementById("root")!).render(
	<React.StrictMode>
		<div className="min-h-screen bg-gray-900 text-white">
			<main className="p-2">
				<ActionSequence />
			</main>
		</div>
	</React.StrictMode>,
);
