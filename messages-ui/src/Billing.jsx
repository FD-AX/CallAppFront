import React, { useEffect, useState } from "react";

export default function Billing({ API_URL, AUTH_HEADER, theme }) {
  const isDark = theme === "dark";
  const [balance, setBalance] = useState(null);
  const [tx, setTx] = useState([]);
  const [loading, setLoading] = useState(false);
  const [err, setErr] = useState("");
  const [amount, setAmount] = useState(1000); // 1000 центов = $10

  const fetchJSON = async (url, opts = {}) => {
    const r = await fetch(url, {
      headers: { "Content-Type": "application/json", ...AUTH_HEADER, ...(opts.headers || {}) },
      ...opts,
    });
    if (!r.ok) throw new Error(`HTTP ${r.status}`);
    return r.json();
  };

  const load = async () => {
    setLoading(true);
    setErr("");
    try {
      const [b, t] = await Promise.all([
        fetchJSON(`${API_URL}/me/balance`),
        fetchJSON(`${API_URL}/me/transactions?limit=50`),
      ]);
      setBalance(b?.balance_in_cents ?? 0);
      setTx(Array.isArray(t) ? t : []);
    } catch (e) {
      setErr(e.message || "Ошибка загрузки платежных данных");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    load();
  }, []);

  const startCheckout = async (amount_cents) => {
    try {
      const res = await fetchJSON(`${API_URL}/create-checkout-session`, {
        method: "POST",
        body: JSON.stringify({ amount_cents }),
      });
      if (res?.url) {
        window.location.href = res.url; // редирект в Stripe Checkout
      } else {
        alert("Не удалось создать сессию оплаты");
      }
    } catch (e) {
      alert(e.message || "Ошибка создания сессии оплаты");
    }
  };

  const cardCls =
    "rounded-xl p-4 shadow " +
    (isDark ? "bg-gray-800 text-white shadow-black/20" : "bg-white text-gray-900 shadow-gray-200");

  const btn = (active) =>
    "px-3 py-2 rounded-lg text-sm font-medium transition-colors " +
    (isDark
      ? active ? "bg-blue-600 text-white" : "bg-gray-700 text-white hover:bg-gray-600"
      : active ? "bg-blue-600 text-white" : "bg-gray-100 text-gray-900 hover:bg-gray-200");

  const inputCls =
    "px-3 py-2 rounded-lg border focus:outline-none " +
    (isDark ? "bg-gray-700 text-white border-gray-600 focus:border-blue-500"
            : "bg-white text-gray-900 border-gray-300 focus:border-blue-500");

  return (
    <div className={"min-h-[calc(100vh-57px)] " + (isDark ? "bg-gray-900" : "bg-gray-50")}>
      <div className="max-w-5xl mx-auto p-4 grid gap-4 md:grid-cols-2">
        {/* Баланс */}
        <div className={cardCls}>
          <div className="flex items-center justify-between">
            <h2 className="text-lg font-semibold">Баланс</h2>
            <button onClick={load} className={btn(false)}>Обновить</button>
          </div>
          <div className="mt-3 text-3xl font-bold">
            {loading && balance === null ? "…" : `$${((balance ?? 0) / 100).toFixed(2)}`}
          </div>
          {err && <div className={isDark ? "text-red-300 mt-2" : "text-red-600 mt-2"}>{err}</div>}
        </div>

        {/* Быстрая оплата */}
        <div className={cardCls}>
          <h2 className="text-lg font-semibold">Пополнить счёт</h2>
          <div className="mt-3 flex flex-wrap gap-2">
            {[500, 1000, 2500, 5000, 10000].map((cents) => (
              <button
                key={cents}
                className={btn(amount === cents)}
                onClick={() => setAmount(cents)}
              >
                ${(cents / 100).toFixed(2)}
              </button>
            ))}
          </div>

          <div className="mt-3">
            <label className={isDark ? "text-sm text-gray-300" : "text-sm text-gray-700"}>
              Своя сумма, $ (0.50–1000.00)
            </label>
            <input
              type="number"
              min="0.50"
              max="1000"
              step="0.50"
              className={inputCls + " mt-1 w-full"}
              value={(amount / 100).toFixed(2)}
              onChange={(e) => {
                const v = Number(e.target.value || "0");
                setAmount(Math.round(v * 100));
              }}
            />
          </div>

          <div className="mt-4">
            <button
              className={btn(true) + " w-full"}
              onClick={() => startCheckout(amount)}
              disabled={amount < 50 || amount > 100000}
              title="Перейти к оплате (Stripe Checkout)"
            >
              Оплатить ${(amount / 100).toFixed(2)}
            </button>
          </div>
        </div>

        {/* История транзакций */}
        <div className={cardCls + " md:col-span-2"}>
          <div className="flex items-center justify-between">
            <h2 className="text-lg font-semibold">История транзакций</h2>
            <span className={isDark ? "text-sm text-gray-400" : "text-sm text-gray-500"}>
              последние 50 операций
            </span>
          </div>

          <div className="mt-3 overflow-x-auto">
            <table className="min-w-full text-sm">
              <thead>
                <tr className={isDark ? "text-gray-300" : "text-gray-600"}>
                  <th className="text-left py-2 pr-3">ID</th>
                  <th className="text-left py-2 pr-3">Сумма</th>
                  <th className="text-left py-2 pr-3">Внешний ID</th>
                  <th className="text-left py-2 pr-3">Дата</th>
                </tr>
              </thead>
              <tbody>
                {tx.length === 0 ? (
                  <tr>
                    <td className="py-3 text-center" colSpan={4}>
                      {loading ? "Загрузка…" : "Операций пока нет"}
                    </td>
                  </tr>
                ) : (
                  tx.map((t) => (
                    <tr key={t.id} className={isDark ? "border-t border-gray-700" : "border-t border-gray-200"}>
                      <td className="py-2 pr-3">{t.id}</td>
                      <td className="py-2 pr-3">${(t.amount_cents / 100).toFixed(2)}</td>
                      <td className="py-2 pr-3 truncate max-w-[320px]">{t.external_id}</td>
                      <td className="py-2 pr-3">{new Date(t.created_at).toLocaleString()}</td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </div>
  );
}
