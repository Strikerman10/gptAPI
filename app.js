// ==========================
// CONFIG
// ==========================
const WORKER_URL = "https://gptapiv2.barney-willis2.workers.dev";

// ==========================
// UTILITIES
// ==========================

// Debounce utility (trailing by default)
function debounce(fn, wait = 100) {
  let t;
  return (...args) => {
    clearTimeout(t);
    t = setTimeout(() => fn(...args), wait);
  };
}

// fetch with exponential backoff + jitter, retrying common transient statuses
async function fetchWithBackoff(url, options = {}, {
  retries = 4,
  baseDelay = 250,
  retryOnStatus = (s) => [429, 500, 502, 503, 504].includes(s)
} = {}) {
  let attempt = 0, lastErr = null;
  while (attempt <= retries) {
    try {
      const res = await fetch(url, options);
      if (res.ok) return res;
      if (!retryOnStatus(res.status) || attempt === retries) return res;
    } catch (e) {
      lastErr = e;
      if (attempt === retries) throw e;
    }
    const delay = baseDelay * Math.pow(2, attempt) + Math.random() * 100;
    await new Promise(r => setTimeout(r, delay));
    attempt++;
  }
  if (lastErr) throw lastErr;
  throw new Error("fetchWithBackoff exhausted");
}

// Time stamp helper
function formatDateTime(date = new Date()) {
  const dd = String(date.getDate()).padStart(2, "0");
  const mm = String(date.getMonth() + 1).padStart(2, "0");
  const yyyy = date.getFullYear();
  const hh = String(date.getHours()).padStart(2, "0");
  const mi = String(date.getMinutes()).padStart(2, "0");
  return `${hh}:${mi}\n${dd}/${mm}/${yyyy}`;
}

// ==========================
// AUTH CLIENT
// ==========================

let authToken = null; // in-memory token

function authHeaders(extra = {}) {
  return authToken ? { ...extra, Authorization: `Bearer ${authToken}` } : extra;
}

async function login(username, password) {
  const res = await fetchWithBackoff(`${WORKER_URL}/login`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ username, password })
  });
  if (!res.ok) throw new Error(await res.text());
  const data = await res.json();
  authToken = data.token;
  if (!authToken) throw new Error("No token received");
  localStorage.setItem("chat_user_id", username);
  return true;
}

async function registerUser(username, password) {
  const res = await fetchWithBackoff(`${WORKER_URL}/register`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ username, password })
  });
  if (!res.ok) throw new Error(await res.text());
  return true;
}

