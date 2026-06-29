import React from "react";
import ReactDOM from "react-dom/client";
import ActionSequence from "./pages/ActionSequence";
import "./index.css";

// 根据屏幕分辨率自适应根字体大小，解决 Wayland scale=1 下字体过小的问题
(function adjustFontSize() {
	document.documentElement.style.fontSize = `16px`;
	// 判断是否为linux，若为linux则自适应增大字体大小
	if (navigator.userAgent.toLowerCase().includes("linux")) {
		const screenWidth = window.screen.width;
		const screenHeight = window.screen.height;
		const scaleFactor = Math.min(screenWidth / 1920, screenHeight / 1080);
		const newFontSize = Math.max(16, 16 * scaleFactor);
		document.documentElement.style.fontSize = `${newFontSize}px`;
	}
})();

// 全局禁用右键菜单（保留自定义右键处理）
window.addEventListener("contextmenu", (event) => event.preventDefault());

const rootElement = document.getElementById("root");
if (!rootElement) throw new Error("Root element not found");
ReactDOM.createRoot(rootElement).render(
	<React.StrictMode>
		<div className="min-h-screen bg-gray-900 text-white">
			<main className="p-2">
				<ActionSequence />
			</main>
		</div>
	</React.StrictMode>,
);
