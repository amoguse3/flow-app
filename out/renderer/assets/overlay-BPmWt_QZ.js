import { c as clientExports, j as jsxRuntimeExports, r as reactExports } from "./index-6T1Mutlo.js";
const SIZES = { small: 48, medium: 64, large: 80 };
function OverlayApp() {
  const [orbPx, setOrbPx] = reactExports.useState(64);
  const [showChat, setShowChat] = reactExports.useState(false);
  const [chatInput, setChatInput] = reactExports.useState("");
  const [reminder, setReminder] = reactExports.useState(null);
  const [idle, setIdle] = reactExports.useState(false);
  const idleTimer = reactExports.useRef(null);
  const dragging = reactExports.useRef(false);
  const dragStart = reactExports.useRef({ x: 0, y: 0 });
  const didDrag = reactExports.useRef(false);
  reactExports.useEffect(() => {
    window.overlayAPI.getOrbSize().then((s) => setOrbPx(SIZES[s] || 64));
    window.overlayAPI.onSizeChange((s) => setOrbPx(SIZES[s] || 64));
  }, []);
  const resetIdle = reactExports.useCallback(() => {
    setIdle(false);
    if (idleTimer.current) clearTimeout(idleTimer.current);
    idleTimer.current = setTimeout(() => setIdle(true), 5e3);
  }, []);
  reactExports.useEffect(() => {
    resetIdle();
    return () => {
      if (idleTimer.current) clearTimeout(idleTimer.current);
    };
  }, [resetIdle]);
  reactExports.useEffect(() => {
    const fetchReminder = async () => {
      if (showChat) return;
      const r = await window.overlayAPI.getReminder();
      if (r?.text) {
        setReminder(r.text);
        resetIdle();
        setTimeout(() => setReminder(null), 6e3);
      }
    };
    const interval = setInterval(fetchReminder, 45e3);
    const first = setTimeout(fetchReminder, 8e3);
    return () => {
      clearInterval(interval);
      clearTimeout(first);
    };
  }, [showChat, resetIdle]);
  reactExports.useEffect(() => {
    const onMouseMove = (e) => {
      if (!dragging.current) return;
      const dx = e.screenX - dragStart.current.x;
      const dy = e.screenY - dragStart.current.y;
      if (Math.abs(dx) > 2 || Math.abs(dy) > 2) {
        didDrag.current = true;
        window.overlayAPI.dragMove(dx, dy);
        dragStart.current = { x: e.screenX, y: e.screenY };
      }
    };
    const onMouseUp = () => {
      dragging.current = false;
    };
    window.addEventListener("mousemove", onMouseMove);
    window.addEventListener("mouseup", onMouseUp);
    return () => {
      window.removeEventListener("mousemove", onMouseMove);
      window.removeEventListener("mouseup", onMouseUp);
    };
  }, []);
  const handleOrbMouseDown = (e) => {
    dragging.current = true;
    didDrag.current = false;
    dragStart.current = { x: e.screenX, y: e.screenY };
    resetIdle();
  };
  const handleOrbMouseUp = () => {
    dragging.current = false;
    if (!didDrag.current) {
      setShowChat((prev) => !prev);
      setReminder(null);
    }
  };
  const onEnterVisible = () => window.overlayAPI.setClickThrough(false);
  const onLeaveVisible = () => {
    if (!showChat) window.overlayAPI.setClickThrough(true);
  };
  const handleSend = () => {
    const msg = chatInput.trim();
    setChatInput("");
    setShowChat(false);
    window.overlayAPI.setClickThrough(true);
    if (msg) {
      window.overlayAPI.sendToChat(msg);
    } else {
      window.overlayAPI.openMain();
    }
  };
  return /* @__PURE__ */ jsxRuntimeExports.jsxs(
    "div",
    {
      style: {
        width: "100%",
        height: "100%",
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        justifyContent: "flex-end",
        paddingBottom: 12,
        opacity: idle && !showChat && !reminder ? 0.5 : 1,
        transition: "opacity 0.8s ease",
        userSelect: "none"
      },
      children: [
        reminder && !showChat && /* @__PURE__ */ jsxRuntimeExports.jsx(
          "div",
          {
            onMouseEnter: onEnterVisible,
            onMouseLeave: onLeaveVisible,
            style: {
              maxWidth: 200,
              padding: "8px 12px",
              marginBottom: 8,
              borderRadius: 10,
              background: "rgba(30,20,10,0.92)",
              border: "1px solid rgba(180,130,60,0.3)",
              fontFamily: "'Press Start 2P', monospace",
              fontSize: 5,
              color: "rgba(220,200,160,0.85)",
              lineHeight: 2.2,
              textAlign: "center",
              animation: "fadeIn 0.3s ease"
            },
            children: reminder
          }
        ),
        /* @__PURE__ */ jsxRuntimeExports.jsxs("div", { style: { display: "flex", flexDirection: "column", alignItems: "center" }, children: [
          /* @__PURE__ */ jsxRuntimeExports.jsx(
            "div",
            {
              onMouseEnter: onEnterVisible,
              onMouseLeave: onLeaveVisible,
              onMouseDown: handleOrbMouseDown,
              onMouseUp: handleOrbMouseUp,
              style: {
                width: orbPx,
                height: orbPx,
                borderRadius: "50%",
                background: "radial-gradient(circle at 38% 32%, rgba(180,130,80,0.9), rgba(100,60,25,0.75) 50%, rgba(30,15,5,0.5) 80%)",
                boxShadow: showChat ? "0 0 25px rgba(180,130,60,0.5), 0 0 50px rgba(140,90,40,0.2)" : "0 0 20px rgba(140,90,40,0.35), 0 0 40px rgba(100,60,20,0.15)",
                cursor: dragging.current ? "grabbing" : "pointer",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                animation: dragging.current ? "none" : "orbFloat 4s ease-in-out infinite",
                flexShrink: 0,
                transition: "box-shadow 0.3s ease"
              },
              children: /* @__PURE__ */ jsxRuntimeExports.jsxs(
                "svg",
                {
                  width: "60%",
                  height: "60%",
                  viewBox: "0 0 100 100",
                  style: { imageRendering: "pixelated", pointerEvents: "none" },
                  shapeRendering: "crispEdges",
                  children: [
                    /* @__PURE__ */ jsxRuntimeExports.jsx("rect", { x: "28", y: "32", width: "12", height: "12", rx: "2", fill: "rgba(212,184,150,0.7)" }),
                    /* @__PURE__ */ jsxRuntimeExports.jsx("rect", { x: "60", y: "32", width: "12", height: "12", rx: "2", fill: "rgba(212,184,150,0.7)" }),
                    /* @__PURE__ */ jsxRuntimeExports.jsx("path", { d: "M35,62 Q50,75 65,62", fill: "none", stroke: "rgba(212,184,150,0.5)", strokeWidth: "3.5" })
                  ]
                }
              )
            }
          ),
          showChat && /* @__PURE__ */ jsxRuntimeExports.jsx(
            "div",
            {
              onMouseEnter: onEnterVisible,
              onMouseLeave: () => {
              },
              style: {
                marginTop: 10,
                width: 220,
                borderRadius: 12,
                overflow: "hidden",
                background: "rgba(8,6,6,0.95)",
                border: "1px solid rgba(180,130,60,0.2)",
                boxShadow: "0 4px 24px rgba(0,0,0,0.6)",
                animation: "slideUp 0.2s ease",
                backdropFilter: "blur(12px)"
              },
              children: /* @__PURE__ */ jsxRuntimeExports.jsxs("div", { style: { padding: 8, display: "flex", gap: 6 }, children: [
                /* @__PURE__ */ jsxRuntimeExports.jsx(
                  "input",
                  {
                    value: chatInput,
                    onChange: (e) => setChatInput(e.target.value),
                    onKeyDown: (e) => {
                      if (e.key === "Enter") handleSend();
                      if (e.key === "Escape") {
                        setShowChat(false);
                        setChatInput("");
                        window.overlayAPI.setClickThrough(true);
                      }
                    },
                    placeholder: "Type something...",
                    autoFocus: true,
                    style: {
                      flex: 1,
                      padding: "6px 10px",
                      borderRadius: 8,
                      fontFamily: "'Press Start 2P', monospace",
                      fontSize: 6,
                      color: "rgba(220,200,160,0.8)",
                      background: "rgba(20,15,10,0.8)",
                      border: "1px solid rgba(180,130,60,0.15)",
                      outline: "none"
                    }
                  }
                ),
                /* @__PURE__ */ jsxRuntimeExports.jsx(
                  "button",
                  {
                    onClick: handleSend,
                    style: {
                      width: 28,
                      height: 28,
                      borderRadius: 8,
                      background: "rgba(180,130,60,0.12)",
                      border: "1px solid rgba(180,130,60,0.2)",
                      color: "rgba(180,130,60,0.6)",
                      cursor: "pointer",
                      fontSize: 10,
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "center"
                    },
                    children: "→"
                  }
                )
              ] })
            }
          )
        ] }),
        /* @__PURE__ */ jsxRuntimeExports.jsx("style", { children: `
        @keyframes fadeIn { from { opacity: 0; } to { opacity: 1; } }
        @keyframes slideUp { from { opacity: 0; transform: translateY(-6px); } to { opacity: 1; transform: translateY(0); } }
        @keyframes orbFloat { 0%, 100% { transform: translateY(0); } 50% { transform: translateY(-3px); } }
      ` })
      ]
    }
  );
}
clientExports.createRoot(document.getElementById("root")).render(/* @__PURE__ */ jsxRuntimeExports.jsx(OverlayApp, {}));
