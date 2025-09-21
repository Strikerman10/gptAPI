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

const paletteSelector   = document.getElementById("paletteSelector");
const themeToggleBtn    = document.getElementById("toggleThemeBtn"); // 🌙/☀️ toggle
const sidebarEl         = document.querySelector(".sidebar");
const toggleSidebarBtn  = document.getElementById("toggleSidebarBtn");

// Create backdrop for sidebar
const backdropEl = document.createElement("div");
backdropEl.className = "sidebar-backdrop";
document.body.appendChild(backdropEl);

const paletteBtn = document.getElementById("themeBtn"); // 🎨 palette button

// ==============================
// Scroll-to-top Button Behaviour
// ==============================
function placeScrollButton() {
  const btn = document.getElementById("scrollTopBtn");
  const lastMessage = document.querySelector(".message:last-child");
  if (!btn || !lastMessage) return;

  if (window.innerWidth <= 600) {
    const msgTime = lastMessage.querySelector(".msg-time");

    if (msgTime) {
      // Actually move button *after* the timestamp node
      msgTime.insertAdjacentElement("afterend", btn);
    } else {
      lastMessage.appendChild(btn);
    }

    btn.classList.add("inside-message");
    btn.style.position = "static";  // ✅ no more absolute positioning
    btn.style.marginTop = "6px";    // spacing below the time
    btn.style.alignSelf = "flex-end"; // right-align at end if using flexbox bubbles
  } else {
    // restore to body as floating FAB
    document.body.appendChild(btn);
    btn.classList.remove("inside-message");
    btn.removeAttribute("style"); // clear inline tweaks
  }
}

const scrollTopBtn = document.getElementById("scrollTopBtn");
const inputArea    = document.querySelector(".input-area");
const textarea     = inputArea.querySelector("textarea");

// (A) Adjust desktop “fixed” bottom offset as input grows
function updateScrollBtnPosition() {
  if (window.innerWidth > 600 && scrollTopBtn) {
    scrollTopBtn.style.bottom = (inputArea.offsetHeight + 20) + "px";
  }
}
textarea.addEventListener("input", updateScrollBtnPosition);
window.addEventListener("resize", () => {
  updateScrollBtnPosition();
  placeScrollButton();
});

// (B) Toggle show/hide based on scroll position
messagesEl.addEventListener("scroll", () => {
  if (!scrollTopBtn) return;
  scrollTopBtn.style.display = messagesEl.scrollTop > 200 ? "flex" : "none";
  placeScrollButton();
});

// (C) Button click → smooth scroll to top
if (scrollTopBtn) {
  scrollTopBtn.addEventListener("click", () => {
    messagesEl.scrollTo({ top: 0, behavior: "smooth" });
  });
}

// Initial setup
placeScrollButton();
updateScrollBtnPosition();

// ==============================
// Sidebar toggle with icon swap
// ==============================
const hamburgerIcon = toggleSidebarBtn.querySelector(".hide-icon"); // hamburger svg
const chevronIcon   = toggleSidebarBtn.querySelector(".show-icon"); // chevron svg

function openSidebar() {
  if (window.innerWidth <= 768) {
    // MOBILE drawer mode
    sidebarEl.classList.add("open");
    backdropEl.classList.add("visible");
  } else {
    // DESKTOP expanded
    sidebarEl.classList.remove("collapsed");
  }
  hamburgerIcon.classList.add("hidden");
  chevronIcon.classList.remove("hidden");
}

function closeSidebar() {
  if (window.innerWidth <= 768) {
    // MOBILE drawer close
    sidebarEl.classList.remove("open");
    backdropEl.classList.remove("visible");
  } else {
    // DESKTOP collapsed
    sidebarEl.classList.add("collapsed");
  }
  hamburgerIcon.classList.remove("hidden");
  chevronIcon.classList.add("hidden");
}

function setInitialState() {
  if (window.innerWidth <= 768) {
    // Mobile loads closed
    closeSidebar();
  } else {
    // Desktop loads expanded
    openSidebar();
    backdropEl.classList.remove("visible"); // no backdrop in desktop
  }
}
setInitialState();

