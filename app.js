// ==========================
// CONFIG
// ==========================
const WORKER_URL = "https://gptapiv2.barney-willis2.workers.dev";

// Temporary user ID: will be asked once then stored in localStorage
let userId = localStorage.getItem("chat_user_id");
if (!userId) {
  userId = prompt("Enter a username to identify your chats:", "");
  localStorage.setItem("chat_user_id", userId);
  (async () => {
    await loadChatsFromWorker();
    loadChats();
    renderChatList();
    renderMessages();
  })();
}

let chats = [];
let currentIndex = null;
let currentModel = localStorage.getItem("chat_model") || "gpt-5.1-codex-mini";

document.addEventListener("DOMContentLoaded", () => {
  const chatListEl = document.getElementById("chatList");
  const messagesEl = document.getElementById("messages");
  const headerEl = document.getElementById("chatHeader").querySelector("span");
  const inputEl = document.getElementById("input");

  function autoResize() {
    inputEl.style.height = "auto";
    inputEl.style.height = Math.min(inputEl.scrollHeight, 200) + "px";
  }
  inputEl.addEventListener("input", autoResize);
  autoResize();

  const paletteSelector   = document.getElementById("paletteSelector");
  const themeToggleBtn    = document.getElementById("toggleThemeBtn");
  const sidebarEl         = document.querySelector(".sidebar");
  const toggleSidebarBtn  = document.getElementById("toggleSidebarBtn");

  const backdropEl = document.createElement("div");
  backdropEl.className = "sidebar-backdrop";
  document.body.appendChild(backdropEl);

  const paletteBtn = document.getElementById("themeBtn");

  const scrollTopBtn = document.getElementById("scrollTopBtn");
  const inputArea    = document.querySelector(".input-area");
  const textarea     = inputArea.querySelector("textarea");

  function updateScrollBtnPosition() {
    const inputHeight = inputArea.offsetHeight;
    scrollTopBtn.style.bottom = (inputHeight + 20) + "px";
  }
  updateScrollBtnPosition();
  textarea.addEventListener("input", updateScrollBtnPosition);
  window.addEventListener("resize", updateScrollBtnPosition);

  messagesEl.addEventListener("scroll", () => {
    scrollTopBtn.style.display = messagesEl.scrollTop > 200 ? "flex" : "none";
  });
  scrollTopBtn.addEventListener("click", () => {
    messagesEl.scrollTo({ top: 0, behavior: "smooth" });
  });

  const hamburgerIcon = toggleSidebarBtn.querySelector(".hide-icon");
  const chevronIcon   = toggleSidebarBtn.querySelector(".show-icon");

  function openSidebar() {
    if (window.innerWidth <= 768) {
      sidebarEl.classList.add("open");
      backdropEl.classList.add("visible");
    } else {
      sidebarEl.classList.remove("collapsed");
    }
    hamburgerIcon.classList.add("hidden");
    chevronIcon.classList.remove("hidden");
  }

  function closeSidebar() {
    if (window.innerWidth <= 768) {
      sidebarEl.classList.remove("open");
      backdropEl.classList.remove("visible");
    } else {
      sidebarEl.classList.add("collapsed");
    }
    hamburgerIcon.classList.remove("hidden");
    chevronIcon.classList.add("hidden");
  }

  function setInitialState() {
    if (window.innerWidth <= 768) {
      closeSidebar();
    } else {
      openSidebar();
      backdropEl.classList.remove("visible");
    }
  }
  setInitialState();

  toggleSidebarBtn.addEventListener("click", () => {
    if (window.innerWidth <= 768) {
      if (sidebarEl.classList.contains("open")) {
        closeSidebar();
      } else {
        openSidebar();
      }
    } else {
      if (sidebarEl.classList.contains("collapsed")) {
        openSidebar();
      } else {
        closeSidebar();
      }
    }
  });

  backdropEl.addEventListener("click", closeSidebar);

  let touchStartX = 0;
  document.addEventListener("touchstart", e => {
    if (window.innerWidth > 768) return;
    touchStartX = e.changedTouches[0].screenX;
  });
  document.addEventListener("touchend", e => {
    if (window.innerWidth > 768) return;
    const touchEndX = e.changedTouches[0].screenX;
    const deltaX = touchEndX - touchStartX;

    if (touchStartX < 50 && deltaX > 60 && !sidebarEl.classList.contains("open")) {
      openSidebar();
    }
    if (deltaX < -60 && sidebarEl.classList.contains("open")) {
      closeSidebar();
    }
  });

  const palettes = {
    Green: {
      "--color-1": "#94e8b4",
      "--color-2": "#72bda3",
      "--color-3": "#5e8c61",
      "--color-4": "#4e6151",
      "--color-5": "#3b322c",
      "--color-6": "#800000",
      "--color-7": "#f30000"
    },
    Blue: {
      "--color-1": "#6da5f8",
      "--color-2": "#3f5fa3",
      "--color-3": "#2c4f80",
      "--color-4": "#1e3759",
      "--color-5": "#0d1628",
      "--color-6": "#4e1818",
      "--color-7": "#ac3535"
    },
    Amber: {
      "--color-1": "#ffd48a",
      "--color-2": "#ffb74d",
      "--color-3": "#996515",
      "--color-4": "#5a3b0f",
      "--color-5": "#1a0e05",
      "--color-6": "#7fd7d0",
      "--color-7": "#a5e3de"
    },
    Purple: {
      "--color-1": "#e3c6ff",
      "--color-2": "#c19df0",
      "--color-3": "#9467bd",
      "--color-4": "#6a4c93",
      "--color-5": "#3e2c41",
      "--color-6": "#007373",
      "--color-7": "#00e9e9"
    },
    Red: {
      "--color-1": "#e07b7b",
      "--color-2": "#b94c4c",
      "--color-3": "#8b0000",
      "--color-4": "#5a0000",
      "--color-5": "#1a0a0a",
      "--color-6": "#008080",
      "--color-7": "#00f3f3"
    },
    Teal: {
      "--color-1": "#7fd7d0",
      "--color-2": "#40a8a0",
      "--color-3": "#006d65",
      "--color-4": "#004944",
      "--color-5": "#0a1c1b",
      "--color-6": "#666699",
      "--color-7": "#9494b8"
    },
    Gray: {
      "--color-1": "#e0e0e0",
      "--color-2": "#b0b0b0",
      "--color-3": "#4a4a4a",
      "--color-4": "#2c2c2c",
      "--color-5": "#121212",
      "--color-6": "#5c5c3d",
      "--color-7": "#9494b8"
    },
    Amoled: {
      "--color-1": "#eaff00",
      "--color-2": "#ffea00",
      "--color-3": "#ffbf00",
      "--color-4": "#fff7dc",
      "--color-5": "#000000",
      "--color-6": "#fff000",
      "--color-7": "#fff999"
    }
  };

  const neutrals = {
    light: {
      "--bg": "hsl(0 0% 99%)",
      "--surface-1": "hsl(0 0% 98%)",
      "--surface-2": "hsl(0 0% 96%)",
      "--surface-hover": "hsl(0 0% 94%)",
      "--border": "hsl(0 0% 85%)",
      "--text": "hsl(0 0% 10%)",
      "--text-muted": "hsl(0 0% 45%)"
    },
    dark: {
      "--bg": "hsl(0 0% 8%)",
      "--surface-1": "hsl(0 0% 12%)",
      "--surface-2": "hsl(0 0% 16%)",
      "--surface-hover": "hsl(0 0% 20%)",
      "--border": "hsl(0 0% 30%)",
      "--text": "hsl(0 0% 92%)",
      "--text-muted": "hsl(0 0% 70%)"
    },
    amoled: {
      "--bg": "#000000",
      "--surface-1": "#000000",
      "--surface-2": "#0a0a0a",
      "--surface-hover": "#111111",
      "--border": "#222222",
      "--text": "#000000",
      "--text-muted": "#333333"
    }
  };

  let currentPalette = localStorage.getItem("palette") || "Red";
  let currentMode = localStorage.getItem("mode") || "light";

  function applyTheme() {
    const root = document.documentElement;
    const palette = palettes[currentPalette];
    const neutralSet = currentPalette === "Amoled" ? neutrals.amoled : neutrals[currentMode];

    for (const [key, value] of Object.entries(palette)) {
      root.style.setProperty(key, value);
    }
    for (const [key, value] of Object.entries(neutralSet)) {
      root.style.setProperty(key, value);
    }

    document.body.classList.toggle("dark-mode", currentMode === "dark" || currentPalette === "Amoled");
    document.body.classList.toggle("amoled-mode", currentPalette === "Amoled");

    localStorage.setItem("palette", currentPalette);
    localStorage.setItem("mode", currentMode);
  }

  async function loadChats() {
    try {
      const res = await fetch(`${WORKER_URL}/load?userId=${encodeURIComponent(userId)}`);
      if (res.ok) {
        const workerChats = await res.json();
        if (Array.isArray(workerChats) && workerChats.length) {
          chats = workerChats;
          currentIndex = 0;
          localStorage.setItem("secure_chat_chats", JSON.stringify(chats));
          localStorage.setItem("secure_chat_index", String(currentIndex));
          return;
        }
      }
    } catch (err) {
      console.warn("Worker load failed, falling back to local:", err);
    }

    const raw = localStorage.getItem("secure_chat_chats");
    const idx = localStorage.getItem("secure_chat_index");
    if (raw) {
      try {
        chats = JSON.parse(raw);
        currentIndex = idx !== null ? Number(idx) : chats.length ? 0 : null;
        await saveChatsToWorker();
      } catch (e) {
        console.warn("Error parsing local chats:", e);
        chats = [];
        createNewChat();
      }
    } else {
      chats = [];
      createNewChat();
    }
  }

  function saveChats() {
    localStorage.setItem("secure_chat_chats", JSON.stringify(chats));
    localStorage.setItem("secure_chat_index", String(currentIndex));
    saveChatsToWorker();
  }

  async function saveChatsToWorker() {
    if (!userId) return;
    try {
      const res = await fetch(`${WORKER_URL}/save`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ userId, chats }),
      });
      if (!res.ok) console.warn("Worker save failed:", await res.text());
    } catch (e) {
      console.warn("Could not reach worker:", e);
    }
  }

  function formatDateTime(date = new Date()) {
    const day = String(date.getDate()).padStart(2, "0");
    const month = String(date.getMonth() + 1).padStart(2, "0");
    const year = date.getFullYear();
    const hours = String(date.getHours()).padStart(2, "0");
    const minutes = String(date.getMinutes()).padStart(2, "0");
    return `${hours}:${minutes}\n${day}/${month}/${year}`;
  }

  async function loadChatsFromWorker() {
    try {
      const res = await fetch(`${WORKER_URL}/load?userId=${encodeURIComponent(userId)}`);
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

  function createNewChat() {
    const newChat = { id: Date.now().toString(), title: "New Chat", messages: [] };
    chats.unshift(newChat);
    currentIndex = 0;
    saveChats();
    renderChatList();
    renderMessages();
    saveChatsToWorker();
  }

  function deleteChat(index) {
    if (index < 0 || index >= chats.length) return;
    chats.splice(index, 1);
    currentIndex = chats.length === 0 ? null : 0;
    saveChats();
    saveChatsToWorker();
    renderChatList();
    renderMessages();
  }

  function renderChatList() {
    chatListEl.innerHTML = "";
    chats.forEach((chat, i) => {
      const item = document.createElement("div");
      item.className = "chat-item" + (i === currentIndex ? " selected" : "");

      function truncate(str, n) {
        return str.length > n ? str.slice(0, n) + "…" : str;
      }

      const isMobile = window.matchMedia("(max-width: 768px)").matches;
      const titleLimit = isMobile ? 45 : 70;
      const subtitleLimit = isMobile ? 40 : 60;

      const preview = document.createElement("div");
      preview.className = "chat-preview";

      const title = truncate(chat.title || "New Chat", titleLimit);
      const subtitle = (chat.messages && chat.messages.length > 0)
        ? truncate(chat.messages[chat.messages.length - 1].content, subtitleLimit)
        : "";

      preview.innerHTML = `
        <div class="chat-title">${title}</div>
        <div class="chat-subtitle">${subtitle}</div>
      `;

      const delBtn = document.createElement("button");
      delBtn.className = "delete-btn";
      delBtn.setAttribute("aria-label", "Delete chat");
      delBtn.textContent = "×";
      delBtn.addEventListener("click", (e) => { e.stopPropagation(); deleteChat(i); });

      item.addEventListener("click", () => {
        const [chat] = chats.splice(i, 1);
        chats.unshift(chat);
        currentIndex = 0;
        saveChats();
        renderChatList();
        renderMessages();
        if (window.innerWidth <= 768) closeSidebar();
      });

      item.appendChild(preview);
      item.appendChild(delBtn);
      chatListEl.appendChild(item);
    });
  }

  function renderMessages() {
    messagesEl.innerHTML = "";
    headerEl.textContent = "ChatGPT";

    if (currentIndex === null || !chats[currentIndex]) {
      messagesEl.innerHTML = `<p class="placeholder">No chats yet. Start a new one!</p>`;
      return;
    }
    const chat = chats[currentIndex];
    if (!chat.messages || !chat.messages.length) {
      messagesEl.innerHTML = `<p class="placeholder">This chat is empty.</p>`;
      return;
    }

    chat.messages.forEach((msg, idx) => {
      const div = document.createElement("div");
      div.className = `message ${msg.role}`;
      const textDiv = document.createElement("div");
      textDiv.className = "msg-text";

      if (msg.content === "__TYPING__") {
        textDiv.innerHTML = `
          <div class="typing-indicator">
            <span></span><span></span><span></span>
          </div>
        `;
      } else {
        textDiv.textContent = msg.content;
      }

      const timeDiv = document.createElement("div");
      timeDiv.className = "msg-time";
      timeDiv.textContent = msg.time || "";
      textDiv.appendChild(timeDiv);
      div.appendChild(textDiv);

      if (msg.role === "assistant" && msg.content !== "__TYPING__") {
        const refreshBtn = document.createElement("button");
        refreshBtn.title = "Retry this user prompt";
        refreshBtn.className = "refresh-button";
        refreshBtn.innerHTML = `
          <svg viewBox="0 0 24 24" width="16" height="16"
               fill="none" stroke="currentColor" stroke-width="2"
               stroke-linecap="round" stroke-linejoin="round">
            <polyline points="23 4 23 10 17 10"></polyline>
            <polyline points="1 20 1 14 7 14"></polyline>
            <path d="M3.51 9a9 9 0 0 1 14.85-3.36L23 10M1 14l4.64 4.36A9 9 0 0 0 20.49 15"/>
          </svg>
        `;

        let originalPrompt = "";
        for (let j = idx - 1; j >= 0; j--) {
          if (chat.messages[j].role === "user") {
            originalPrompt = chat.messages[j].content;
            break;
          }
        }

        refreshBtn.onclick = () => {
          chat.messages.splice(idx, 1);
          renderMessages();
          sendMessageRetry(originalPrompt);
        };

        div.appendChild(refreshBtn);
      }

      messagesEl.appendChild(div);
    });

    messagesEl.scrollTop = messagesEl.scrollHeight;
  }

  async function sendMessage() {
    const text = inputEl.value.trim();
    if (!text) return;
    if (currentIndex === null) createNewChat();
    const chat = chats[currentIndex];

    const userMessage = { role: "user", content: text, time: formatDateTime() };
    chat.messages.push(userMessage);

    if (chat.title === "New Chat" || !chat.title) {
      const firstLine = text.split(/\r?\n/)[0];
      chat.title = firstLine.length > 40 ? firstLine.slice(0, 40) + "…" : firstLine;
    }

    chat.messages.push({ role: "assistant", content: "__TYPING__", time: formatDateTime() });
    renderMessages();
    inputEl.value = "";
    autoResize();
    saveChats();
    saveChatsToWorker();

    try {
      const cleanMessages = chat.messages
        .filter(m => m.content !== "__TYPING__")
        .slice(-10);

      const res = await fetch(`${WORKER_URL}/chat`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          model: currentModel,
          messages: cleanMessages
        }),
      });

      if (!res.ok) {
        const errText = await res.text();
        throw new Error(`Worker returned ${res.status}: ${errText}`);
      }

      const data = await res.json();
      const answer =
  data?.output_text ||
  (data?.output && data.output[0]?.content && data.output[0].content[0]?.text) ||
  "No response";

      chat.messages[chat.messages.length - 1] = {
        role: "assistant",
        content: answer,
        time: formatDateTime()
      };
    } catch (e) {
      chat.messages[chat.messages.length - 1] = {
        role: "assistant",
        content: "Error: " + e.message,
        time: formatDateTime()
      };
    }

    saveChats();
    saveChatsToWorker();
    renderMessages();
    renderChatList();
  }

  async function sendMessageRetry(promptText) {
    if (!promptText) return;
    if (currentIndex === null) createNewChat();
    const chat = chats[currentIndex];

    const userMessage = { role: "user", content: promptText, time: formatDateTime() };
    chat.messages.push(userMessage);

    chat.messages.push({ role: "assistant", content: "__TYPING__", time: formatDateTime() });
    renderMessages();
    saveChats();
    saveChatsToWorker();

    try {
      const cleanMessages = chat.messages
        .filter(m => m.content !== "__TYPING__")
        .slice(-10);

      const res = await fetch(`${WORKER_URL}/chat`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          model: currentModel,
          messages: cleanMessages,
        }),
      });

      if (!res.ok) {
        const errText = await res.text();
        throw new Error(`Worker returned ${res.status}: ${errText}`);
      }

      const data = await res.json();
      const answer =
  data?.output_text ||
  (data?.output && data.output[0]?.content && data.output[0].content[0]?.text) ||
  "No response";

      chat.messages[chat.messages.length - 1] = {
        role: "assistant",
        content: answer,
        time: formatDateTime(),
      };
    } catch (e) {
      chat.messages[chat.messages.length - 1] = {
        role: "assistant",
        content: "Error: " + e.message,
        time: formatDateTime(),
      };
    }

    saveChats();
    saveChatsToWorker();
    renderMessages();
    renderChatList();
  }

  document.getElementById("newChatBtn").addEventListener("click", () => {
    createNewChat();
    if (window.innerWidth <= 768) closeSidebar();
  });
  document.getElementById("sendBtn").addEventListener("click", sendMessage);
  inputEl.addEventListener("keydown", e => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      sendMessage();
    }
  });

  paletteSelector.value = currentPalette;
  const darkIcon  = themeToggleBtn.querySelector(".dark-icon");
  const lightIcon = themeToggleBtn.querySelector(".light-icon");
  darkIcon.classList.toggle("hidden", currentMode === "dark");
  lightIcon.classList.toggle("hidden", currentMode === "light");

  themeToggleBtn.addEventListener("click", () => {
    currentMode = currentMode === "light" ? "dark" : "light";
    darkIcon.classList.toggle("hidden", currentMode === "dark");
    lightIcon.classList.toggle("hidden", currentMode === "light");
    applyTheme();
  });

  paletteBtn.addEventListener("click", () => {
    paletteSelector.classList.toggle("hidden");
    if (!paletteSelector.classList.contains("hidden")) {
      paletteSelector.focus();
    }
  });

  paletteSelector.addEventListener("change", e => {
    currentPalette = e.target.value;
    applyTheme();
    paletteSelector.classList.add("hidden");
  });

  (async () => {
    applyTheme();

    if (!userId) {
      userId = prompt("Enter a username to identify your chats:", "");
      if (!userId) {
        alert("You must enter a username to continue");
        return;
      }
      localStorage.setItem("chat_user_id", userId);
    }

    let gotFromWorker = false;
    try {
      const res = await fetch(`${WORKER_URL}/load?userId=${encodeURIComponent(userId)}`);
      if (res.ok) {
        const workerChats = await res.json();
        if (Array.isArray(workerChats) && workerChats.length) {
          chats = workerChats;
          const savedIndex = Number(localStorage.getItem("secure_chat_index"));
          if (!isNaN(savedIndex) && savedIndex >= 0 && savedIndex < chats.length) {
            const [activeChat] = chats.splice(savedIndex, 1);
            chats.unshift(activeChat);
            currentIndex = 0;
          } else {
            currentIndex = 0;
          }
          saveChats();
          gotFromWorker = true;
        }
      }
    } catch (e) {
      console.warn("Could not load from worker:", e);
    }

    if (!gotFromWorker) {
      loadChats();
    }

    renderChatList();
    renderMessages();
  })();
});
