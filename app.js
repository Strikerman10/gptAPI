// ==========================
// CONFIG
// ==========================
const WORKER_URL = "https://gptapiv2.barney-willis2.workers.dev";
const MODEL = "gpt-5-chat-latest";

let chats = [];
let currentIndex = null;

document.addEventListener("DOMContentLoaded", () => {
  // DOM elements
  const chatListEl = document.getElementById("chatList");
  const messagesEl = document.getElementById("messages");
  const headerEl = document.getElementById("chatHeader").querySelector("span");
  const inputEl = document.getElementById("input");
  const paletteSelector = document.getElementById("paletteSelector");
  const themeToggleBtn = document.getElementById("toggleThemeBtn"); // 🌙/☀️ toggle
  const sidebarEl = document.querySelector(".sidebar");
  const toggleSidebarBtn = document.getElementById("toggleSidebarBtn");
  const paletteBtn = document.getElementById("themeBtn"); // 🎨 palette button

  // ==========================
  // PALETTE & THEME
  // ==========================
  const palettes = {
    Green: {
  "--color-1": "#94e8b4",  /* light mint green */
  "--color-2": "#72bda3",  /* soft teal green */
  "--color-3": "#5e8c61",  /* medium sage green */
  "--color-4": "#4e6151",  /* muted deep green */
  "--color-5": "#3b322c",  /* near‑black brown‑green */
  "--color-6": "#800000"   /* accent (maroon/burgundy) */
},
    Blue: {
  "--color-1": "#6da5f8",  /* muted steel blue (light accent, but not pale) */
  "--color-2": "#3f5fa3",  /* medium navy‑blue */
  "--color-3": "#2c4f80",  /* strong deep blue (primary) */
  "--color-4": "#1e3759",  /* dark slate navy */
  "--color-5": "#0d1628",  /* near‑black navy base */
  "--color-6": "#4e1818"   /* dark red accent (kept for contrast) */
},
    Amber: {
  "--color-1": "#ffd48a",  /* pale amber */
  "--color-2": "#ffb74d",  /* brighter amber */
  "--color-3": "#996515",  /* bronze amber (primary) */
  "--color-4": "#5a3b0f",  /* very dark brown/amber */
  "--color-5": "#1a0e05",  /* near‑black brown */
  "--color-6": "#7fd7d0"   /* teal accent for contrast */
},
    Purple: {
  "--color-1": "#e3c6ff",  /* light lavender */
  "--color-2": "#c19df0",  /* soft lilac */
  "--color-3": "#9467bd",  /* medium purple */
  "--color-4": "#6a4c93",  /* deep muted violet */
  "--color-5": "#3e2c41",  /* near‑black purple */
  "--color-6": "#007373"   /* teal accent (buttons, special actions) */
},
    Red: {
  "--color-1": "#e07b7b",  /* lightened red accent */
  "--color-2": "#b94c4c",  /* medium muted red */
  "--color-3": "#8b0000",  /* deep dark red (primary) */
  "--color-4": "#5a0000",  /* very dark wine red */
  "--color-5": "#1a0a0a",  /* near‑black with red undertones */
  "--color-6": "#008080"   /* teal highlight */
},
    Teal: {
  "--color-1": "#7fd7d0",  /* light aqua highlight */
  "--color-2": "#40a8a0",  /* medium teal */
  "--color-3": "#006d65",  /* deep teal (primary) */
  "--color-4": "#004944",  /* dark teal/greenish slate */
  "--color-5": "#0a1c1b",  /* near‑black teal base */
  "--color-6": "#666699"   /* mauve accent */
},
    Gray: {
  "--color-1": "#e0e0e0",  /* light gray */
  "--color-2": "#b0b0b0",  /* medium gray */
  "--color-3": "#4a4a4a",  /* charcoal gray (primary) */
  "--color-4": "#2c2c2c",  /* almost black */
  "--color-5": "#121212",  /* true dark base */
  "--color-6": "#5c5c3d"   /* accent contrast (military greenish) */
},
    Amoled: {
  "--color-1": "#FCE883",  /* message assistant */
  "--color-2": "#7A6174",  /* hover over content */
  "--color-3": "#E28D00",  /* Header */
  "--color-4": "#242424",  /* message user */
  "--color-5": "#000000",  /* True AMOLED black background */
  "--color-6": "#483519"   /* Brown for button */
}
  };

  const neutrals = {
    light: { "--bg": "hsl(0 0% 99%)", "--surface-1": "hsl(0 0% 98%)", "--surface-2": "hsl(0 0% 96%)", "--surface-hover": "hsl(0 0% 94%)", "--border": "hsl(0 0% 85%)", "--text": "hsl(0 0% 10%)", "--text-muted": "hsl(0 0% 45%)" },
    dark: { "--bg": "hsl(0 0% 8%)", "--surface-1": "hsl(0 0% 12%)", "--surface-2": "hsl(0 0% 16%)", "--surface-hover": "hsl(0 0% 20%)", "--border": "hsl(0 0% 30%)", "--text": "hsl(0 0% 92%)", "--text-muted": "hsl(0 0% 70%)" }
  };

  let currentPalette = localStorage.getItem("palette") || "Green";
  let currentMode = localStorage.getItem("mode") || "light";

  function applyTheme() {
    const root = document.documentElement;
    const palette = palettes[currentPalette];
    const neutralSet = neutrals[currentMode];
    for (const [key, value] of Object.entries(palette)) root.style.setProperty(key, value);
    for (const [key, value] of Object.entries(neutralSet)) root.style.setProperty(key, value);
    document.body.classList.toggle("dark-mode", currentMode === "dark");
    localStorage.setItem("palette", currentPalette);
    localStorage.setItem("mode", currentMode);
  }

  // ==========================
  // UTILITIES
  // ==========================
  function saveChats() {
    localStorage.setItem("secure_chat_chats", JSON.stringify(chats));
    localStorage.setItem("secure_chat_index", String(currentIndex));
  }

  function loadChats() {
    const raw = localStorage.getItem("secure_chat_chats");
    const idx = localStorage.getItem("secure_chat_index");
    if (raw) {
      chats = JSON.parse(raw);
      currentIndex = idx !== null ? Number(idx) : chats.length ? 0 : null;
    }
    if (!chats.length) createNewChat();
  }

  function formatTime(date = new Date()) {
    return date.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
  }

  // ==========================
  // WORKER INTEGRATION
  // ==========================
  async function loadChatsFromWorker() {
    try {
      const res = await fetch(`${WORKER_URL}/load`);
      if (!res.ok) return;
      const workerChats = await res.json();
      if (Array.isArray(workerChats) && workerChats.length) {
        chats = workerChats;
        currentIndex = 0;
        renderChatList();
        renderMessages();
      }
    } catch (e) {
      console.warn("Could not load chats from worker:", e);
    }
  }

  async function saveChatsToWorker() {
    try {
      await fetch(`${WORKER_URL}/save`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ chats }),
      });
    } catch (e) {
      console.warn("Could not save chats to worker:", e);
    }
  }

  // ==========================
  // CHAT FUNCTIONS
  // ==========================
  function createNewChat() {
    const newChat = { id: Date.now().toString(), title: "New Chat", messages: [] };
    chats.unshift(newChat);
    currentIndex = 0;
    saveChats();
    renderChatList();
    renderMessages();
    saveChatsToWorker();
  }

  function renderChatList() {
    chatListEl.innerHTML = "";
    chats.forEach((chat, i) => {
      const item = document.createElement("div");
      item.className = "chat-item" + (i === currentIndex ? " selected" : "");

      const preview = document.createElement("div");
      preview.className = "chat-preview";
      preview.innerHTML = `
        <div class="chat-title">${chat.title || "New Chat"}</div>
        <div class="chat-subtitle">
          ${(chat.messages && chat.messages.length > 0) ? chat.messages[chat.messages.length - 1].content.slice(0, 60) : ""}
        </div>
      `;

      const delBtn = document.createElement("button");
      delBtn.className = "delete-btn";
      delBtn.setAttribute("aria-label", "Delete chat");
      delBtn.textContent = "×";

      delBtn.addEventListener("click", (e) => {
        e.stopPropagation();
        chats.splice(i, 1);
        if (currentIndex === i) {
          currentIndex = chats.length ? 0 : null;
        } else if (currentIndex > i) {
          currentIndex--;
        }
        saveChats();
        renderChatList();
        renderMessages();
        saveChatsToWorker();
      });

      item.addEventListener("click", () => {
        currentIndex = i;
        renderChatList();
        renderMessages();
      });

      item.appendChild(preview);
      item.appendChild(delBtn);
      chatListEl.appendChild(item);
    });
  }

  function renderMessages() {
  messagesEl.innerHTML = "";
  headerEl.textContent = "ChatGPT"; 
  if (currentIndex === null || !chats[currentIndex]) return;
  const chat = chats[currentIndex];

  chat.messages.forEach(msg => {
    const div = document.createElement("div");
    div.className = `message ${msg.role}`;

    // text bubble
    const textDiv = document.createElement("div");
    textDiv.className = "msg-text";
    textDiv.textContent = msg.content;

    // timestamp
    const timeDiv = document.createElement("div");
    timeDiv.className = "msg-time";
    timeDiv.textContent = msg.time || "";

    // put timestamp inside the text container
    textDiv.appendChild(timeDiv);
    div.appendChild(textDiv);

    messagesEl.appendChild(div);
  });

  messagesEl.scrollTop = messagesEl.scrollHeight;
}

  // ==========================
  // SEND MESSAGE
  // ==========================
  async function sendMessage() {
    const text = inputEl.value.trim();
    if (!text) return;
    if (currentIndex === null) createNewChat();
    const chat = chats[currentIndex];
    const userMessage = { role: "user", content: text, time: formatTime() };
    chat.messages.push(userMessage);
    if (chat.title === "New Chat" || !chat.title) {
      const firstLine = text.split(/\r?\n/)[0];
      chat.title = firstLine.length > 40 ? firstLine.slice(0, 40) + "…" : firstLine;
    }
    const thinkingMessage = { role: "assistant", content: "Thinking...", time: formatTime() };
    chat.messages.push(thinkingMessage);
    renderMessages();
    inputEl.value = "";
    saveChats();
    saveChatsToWorker();

    try {
      const recentMessages = chat.messages.slice(-10);
      const res = await fetch(`${WORKER_URL}/chat`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ model: MODEL, messages: recentMessages }),
      });
      if (!res.ok) throw new Error(`Worker returned ${res.status}`);
      const data = await res.json();
      const answer = data?.choices?.[0]?.message?.content || "No response";
      chat.messages[chat.messages.length - 1] = { role: "assistant", content: answer, time: formatTime() };
    } catch (e) {
      chat.messages[chat.messages.length - 1] = { role: "assistant", content: "Error: " + e.message, time: formatTime() };
    }
    saveChats();
    saveChatsToWorker();
    renderMessages();
    renderChatList();
  }

  // ==========================
  // EVENT LISTENERS
  // ==========================
  document.getElementById("newChatBtn").addEventListener("click", createNewChat);
  document.getElementById("sendBtn").addEventListener("click", sendMessage);
  inputEl.addEventListener("keydown", e => { 
    if (e.key === "Enter" && !e.shiftKey) { 
      e.preventDefault(); 
      sendMessage(); 
    } 
  });

  // Palette selector init
  paletteSelector.value = currentPalette;

  // Theme icon toggling
  const darkIcon  = themeToggleBtn.querySelector(".dark-icon");
  const lightIcon = themeToggleBtn.querySelector(".light-icon");
  darkIcon.classList.toggle("hidden", currentMode === "dark");
  lightIcon.classList.toggle("hidden", currentMode === "light");

  // Light/Dark button
  themeToggleBtn.addEventListener("click", () => { 
    currentMode = currentMode === "light" ? "dark" : "light"; 
    darkIcon.classList.toggle("hidden", currentMode === "dark");
    lightIcon.classList.toggle("hidden", currentMode === "light");
    applyTheme(); 
  });

  // Palette dropdown toggle via 🎨 button
  paletteBtn.addEventListener("click", () => {
    paletteSelector.classList.toggle("hidden");
    if (!paletteSelector.classList.contains("hidden")) {
      paletteSelector.focus();
    }
  });

  paletteSelector.addEventListener("change", e => {
    currentPalette = e.target.value; 
    applyTheme();
    paletteSelector.classList.add("hidden"); // hide after selection
  });

  // Sidebar toggle
  toggleSidebarBtn.addEventListener("click", () => {
    const isHidden = sidebarEl.style.display === "none";
    sidebarEl.style.display = isHidden ? "flex" : "none";
    const hideIcon = toggleSidebarBtn.querySelector(".hide-icon");
    const showIcon = toggleSidebarBtn.querySelector(".show-icon");
    hideIcon.classList.toggle("hidden", !isHidden); 
    showIcon.classList.toggle("hidden", isHidden);
  });

  // ==========================
  // INITIAL LOAD
  // ==========================
  (async () => {
    applyTheme();
    await loadChatsFromWorker();
    loadChats();
    renderChatList();
    renderMessages();
  })();

});






















