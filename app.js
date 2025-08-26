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
  const themeBtn = document.getElementById("toggleThemeBtn");
  const sidebarEl = document.querySelector(".sidebar");
  const toggleSidebarBtn = document.getElementById("toggleSidebarBtn");

  // ==========================
  // PALETTE & THEME
  // ==========================
  const palettes = {
    Green: { "--color-1": "#94e8b4", "--color-2": "#72bda3", "--color-3": "#5e8c61", "--color-4": "#4e6151", "--color-5": "#3b322c", "--color-6": "#800000" },
    Blue: { "--color-1": "#b3cfff", "--color-2": "#7a9eff", "--color-3": "#437f97", "--color-4": "#2c5c63", "--color-5": "#1a1c2c", "--color-6": "#F67c03" },
    Orange: { "--color-1": "#ffd6a5", "--color-2": "#ffb347", "--color-3": "#ff7f50", "--color-4": "#cc5500", "--color-5": "#662200", "--color-6": "#0f4d92" },
    Purple: { "--color-1": "#2e0219", "--color-2": "#4a001f", "--color-3": "#6a0f49", "--color-4": "#6c9d9a", "--color-5": "#95eee9", "--color-6": "#800000" }
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
    const newChat = {
      id: Date.now().toString(),
      title: "New Chat",
      messages: [],
    };
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
    headerEl.textContent = "Barney's ChatGPT"; 

    if (currentIndex === null || !chats[currentIndex]) return;

    const chat = chats[currentIndex];

    chat.messages.forEach(msg => {
      const div = document.createElement("div");
      div.className = `message ${msg.role}`;
      div.innerText = msg.content;

      const timeDiv = document.createElement("div");
      timeDiv.className = "msg-time";
      timeDiv.textContent = msg.time || "";

      div.appendChild(timeDiv);
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

  // ==========================
  // Palette & Theme (UPDATED FOR ICONS)
  // ==========================
  paletteSelector.value = currentPalette;

  const darkIcon = themeBtn.querySelector(".dark-icon");
  const lightIcon = themeBtn.querySelector(".light-icon");

  // Set initial icon state
  darkIcon.classList.toggle("hidden", currentMode === "dark");
  lightIcon.classList.toggle("hidden", currentMode === "light");

  paletteSelector.addEventListener("change", e => {
    currentPalette = e.target.value; 
    applyTheme(); 
  });

  themeBtn.addEventListener("click", () => { 
    currentMode = currentMode === "light" ? "dark" : "light"; 
    darkIcon.classList.toggle("hidden", currentMode === "dark");
    lightIcon.classList.toggle("hidden", currentMode === "light");
    applyTheme(); 
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
