// ==========================
// CONFIG & GLOBAL STATE
// ==========================
const WORKER_URL = "https://gptapiv2.barney-willis2.workers.dev";

// AUTH STATE
// We no longer use a plain prompt() for userId.
// Instead we store a proper auth token and userId from login.
let authToken = localStorage.getItem("authToken") || null;
let userId    = localStorage.getItem("userId")    || null;

let chats = [];
let currentIndex = null;
let currentProvider = localStorage.getItem("chat_provider") || "openai";
let currentModel    = localStorage.getItem("chat_model")    || "gpt-5.4-mini-2026-03-17";

// ==========================
// DOM READY
// ==========================
document.addEventListener("DOMContentLoaded", () => {

  // ==========================
  // DOM ELEMENT REFERENCES
  // ==========================
  const chatListEl    = document.getElementById("chatList");
  const messagesEl    = document.getElementById("messages");
  const chatTitleEl   = document.getElementById("chatTitle");
  const inputEl       = document.getElementById("input");
  const themeToggleBtn   = document.getElementById("toggleThemeBtn");
  const sidebarEl        = document.querySelector(".sidebar");
  const toggleSidebarBtn = document.getElementById("toggleSidebarBtn");
  const modelSelector    = document.getElementById("modelSelector");

  // ==========================
  // AUTH MODAL LOGIC
  // ==========================
  function showAuthModal() {
    document.getElementById("authModal").classList.remove("hidden");
  }
  
  function hideAuthModal() {
    document.getElementById("authModal").classList.add("hidden");
  }
  
  async function initAuth() {
    // Already logged in — token exists
    if (authToken && userId) {
      hideAuthModal();
      return true;
    }
  
    // Show the modal and wait for the user to log in or register
    showAuthModal();
  
    return new Promise((resolve) => {
      let mode = "login"; // or "register"
  
      const tabLogin    = document.getElementById("tabLogin");
      const tabRegister = document.getElementById("tabRegister");
      const submitBtn   = document.getElementById("authSubmitBtn");
      const errorEl     = document.getElementById("authError");
      const titleEl     = document.getElementById("authModalTitle");
      const subtitleEl  = document.getElementById("authModalSubtitle");
  
      tabLogin.addEventListener("click", () => {
        mode = "login";
        tabLogin.classList.add("active");
        tabRegister.classList.remove("active");
        submitBtn.textContent = "Sign In";
        titleEl.textContent   = "Welcome Back";
        subtitleEl.textContent = "Sign in to access your chats";
        errorEl.textContent   = "";
      });
  
      tabRegister.addEventListener("click", () => {
        mode = "register";
        tabRegister.classList.add("active");
        tabLogin.classList.remove("active");
        submitBtn.textContent  = "Create Account";
        titleEl.textContent    = "Create Account";
        subtitleEl.textContent = "Register to save your chats";
        errorEl.textContent    = "";
      });
  
      submitBtn.addEventListener("click", async () => {
        const username = document.getElementById("authUsername").value.trim();
        const password = document.getElementById("authPassword").value.trim();
        errorEl.textContent = "";
  
        if (!username || !password) {
          errorEl.textContent = "Please enter a username and password.";
          return;
        }
  
        submitBtn.disabled    = true;
        submitBtn.textContent = "Please wait…";
  
        try {
          const endpoint = mode === "login" ? "/login" : "/register";
          const res = await fetch(`${WORKER_URL}${endpoint}`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ username, password }),
          });
  
          const data = await res.json();
  
          if (!res.ok) {
            throw new Error(data.error || "Something went wrong.");
          }
  
          if (mode === "register") {
            // After register, switch to login automatically
            errorEl.style.color = "green";
            errorEl.textContent = "Account created! Signing you in…";
  
            // Auto-login after register
            const loginRes = await fetch(`${WORKER_URL}/login`, {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({ username, password }),
            });
            const loginData = await loginRes.json();
            if (!loginRes.ok) throw new Error(loginData.error || "Login failed.");
  
            authToken = loginData.token;
            userId    = loginData.userId;
          } else {
            authToken = data.token;
            userId    = data.userId;
          }
  
          // Persist to localStorage
          localStorage.setItem("authToken", authToken);
          localStorage.setItem("userId",    userId);
  
          hideAuthModal();
          resolve(true);
  
        } catch (err) {
          errorEl.style.color = "";
          errorEl.textContent = err.message;
          submitBtn.disabled  = false;
          submitBtn.textContent = mode === "login" ? "Sign In" : "Create Account";
        }
      });
  
      // Allow Enter key to submit
      document.getElementById("authPassword").addEventListener("keydown", (e) => {
        if (e.key === "Enter") submitBtn.click();
      });
    });
  }

