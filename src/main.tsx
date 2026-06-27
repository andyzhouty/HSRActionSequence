import React from "react";
import ReactDOM from "react-dom/client";
import ActionSequence from "./pages/ActionSequence";
import "./index.css";

ReactDOM.createRoot(document.getElementById("root")!).render(
  <React.StrictMode>
    <div className="min-h-screen bg-gray-900 text-white">
      <main className="p-4">
        <ActionSequence />
      </main>
    </div>
  </React.StrictMode>,
);
