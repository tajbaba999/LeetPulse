"use client";

import { useEffect, useRef, useState } from "react";

import { chat } from "@/lib/api/codingprofile";

type Message = { role: "user" | "assistant"; text: string; sources?: string[]; error?: boolean };

const SUGGESTIONS = [
  "What's my weakest topic right now?",
  "How's my streak trending this month?",
  "Which difficulty should I focus on next?",
  "Summarize my contest performance.",
];

export default function ChatPage() {
  const [messages, setMessages] = useState<Message[]>([]);
  const [draft, setDraft] = useState("");
  const [sending, setSending] = useState(false);
  const scrollRef = useRef<HTMLDivElement>(null);
  const typingRef = useRef<ReturnType<typeof setInterval> | null>(null);

  useEffect(() => {
    scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight, behavior: "smooth" });
  }, [messages, sending]);

  useEffect(() => {
    return () => { if (typingRef.current) clearInterval(typingRef.current); };
  }, []);

  function typewriterAppend(fullText: string, sources: string[], msgIndex: number) {
    let i = 0;
    const chunkSize = 3;
    const interval = 15;
    typingRef.current = setInterval(() => {
      i = Math.min(i + chunkSize, fullText.length);
      setMessages((m) => {
        const updated = [...m];
        updated[msgIndex] = { ...updated[msgIndex], text: fullText.slice(0, i), sources: i === fullText.length ? sources : updated[msgIndex].sources };
        return updated;
      });
      if (i >= fullText.length && typingRef.current) {
        clearInterval(typingRef.current);
        typingRef.current = null;
        setSending(false);
      }
    }, interval);
  }

  async function send(question: string) {
    const q = question.trim();
    if (!q || sending) return;
    setDraft("");
    setMessages((m) => [...m, { role: "user", text: q }]);
    setSending(true);

    const msgIndex = messages.length + 1;
    setMessages((m) => [...m, { role: "assistant", text: "" }]);

    try {
      const res = await chat(q);
      typewriterAppend(res.answer, res.sources, msgIndex);
    } catch (err) {
      const msg = err instanceof Error ? err.message : "Chat failed";
      setMessages((m) => {
        const updated = [...m];
        updated[msgIndex] = { ...updated[msgIndex], text: msg, error: true };
        return updated;
      });
      setSending(false);
    }
  }

  const hasMessages = messages.length > 0;

  return (
    <div style={{ padding: "36px 44px", display: "flex", flexDirection: "column", height: "100vh" }} className="animate-fadeup">
      <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 4 }}>
        <div style={{ fontWeight: 700, fontSize: 26, letterSpacing: "-0.02em" }}>Ask LeetPulse</div>
        <span style={{ fontSize: 10, fontWeight: 800, letterSpacing: "0.05em", padding: "3px 8px", borderRadius: 6, background: "linear-gradient(135deg, var(--accent-strong), var(--accent))", color: "white" }}>AI</span>
      </div>
      <div style={{ fontSize: 14, color: "var(--text-dim)", marginBottom: 20 }}>
        Grounded in your synced profile, snapshots, and skill breakdown — not generic advice.
      </div>

      <div style={{ flex: 1, minHeight: 0, display: "flex", flexDirection: "column", background: "radial-gradient(ellipse 900px 500px at 50% 0%, var(--accent-soft), transparent 65%), var(--surface)", border: "1px solid var(--border)", borderRadius: 18, overflow: "hidden" }}>
        {!hasMessages ? (
          <div style={{ flex: 1, minHeight: 0, display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "flex-start", padding: "64px 40px 40px", gap: 24, overflowY: "auto" }}>
            <div style={{ maxWidth: 600, textAlign: "center", fontWeight: 700, fontSize: 28, lineHeight: 1.3, letterSpacing: "-0.02em" }}>
              What do you want to know about your coding journey?
            </div>
            <ChatInput draft={draft} setDraft={setDraft} onSend={() => send(draft)} sending={sending} big />
            <div style={{ display: "flex", gap: 8, flexWrap: "wrap", justifyContent: "center", maxWidth: 620 }}>
              {SUGGESTIONS.map((s) => (
                <div key={s} onClick={() => send(s)} style={{ padding: "9px 14px", border: "1px solid var(--border)", borderRadius: 20, fontSize: 12.5, color: "var(--text-dim)", cursor: "pointer", background: "var(--bg-elevated)" }}>
                  {s}
                </div>
              ))}
            </div>
          </div>
        ) : (
          <>
            <div ref={scrollRef} style={{ flex: 1, minHeight: 0, overflowY: "auto", padding: "26px 28px", display: "flex", flexDirection: "column", gap: 16 }}>
              {messages.map((msg, i) => (
                <MessageRow key={i} msg={msg} />
              ))}
              {sending && messages[messages.length - 1]?.role === "assistant" && messages[messages.length - 1]?.text === "" && (
                <div style={{ display: "flex", justifyContent: "flex-start" }}>
                  <div style={{ background: "var(--surface)", border: "1px solid var(--border)", padding: "15px 18px", borderRadius: "16px 16px 16px 4px", fontSize: 14, minHeight: 20 }}>
                    <span style={{ display: "inline-block", width: 6, height: 14, background: "var(--accent)", verticalAlign: "middle", animation: "pulseDot 0.8s ease infinite" }} />
                  </div>
                </div>
              )}
            </div>
            <div style={{ borderTop: "1px solid var(--border)", padding: "18px 22px" }}>
              <ChatInput draft={draft} setDraft={setDraft} onSend={() => send(draft)} sending={sending} />
            </div>
          </>
        )}
      </div>
    </div>
  );
}

