// ==========================
// CONFIG
// ==========================
const WORKER_URL = "https://gptapiv2.barney-willis2.workers.dev";

// Temporary user ID: will be asked once then stored in localStorage
let userId = localStorage.getItem("chat_user_id");
if (!userId) {
  userId = prompt("Enter a username to identify your chats:", "");
  localStorage.setItem("chat_user_id", userId);
   // 👇 Immediately try loading chats for this new user
  (async () => {
    await loadChatsFromWorker();
    loadChats();
    renderChatList();
    renderMessages();
  })();
}

let chats = [];
let currentIndex = null;
let currentModel = localStorage.getItem("chat_model") || "gpt-5-chat-latest";

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

// --- Scroll-to-top FAB behaviour ---
const scrollTopBtn = document.getElementById("scrollTopBtn");
const inputArea = document.querySelector(".input-area");
const textarea  = inputArea.querySelector("textarea");

// adjust button bottom depending on input area height
function updateScrollBtnPosition() {
  const inputHeight = inputArea.offsetHeight;
  scrollTopBtn.style.bottom = (inputHeight + 20) + "px"; // 20px gap
}

// run once on load
updateScrollBtnPosition();

// update whenever textarea grows/shrinks
textarea.addEventListener("input", updateScrollBtnPosition);
window.addEventListener("resize", updateScrollBtnPosition);

// existing scroll behaviour
messagesEl.addEventListener("scroll", () => {
  scrollTopBtn.style.display = messagesEl.scrollTop > 200 ? "flex" : "none";
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
      "--color-1": "#eaff00",  // assistant chat
      "--color-2": "#ffea00",  // user chat
      "--color-3": "#ffbf00",  // header
      "--color-4": "#ffff9d",  // background
      "--color-5": "#000000",  // pure black background
      "--color-6": "#fffF00"   // buttons
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
      "--text-muted": "hsl(0 0% 70%)",
       "--primary-contrast": "#ffffff"     // white text on dark mode buttons
    },
     amoled: {
    "--bg": "#000000",            // pure black
    "--surface-1": "#000000",     // keep components flush
    "--surface-2": "#0a0a0a",     // just a tiny lift
    "--surface-hover": "#111111", // barely visible hover
    "--border": "#222222",        // thin subtle border
    "--text": "#000000",          // high contrast text
    "--text-muted": "#333333",     // muted gray
    "--primary-contrast": "#000000"  // make button text black
     }
  };

  let currentPalette = localStorage.getItem("palette") || "Red";
  let currentMode = localStorage.getItem("mode") || "light";

  function applyTheme() {
  const root = document.documentElement;
  const palette = palettes[currentPalette];
  
  // use AMOLED neutrals if selected
  const neutralSet = currentPalette === "Amoled"
    ? neutrals.amoled
    : neutrals[currentMode];

  for (const [key, value] of Object.entries(palette)) {
    root.style.setProperty(key, value);
  }
  for (const [key, value] of Object.entries(neutralSet)) {
    root.style.setProperty(key, value);
  }

  // treat AMOLED as dark mode too
  document.body.classList.toggle(
    "dark-mode",
    currentMode === "dark" || currentPalette === "Amoled"
  );

  document.body.classList.toggle("amoled-mode", currentPalette === "Amoled");

  localStorage.setItem("palette", currentPalette);
  localStorage.setItem("mode", currentMode);
}

// ==========================
// UTILITIES
// ==========================

// Always prefer Worker (cloud) as master, fallback to local only if Worker empty
async function loadChats() {
  try {
    const res = await fetch(`${WORKER_URL}/load?userId=${encodeURIComponent(userId)}`);
    if (res.ok) {
      const workerChats = await res.json();
      if (Array.isArray(workerChats) && workerChats.length) {
        // ✅ Cloud takes precedence
        chats = workerChats;
        currentIndex = 0;
        // Keep local cache in sync
        localStorage.setItem("secure_chat_chats", JSON.stringify(chats));
        localStorage.setItem("secure_chat_index", String(currentIndex));
        return;
      }
    }
  } catch (err) {
    console.warn("Worker load failed, falling back to local:", err);
  }

  // ⚠️ Worker empty or unreachable → fallback on local
  const raw = localStorage.getItem("secure_chat_chats");
  const idx = localStorage.getItem("secure_chat_index");
  if (raw) {
    try {
      chats = JSON.parse(raw);
      currentIndex = idx !== null ? Number(idx) : chats.length ? 0 : null;
      // Push local copy up so it’s available on cloud next time
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

// Save locally and push to Worker
function saveChats() {
  // Local cache
  localStorage.setItem("secure_chat_chats", JSON.stringify(chats));
  localStorage.setItem("secure_chat_index", String(currentIndex));
  // Sync cloud
  saveChatsToWorker();
}

// Helper: actually send to Worker
async function saveChatsToWorker() {
  if (!userId) return;
  try {
    const res = await fetch(`${WORKER_URL}/save`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ userId, chats }),
    });
    if (!res.ok) {
      console.warn("Worker save failed:", await res.text());
    }
  } catch (e) {
    console.warn("Could not reach worker:", e);
  }
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

      // helper to truncate and add … if too long
function truncate(str, n) {
  return str.length > n ? str.slice(0, n) + "…" : str;
}

// check if we’re on mobile (≤768px wide)
const isMobile = window.matchMedia("(max-width: 768px)").matches;

// choose limits based on screen size
const titleLimit    = isMobile ? 45 : 70;
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

    // ⟳ Add refresh button only on assistant messages
    if (msg.role === "assistant" && msg.content !== "__TYPING__") {
      const refreshBtn = document.createElement("button");
      refreshBtn.innerText = "⟳";
      refreshBtn.title = "Retry this user prompt";
      refreshBtn.className = "refresh-button";

      // Associate assistant response with its preceding user prompt
      // Find the nearest user message BEFORE this assistant
      let originalPrompt = "";
      for (let j = idx - 1; j >= 0; j--) {
        if (chat.messages[j].role === "user") {
          originalPrompt = chat.messages[j].content;
          break;
        }
      }
      refreshBtn.onclick = () => {
        // Remove old assistant message then retry
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
      body: JSON.stringify({
        model: currentModel,                  // ✅ uses user‑selected/current model
        messages: chat.messages.slice(-10)    // only send the last 10 messages
      }),
    });

    if (!res.ok) throw new Error(`Worker returned ${res.status}`);

    const data = await res.json();
    const answer = data?.choices?.[0]?.message?.content || "No response";

    // Replace typing placeholder with actual assistant reply
    chat.messages[chat.messages.length - 1] = {
      role: "assistant",
      content: answer,
      time: formatTime()
    };
  } catch (e) {
    // Replace typing placeholder with error message
    chat.messages[chat.messages.length - 1] = {
      role: "assistant",
      content: "Error: " + e.message,
      time: formatTime()
    };
  }

  saveChats();
  saveChatsToWorker();
  renderMessages();
  renderChatList();
}

