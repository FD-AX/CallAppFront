import React, { useEffect, useMemo, useState } from "react";
import CommunicationsList from "./CommunicationsList";
import Billing from "./Billing";

// .env:
// VITE_API_URL=http://localhost:8080
// VITE_AUTH_TOKEN=agent_api_key_24
const API_URL = import.meta.env.VITE_API_URL || "http://localhost:8080";
const AUTH_TOKEN = import.meta.env.VITE_AUTH_TOKEN || "agent_api_key_24";
const AUTH_HEADER = { Authorization: `Bearer ${AUTH_TOKEN}` };

export default function App() {
  // ----- ТЕМА -----
  const [theme, setTheme] = useState(() => {
    const saved = localStorage.getItem("theme");
    if (saved === "light" || saved === "dark") return saved;
    // по умолчанию тёмная
    return "dark";
  });

  useEffect(() => {
    localStorage.setItem("theme", theme);
    // меняем класс на <html>, чтобы можно было накинуть свои стили при желании
    document.documentElement.dataset.theme = theme; // data-theme="dark|light"
  }, [theme]);

  const isDark = theme === "dark";

  // ----- ВКЛАДКИ -----
  const [tab, setTab] = useState("chat"); // "chat" | "billing"

  // шапка
  const headerClass =
    (isDark ? "bg-gray-800 text-white" : "bg-white text-gray-900") +
    " border-b " +
    (isDark ? "border-gray-700" : "border-gray-200");

  const tabButton = (name, label) => {
    const active = tab === name;
    const base =
      "px-3 py-2 rounded-lg text-sm font-medium transition-colors";
    const cls = active
      ? isDark
        ? "bg-blue-600 text-white"
        : "bg-blue-600 text-white"
      : isDark
        ? "text-gray-300 hover:bg-gray-700"
        : "text-gray-700 hover:bg-gray-100";
    return (
      <button key={name} onClick={() => setTab(name)} className={`${base} ${cls}`}>
        {label}
      </button>
    );
  };

  return (
    <div className={isDark ? "bg-gray-900 text-white" : "bg-gray-50 text-gray-900"}>
      {/* Header */}
      <div className={`${headerClass} sticky top-0 z-30`}>
        <div className="max-w-6xl mx-auto px-4 py-3 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <span className="font-semibold">Inbox</span>
            <span className="opacity-60">/</span>
            <span className="opacity-80">Console</span>
          </div>

          <div className="flex items-center gap-2">
            {tabButton("chat", "Сообщения")}
            {tabButton("billing", "Оплата")}
            <div className="w-px h-6 mx-2" style={{ background: isDark ? "#374151" : "#E5E7EB" }} />
            <ThemeToggle theme={theme} setTheme={setTheme} />
          </div>
        </div>
      </div>

      {/* Content */}
      {tab === "chat" ? (
        <CommunicationsList
          API_URL={API_URL}
          AUTH_HEADER={AUTH_HEADER}
          theme={theme}
        />
      ) : (
        <Billing
          API_URL={API_URL}
          AUTH_HEADER={AUTH_HEADER}
          theme={theme}
        />
      )}
    </div>
  );
}

function ThemeToggle({ theme, setTheme }) {
  const isDark = theme === "dark";
  const btnCls =
    "inline-flex items-center gap-2 px-3 py-2 rounded-lg text-sm transition-colors " +
    (isDark ? "bg-gray-700 hover:bg-gray-600 text-white"
            : "bg-gray-100 hover:bg-gray-200 text-gray-800");

  return (
    <button
      className={btnCls}
      onClick={() => setTheme(isDark ? "light" : "dark")}
      title="Переключить тему"
    >
      <span
        className={
          "inline-block w-4 h-4 rounded " +
          (isDark ? "bg-yellow-300" : "bg-gray-900")
        }
      />
      {isDark ? "Тёмная" : "Светлая"}
    </button>
  );
}