function handleUnauthorized() {
  authToken = null;
  userId = null;
  localStorage.removeItem("authToken");
  localStorage.removeItem("userId");
  initAuth();
}
  
  // ── NEW: Model Sheet elements ──────────────────────────
  const modelSheet         = document.getElementById('modelSheet');
  const modelSheetBackdrop = document.getElementById('modelSheetBackdrop');
  const closeModelSheetBtn = document.getElementById('closeModelSheetBtn');
  const modelSheetOptions  = document.querySelectorAll('.model-sheet-option');
  // ───────────────────────────────────────────────────────

  // ==========================
  // INPUT AUTO RESIZE
  // ==========================
  function autoResize() {
    inputEl.style.height = "auto";
    inputEl.style.height = Math.min(inputEl.scrollHeight, 200) + "px";
  }
  inputEl.addEventListener("input", autoResize);
  autoResize();

  const backdropEl = document.createElement("div");
  backdropEl.className = "sidebar-backdrop";
  document.body.appendChild(backdropEl);

  const paletteBtn     = document.getElementById("themeBtn");
  const paletteSheet   = document.getElementById("paletteSheet");
  const sheetBackdrop  = document.getElementById("sheetBackdrop");
  const closeSheetBtn  = document.getElementById("closeSheetBtn");
  const paletteOptions = document.querySelectorAll(".sheet-option");

  const scrollTopBtn = document.getElementById("scrollTopBtn");
  const scrollBottomBtn = document.getElementById("scrollBottomBtn");
  const inputArea    = document.querySelector(".input-area");
  const textarea     = inputArea.querySelector("textarea");

  // ==========================
  // SCROLL BUTTONS
  // ==========================
  function updateScrollBtnPosition() {
    const inputHeight = inputArea.offsetHeight;
    scrollTopBtn.style.bottom = (inputHeight + 20) + "px";
  }
  updateScrollBtnPosition();
  textarea.addEventListener("input", updateScrollBtnPosition);
  window.addEventListener("resize", updateScrollBtnPosition);

     messagesEl.addEventListener("scroll", () => {
    const distanceFromTop = messagesEl.scrollTop;
    const distanceFromBottom = messagesEl.scrollHeight - messagesEl.scrollTop - messagesEl.clientHeight;
    const canScroll = messagesEl.scrollHeight > messagesEl.clientHeight;

    if (!canScroll) {
        scrollTopBtn.style.display    = "none";
        scrollBottomBtn.style.display = "none";
    } else if (distanceFromTop <= 50) {
        // Near the top
        scrollTopBtn.style.display    = "none";
        scrollBottomBtn.style.display = "flex";
    } else if (distanceFromBottom <= 50) {
        // Near the bottom
        scrollTopBtn.style.display    = "flex";
        scrollBottomBtn.style.display = "none";
    } else {
        // In the middle - show both
        scrollTopBtn.style.display    = "flex";
        scrollBottomBtn.style.display = "flex";
    }
});

  scrollTopBtn.addEventListener("click", () => {
    messagesEl.scrollTo({ top: 0, behavior: "smooth" });
  });
  scrollBottomBtn.addEventListener("click", () => {
    messagesEl.scrollTo({ top: messagesEl.scrollHeight, behavior: "smooth" });
  });

  setTimeout(() => {
      messagesEl.dispatchEvent(new Event("scroll"));
  }, 100);

  const hamburgerIcon = toggleSidebarBtn.querySelector(".hide-icon");
  const chevronIcon   = toggleSidebarBtn.querySelector(".show-icon");

  // ==========================
  // UTILITY FUNCTIONS
  // ==========================
  function escapeHTML(str) {
    return str
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;");
  }

  function extractAnswer(data) {
    return (
      data?.output_text ||
      data?.output?.[0]?.content?.[0]?.text ||
      data?.content?.[0]?.text ||
      data?.detail ||
      data?.error ||
      "No response"
    );
  }
  
