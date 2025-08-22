import React, { useEffect, useMemo, useState } from "react";
import CommunicationsList from "./CommunicationsList";
import Billing from "./Billing";

// .env:
// VITE_API_URL=http://localhost:8080
// VITE_AUTH_TOKEN=agent_api_key_24
const API_URL = import.meta.env.VITE_API_URL || "http://localhost:8080";
const AUTH_TOKEN = import.meta.env.VITE_AUTH_TOKEN || "agent_api_key_23";
const AUTH_HEADER = { Authorization: `Bearer ${AUTH_TOKEN}` };
const EMPLOYEE_USERNAME =
  import.meta.env.VITE_EMPLOYEE_USERNAME || "Agent_011";

export default function App() {
  // ----- ТЕМА -----
  const [theme, setTheme] = useState(() => {
    const saved = localStorage.getItem("theme");
    if (saved === "light" || saved === "dark") return saved;
    return "dark";
  });

  useEffect(() => {
    localStorage.setItem("theme", theme);
    document.documentElement.dataset.theme = theme;
  }, [theme]);

  const isDark = theme === "dark";

  // ----- ВКЛАДКИ -----
  const [tab, setTab] = useState("chat"); // "chat" | "billing"

  // ----- CALL (одна кнопка + модалка с одним полем номера) -----
  const [showCall, setShowCall] = useState(false);
  const [callPhone, setCallPhone] = useState("");

  const normPhone = (p) => p.replace(/[^\d+]/g, "").trim();
  const isPhoneValid = (p) => /^\+?\d{7,20}$/.test(normPhone(p));

  const sendCall = async () => {
    const phone = normPhone(callPhone);
    if (!isPhoneValid(phone)) {
      alert("Укажи корректный номер (например, +19009009090)");
      return;
    }
    try {
      await fetch(`${API_URL}/call`, {
        method: "POST",
        headers: { "Content-Type": "application/json", ...AUTH_HEADER },
        body: JSON.stringify({
          employee_username: EMPLOYEE_USERNAME,
          lead_phone: phone,
          // по требованию — текст HARDCODED
          message: "hi",
        }),
      });
      setShowCall(false);
      setCallPhone("");
      alert("Call отправлен");
    } catch (e) {
      alert(e.message || "Не удалось отправить звонок");
    }
  };

  // --- UI helpers ---
  const headerClass =
    (isDark ? "bg-gray-800 text-white" : "bg-white text-gray-900") +
    " border-b " +
    (isDark ? "border-gray-700" : "border-gray-200");

  const tabButton = (name, label) => {
    const active = tab === name;
    const base = "px-3 py-2 rounded-lg text-sm font-medium transition-colors";
    const cls = active
      ? "bg-blue-600 text-white"
      : isDark
      ? "text-gray-300 hover:bg-gray-700"
      : "text-gray-700 hover:bg-gray-100";
    return (
      <button key={name} onClick={() => setTab(name)} className={`${base} ${cls}`}>
        {label}
      </button>
    );
  };

  const callBtnCls =
    "px-3 py-2 rounded-lg text-sm font-medium transition-colors " +
    (isDark ? "bg-green-700 hover:bg-green-600 text-white"
            : "bg-green-600 hover:bg-green-500 text-white");

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
            {/* ← Кнопка CALL слева от «Сообщения» */}
            <button
              onClick={() => setShowCall(true)}
              className={callBtnCls}
              title="Позвонить (текст: hi)"
            >
              📞 Call
            </button>

            {tabButton("chat", "Сообщения")}
            {tabButton("billing", "Оплата")}
            <div
              className="w-px h-6 mx-2"
              style={{ background: isDark ? "#374151" : "#E5E7EB" }}
            />
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
        <Billing API_URL={API_URL} AUTH_HEADER={AUTH_HEADER} theme={theme} />
      )}

      {/* Модалка: только ввод номера, watermark +19009009090, текст = "hi" харкодом */}
      {showCall && (
        <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center">
          <div className="absolute inset-0 bg-black/40" onClick={() => setShowCall(false)} />
          <div
            className={
              "relative w-full sm:w-[520px] mx-auto rounded-t-2xl sm:rounded-2xl p-4 sm:p-6 overflow-hidden " +
              (isDark ? "bg-gray-800 text-white" : "bg-white text-gray-900")
            }
          >
            {/* водяной знак-подсказка */}
            <div className="pointer-events-none absolute inset-0 flex items-center justify-center opacity-10 select-none">
              <div className="text-5xl font-bold tracking-wider">+19009009090</div>
            </div>

            <div className="relative">
              <div className="flex items-center justify-between">
                <h3 className="text-lg font-semibold">Call</h3>
                <button
                  onClick={() => setShowCall(false)}
                  className={isDark ? "p-2 rounded hover:bg-gray-700" : "p-2 rounded hover:bg-gray-100"}
                >
                  ✕
                </button>
              </div>

              <div className="mt-3 space-y-3">
                <div>
                  <label className={isDark ? "block text-sm text-gray-300 mb-1" : "block text-sm text-gray-700 mb-1"}>
                    Номер телефона
                  </label>
                  <input
                    type="tel"
                    value={callPhone}
                    onChange={(e) => setCallPhone(e.target.value)}
                    placeholder="+19009009090"
                    className={
                      "w-full px-3 py-2 rounded-lg border focus:outline-none " +
                      (isDark
                        ? "bg-gray-700 text-white border-gray-600 focus:border-blue-500"
                        : "bg-white text-gray-900 border-gray-300 focus:border-blue-500")
                    }
                  />
                </div>

                <div className={isDark ? "text-xs text-gray-400" : "text-xs text-gray-600"}>
                  Текст передаётся как <code>hi</code> по умолчанию.
                </div>
              </div>

              <div className="mt-4 flex items-center justify-end gap-2">
                <button
                  onClick={() => setShowCall(false)}
                  className={isDark ? "px-3 py-2 rounded-lg bg-gray-700 hover:bg-gray-600" : "px-3 py-2 rounded-lg bg-gray-100 hover:bg-gray-200"}
                >
                  Отмена
                </button>
                <button
                  onClick={sendCall}
                  className="px-4 py-2 rounded-lg bg-green-600 text-white hover:bg-green-700"
                >
                  Позвонить
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

function ThemeToggle({ theme, setTheme }) {
  const isDark = theme === "dark";
  const btnCls =
    "inline-flex items-center gap-2 px-3 py-2 rounded-lg text-sm transition-colors " +
    (isDark ? "bg-gray-700 hover:bg-gray-600 text-white" : "bg-gray-100 hover:bg-gray-200 text-gray-800");

  return (
    <button className={btnCls} onClick={() => setTheme(isDark ? "light" : "dark")} title="Переключить тему">
      <span className={"inline-block w-4 h-4 rounded " + (isDark ? "bg-yellow-300" : "bg-gray-900")} />
      {isDark ? "Тёмная" : "Светлая"}
    </button>
  );
}