// Modal-based login/register flow
async function ensureLoginUI() {
  // Create a simple modal dynamically if it doesn't exist in HTML
  let modal = document.getElementById("authModal");
  if (!modal) {
    modal = document.createElement("div");
    modal.id = "authModal";
    modal.style.cssText = "position:fixed;inset:0;display:flex;align-items:center;justify-content:center;background:rgba(0,0,0,0.4);z-index:9999;";
    modal.innerHTML = `
      <div style="background:#fff;color:#000;padding:16px;border-radius:8px;width:320px;max-width:90%;box-shadow:0 10px 30px rgba(0,0,0,0.2);">
        <h3 style="margin:0 0 12px;">Sign in</h3>
        <label style="display:block;font-size:14px;margin-bottom:6px;">Username</label>
        <input id="authUsername" type="text" style="width:100%;padding:8px;border:1px solid #ccc;border-radius:6px;margin-bottom:10px;" />
        <label style="display:block;font-size:14px;margin-bottom:6px;">Password</label>
        <input id="authPassword" type="password" style="width:100%;padding:8px;border:1px solid #ccc;border-radius:6px;margin-bottom:14px;" />
        <div style="display:flex;gap:8px;">
          <button id="btnLogin" style="flex:1;padding:10px;border:none;border-radius:6px;background:#008080;color:#fff;cursor:pointer;">Log in</button>
          <button id="btnRegister" style="flex:1;padding:10px;border:1px solid #008080;border-radius:6px;background:#fff;color:#008080;cursor:pointer;">Register</button>
        </div>
        <div id="authStatus" style="margin-top:10px;font-size:13px;color:#b94c4c;"></div>
      </div>
    `;
    document.body.appendChild(modal);
  }

  const uEl = document.getElementById("authUsername");
  const pEl = document.getElementById("authPassword");
  const statusEl = document.getElementById("authStatus");
  const btnLogin = document.getElementById("btnLogin");
  const btnRegister = document.getElementById("btnRegister");

  return new Promise((resolve) => {
    async function doLogin() {
      statusEl.textContent = "";
      const u = (uEl.value || "").trim();
      const p = pEl.value || "";
      if (!u || !p) { statusEl.textContent = "Enter username and password."; return; }
      btnLogin.disabled = btnRegister.disabled = true;
      try {
        await login(u, p);
        modal.style.display = "none";
        resolve(true);
      } catch (e) {
        statusEl.textContent = "Login failed. Check details or Register.";
      } finally {
        btnLogin.disabled = btnRegister.disabled = false;
      }
    }

    async function doRegister() {
      statusEl.textContent = "";
      const u = (uEl.value || "").trim();
      const p = pEl.value || "";
      if (!u || !p) { statusEl.textContent = "Enter username and password."; return; }
      btnLogin.disabled = btnRegister.disabled = true;
      try {
        await registerUser(u, p);
        await login(u, p);
        modal.style.display = "none";
        resolve(true);
      } catch (e) {
        statusEl.textContent = "Register failed. Try a different username.";
      } finally {
        btnLogin.disabled = btnRegister.disabled = false;
      }
    }

    btnLogin.onclick = doLogin;
    btnRegister.onclick = doRegister;
    pEl.addEventListener("keydown", (e) => { if (e.key === "Enter") doLogin(); });
  });
}

// ==========================
// CLOUD API WRAPPERS
// ==========================
async function loadFromWorker(uid) {
  const res = await fetchWithBackoff(`${WORKER_URL}/load?userId=${encodeURIComponent(uid)}`, {
    method: "GET",
    headers: authHeaders()
  });
  if (!res.ok) return [];
  return res.json();
}

async function saveToWorker(uid, chats) {
  return fetchWithBackoff(`${WORKER_URL}/save`, {
    method: "POST",
    headers: authHeaders({ "Content-Type": "application/json" }),
    body: JSON.stringify({ userId: uid, chats })
  });
}

async function chatWithWorker(model, messages) {
  // strip placeholders and limit context
  const payload = messages.filter(m => m.content !== "__TYPING__").slice(-10);
  const res = await fetchWithBackoff(`${WORKER_URL}/chat`, {
    method: "POST",
    headers: authHeaders({ "Content-Type": "application/json" }),
    body: JSON.stringify({ model, messages: payload })
  });
  if (!res.ok) throw new Error(`Worker returned ${res.status}`);
  return res.json();
}

// ==========================
// STATE
// ==========================
let chats = [];
let currentChatId = localStorage.getItem("secure_chat_current_id") || null;
let currentModel = localStorage.getItem("chat_model") || "gpt-5-chat-latest";

// Derived index from id
function getActiveChatIndex() {
  return chats.findIndex(c => c.id === currentChatId);
}
function setActiveChatById(id) {
  currentChatId = id;
  localStorage.setItem("secure_chat_current_id", id || "");
}

// Local cache
function saveLocal() {
  localStorage.setItem("secure_chat_chats", JSON.stringify(chats));
  localStorage.setItem("secure_chat_current_id", currentChatId || "");
}

// Cloud + local save
function saveChats() {
  saveLocal();
  const userId = localStorage.getItem("chat_user_id");
  if (userId) {
    saveToWorker(userId, chats).catch(e => console.warn("Cloud save failed:", e));
  }
}