function renderMessageContent(content) {
  const FENCE = String.fromCharCode(96, 96, 96);
  const fenceRegex = new RegExp(FENCE + "(\\w*\\n[\\s\\S]*?)\\n" + FENCE, "g");
  const countRegex = new RegExp(FENCE, "g");

  const tickCount = (content.match(countRegex) || []).length;
  if (tickCount % 2 !== 0) {
    content = content + "\n" + FENCE;
  }

  const parts = content.split(fenceRegex);
  let html = "";

  for (let i = 0; i < parts.length; i++) {
    if (i % 2 === 0) {
      const escaped = escapeHTML(parts[i]).replace(/\n/g, "<br>");
      if (escaped.trim()) {
        html += `<div class="msg-paragraph">${escaped}</div>`;
      }
    } else {
      let code = parts[i].trim();
      const firstNewline = code.indexOf("\n");
      let lang = "";
      if (firstNewline !== -1) {
        const firstLine = code.substring(0, firstNewline).trim();
        if (/^\w+$/.test(firstLine)) {
          lang = firstLine;
          code = code.substring(firstNewline + 1);
        }
      }

      const id = "code-" + Math.random().toString(36).substring(2, 9);
      html += `
        <div class="code-block-wrapper">
          <div class="code-lang-label">${lang || "code"}</div>
          <button class="copy-code-btn" data-target="${id}">Copy</button>
          <pre><code id="${id}">${escapeHTML(code)}</code></pre>
        </div>`;
    }
  }

  return html;
}
// ==========================
// SIDEBAR - OPEN / CLOSE / TOGGLE
// ==========================
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

// ==========================
// SIDEBAR - SWIPE TO OPEN / CLOSE (MOBILE)
// ==========================
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
// THEME - COLOUR PALETTES
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
    Orange: {
      "--color-1": "#FFD9B3",
      "--color-2": "#FFB870",
      "--color-3": "#F28C28",
      "--color-4": "#C96A1B",
      "--color-5": "#8A4513",
      "--color-6": "#800000",
      "--color-7": "#F30000"
    },
  };

// ==========================
// THEME - LIGHT / DARK NEUTRALS
// ==========================
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

  let currentPalette = localStorage.getItem("palette") || "Red";
  let currentMode = localStorage.getItem("mode") || "light";

// ==========================
// THEME - APPLY THEME
// ==========================
  function applyTheme() {
    const root = document.documentElement;
    const palette = palettes[currentPalette] || palettes.Red;
   const neutralSet = neutrals[currentMode];

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

// ==========================
// SAVE CHATS - LOCAL STORAGE & WORKER
// ==========================
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
          headers: {
            "Content-Type": "application/json",
            "Authorization": `Bearer ${authToken}`
          },
          body: JSON.stringify({ userId, chats }),
        });
        if (res.status === 401) { handleUnauthorized(); return; }
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
        const res = await fetch(`${WORKER_URL}/load?userId=${encodeURIComponent(userId)}`, {
          headers: {
            "Authorization": `Bearer ${authToken}`
          }
        });
        if (res.status === 401) { handleUnauthorized(); return; }
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
    const newChat = { id: Date.now().toString(), title: "New Chat", messages: [], pinned: false };
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

    function togglePin(index) {
      chats[index].pinned = !chats[index].pinned;
    
      // Sort: pinned first, unpinned after — preserve order within each group
      const pinned   = chats.filter(c => c.pinned);
      const unpinned = chats.filter(c => !c.pinned);
      chats = [...pinned, ...unpinned];
    
      // Keep currentIndex pointing to the same chat after re-sort
      currentIndex = chats.findIndex(c => c === chats[0]) ?? 0;
      // Re-find by id to be safe
      const currentId = chats[index]?.id;
      if (currentId) currentIndex = chats.findIndex(c => c.id === currentId);
    
      saveChats();
      renderChatList();
    }
  