// Toggle button
toggleSidebarBtn.addEventListener("click", () => {
  if (window.innerWidth <= 768) {
    // Mobile check
    if (sidebarEl.classList.contains("open")) {
      closeSidebar();
    } else {
      openSidebar();
    }
  } else {
    // Desktop check
    if (sidebarEl.classList.contains("collapsed")) {
      openSidebar();
    } else {
      closeSidebar();
    }
  }
});

// Backdrop click → mobile close only
backdropEl.addEventListener("click", closeSidebar);

// =======================
// Swipe gestures (mobile)
// =======================
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
      "--color-1": "#eaff00",  // assistant chat
      "--color-2": "#ffea00",  // user chat
      "--color-3": "#ffbf00",  // header
      "--color-4": "#fff7dc",  // background
      "--color-5": "#000000",  // pure black background
      "--color-6": "#fff000",  // buttons
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
    "--bg": "#000000",            // pure black
    "--surface-1": "#000000",     // keep components flush
    "--surface-2": "#0a0a0a",     // just a tiny lift
    "--surface-hover": "#111111", // barely visible hover
    "--border": "#222222",        // thin subtle border
    "--text": "#000000",          // high contrast text
    "--text-muted": "#333333"     // muted gray
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

function formatDateTime(date = new Date()) {
  const day = String(date.getDate()).padStart(2, '0');
  const month = String(date.getMonth() + 1).padStart(2, '0'); // zero-based
  const year = date.getFullYear();

  const hours = String(date.getHours()).padStart(2, '0');
  const minutes = String(date.getMinutes()).padStart(2, '0');

  return `${hours}:${minutes}\n${day}/${month}/${year}`;
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

  // Remove selected chat
  chats.splice(index, 1);

  if (chats.length === 0) {
    currentIndex = null;
  } else {
    // Always keep the *first chat* as active (since Option B keeps active chats at top)
    currentIndex = 0;
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
  // Move selected chat to the top
  const [chat] = chats.splice(i, 1);
  chats.unshift(chat);
  currentIndex = 0; // always point to the top one now

  saveChats();        // ✅ persist selection & index
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

    if (msg.role === "assistant" && msg.content !== "__TYPING__") {
  const refreshBtn = document.createElement("button");
  refreshBtn.title = "Retry this user prompt";
  refreshBtn.className = "refresh-button";

  // insert SVG instead of text
  refreshBtn.innerHTML = `
    <svg viewBox="0 0 24 24" width="16" height="16"
         fill="none" stroke="currentColor" stroke-width="2" 
         stroke-linecap="round" stroke-linejoin="round">
      <polyline points="23 4 23 10 17 10"></polyline>
      <polyline points="1 20 1 14 7 14"></polyline>
      <path d="M3.51 9a9 9 0 0 1 14.85-3.36L23 10M1 14l4.64 4.36A9 9 0 0 0 20.49 15"/>
    </svg>
  `;

  // Associate this assistant message with the user prompt before it
  let originalPrompt = "";
  for (let j = idx - 1; j >= 0; j--) {
    if (chat.messages[j].role === "user") {
      originalPrompt = chat.messages[j].content;
      break;
    }
  }

  refreshBtn.onclick = () => {
    // remove old assistant msg and retry
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

  const userMessage = { role: "user", content: text, time: formatDateTime() };
  chat.messages.push(userMessage);

  if (chat.title === "New Chat" || !chat.title) {
    const firstLine = text.split(/\r?\n/)[0];
    chat.title = firstLine.length > 40 ? firstLine.slice(0, 40) + "…" : firstLine;
  }

  // Add typing placeholder
  chat.messages.push({ role: "assistant", content: "__TYPING__", time: formatDateTime() });
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
      time: formatDateTime()
    };
  } catch (e) {
    // Replace typing placeholder with error message
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

// ==========================
// SEND MESSAGE (RETRY HELPER)
// ==========================
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

  // ✅ Restore last active chat, then move it to the top of the list
  const savedIndex = Number(localStorage.getItem("secure_chat_index"));
  if (!isNaN(savedIndex) && savedIndex >= 0 && savedIndex < chats.length) {
    const [activeChat] = chats.splice(savedIndex, 1);
    chats.unshift(activeChat);
    currentIndex = 0;
  } else {
    currentIndex = 0; // fallback to first
  }

  saveChats();
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