// ==========================
// SEND MESSAGE (RETRY HELPER)
// ==========================
async function sendMessageRetry(promptText) {
  if (!promptText) return;
  if (currentIndex === null) createNewChat();
  const chat = chats[currentIndex];

  const userMessage = { role: "user", content: promptText, time: formatTime() };
  chat.messages.push(userMessage);

  chat.messages.push({ role: "assistant", content: "__TYPING__", time: formatTime() });
  renderMessages();
  saveChats();
  saveChatsToWorker();

  try {
    const res = await fetch(`${WORKER_URL}/chat`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        model: currentModel,
        messages: chat.messages.slice(-10),
      }),
    });
    if (!res.ok) throw new Error(`Worker returned ${res.status}`);
    const data = await res.json();
    const answer = data?.choices?.[0]?.message?.content || "No response";

    chat.messages[chat.messages.length - 1] = {
      role: "assistant",
      content: answer,
      time: formatTime(),
    };
  } catch (e) {
    chat.messages[chat.messages.length - 1] = {
      role: "assistant",
      content: "Error: " + e.message,
      time: formatTime(),
    };
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

// ==========================
// Sidebar toggle & swipe (mobile only)
// ==========================
const sidebar   = document.querySelector(".sidebar");
const toggleBtn = document.getElementById("toggleSidebarBtn");
const backdrop  = document.querySelector(".sidebar-backdrop");

// Toggle handler
toggleBtn.addEventListener("click", () => {
  if (window.innerWidth <= 768) {
    // Mobile: slide-in drawer
    const isOpen = sidebar.classList.toggle("open");
    backdrop.classList.toggle("visible", isOpen);
  } else {
    // Desktop: collapse/expand
    sidebar.classList.toggle("hidden");
  }
});

// Backdrop click closes drawer on mobile
backdrop.addEventListener("click", () => {
  sidebar.classList.remove("open");
  backdrop.classList.remove("visible");
});

// =======================
// Swipe gestures (mobile)
// =======================
let touchStartX = 0;

document.addEventListener("touchstart", e => {
  if (window.innerWidth > 768) return; // only enable on mobile
  touchStartX = e.changedTouches[0].screenX;
});

document.addEventListener("touchend", e => {
  if (window.innerWidth > 768) return;
  const touchEndX = e.changedTouches[0].screenX;
  const deltaX = touchEndX - touchStartX;

  // Swipe right from left edge → open
  if (touchStartX < 50 && deltaX > 60 && !sidebar.classList.contains("open")) {
    sidebar.classList.add("open");
    backdrop.classList.add("visible");
  }

  // Swipe left → close
  if (deltaX < -60 && sidebar.classList.contains("open")) {
    sidebar.classList.remove("open");
    backdrop.classList.remove("visible");
  }
});

// ==========================
  // INITIAL LOAD
  // ==========================
  (async () => {
    applyTheme();

    // 1. Make sure we have a userId
    if (!userId) {
      userId = prompt("Enter a username to identify your chats:", "");
      if (!userId) {
        alert("You must enter a username to continue");
        return; // stop if no username given
      }
      localStorage.setItem("chat_user_id", userId);
    }

    // 2. Try loading chats from the Worker
    let gotFromWorker = false;
    try {
      const res = await fetch(`${WORKER_URL}/load?userId=${encodeURIComponent(userId)}`);
      if (res.ok) {
        const workerChats = await res.json();
        if (Array.isArray(workerChats) && workerChats.length) {
          chats = workerChats;
          currentIndex = 0;
          saveChats(); // sync Worker data back into local storage
          gotFromWorker = true;
        }
      }
    } catch (e) {
      console.warn("Could not load from worker:", e);
    }

    // 3. Fallback to localStorage if Worker had nothing
    if (!gotFromWorker) {
      loadChats();
    }

    // 4. Render UI
    renderChatList();
    renderMessages();
  })();

}); 