function renderChatList() {
  chatListEl.innerHTML = "";

  // Sort: pinned first
  const pinned   = chats.map((c, i) => ({ chat: c, i })).filter(x => x.chat.pinned);
  const unpinned = chats.map((c, i) => ({ chat: c, i })).filter(x => !x.chat.pinned);

  function truncate(str, n) {
    return str.length > n ? str.slice(0, n) + "…" : str;
  }

  const isMobile = window.matchMedia("(max-width: 768px)").matches;
  const titleLimit    = isMobile ? 45 : 70;
  const subtitleLimit = isMobile ? 40 : 60;

  function buildItem({ chat, i }) {
    const item = document.createElement("div");
    item.className = "chat-item" + (i === currentIndex ? " selected" : "");
    if (chat.pinned) item.classList.add("pinned");

    const preview = document.createElement("div");
    preview.className = "chat-preview";

    const title    = truncate(chat.title || "New Chat", titleLimit);
    const subtitle = (chat.messages && chat.messages.length > 0)
      ? truncate(chat.messages[chat.messages.length - 1].content, subtitleLimit)
      : "";

      preview.innerHTML = `
      <div class="chat-title">${title}</div>
      <div class="chat-subtitle">${subtitle}</div>
    `;

    // Pin button
    const pinBtn = document.createElement("button");
    pinBtn.className = "pin-btn" + (chat.pinned ? " active" : "");
    pinBtn.setAttribute("aria-label", chat.pinned ? "Unpin chat" : "Pin chat");
    pinBtn.title = chat.pinned ? "Unpin" : "Pin to top";
    pinBtn.innerHTML = `
      <svg viewBox="0 0 24 24" width="14" height="14"
           fill="${chat.pinned ? 'currentColor' : 'none'}"
           stroke="currentColor" stroke-width="2"
           stroke-linecap="round" stroke-linejoin="round">
        <line x1="12" y1="17" x2="12" y2="22"/>
        <path d="M5 17h14v-1.76a2 2 0 0 0-1.11-1.79l-1.78-.9A2 2 0 0 1 15
                 10.76V6h1a2 2 0 0 0 0-4H8a2 2 0 0 0 0 4h1v4.76a2
                 2 0 0 1-1.11 1.79l-1.78.9A2 2 0 0 0 5 15.24Z"/>
      </svg>
    `;
    pinBtn.addEventListener("click", (e) => {
      e.stopPropagation();
      togglePin(i);
    });

    // Delete button
    const delBtn = document.createElement("button");
    delBtn.className = "delete-btn";
    delBtn.setAttribute("aria-label", "Delete chat");
    delBtn.textContent = "×";
    delBtn.addEventListener("click", (e) => {
      e.stopPropagation();
      deleteChat(i);
    });

    item.addEventListener("click", () => {
      const [clicked] = chats.splice(i, 1);

      // Keep pinned chats pinned at top, don't move them
      if (!clicked.pinned) {
        // Insert after all pinned chats
        const firstUnpinned = chats.findIndex(c => !c.pinned);
        if (firstUnpinned === -1) {
          chats.push(clicked);
        } else {
          chats.splice(firstUnpinned, 0, clicked);
        }
        currentIndex = chats.findIndex(c => c.id === clicked.id);
      } else {
        // Put pinned back at original spot (top of pinned)
        chats.unshift(clicked);
        currentIndex = 0;
      }

      saveChats();
      renderChatList();
      renderMessages();
      if (window.innerWidth <= 768) closeSidebar();
    });

    item.appendChild(preview);
    item.appendChild(pinBtn);
    item.appendChild(delBtn);
    chatListEl.appendChild(item);
  }

  // Render pinned section
  if (pinned.length > 0) {
    const pinnedHeader = document.createElement("div");
    pinnedHeader.className = "chat-section-header";
    pinnedHeader.textContent = "Pinned";
    chatListEl.appendChild(pinnedHeader);
    pinned.forEach(buildItem);
  }

  // Render unpinned section
  if (unpinned.length > 0) {
    const allHeader = document.createElement("div");
    allHeader.className = "chat-section-header";
    allHeader.textContent = pinned.length > 0 ? "All Chats" : "";
    if (pinned.length > 0) chatListEl.appendChild(allHeader);
    unpinned.forEach(buildItem);
  }
}