// ==========================
// THEME (kept from prior version)
// ==========================
const palettes = {
  Green: {"--color-1":"#94e8b4","--color-2":"#72bda3","--color-3":"#5e8c61","--color-4":"#4e6151","--color-5":"#3b322c","--color-6":"#800000","--color-7":"#f30000"},
  Blue: {"--color-1":"#6da5f8","--color-2":"#3f5fa3","--color-3":"#2c4f80","--color-4":"#1e3759","--color-5":"#0d1628","--color-6":"#4e1818","--color-7":"#ac3535"},
  Amber: {"--color-1":"#ffd48a","--color-2":"#ffb74d","--color-3":"#996515","--color-4":"#5a3b0f","--color-5":"#1a0e05","--color-6":"#7fd7d0","--color-7":"#a5e3de"},
  Purple: {"--color-1":"#e3c6ff","--color-2":"#c19df0","--color-3":"#9467bd","--color-4":"#6a4c93","--color-5":"#3e2c41","--color-6":"#007373","--color-7":"#00e9e9"},
  Red: {"--color-1":"#e07b7b","--color-2":"#b94c4c","--color-3":"#8b0000","--color-4":"#5a0000","--color-5":"#1a0a0a","--color-6":"#008080","--color-7":"#00f3f3"},
  Teal: {"--color-1":"#7fd7d0","--color-2":"#40a8a0","--color-3":"#006d65","--color-4":"#004944","--color-5":"#0a1c1b","--color-6":"#666699","--color-7":"#9494b8"},
  Gray: {"--color-1":"#e0e0e0","--color-2":"#b0b0b0","--color-3":"#4a4a4a","--color-4":"#2c2c2c","--color-5":"#121212","--color-6":"#5c5c3d","--color-7":"#9494b8"},
  Amoled: {"--color-1":"#eaff00","--color-2":"#ffea00","--color-3":"#ffbf00","--color-4":"#fff7dc","--color-5":"#000000","--color-6":"#fff000","--color-7":"#fff999"}
};
const neutrals = {
  light: {"--bg":"hsl(0 0% 99%)","--surface-1":"hsl(0 0% 98%)","--surface-2":"hsl(0 0% 96%)","--surface-hover":"hsl(0 0% 94%)","--border":"hsl(0 0% 85%)","--text":"hsl(0 0% 10%)","--text-muted":"hsl(0 0% 45%)"},
  dark: {"--bg":"hsl(0 0% 8%)","--surface-1":"hsl(0 0% 12%)","--surface-2":"hsl(0 0% 16%)","--surface-hover":"hsl(0 0% 20%)","--border":"hsl(0 0% 30%)","--text":"hsl(0 0% 92%)","--text-muted":"hsl(0 0% 70%)"},
  amoled: {"--bg":"#000000","--surface-1":"#000000","--surface-2":"#0a0a0a","--surface-hover":"#111111","--border":"#222222","--text":"#000000","--text-muted":"#333333"}
};
let currentPalette = localStorage.getItem("palette") || "Red";
let currentMode = localStorage.getItem("mode") || "light";

function applyTheme() {
  const root = document.documentElement;
  const palette = palettes[currentPalette];
  const neutralSet = currentPalette === "Amoled" ? neutrals.amoled : neutrals[currentMode];
  Object.entries(palette).forEach(([k, v]) => root.style.setProperty(k, v));
  Object.entries(neutralSet).forEach(([k, v]) => root.style.setProperty(k, v));
  document.body.classList.toggle("dark-mode", currentMode === "dark" || currentPalette === "Amoled");
  document.body.classList.toggle("amoled-mode", currentPalette === "Amoled");
  localStorage.setItem("palette", currentPalette);
  localStorage.setItem("mode", currentMode);
}

