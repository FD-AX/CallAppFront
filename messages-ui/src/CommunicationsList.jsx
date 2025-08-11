import React, { useEffect, useRef, useState, useCallback } from "react";

// .env:
// VITE_API_URL=http://localhost:8080
// VITE_AUTH_TOKEN=agent_api_key_24
const API_URL = import.meta.env.VITE_API_URL || "http://localhost:8080";
const AUTH_TOKEN = import.meta.env.VITE_AUTH_TOKEN || "agent_api_key_24";
const AUTH_HEADER = { Authorization: `Bearer ${AUTH_TOKEN}` };

const roleFromDirection = (direction) =>
  direction === "outbound" ? "agent" : "lead";

const formatTime = (iso) => {
  if (!iso) return "";
  const d = new Date(iso);
  return d.toLocaleTimeString("ru-RU", { hour: "2-digit", minute: "2-digit" });
};

const bubbleSide = (role) => (role === "agent" ? "justify-end" : "justify-start");
const bubbleStyle = (role) =>
  role === "agent" ? "bg-blue-600 text-white" : "bg-white text-gray-900";

export default function CommunicationsList() {
  // Список диалогов (пагинация)
  const [communications, setCommunications] = useState([]);
  const [nextCursor, setNextCursor] = useState(null);
  const [loadingList, setLoadingList] = useState(false);
  const [listError, setListError] = useState("");

  // Выбранный диалог + сообщения
  const [selected, setSelected] = useState(null);
  const [messages, setMessages] = useState([]);   // по возрастанию времени
  const [paging, setPaging] = useState({ next_before_time: null, limit: 50 });
  const [loadingDialog, setLoadingDialog] = useState(false);
  const [dialogError, setDialogError] = useState("");

  // Отправка
  const [draft, setDraft] = useState("");

  const chatRef = useRef(null);
  const isLoadingOlderRef = useRef(false);
  const bootedRef = useRef(false); // защита от двойного эффекта в StrictMode

  // автоскролл вниз при появлении новых сообщений
  useEffect(() => {
    if (chatRef.current) {
      chatRef.current.scrollTop = chatRef.current.scrollHeight;
    }
  }, [messages, selected]);

  // ------- API helper -------
  const fetchJSON = async (url, opts = {}) => {
    const r = await fetch(url, {
      headers: { "Content-Type": "application/json", ...AUTH_HEADER, ...(opts.headers || {}) },
      ...opts,
    });
    if (!r.ok) throw new Error(`HTTP ${r.status}`);
    return r.json();
  };

  // Загрузка страницы диалогов (с дедупликацией)
  const loadDialogs = useCallback(
    async (cursor = null, limit = 20, preview = 10) => {
      if (loadingList) return;
      setLoadingList(true);
      setListError("");
      try {
        const url = new URL(`${API_URL}/messages`);
        url.searchParams.set("limit", String(limit));
        url.searchParams.set("offser", String(preview)); // сколько последних сообщений на карточку
        if (cursor) url.searchParams.set("cursor", String(cursor));

        const data = await fetchJSON(url.toString());

        setCommunications((prev) => {
          const map = new Map(prev.map((x) => [x.id, x]));
          for (const item of (data.communications || [])) map.set(item.id, item);
          // стабильный порядок по id убыванию
          return Array.from(map.values()).sort((a, b) => b.id - a.id);
        });
        setNextCursor(data.next_cursor ?? null);
      } catch (e) {
        setListError(e.message || "Ошибка загрузки списка");
      } finally {
        setLoadingList(false);
      }
    },
    [loadingList]
  );

  // Первая загрузка (блок от StrictMode)
  useEffect(() => {
    if (bootedRef.current) return;
    bootedRef.current = true;
    loadDialogs(null, 20, 10);
  }, [loadDialogs]);

  // Выбор диалога
  const handleSelect = async (comm) => {
    setSelected(comm);
    setDialogError("");
    setMessages([]);

    // 1) сразу покажем превью (последние N)
    const preview = (comm.last_messages || [])
      .slice()
      .sort((a, b) => (a.time || "").localeCompare(b.time || ""));
    const previewNorm = preview.map((m) => ({
      id: m.id,
      text: m.text,
      time: m.time,
      direction: m.direction,
      role: roleFromDirection(m.direction),
    }));
    setMessages(previewNorm);

    // курсор для старых
    const nextBefore = previewNorm.length ? previewNorm[0].time : null;
    setPaging({ next_before_time: nextBefore, limit: 50 });

    // 2) дотянуть последнюю страницу и смержить без дублей
    await loadLatestPage(comm.id, 50);
  };

  // Последняя страница сообщений
  const loadLatestPage = async (commId, limit = 50) => {
    setLoadingDialog(true);
    setDialogError("");
    try {
      const url = new URL(`${API_URL}/messages/${commId}`);
      url.searchParams.set("offser", String(limit));
      const data = await fetchJSON(url.toString());

      const fresh = (data.communication?.messages || []).map((m) => ({
        id: m.id,
        text: m.text,
        time: m.time,
        direction: m.direction,
        role: roleFromDirection(m.direction),
      }));

      setMessages((prev) => {
        const byId = new Map(prev.map((x) => [x.id, x]));
        for (const m of fresh) byId.set(m.id, m);
        return Array.from(byId.values()).sort((a, b) =>
          (a.time || "").localeCompare(b.time || "")
        );
      });

      const nb = data.communication?.paging?.next_before_time || null;
      setPaging({ next_before_time: nb, limit });
    } catch (e) {
      setDialogError(e.message || "Ошибка загрузки диалога");
    } finally {
      setLoadingDialog(false);
    }
  };

  // Догрузить старые (при скролле вверх)
  const loadOlder = async () => {
    if (!selected || !paging.next_before_time || isLoadingOlderRef.current) return;
    isLoadingOlderRef.current = true;
    try {
      const url = new URL(`${API_URL}/messages/${selected.id}`);
      url.searchParams.set("offser", String(paging.limit));
      url.searchParams.set("before_time", paging.next_before_time);
      const data = await fetchJSON(url.toString());

      const older = (data.communication?.messages || []).map((m) => ({
        id: m.id,
        text: m.text,
        time: m.time,
        direction: m.direction,
        role: roleFromDirection(m.direction),
      }));

      // prepend старые
      setMessages((prev) => [...older, ...prev]);

      const nb = data.communication?.paging?.next_before_time || null;
      setPaging((p) => ({ ...p, next_before_time: nb }));
    } catch (e) {
      // можно показать уведомление
    } finally {
      isLoadingOlderRef.current = false;
    }
  };

  // Скролл
  const onScroll = (e) => {
    const el = e.currentTarget;
    if (el.scrollTop <= 0) loadOlder();
  };

  // Отправка
  const sendMessage = async (e) => {
    e.preventDefault();
    const text = draft.trim();
    if (!text || !selected) return;

    // оптимистично
    const tmp = {
      id: `tmp-${Date.now()}`,
      text,
      time: new Date().toISOString(),
      direction: "outbound",
      role: "agent",
    };
    setMessages((prev) => [...prev, tmp]);
    setDraft("");

    try {
      await fetchJSON(`${API_URL}/messages/${selected.id}`, {
        method: "POST",
        body: JSON.stringify({ message: text }),
      });
      // при желании — подтянуть реальный id:
      // await loadLatestPage(selected.id, 50);
    } catch {
      // откат
      setMessages((prev) => prev.filter((m) => m.id !== tmp.id));
      alert("Не удалось отправить сообщение");
    }
  };

  return (
    <div className="min-h-screen bg-gray-900 flex">
      {/* Sidebar */}
      <div className="w-80 bg-gray-800 border-r border-gray-700 flex flex-col">
        <div className="p-4 border-b border-gray-700">
          <h1 className="text-white text-lg font-semibold">Saved Messages</h1>
        </div>

        <div className="flex-1 overflow-y-auto">
          {listError && <div className="p-3 text-red-300">{listError}</div>}
          {communications.map((comm) => (
            <button
              key={comm.id} // id уникален после дедупликации
              onClick={() => handleSelect(comm)}
              className={
                "w-full text-left p-4 border-b border-gray-700 hover:bg-gray-700 transition-colors " +
                (selected?.id === comm.id ? "bg-gray-700" : "")
              }
            >
              <div className="flex items-center justify-between mb-1">
                <div className="text-white font-medium text-sm">Лид #{comm.lead_id}</div>
                <div className="text-gray-400 text-xs">
                  {comm.last_message?.time ? formatTime(comm.last_message.time) : ""}
                </div>
              </div>
              <div className="text-gray-300 text-sm mb-2 truncate">
                {comm.last_message?.text || "Сообщений нет"}
              </div>
              <div className="flex items-center justify-between">
                <div className="flex items-center text-xs text-gray-400">
                  <svg className="w-3 h-3 mr-1" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2"
                      d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z" />
                  </svg>
                  {comm.messages_count}
                </div>
                <div
                  className={
                    "w-2 h-2 rounded-full " +
                    (comm.messages_count > 10
                      ? "bg-red-400"
                      : comm.messages_count > 5
                      ? "bg-yellow-400"
                      : "bg-green-400")
                  }
                />
              </div>
            </button>
          ))}
        </div>

        <div className="p-3 border-t border-gray-700">
          {nextCursor ? (
            <button
              onClick={() => loadDialogs(nextCursor, 20, 10)}
              disabled={loadingList}
              className="w-full text-sm bg-gray-700 text-white px-3 py-2 rounded hover:bg-gray-600"
            >
              {loadingList ? "Загрузка..." : "Загрузить ещё"}
            </button>
          ) : (
            <div className="text-xs text-gray-500 text-center">Больше диалогов нет</div>
          )}
        </div>
      </div>

      {/* Main */}
      <div className="flex-1 flex flex-col">
        {selected ? (
          <>
            <div className="bg-gray-800 border-b border-gray-700 p-4">
              <div className="flex items-center">
                <div className="w-8 h-8 bg-blue-600 rounded-full flex items-center justify-center mr-3">
                  <span className="text-white text-sm font-medium">
                    {selected.lead_id.toString().slice(-2)}
                  </span>
                </div>
                <div>
                  <h2 className="text-white font-semibold">Лид #{selected.lead_id}</h2>
                  <p className="text-gray-400 text-sm">{selected.messages_count} сообщений</p>
                </div>
              </div>
            </div>

            <div
              ref={chatRef}
              onScroll={onScroll}
              className="flex-1 bg-gray-900 p-4 overflow-y-auto"
            >
              {loadingDialog && !messages.length ? (
                <div className="flex items-center justify-center h-full">
                  <div className="flex items-center space-x-2">
                    <div className="w-4 h-4 bg-blue-600 rounded-full animate-pulse" />
                    <div className="w-4 h-4 bg-blue-600 rounded-full animate-pulse" />
                    <div className="w-4 h-4 bg-blue-600 rounded-full animate-pulse" />
                  </div>
                </div>
              ) : dialogError ? (
                <div className="text-center text-red-300">{dialogError}</div>
              ) : messages.length ? (
                <div className="space-y-4">
                  {messages.map((m) => (
                    <div key={`${m.id}-${m.time}`} className={"flex " + bubbleSide(m.role)}>
                      <div className={"max-w-xs lg:max-w-md px-4 py-2 rounded-lg " + bubbleStyle(m.role)}>
                        <p className="text-sm whitespace-pre-wrap">{m.text}</p>
                        <p className="text-xs text-gray-500 mt-1">{formatTime(m.time)}</p>
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <div className="flex items-center justify-center h-full">
                  <p className="text-gray-500">Сообщений пока нет</p>
                </div>
              )}
            </div>

            <div className="bg-gray-800 border-t border-gray-700 p-4">
              <form className="flex items-center space-x-2" onSubmit={sendMessage}>
                <input
                  type="text"
                  placeholder="Введите сообщение..."
                  className="flex-1 bg-gray-700 text-white px-4 py-2 rounded-lg border border-gray-600 focus:outline-none focus:border-blue-500"
                  value={draft}
                  onChange={(e) => setDraft(e.target.value)}
                />
                <button
                  type="submit"
                  className="bg-blue-600 text-white px-4 py-2 rounded-lg hover:bg-blue-700 transition-colors"
                  disabled={!draft.trim()}
                >
                  <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 19l9 2-9-18-9 18 9-2zm0 0v-8" />
                  </svg>
                </button>
              </form>
            </div>
          </>
        ) : (
          <div className="flex-1 flex items-center justify-center bg-gray-900">
            <div className="text-center">
              <svg className="mx-auto h-16 w-16 text-gray-600 mb-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2"
                  d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z" />
              </svg>
              <h3 className="text-lg font-medium text-gray-300 mb-2">Выберите диалог</h3>
              <p className="text-gray-500">Слева список с превью и временем</p>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}