function renderMessages() {
  messagesEl.innerHTML = "";
  chatTitleEl.textContent = "Messages";

  if (currentIndex === null || !chats[currentIndex]) {
    messagesEl.innerHTML = `<p class="placeholder">No chats yet. Start a new one!</p>`;
    return;
  }

  const chat = chats[currentIndex];
  if (!chat.messages || !chat.messages.length) {
    messagesEl.innerHTML = `<p class="placeholder">This chat is empty.</p>`;
    return;
  }

const lastAssistantIdx = chat.messages.reduce((last, msg, idx) => {
  return (msg.role === "assistant" && msg.content !== "__TYPING__") ? idx : last;
}, -1);

  chat.messages.forEach((msg, idx) => {
    const wrapper = document.createElement("div");
    wrapper.className = `message-wrapper ${msg.role}`;

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
    } else if (msg.role === "assistant") {
      textDiv.innerHTML = renderMessageContent(msg.content);
    } else {
      textDiv.textContent = msg.content;
    }

      const metaDiv = document.createElement("div");
    metaDiv.className = "msg-meta";

    const timeDiv = document.createElement("div");
    timeDiv.className = "msg-time";
    timeDiv.textContent = msg.time || "";
    metaDiv.appendChild(timeDiv);

    if (msg.model && msg.content !== "__TYPING__") {
      const modelDiv = document.createElement("div");
      modelDiv.className = "msg-model";
      modelDiv.textContent = msg.model;
      metaDiv.appendChild(modelDiv);
    }

    textDiv.appendChild(metaDiv);

    div.appendChild(textDiv);
    wrapper.appendChild(div);

    if (msg.role === "assistant" && msg.content !== "__TYPING__" && idx === lastAssistantIdx) {
      const reloadRow = document.createElement("div");
      reloadRow.className = "reload-row";

      const reloadBtn = document.createElement("button");
      reloadBtn.type = "button";
      reloadBtn.className = "reload-pill";
      reloadBtn.title = "Retry this response";
      reloadBtn.innerHTML = `
        <svg viewBox="0 0 24 24" width="16" height="16"
             fill="none" stroke="currentColor" stroke-width="2"
             stroke-linecap="round" stroke-linejoin="round">
          <polyline points="23 4 23 10 17 10"></polyline>
          <polyline points="1 20 1 14 7 14"></polyline>
          <path d="M3.51 9a9 9 0 0 1 14.85-3.36L23 10M1 14l4.64 4.36A9 9 0 0 0 20.49 15"/>
        </svg>
        <span>Reload</span>
      `;

      reloadBtn.addEventListener("click", async () => {
  // Remove the assistant message at this specific index
  chat.messages.splice(idx, 1);
  
  // Insert the typing indicator at the SAME position, not the end
  chat.messages.splice(idx, 0, { role: "assistant", content: "__TYPING__", time: formatDateTime() });

  saveChats();
  saveChatsToWorker();
  renderMessages();

  try {
    const cleanMessages = chat.messages
      .filter(m => m.content !== "__TYPING__")
      .slice(-10)
      .reduce((acc, msg) => {
        if (acc.length > 0 && acc[acc.length - 1].role === msg.role) {
          acc[acc.length - 1] = msg;
        } else {
          acc.push(msg);
        }
        return acc;
      }, []);

    if (cleanMessages.length > 0 && cleanMessages[cleanMessages.length - 1].role !== "user") {
      cleanMessages.pop();
    }

    const res = await fetch(`${WORKER_URL}/chat`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        provider: currentProvider,
        model: currentModel,
        messages: cleanMessages
      }),
    });

    if (!res.ok) {
      const errText = await res.text();
      throw new Error(`Worker returned ${res.status}: ${errText}`);
    }

    const data = await res.json();
    const answer = extractAnswer(data);

    // Replace at the SAME idx position, not the end
    chat.messages[idx] = {
      role: "assistant",
      content: answer,
      time: formatDateTime(),
      model: modelSelector.options[modelSelector.selectedIndex].text
    };
  } catch (e) {
    // Replace at the SAME idx position on error too
    chat.messages[idx] = {
      role: "assistant",
      content: "Error: " + e.message,
      time: formatDateTime(),
      model: modelSelector.options[modelSelector.selectedIndex].text
    };
  }

  saveChats();
  saveChatsToWorker();
  renderMessages();
  renderChatList();
});

      reloadRow.appendChild(reloadBtn);
      wrapper.appendChild(reloadRow);
    }

    messagesEl.appendChild(wrapper);
  });

  messagesEl.querySelectorAll(".copy-code-btn").forEach(btn => {
    btn.addEventListener("click", async () => {
      const targetId = btn.getAttribute("data-target");
      const codeEl = document.getElementById(targetId);
      if (!codeEl) return;
  
      try {
        await navigator.clipboard.writeText(codeEl.textContent);
        const oldText = btn.textContent;
        btn.textContent = "Copied!";
        setTimeout(() => {
          btn.textContent = oldText;
        }, 1200);
      } catch (err) {
        console.warn("Copy failed:", err);
        alert("Could not copy code.");
      }
    });
  });
  
  messagesEl.scrollTop = messagesEl.scrollHeight;
}