// ==========================
// APP BOOT
// ==========================
document.addEventListener("DOMContentLoaded", () => {
  // DOM refs
  const chatListEl = document.getElementById("chatList");
  const messagesEl = document.getElementById("messages");
  const headerEl = document.getElementById("chatHeader")?.querySelector("span");
  const inputEl = document.getElementById("input");
  const paletteSelector = document.getElementById("paletteSelector");
  const themeToggleBtn = document.getElementById("toggleThemeBtn");
  const sidebarEl = document.querySelector(".sidebar");
  const toggleSidebarBtn = document.getElementById("toggleSidebarBtn");
  const paletteBtn = document.getElementById("themeBtn");
  const scrollTopBtn = document.getElementById("scrollTopBtn");
  const inputArea = document.querySelector(".input-area");

  if (!chatListEl || !messagesEl || !inputEl || !sidebarEl || !toggleSidebarBtn) {
    console.warn("Missing required DOM elements");
    return;
  }

  // Auto-resize textarea
  function autoResize() {
    inputEl.style.height = "auto";
    inputEl.style.height = Math.min(inputEl.scrollHeight, 200) + "px";
  }
  inputEl.addEventListener("input", autoResize);
  autoResize();

  // Sidebar backdrop
  const backdropEl = document.createElement("div");
  backdropEl.className = "sidebar-backdrop";
  document.body.appendChild(backdropEl);

  // FAB position via ResizeObserver
  if (scrollTopBtn && inputArea) {
    const ro = new ResizeObserver(entries => {
      for (const entry of entries) {
        scrollTopBtn.style.bottom = (entry.contentRect.height + 20) + "px";
      }
    });
    ro.observe(inputArea);
  }

  // Show/hide FAB on scroll
  messagesEl.addEventListener("scroll", debounce(() => {
    if (!scrollTopBtn) return;
    scrollTopBtn.style.display = messagesEl.scrollTop > 200 ? "flex" : "none";
  }, 80), { passive: true });

  scrollTopBtn?.addEventListener("click", () => {
    messagesEl.scrollTo({ top: 0, behavior: "smooth" });
  });

  // Sidebar toggle
  const hamburgerIcon = toggleSidebarBtn.querySelector(".hide-icon");
  const chevronIcon = toggleSidebarBtn.querySelector(".show-icon");

  function openSidebar() {
    if (window.innerWidth <= 768) {
      sidebarEl.classList.add("open");
      backdropEl.classList.add("visible");
    } else {
      sidebarEl.classList.remove("collapsed");
    }
    hamburgerIcon?.classList.add("hidden");
    chevronIcon?.classList.remove("hidden");
  }
  function closeSidebar() {
    if (window.innerWidth <= 768) {
      sidebarEl.classList.remove("open");
      backdropEl.classList.remove("visible");
    } else {
      sidebarEl.classList.add("collapsed");
    }
    hamburgerIcon?.classList.remove("hidden");
    chevronIcon?.classList.add("hidden");
  }
  function setInitialState() {
    if (window.innerWidth <= 768) closeSidebar();
    else { openSidebar(); backdropEl.classList.remove("visible"); }
  }
  setInitialState();
  toggleSidebarBtn.addEventListener("click", () => {
    if (window.innerWidth <= 768) {
      sidebarEl.classList.contains("open") ? closeSidebar() : openSidebar();
    } else {
      sidebarEl.classList.contains("collapsed") ? openSidebar() : closeSidebar();
    }
  });
  backdropEl.addEventListener("click", closeSidebar);

  // Theme controls
  applyTheme();
  if (paletteSelector) {
    paletteSelector.value = currentPalette;
    paletteBtn?.addEventListener("click", () => {
      paletteSelector.classList.toggle("hidden");
      if (!paletteSelector.classList.contains("hidden")) paletteSelector.focus();
    });
    paletteSelector.addEventListener("change", e => {
      currentPalette = e.target.value;
      applyTheme();
      paletteSelector.classList.add("hidden");
    });
  }
  if (themeToggleBtn) {
    const darkIcon = themeToggleBtn.querySelector(".dark-icon");
    const lightIcon = themeToggleBtn.querySelector(".light-icon");
    darkIcon?.classList.toggle("hidden", currentMode === "dark");
    lightIcon?.classList.toggle("hidden", currentMode === "light");
    themeToggleBtn.addEventListener("click", () => {
      currentMode = currentMode === "light" ? "dark" : "light";
      darkIcon?.classList.toggle("hidden", currentMode === "dark");
      lightIcon?.classList.toggle("hidden", currentMode === "light");
      applyTheme();
    });
  }

  // ==========================
  // CHAT CORE
  // ==========================
  function createNewChat() {
    const newChat = { id: Date.now().toString(), title: "New Chat", messages: [] };
    chats.unshift(newChat);
    setActiveChatById(newChat.id);
    saveChats();
    renderChatList();
    renderMessages();
  }

  function deleteChat(index) {
    if (index < 0 || index >= chats.length) return;
    chats.splice(index, 1);
    if (!chats.length) setActiveChatById(null);
    else setActiveChatById(chats[0].id);
    saveChats();
    renderChatList();
    renderMessages();
  }

  function renderChatList() {
    chatListEl.innerHTML = "";
    chats.forEach((chat, i) => {
      const item = document.createElement("div");
      const active = chat.id === currentChatId;
      item.className = "chat-item" + (active ? " selected" : "");

      const isMobile = window.matchMedia("(max-width: 768px)").matches;
      const titleLimit = isMobile ? 45 : 70;
      const subtitleLimit = isMobile ? 40 : 60;
      const truncate = (s, n) => s.length > n ? s.slice(0, n) + "…" : s;

      const preview = document.createElement("div");
      preview.className = "chat-preview";
      const title = truncate(chat.title || "New Chat", titleLimit);
      const subtitle = (chat.messages?.length ? truncate(chat.messages[chat.messages.length - 1].content, subtitleLimit) : "");
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
        const idx = chats.findIndex(c => c.id === chat.id);
        if (idx > -1) {
          const [c] = chats.splice(idx, 1);
          chats.unshift(c);
          setActiveChatById(c.id);
          saveChats();
          renderChatList();
          renderMessages();
          if (window.innerWidth <= 768) closeSidebar();
          inputEl.focus();
        }
      });

      item.appendChild(preview);
      item.appendChild(delBtn);
      chatListEl.appendChild(item);
    });
  }

  function renderMessages() {
    messagesEl.innerHTML = "";
    if (headerEl) headerEl.textContent = "ChatGPT";

    const idx = getActiveChatIndex();
    if (idx === -1) {
      messagesEl.innerHTML = `<p class="placeholder">No chats yet. Start a new one!</p>`;
      return;
    }
    const chat = chats[idx];
    if (!chat.messages?.length) {
      messagesEl.innerHTML = `<p class="placeholder">This chat is empty.</p>`;
      return;
    }

    chat.messages.forEach((msg, i) => {
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
          <svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
            <polyline points="23 4 23 10 17 10"></polyline>
            <polyline points="1 20 1 14 7 14"></polyline>
            <path d="M3.51 9a9 9 0 0 1 14.85-3.36L23 10M1 14l4.64 4.36A9 9 0 0 0 20.49 15"></path>
          </svg>
        `;
        let originalPrompt = "";
        for (let j = i - 1; j >= 0; j--) {
          if (chat.messages[j].role === "user") { originalPrompt = chat.messages[j].content; break; }
        }
        refreshBtn.onclick = () => {
          chat.messages.splice(i, 1);
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
  // SEND
  // ==========================
  async function sendMessage() {
    const text = inputEl.value.trim();
    if (!text) return;

    let idx = getActiveChatIndex();
    if (idx === -1) {
      createNewChat();
      idx = 0;
    }
    const chat = chats[idx];

    chat.messages.push({ role: "user", content: text, time: formatDateTime() });

    if (!chat.title || chat.title === "New Chat") {
      const firstLine = text.split(/\r?\n/)[0];
      chat.title = firstLine.length > 40 ? firstLine.slice(0, 40) + "…" : firstLine;
    }

    chat.messages.push({ role: "assistant", content: "__TYPING__", time: formatDateTime() });
    renderMessages();
    inputEl.value = "";
    inputEl.style.height = "auto";
    saveChats();

    const sendBtn = document.getElementById("sendBtn");
    const prevDisabled = sendBtn?.disabled;
    if (sendBtn) sendBtn.disabled = true;

    try {
      const data = await chatWithWorker(currentModel, chat.messages);
      const answer = data?.choices?.[0]?.message?.content || "No response";
      chat.messages[chat.messages.length - 1] = { role: "assistant", content: answer, time: formatDateTime() };
    } catch (e) {
      chat.messages[chat.messages.length - 1] = { role: "assistant", content: "Error: " + e.message, time: formatDateTime() };
    } finally {
      if (sendBtn) sendBtn.disabled = prevDisabled ?? false;
    }

    saveChats();
    renderMessages();
    renderChatList();
  }

  async function sendMessageRetry(promptText) {
    if (!promptText) return;

    let idx = getActiveChatIndex();
    if (idx === -1) {
      createNewChat();
      idx = 0;
    }
    const chat = chats[idx];

    chat.messages.push({ role: "user", content: promptText, time: formatDateTime() });
    chat.messages.push({ role: "assistant", content: "__TYPING__", time: formatDateTime() });
    renderMessages();
    saveChats();

    try {
      const data = await chatWithWorker(currentModel, chat.messages);
      const answer = data?.choices?.[0]?.message?.content || "No response";
      chat.messages[chat.messages.length - 1] = { role: "assistant", content: answer, time: formatDateTime() };
    } catch (e) {
      chat.messages[chat.messages.length - 1] = { role: "assistant", content: "Error: " + e.message, time: formatDateTime() };
    }

    saveChats();
    renderMessages();
    renderChatList();
  }

  // ==========================
  // EVENTS
  // ==========================
  document.getElementById("newChatBtn")?.addEventListener("click", () => {
    createNewChat();
    if (window.innerWidth <= 768) closeSidebar();
  });

  document.getElementById("sendBtn")?.addEventListener("click", sendMessage);

  inputEl.addEventListener("keydown", e => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      sendMessage();
    }
  });

  // ==========================
  // INITIAL LOAD
  // ==========================
  (async () => {
    applyTheme();

    // Show modal and wait for login/register success
    await ensureLoginUI();
    const userId = localStorage.getItem("chat_user_id");

    // Try to hydrate from cloud
    let hydrated = false;
    try {
      const workerChats = await loadFromWorker(userId);
      if (Array.isArray(workerChats) && workerChats.length) {
        chats = workerChats;
        if (currentChatId && chats.some(c => c.id === currentChatId)) {
          const idx = chats.findIndex(c => c.id === currentChatId);
          if (idx > -1) {
            const [active] = chats.splice(idx, 1);
            chats.unshift(active);
          }
        } else {
          currentChatId = chats[0].id;
        }
        hydrated = true;
        saveLocal();
      }
    } catch (e) {
      console.warn("Could not load from worker:", e);
    }

    // Fallback to local
    if (!hydrated) {
      const raw = localStorage.getItem("secure_chat_chats");
      if (raw) {
        try {
          chats = JSON.parse(raw) || [];
          if (!currentChatId && chats[0]) currentChatId = chats[0].id;
        } catch (e) {
          console.warn("Error parsing local chats:", e);
          chats = [];
        }
      }
      if (!chats.length) {
        createNewChat();
      } else if (userId) {
        saveToWorker(userId, chats).catch(() => {});
      }
    }

    renderChatList();
    renderMessages();
  })();
});