function MessageRow({ msg }: { msg: Message }) {
  const isUser = msg.role === "user";
  return (
    <div style={{ display: "flex", justifyContent: isUser ? "flex-end" : "flex-start" }}>
      <div style={{ display: "flex", flexDirection: "column", gap: 8, maxWidth: "78%" }}>
        <div
          style={{
            padding: "12px 16px",
            fontSize: 14,
            lineHeight: 1.6,
            whiteSpace: "pre-wrap",
            wordBreak: "break-word",
            background: isUser ? "var(--accent)" : msg.error ? "var(--hard-soft)" : "var(--surface)",
            color: isUser ? "white" : msg.error ? "var(--hard)" : "var(--text)",
            border: isUser ? "none" : "1px solid var(--border)",
            borderRadius: isUser ? "16px 16px 4px 16px" : "16px 16px 16px 4px",
          }}
        >
          {msg.text}
        </div>
        {msg.sources && msg.sources.length > 0 && (
          <div style={{ display: "flex", gap: 6, flexWrap: "wrap", paddingLeft: 4 }}>
            {msg.sources.map((src) => (
              <span key={src} className="font-mono" style={{ fontSize: 10.5, color: "var(--text-faint)", background: "var(--surface-2)", padding: "3px 8px", borderRadius: 6 }}>{src}</span>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

function ChatInput({ draft, setDraft, onSend, sending, big }: { draft: string; setDraft: (v: string) => void; onSend: () => void; sending: boolean; big?: boolean }) {
  return (
    <div style={{ width: "100%", maxWidth: big ? 620 : undefined, display: "flex", gap: 10, alignItems: "center", background: "var(--bg-elevated)", border: "1px solid var(--border)", borderRadius: big ? 14 : 12, padding: big ? "8px 8px 8px 18px" : 0 }}>
      <input
        value={draft}
        onChange={(e) => setDraft(e.target.value)}
        onKeyDown={(e) => { if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); onSend(); } }}
        placeholder="Ask about your progress, weak topics, streaks…"
        style={{ flex: 1, padding: big ? "10px 0" : "13px 16px", background: "transparent", border: "none", outline: "none", color: "var(--text)", fontSize: big ? 15 : 14, fontFamily: "inherit" }}
      />
      <button
        onClick={onSend}
        disabled={sending || !draft.trim()}
        style={{ padding: big ? "11px 16px" : "13px 18px", background: "var(--accent)", color: "white", border: "none", borderRadius: big ? 10 : 12, fontWeight: 700, fontSize: 13, cursor: sending || !draft.trim() ? "default" : "pointer", opacity: sending || !draft.trim() ? 0.6 : 1, flexShrink: 0, fontFamily: "inherit" }}
      >
        Send
      </button>
    </div>
  );
}