async function sendMessage() {
  const text = inputEl.value.trim();
  if (!text) return;

  if (currentIndex === null) createNewChat();
  const chat = chats[currentIndex];

  const userMessage = { role: "user", content: text, time: formatDateTime(), model: modelSelector.options[modelSelector.selectedIndex].text };
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
      .slice(-10)
      .reduce((acc, msg) => {
        // Avoid two consecutive messages from the same role
        if (acc.length > 0 && acc[acc.length - 1].role === msg.role) {
          acc[acc.length - 1] = msg; // replace with latest
        } else {
          acc.push(msg);
        }
        return acc;
      }, []);
    
    // Final safety check - Anthropic requires last message to be user
    if (cleanMessages.length > 0 && cleanMessages[cleanMessages.length - 1].role !== "user") {
      cleanMessages.pop();
    }

    console.log("About to send:", {
      provider: currentProvider,
      model: modelSelector.options[modelSelector.selectedIndex].text,
      messages: cleanMessages
    });

    const res = await fetch(`${WORKER_URL}/chat`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Authorization": `Bearer ${authToken}`
      },
      body: JSON.stringify({
        provider: currentProvider,
        model: currentModel,
        messages: cleanMessages,
      }),
    });

    console.log("HTTP status:", res.status);

    const rawText = await res.text();
    console.log("Worker raw response:", rawText);

    let data = {};
    try {
      data = rawText ? JSON.parse(rawText) : {};
    } catch (jsonErr) {
      throw new Error(`Invalid JSON from worker: ${rawText}`);
    }

    if (res.status === 401) { handleUnauthorized(); return; }
    if (!res.ok) {
      throw new Error(data.detail || data.error || `Worker returned ${res.status}`);
    }

    const answer = extractAnswer(data);

      chat.messages[chat.messages.length - 1] = {
      role: "assistant",
      content: answer,
      time: formatDateTime(),
      model: modelSelector.options[modelSelector.selectedIndex].text
    };
  } catch (e) {
    console.error("sendMessage failed:", e);

    chat.messages[chat.messages.length - 1] = {
      role: "assistant",
      content: "Error: " + e.message,
      time: formatDateTime(),
      model: modelSelector.options[modelSelector.selectedIndex].text
    };
  }

  saveChats();
  saveChatsToWorker();
  renderMessages();
  renderChatList();
}

 async function sendMessageRetry() {
  if (currentIndex === null) createNewChat();
  const chat = chats[currentIndex];

  chat.messages.push({ role: "assistant", content: "__TYPING__", time: formatDateTime() });
  renderMessages();
  saveChats();
  saveChatsToWorker();

  try {
     const cleanMessages = chat.messages
      .filter(m => m.content !== "__TYPING__")
      .slice(-10)
      .reduce((acc, msg) => {
        // Avoid two consecutive messages from the same role
        if (acc.length > 0 && acc[acc.length - 1].role === msg.role) {
          acc[acc.length - 1] = msg; // replace with latest
        } else {
          acc.push(msg);
        }
        return acc;
      }, []);
    
    // Final safety check - Anthropic requires last message to be user
    if (cleanMessages.length > 0 && cleanMessages[cleanMessages.length - 1].role !== "user") {
      cleanMessages.pop();
    }

    console.log("Retry send:", {
      provider: currentProvider,
      model: currentModel,
      messages: cleanMessages
    });

    const res = await fetch(`${WORKER_URL}/chat`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        provider: currentProvider,
        model: currentModel,
        messages: cleanMessages
      }),
    });

    console.log("Retry status:", res.status);

    const rawText = await res.text();
    console.log("Retry raw response:", rawText);

    let data = {};
    try {
      data = rawText ? JSON.parse(rawText) : {};
    } catch {
      throw new Error(`Invalid JSON from worker: ${rawText}`);
    }

    if (!res.ok) {
      throw new Error(data.detail || data.error || `Worker returned ${res.status}`);
    }

    const answer = extractAnswer(data);

        chat.messages[chat.messages.length - 1] = {
      role: "assistant",
      content: answer,
      time: formatDateTime(),
      model: modelSelector.options[modelSelector.selectedIndex].text
    };
  } catch (e) {
    console.error("sendMessageRetry failed:", e);

    chat.messages[chat.messages.length - 1] = {
      role: "assistant",
      content: "Error: " + e.message,
      time: formatDateTime(),
      model: modelSelector.options[modelSelector.selectedIndex].text
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
  
// ==========================
// MODEL SELECTOR - DESKTOP DROPDOWN
// ==========================
modelSelector.value = `${currentProvider}|${currentModel}`;

modelSelector.addEventListener("change", (e) => {
  const value = e.target.value || "";
  const parts = value.split("|");

  if (parts.length === 2) {
    currentProvider = parts[0];
    currentModel = parts[1];
  } else {
    currentProvider = "openai";
    currentModel = value || "gpt-5.4-mini-2026-03-17";
  }

  localStorage.setItem("chat_provider", currentProvider);
  localStorage.setItem("chat_model", currentModel);

  console.log("Model selection changed:", {
    currentProvider,
    currentModel
  });
  syncActiveModel(e.target.value);
});

// ==========================
// THEME - LIGHT/DARK TOGGLE BUTTON
// ==========================
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

// ==========================
// THEME - PALETTE SHEET (BOTTOM SHEET)
// ==========================
function openPaletteSheet() {
  paletteSheet.classList.remove("hidden");
  sheetBackdrop.classList.remove("hidden");

  requestAnimationFrame(() => {
    paletteSheet.classList.add("show");
    sheetBackdrop.classList.add("show");
  });

  paletteBtn.setAttribute("aria-expanded", "true");
  document.body.style.overflow = "hidden";
}

function closePaletteSheet() {
  paletteSheet.classList.remove("show");
  sheetBackdrop.classList.remove("show");
  paletteBtn.setAttribute("aria-expanded", "false");
  document.body.style.overflow = "";

  setTimeout(() => {
    paletteSheet.classList.add("hidden");
    sheetBackdrop.classList.add("hidden");
  }, 220);
}

paletteBtn.addEventListener("click", openPaletteSheet);
closeSheetBtn.addEventListener("click", closePaletteSheet);
sheetBackdrop.addEventListener("click", closePaletteSheet);

paletteOptions.forEach(btn => {
  btn.addEventListener("click", () => {
    currentPalette = btn.dataset.theme; // Green/Blue/Purple/Red/Teal
    applyTheme();
    closePaletteSheet();
  });
});

// ==========================
// MODEL SELECTOR - MOBILE BOTTOM SHEET
// ==========================
function openModelSheet() {
    modelSheet.classList.remove('hidden');
    modelSheetBackdrop.classList.remove('hidden');
    requestAnimationFrame(() => {
    modelSheet.classList.add('show');
    modelSheetBackdrop.classList.add('show');
    });
    document.body.style.overflow = 'hidden';
    }
    
    function closeModelSheet() {
    modelSheet.classList.remove('show');
    modelSheetBackdrop.classList.remove('show');
    document.body.style.overflow = '';
    setTimeout(() => {
    modelSheet.classList.add('hidden');
    modelSheetBackdrop.classList.add('hidden');
    }, 220);
    }
    
    function syncActiveModel(currentVal) {
    modelSheetOptions.forEach(btn => {
    btn.classList.toggle('active', btn.dataset.model === currentVal);
    });
    }
    
   modelSelector.addEventListener('mousedown', (e) => {
  if (window.innerWidth <= 768) {
    e.preventDefault();
    openModelSheet();
  }
});
    closeModelSheetBtn?.addEventListener('click', closeModelSheet);
    modelSheetBackdrop?.addEventListener('click', closeModelSheet);
    
    modelSheetOptions.forEach(btn => {
    btn.addEventListener('click', () => {
    const value = btn.dataset.model;
    const parts = value.split('|');
    if (parts.length === 2) {
    currentProvider = parts[0];
    currentModel = parts[1];
    } else {
    currentProvider = 'openai';
    currentModel = value;
    }
    localStorage.setItem('chat_provider', currentProvider);
    localStorage.setItem('chat_model', currentModel);
    modelSelector.value = value;
    modelSheetOptions.forEach(b => b.classList.remove('active'));
    btn.classList.add('active');
    console.log('Mobile model selected:', { currentProvider, currentModel });
    setTimeout(closeModelSheet, 180);
    });
    });

// ==========================
// KEYBOARD SHORTCUTS
// ==========================
document.addEventListener("keydown", (e) => {
  if (e.key === "Escape" && paletteSheet.classList.contains("show")) {
    closePaletteSheet();
  if (modelSheet && !modelSheet.classList.contains("hidden")) closeModelSheet();
  }
});

  (async () => {
    applyTheme();
    syncActiveModel(`${currentProvider}|${currentModel}`);
    
   // NEW — show login modal if not authenticated
    const authed = await initAuth();
    if (!authed) return;

    let gotFromWorker = false;
    try {
      const res = await fetch(`${WORKER_URL}/load?userId=${encodeURIComponent(userId)}`, {
        headers: {
          "Authorization": `Bearer ${authToken}`
        }
      });
      
      if (res.status === 401) { handleUnauthorized(); return; }
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
