// ==========================
// CONFIG
// ==========================
const WORKER_URL = "https://gptapiv2.barney-willis2.workers.dev";
const MODEL = "gpt-5-chat-latest";

// Temporary user ID: will be asked once then stored in localStorage
let userId = localStorage.getItem("chat_user_id");
if (!userId) {
  userId = prompt("Enter a username to identify your chats:", "guest1");
  localStorage.setItem("chat_user_id", userId);
}

let chats = [];
let currentIndex = null;

document.addEventListener("DOMContentLoaded", () => {
  // DOM elements
  const chatListEl = document.getElementById("chatList");
  const messagesEl = document.getElementById("messages");
  const headerEl = document.getElementById("chatHeader").querySelector("span");
  const inputEl = document.getElementById("input");
  // ==========================
  // AUTO-RESIZE TEXTAREA
  // ==========================
  function autoResize() {
    inputEl.style.height = "auto"; // reset so it can shrink
    inputEl.style.height = Math.min(inputEl.scrollHeight, 200) + "px";
  }

  inputEl.addEventListener("input", autoResize);
  // run once on load
  autoResize();
  const paletteSelector = document.getElementById("paletteSelector");
  const themeToggleBtn = document.getElementById("toggleThemeBtn"); // 🌙/☀️ toggle
  const sidebarEl = document.querySelector(".sidebar");
  const toggleSidebarBtn = document.getElementById("toggleSidebarBtn");
  // Create backdrop for sidebar
const backdropEl = document.createElement("div");
backdropEl.className = "sidebar-backdrop";
document.body.appendChild(backdropEl);
  const paletteBtn = document.getElementById("themeBtn"); // 🎨 palette button

const scrollTopBtn = document.getElementById("scrollTopBtn");
messagesEl.addEventListener("scroll", () => {
  if (messagesEl.scrollTop > 200) {
    scrollTopBtn.style.display = "flex";
  } else {
    scrollTopBtn.style.display = "none";
  }
});

scrollTopBtn.addEventListener("click", () => {
  messagesEl.scrollTo({ top: 0, behavior: "smooth" });
});
  
  // ==========================
  // PALETTE & THEME
  // ==========================
  const palettes = {
    Green: {
      "--color-1": "#94e8b4",
      "--color-2": "#72bda3",
      "--color-3": "#5e8c61",
      "--color-4": "#4e6151",
      "--color-5": "#3b322c",
      "--color-6": "#800000"
    },
    Blue: {
      "--color-1": "#6da5f8",
      "--color-2": "#3f5fa3",
      "--color-3": "#2c4f80",
      "--color-4": "#1e3759",
      "--color-5": "#0d1628",
      "--color-6": "#4e1818"
    },
    Amber: {
      "--color-1": "#ffd48a",
      "--color-2": "#ffb74d",
      "--color-3": "#996515",
      "--color-4": "#5a3b0f",
      "--color-5": "#1a0e05",
      "--color-6": "#7fd7d0"
    },
    Purple: {
      "--color-1": "#e3c6ff",
      "--color-2": "#c19df0",
      "--color-3": "#9467bd",
      "--color-4": "#6a4c93",
      "--color-5": "#3e2c41",
      "--color-6": "#007373"
    },
    Red: {
      "--color-1": "#e07b7b",
      "--color-2": "#b94c4c",
      "--color-3": "#8b0000",
      "--color-4": "#5a0000",
      "--color-5": "#1a0a0a",
      "--color-6": "#008080"
    },
    Teal: {
      "--color-1": "#7fd7d0",
      "--color-2": "#40a8a0",
      "--color-3": "#006d65",
      "--color-4": "#004944",
      "--color-5": "#0a1c1b",
      "--color-6": "#666699"
    },
    Gray: {
      "--color-1": "#e0e0e0",
      "--color-2": "#b0b0b0",
      "--color-3": "#4a4a4a",
      "--color-4": "#2c2c2c",
      "--color-5": "#121212",
      "--color-6": "#5c5c3d"
    },
    Amoled: {
      "--color-1": "#FCE883",
      "--color-2": "#08415C",
      "--color-3": "#ffbf00",
      "--color-4": "#242424",
      "--color-5": "#000000",
      "--color-6": "#846C5B"
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
    }
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

  async function saveChatsToWorker() {
    try {
      await fetch(`${WORKER_URL}/save`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ userId, chats }),
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

  function deleteChat(index) {
    if (index < 0 || index >= chats.length) return;
    chats.splice(index, 1);
    if (chats.length === 0) {
      currentIndex = null;
    } else if (currentIndex >= chats.length) {
      currentIndex = chats.length - 1;
    }
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
      delBtn.addEventListener("click", (e) => { e.stopPropagation(); deleteChat(i); });

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

    if (currentIndex === null || !chats[currentIndex]) {
      messagesEl.innerHTML = `<p class="placeholder">No chats yet. Start a new one!</p>`;
      return;
    }
    const chat = chats[currentIndex];
    if (!chat.messages || !chat.messages.length) {
      messagesEl.innerHTML = `<p class="placeholder">This chat is empty.</p>`;
      return;
    }

    chat.messages.forEach(msg => {
      const div = document.createElement("div");
      div.className = `message ${msg.role}`;
      const textDiv = document.createElement("div");
      textDiv.className = "msg-text";

      // Typing indicator support
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
    // Add typing placeholder
    chat.messages.push({ role: "assistant", content: "__TYPING__", time: formatTime() });
    renderMessages();
    inputEl.value = "";
    autoResize();   // reset height after clearing
    saveChats();
    saveChatsToWorker();

    try {
      const res = await fetch(`${WORKER_URL}/chat`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ model: MODEL, messages: chat.messages.slice(-10) }),
      });
      if (!res.ok) throw new Error(`Worker returned ${res.status}`);
      const data = await res.json();
      const answer = data?.choices?.[0]?.message?.content || "No response";
      // Replace typing placeholder
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
  const isOpen = sidebarEl.classList.toggle("open");
  backdropEl.classList.toggle("visible", isOpen);
});

// Close when clicking backdrop
backdropEl.addEventListener("click", () => {
  sidebarEl.classList.remove("open");
  backdropEl.classList.remove("visible");
});
  
  let touchStartX = 0;

document.addEventListener("touchstart", e => {
  touchStartX = e.changedTouches[0].screenX;
});

document.addEventListener("touchend", e => {
  const touchEndX = e.changedTouches[0].screenX;
  const deltaX = touchEndX - touchStartX;

  // swipe right to open (from left edge only)
  if (touchStartX < 50 && deltaX > 60 && !sidebarEl.classList.contains("open")) {
    sidebarEl.classList.add("open");
    backdropEl.classList.add("visible");
  }

  // swipe left to close
  if (deltaX < -60 && sidebarEl.classList.contains("open")) {
    sidebarEl.classList.remove("open");
    backdropEl.classList.remove("visible");
  }
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



