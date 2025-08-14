import React, { useEffect, useRef, useState, useCallback } from "react";

const roleFromDirection = (direction) =>
  direction === "outbound" ? "agent" : "lead";

const formatTime = (iso) => {
  if (!iso) return "";
  const d = new Date(iso);
  return d.toLocaleTimeString("ru-RU", { hour: "2-digit", minute: "2-digit" });
};

export default function CommunicationsList({ API_URL, AUTH_HEADER, theme }) {
  const isDark = theme === "dark";

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
  const bootedRef = useRef(false);

  // автоскролл вниз
  useEffect(() => {
    if (chatRef.current) {
      chatRef.current.scrollTop = chatRef.current.scrollHeight;
    }
  }, [messages, selected]);

  // helper
  const fetchJSON = async (url, opts = {}) => {
    const r = await fetch(url, {
      headers: { "Content-Type": "application/json", ...AUTH_HEADER, ...(opts.headers || {}) },
      ...opts,
    });
    if (!r.ok) throw new Error(`HTTP ${r.status}`);
    return r.json();
  };

  const loadDialogs = useCallback(
    async (cursor = null, limit = 20, preview = 10) => {
      if (loadingList) return;
      setLoadingList(true);
      setListError("");
      try {
        const url = new URL(`${API_URL}/messages`);
        url.searchParams.set("limit", String(limit));
        url.searchParams.set("offser", String(preview)); // превью-сообщения
        if (cursor) url.searchParams.set("cursor", String(cursor));

        const data = await fetchJSON(url.toString());

        setCommunications((prev) => {
          const map = new Map(prev.map((x) => [x.id, x]));
          for (const item of (data.communications || [])) map.set(item.id, item);
          return Array.from(map.values()).sort((a, b) => b.id - a.id);
        });
        setNextCursor(data.next_cursor ?? null);
      } catch (e) {
        setListError(e.message || "Ошибка загрузки списка");
      } finally {
        setLoadingList(false);
      }
    },
    [API_URL, AUTH_HEADER, loadingList]
  );

  // первая загрузка
  useEffect(() => {
    if (bootedRef.current) return;
    bootedRef.current = true;
    loadDialogs(null, 20, 10);
  }, [loadDialogs]);

  const handleSelect = async (comm) => {
    setSelected(comm);
    setDialogError("");
    setMessages([]);

    // мгновенно покажем превью
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

    const nextBefore = previewNorm.length ? previewNorm[0].time : null;
    setPaging({ next_before_time: nextBefore, limit: 50 });

    // подгрузим «реальную» последнюю страницу (merging)
    await loadLatestPage(comm.id, 50);
  };

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

      setMessages((prev) => [...older, ...prev]);
      const nb = data.communication?.paging?.next_before_time || null;
      setPaging((p) => ({ ...p, next_before_time: nb }));
    } catch {}
    finally {
      isLoadingOlderRef.current = false;
    }
  };

  const onScroll = (e) => {
    const el = e.currentTarget;
    if (el.scrollTop <= 0) loadOlder();
  };

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
    } catch {
      setMessages((prev) => prev.filter((m) => m.id !== tmp.id));
      alert("Не удалось отправить сообщение");
    }
  };

  // стили по теме
  const sidebarCls =
    "w-80 border-r " +
    (isDark ? "bg-gray-800 border-gray-700" : "bg-white border-gray-200");
  const sidebarHeader = "p-4 border-b " + (isDark ? "border-gray-700" : "border-gray-200");
  const sidebarItemBase =
    "w-full text-left p-4 border-b transition-colors " +
    (isDark
      ? "border-gray-700 hover:bg-gray-700"
      : "border-gray-200 hover:bg-gray-100");

  const mainHeader =
    "border-b p-4 " + (isDark ? "bg-gray-800 border-gray-700" : "bg-white border-gray-200");
  const chatArea = "flex-1 p-4 overflow-y-auto " + (isDark ? "bg-gray-900" : "bg-gray-50");
  const inputWrap = "border-t p-4 " + (isDark ? "bg-gray-800 border-gray-700" : "bg-white border-gray-200");
  const inputCls =
    "flex-1 px-4 py-2 rounded-lg border focus:outline-none " +
    (isDark
      ? "bg-gray-700 text-white border-gray-600 focus:border-blue-500"
      : "bg-white text-gray-900 border-gray-300 focus:border-blue-500");

  const bubbleSide = (role) => (role === "agent" ? "justify-end" : "justify-start");
  const bubbleStyle = (role) =>
    role === "agent"
      ? "bg-blue-600 text-white"
      : isDark
        ? "bg-white text-gray-900"
        : "bg-gray-100 text-gray-900";

  return (
    <div className="min-h-[calc(100vh-57px)] flex">
      {/* Sidebar */}
      <div className={sidebarCls}>
        <div className={sidebarHeader}>
          <h1 className={isDark ? "text-white text-lg font-semibold" : "text-gray-900 text-lg font-semibold"}>
            Saved Messages
          </h1>
        </div>

        <div className="flex-1 overflow-y-auto">
          {listError && (
            <div className={isDark ? "p-3 text-red-300" : "p-3 text-red-600"}>
              {listError}
            </div>
          )}

          {communications.map((comm) => (
            <button
              key={comm.id}
              onClick={() => handleSelect(comm)}
              className={
                sidebarItemBase + (selected?.id === comm.id
                  ? isDark ? " bg-gray-700" : " bg-gray-100"
                  : "")
              }
            >
              <div className="flex items-center justify-between mb-1">
                <div className={isDark ? "text-white font-medium text-sm" : "text-gray-900 font-medium text-sm"}>
                  Лид #{comm.lead_id}
                </div>
                <div className={isDark ? "text-gray-300 text-xs" : "text-gray-500 text-xs"}>
                  {comm.last_message?.time ? formatTime(comm.last_message.time) : ""}
                </div>
              </div>

              <div className={isDark ? "text-gray-300 text-sm mb-2 truncate" : "text-gray-600 text-sm mb-2 truncate"}>
                {comm.last_message?.text || "Сообщений нет"}
              </div>

              <div className="flex items-center justify-between">
                <div className={isDark ? "flex items-center text-xs text-gray-400" : "flex items-center text-xs text-gray-500"}>
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

        <div className={isDark ? "p-3 border-t border-gray-700" : "p-3 border-t border-gray-200"}>
          {nextCursor ? (
            <button
              onClick={() => loadDialogs(nextCursor, 20, 10)}
              disabled={loadingList}
              className={
                "w-full text-sm rounded px-3 py-2 transition-colors " +
                (isDark ? "bg-gray-700 text-white hover:bg-gray-600"
                        : "bg-gray-200 text-gray-900 hover:bg-gray-300")
              }
            >
              {loadingList ? "Загрузка..." : "Загрузить ещё"}
            </button>
          ) : (
            <div className={isDark ? "text-xs text-gray-500 text-center" : "text-xs text-gray-500 text-center"}>
              Больше диалогов нет
            </div>
          )}
        </div>
      </div>

      {/* Main */}
      <div className="flex-1 flex flex-col">
        {selected ? (
          <>
            <div className={mainHeader}>
              <div className="flex items-center">
                <div className="w-8 h-8 bg-blue-600 rounded-full flex items-center justify-center mr-3">
                  <span className="text-white text-sm font-medium">
                    {selected.lead_id.toString().slice(-2)}
                  </span>
                </div>
                <div>
                  <h2 className={isDark ? "text-white font-semibold" : "text-gray-900 font-semibold"}>
                    Лид #{selected.lead_id}
                  </h2>
                  <p className={isDark ? "text-gray-400 text-sm" : "text-gray-500 text-sm"}>
                    {selected.messages_count} сообщений
                  </p>
                </div>
              </div>
            </div>

            <div
              ref={chatRef}
              onScroll={onScroll}
              className={chatArea}
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
                <div className={isDark ? "text-center text-red-300" : "text-center text-red-600"}>
                  {dialogError}
                </div>
              ) : messages.length ? (
                <div className="space-y-4">
                  {messages.map((m) => (
                    <div key={`${m.id}-${m.time}`} className={"flex " + bubbleSide(m.role)}>
                      <div className={"max-w-xs lg:max-w-md px-4 py-2 rounded-lg " + bubbleStyle(m.role)}>
                        <p className="text-sm whitespace-pre-wrap">{m.text}</p>
                        <p className={isDark ? "text-xs text-gray-400 mt-1" : "text-xs text-gray-500 mt-1"}>
                          {formatTime(m.time)}
                        </p>
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <div className="flex items-center justify-center h-full">
                  <p className={isDark ? "text-gray-500" : "text-gray-500"}>Сообщений пока нет</p>
                </div>
              )}
            </div>

            <div className={inputWrap}>
              <form className="flex items-center space-x-2" onSubmit={sendMessage}>
                <input
                  type="text"
                  placeholder="Введите сообщение..."
                  className={inputCls}
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
          <div className={chatArea + " flex items-center justify-center"}>
            <div className="text-center">
              <svg className={"mx-auto h-16 w-16 mb-4 " + (isDark ? "text-gray-600" : "text-gray-400")} fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2"
                  d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z" />
              </svg>
              <h3 className={"text-lg font-medium mb-2 " + (isDark ? "text-gray-300" : "text-gray-700")}>
                Выберите диалог
              </h3>
              <p className={isDark ? "text-gray-500" : "text-gray-500"}>
                Слева список с превью и временем
              </p>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}