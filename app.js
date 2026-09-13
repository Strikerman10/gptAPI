// ================================
// CONFIG & GLOBAL STATE
// ================================

const WORKER_URL = "https://gptapiv2.barney-willis2.workers.dev";

// AUTH STATE
let authToken = localStorage.getItem("authToken") || null;
let userId = localStorage.getItem("userId") || null;

let chats = [];
let currentIndex = null;
let currentProvider = localStorage.getItem("chat_provider") || "openai";
let currentModel = localStorage.getItem("chat_model") || "gpt-5.5-2026-04-23";

// Controls the in-flight request so the user can stop a hanging model
let activeAbortController = null;

// Sidebar backdrop element
let sidebarBackdropEl = null;

// Pending attachments for the NEXT message. Each: { r2Key, filename, contentType, previewUrl }
let pendingAttachments = [];

// DOM element cache (populated on DOMContentLoaded)
const dom = {};

// ================================
// DOM READY
// ================================

document.addEventListener("DOMContentLoaded", async () => {
  cacheDOM();

  // Keyboard adaptability (mobile)
  initKeyboardAdaptability();

  // File attachments
  initFileAttachments();

  // Logout modal
  initLogoutModal();

  // Auth modal
  await initAuth();
  dom.modalConfirm.addEventListener("click", async () => { confirmLogout(); });

  // Sidebar
  initSidebar();

  // Scroll buttons
  initScrollButtons();

  // Theme
  initTheme();

  // Model selector
  initModelSelector();

  // Chat operations
  dom.newChatBtn.addEventListener("click", () => {
    createNewChat();
    if (window.innerWidth <= 768) closeSidebar();
  });
  dom.sendBtn.addEventListener("click", sendMessage);
  dom.inputEl.addEventListener("keydown", (e) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      sendMessage();
    }
  });

  // Keyboard shortcuts
  document.addEventListener("keydown", (e) => {
    if (e.key === "Escape") {
      if (dom.modelSheet && !dom.modelSheet.classList.contains("hidden")) closeModelSheet();
    }
  });

  // Initial render
  applyTheme();
  syncActiveModel(`${currentProvider}|${currentModel}`);

  const authed = await initAuth();
  if (!authed) return;

  await new Promise(r => setTimeout(r, 150));

  let gotFromWorker = false;
  try {
    const res = await fetch(`${WORKER_URL}/load?userId=${encodeURIComponent(userId)}`, {
      headers: { "Authorization": `Bearer ${authToken}` }
    });
    if (res.status === 401) { await handleUnauthorized(); return; }
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
    await loadChats();
  }

  renderChatList();
  renderMessages();
});

// ================================
// AUTH AUTHENTICATION
// ================================

async function initAuth() {
  if (authToken && userId) {
    dom.authModal.classList.add("hidden");
    return true;
  }

  dom.authModal.classList.remove("hidden");

  // Clone elements to wipe any old event listeners
  const oldSubmitBtn = dom.authSubmitBtn;
  const submitBtn = oldSubmitBtn.cloneNode(true);
  oldSubmitBtn.parentNode.replaceChild(submitBtn, oldSubmitBtn);
  dom.authSubmitBtn = submitBtn;

  // Reset button state in case it was left disabled from previous login
  submitBtn.disabled = false;
  submitBtn.textContent = "Sign In";

  const oldTabLogin = dom.tabLogin;
  const tabLogin = oldTabLogin.cloneNode(true);
  oldTabLogin.parentNode.replaceChild(tabLogin, oldTabLogin);
  dom.tabLogin = tabLogin;

  const oldTabRegister = dom.tabRegister;
  const tabRegister = oldTabRegister.cloneNode(true);
  oldTabRegister.parentNode.replaceChild(tabRegister, oldTabRegister);
  dom.tabRegister = tabRegister;

  const oldPasswordEl = dom.authPassword;
  const passwordEl = oldPasswordEl.cloneNode(true);
  oldPasswordEl.parentNode.replaceChild(passwordEl, oldPasswordEl);
  dom.authPassword = passwordEl;

  const errorEl = dom.authError;
  const titleEl = dom.authModalTitle;
  const subtitleEl = dom.authModalSubtitle;

  return new Promise((resolve) => {
    let mode = "login";

    tabLogin.addEventListener("click", () => {
      mode = "login";
      tabLogin.classList.add("active");
      tabRegister.classList.remove("active");
      submitBtn.textContent = "Sign In";
      titleEl.textContent = "Welcome Back";
      subtitleEl.textContent = "Sign in to access your chats";
      errorEl.textContent = "";
    });

    tabRegister.addEventListener("click", () => {
      mode = "register";
      tabRegister.classList.add("active");
      tabLogin.classList.remove("active");
      submitBtn.textContent = "Create Account";
      titleEl.textContent = "Create Account";
      subtitleEl.textContent = "Register to save your chats";
      errorEl.textContent = "";
    });

    submitBtn.addEventListener("click", async () => {
      const username = dom.authUsername.value.trim();
      const password = dom.authPassword.value.trim();
      errorEl.textContent = "";

      if (!username || !password) {
        errorEl.textContent = "Please enter a username and password.";
        return;
      }

      submitBtn.disabled = true;
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
          errorEl.style.color = "green";
          errorEl.textContent = "Account created! Signing you in…";

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

        localStorage.setItem("authToken", authToken);
        localStorage.setItem("userId",    userId);

        dom.authModal.classList.add("hidden");
        resolve(true);

      } catch (err) {
        errorEl.style.color   = "";
        errorEl.textContent   = err.message;
        submitBtn.disabled    = false;
        submitBtn.textContent = mode === "login" ? "Sign In" : "Create Account";
      }
    });

    // Use cloned passwordEl here, not getElementById
    passwordEl.addEventListener("keydown", (e) => {
      if (e.key === "Enter") submitBtn.click();
    });
  });
}

async function handleUnauthorized() {
  authToken = null;
  userId = null;
  localStorage.removeItem("authToken");
  localStorage.removeItem("userId");
  await initAuth();
}

// ================================
// RENDERING HELPERS
// ================================

function extractAnswer(data) {
  if (!data) return "";
  if (typeof data === "string") return data;
  if (data.choices && Array.isArray(data.choices) && data.choices[0]) {
    return data.choices[0].message?.content ?? "";
  }
  if (data.output) return String(data.output);
  return data.reply ?? data.answer ?? "";
}

function renderMessageContent(content) {
  if (typeof content !== "string") return "";
  return content
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/\*\*(.+?)\*\*/g, "<strong>$1</strong>")
    .replace(/\*(.+?)\*/g, "<em>$1</em>")
    .replace(/`([^`]+)`/g, "<code>$1</code>")
    .replace(/\n/g, "<br>");
}

function renderChatList() {
  dom.chatListEl.innerHTML = "";
  const isMobile = window.matchMedia("(max-width: 768px)").matches;
  const titleLimit = isMobile ? 45 : 70;
  const subtitleLimit = isMobile ? 40 : 60;

  function truncate(str, n) {
    return typeof str === "string" && str.length > n ? str.slice(0, n) + "…" : str;
  }

  const pinned   = chats.map((c, i) => ({ chat: c, i })).filter(x => x.chat.pinned);
  const unpinned = chats.map((c, i) => ({ chat: c, i })).filter(x => !x.chat.pinned);

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
    preview.innerHTML = `<div class="chat-title">${title}</div><div class="chat-subtitle">${subtitle}</div>`;

    const pinBtn = document.createElement("button");
    pinBtn.className = "pin-btn" + (chat.pinned ? " active" : "");
    pinBtn.setAttribute("aria-label", chat.pinned ? "Unpin chat" : "Pin chat");
    pinBtn.title = chat.pinned ? "Unpin" : "Pin to top";
    pinBtn.innerHTML = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" width="14" height="14" fill="currentColor"><path d="M16 12V4h1V2H7v2h1v8l-2 2v2h5.2v6h1.6v-6H18v-2l-2-2z"/></svg>`;
    pinBtn.addEventListener("click", (e) => { e.stopPropagation(); togglePin(i); });

    const delBtn = document.createElement("button");
    delBtn.className = "delete-btn";
    delBtn.setAttribute("aria-label", "Delete chat");
    delBtn.textContent = "×";
    delBtn.addEventListener("click", (e) => { e.stopPropagation(); deleteChat(i); });

    item.addEventListener("click", () => {
      const [clicked] = chats.splice(i, 1);
      if (!clicked.pinned) {
        const firstUnpinned = chats.findIndex(c => !c.pinned);
        if (firstUnpinned === -1) { chats.push(clicked); }
        else { chats.splice(firstUnpinned, 0, clicked); }
        currentIndex = chats.findIndex(c => c.id === clicked.id);
      } else {
        chats.unshift(clicked);
        currentIndex = 0;
      }
      saveChats();
      renderChatList();
      renderMessages();
      if (window.innerWidth <= 768) closeSidebar();
    });

    const actionsDiv = document.createElement("div");
    actionsDiv.className = "chat-item-actions";
    actionsDiv.appendChild(pinBtn);
    actionsDiv.appendChild(delBtn);
    item.appendChild(preview);
    item.appendChild(actionsDiv);
    dom.chatListEl.appendChild(item);
  }

  if (pinned.length > 0) {
    const pinnedHeader = document.createElement("div");
    pinnedHeader.className = "chat-section-header";
    pinnedHeader.textContent = "Pinned";
    dom.chatListEl.appendChild(pinnedHeader);
    pinned.forEach(buildItem);
  }

  if (unpinned.length > 0) {
    const allHeader = document.createElement("div");
    allHeader.className = "chat-section-header";
    allHeader.textContent = pinned.length > 0 ? "All Chats" : "";
    if (pinned.length > 0) dom.chatListEl.appendChild(allHeader);
    unpinned.forEach(buildItem);
  }
}

function renderMessages() {
  dom.messagesEl.innerHTML = "";
  dom.chatTitleEl.textContent = "Orion AI Messages";

  if (currentIndex === null || !chats[currentIndex]) {
    dom.messagesEl.innerHTML = `<p class="placeholder">No chats yet. Start a new one!</p>`;
    return;
  }

  const chat = chats[currentIndex];
  if (!chat.messages || !chat.messages.length) {
    dom.messagesEl.innerHTML = `<p class="placeholder">This chat is empty.</p>`;
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
      textDiv.innerHTML = `<div class="typing-indicator"><span></span><span></span><span></span></div>`;
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

    if (Array.isArray(msg.attachments) && msg.attachments.length > 0) {
      const attachDiv = document.createElement("div");
      attachDiv.className = "msg-attachments";
      attachDiv.textContent = msg.attachments.map(a => a.filename || "file").join(", ");
      metaDiv.appendChild(attachDiv);
    }

    div.appendChild(textDiv);
    div.appendChild(metaDiv);
    wrapper.appendChild(div);

    if (idx === lastAssistantIdx && msg.role === "assistant" && msg.content !== "__TYPING__") {
      const regenBtn = document.createElement("button");
      regenBtn.className = "retry-btn";
      regenBtn.textContent = "↻ Retry";
      regenBtn.addEventListener("click", () => sendMessageRetry());
      wrapper.appendChild(regenBtn);
    }

    dom.messagesEl.appendChild(wrapper);
  });

  requestAnimationFrame(() => {
    dom.messagesEl.scrollTop = dom.messagesEl.scrollHeight;
    requestAnimationFrame(updateScrollBtnPosition);
  });
}

// ================================
// THEME & PALETTE
// ================================

const palettes = {
  Red: {
    "--color-1": "#1a1a1a",
    "--color-2": "#2a2a2a",
    "--color-3": "#3a3a3a",
    "--color-4": "#111111",
    "--color-5": "#000000",
    "--color-6": "#362239",
    "--color-7": "#266D69"
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

let currentPalette = localStorage.getItem("palette") || "Red";
let currentMode    = localStorage.getItem("mode")    || "light";

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

  document.querySelectorAll(".palette-option").forEach(el => {
    el.classList.toggle("active", el.dataset.palette === currentPalette);
  });

  localStorage.setItem("palette", currentPalette);
  localStorage.setItem("mode", currentMode);
}

function initTheme() {
  applyTheme();

  dom.paletteBtn.addEventListener("click", () => {
    dom.paletteSheet.classList.remove("hidden");
    dom.sheetBackdrop.classList.remove("hidden");
    requestAnimationFrame(() => {
      dom.paletteSheet.classList.add("show");
      dom.sheetBackdrop.classList.add("show");
    });
    dom.paletteBtn.setAttribute("aria-expanded", "true");
    document.body.style.overflow = "hidden";
  });

  dom.sheetBackdrop.addEventListener("click", () => {
    dom.paletteSheet.classList.remove("show", "hidden");
    dom.sheetBackdrop.classList.remove("show", "hidden");
    dom.paletteBtn.setAttribute("aria-expanded", "false");
    document.body.style.overflow = "";
  });

  document.querySelectorAll(".palette-option").forEach(btn => {
    btn.addEventListener("click", () => {
      currentPalette = btn.dataset.palette;
      applyTheme();
      dom.paletteSheet.classList.remove("show", "hidden");
      dom.sheetBackdrop.classList.remove("show", "hidden");
      dom.paletteBtn.setAttribute("aria-expanded", "false");
      document.body.style.overflow = "";
    });
  });
}

// ================================
// MODEL SELECTOR
// ================================

function syncActiveModel(currentVal) {
  dom.modelSheetOptions.forEach(btn => {
    btn.classList.toggle("active", btn.dataset.model === currentVal);
  });
  dom.modelSelector.value = currentVal;
}

function openModelSheet() {
  dom.modelSheet.classList.remove("hidden");
  dom.modelSheetBackdrop.classList.remove("hidden");
  requestAnimationFrame(() => {
    dom.modelSheet.classList.add("show");
    dom.modelSheetBackdrop.classList.add("show");
  });
  document.body.style.overflow = "hidden";
}

function closeModelSheet() {
  dom.modelSheet.classList.remove("show");
  dom.modelSheetBackdrop.classList.remove("show");
  document.body.style.overflow = "";
  setTimeout(() => {
    dom.modelSheet.classList.add("hidden");
    dom.modelSheetBackdrop.classList.add("hidden");
  }, 220);
}

function initModelSelector() {
  dom.modelSelector.value = `${currentProvider}|${currentModel}`;

  dom.modelSelector.addEventListener("change", (e) => {
    const value = e.target.value || "";
    const parts = value.split("|");
    if (parts.length === 2) {
      currentProvider = parts[0];
      currentModel = parts[1];
    } else {
      currentProvider = "openai";
      currentModel = value || "gpt-5.5-2026-04-23";
    }
    localStorage.setItem("chat_provider", currentProvider);
    localStorage.setItem("chat_model", currentModel);
    syncActiveModel(e.target.value);
  });

  dom.modelSelector.addEventListener("mousedown", (e) => {
    if (window.innerWidth <= 768) {
      e.preventDefault();
      openModelSheet();
    }
  });

  dom.closeModelSheetBtn?.addEventListener("click", closeModelSheet);
  dom.modelSheetBackdrop?.addEventListener("click", closeModelSheet);

  dom.modelSheetOptions.forEach(btn => {
    btn.addEventListener("click", () => {
      const value = btn.dataset.model;
      const parts = value.split("|");
      if (parts.length === 2) {
        currentProvider = parts[0];
        currentModel = parts[1];
      } else {
        currentProvider = "openai";
        currentModel = value;
      }
      localStorage.setItem("chat_provider", currentProvider);
      localStorage.setItem("chat_model", currentModel);
      syncActiveModel(value);
      setTimeout(closeModelSheet, 180);
    });
  });
}

// ================================
// DOM CACHING
// ================================

function cacheDOM() {
  dom.chatListEl    = document.getElementById("chatList");
  dom.messagesEl    = document.getElementById("messages");
  dom.chatTitleEl   = document.getElementById("chatTitle");
  dom.inputEl       = document.getElementById("input");
  dom.themeToggleBtn = document.getElementById("themeToggle");
  dom.sidebarEl        = document.querySelector(".sidebar");
  dom.toggleSidebarBtn = document.getElementById("toggleSidebarBtn");
  dom.modelSelector    = document.getElementById("modelSelector");
  dom.logoutBtn     = document.getElementById("logoutBtn");
  dom.fileInputEl   = document.getElementById("fileInput");
  dom.attachBtnEl    = document.getElementById("attachBtn");
  dom.chipsEl        = document.getElementById("attachmentChips");
  dom.dropZone       = document.querySelector(".input-area");
  dom.logoutModal    = document.getElementById('logoutModal');
  dom.modalCancel    = document.getElementById('modalCancel');
  dom.modalConfirm   = document.getElementById('modalConfirm');
  dom.authModal      = document.getElementById("authModal");
  dom.authSubmitBtn  = document.getElementById("authSubmitBtn");
  dom.tabLogin       = document.getElementById("tabLogin");
  dom.tabRegister    = document.getElementById("tabRegister");
  dom.authPassword   = document.getElementById("authPassword");
  dom.authError      = document.getElementById("authError");
  dom.authModalTitle = document.getElementById("authModalTitle");
  dom.authModalSubtitle = document.getElementById("authModalSubtitle");
  dom.authUsername   = document.getElementById("authUsername");
  dom.sendBtn        = document.getElementById("sendBtn");
  dom.newChatBtn     = document.getElementById("newChatBtn");
  dom.scrollTopBtn   = document.getElementById("scrollTopBtn");
  dom.scrollBottomBtn = document.getElementById("scrollBottomBtn");
  dom.inputArea      = document.querySelector(".input-area");
  dom.textarea       = document.querySelector(".input-area textarea");
  dom.modelSheet     = document.getElementById('modelSheet');
  dom.modelSheetBackdrop = document.getElementById('modelSheetBackdrop');
  dom.closeModelSheetBtn = document.getElementById('closeModelSheetBtn');
  dom.modelSheetOptions = document.querySelectorAll('.model-sheet-option');
  dom.paletteSheet         = document.getElementById("paletteSheet");
  dom.sheetBackdrop          = document.getElementById("sheetBackdrop");
  dom.paletteBtn             = document.getElementById("paletteBtn");
}

// ================================
// KEYBOARD ADAPTABILITY (MOBILE)
// ================================

function initKeyboardAdaptability() {
  if (window.visualViewport) {
    window.visualViewport.addEventListener('resize', () => {
      document.body.style.height = `${window.visualViewport.height}px`;
      const activeEl = document.activeElement;
      if (activeEl && (activeEl.tagName === 'TEXTAREA' || activeEl.tagName === 'INPUT')) {
        activeEl.scrollIntoView({ block: 'nearest' });
      }
    });
  }
}

// ================================
// FILE ATTACHMENTS
// ================================

const ALLOWED_TYPES = new Set([
  "image/png", "image/jpeg", "image/gif", "image/webp",
  "application/pdf", "text/plain", "text/markdown"
]);
const MAX_FILE_SIZE = 8 * 1024 * 1024; // 15MB

function initFileAttachments() {
  dom.attachBtnEl.addEventListener("click", () => dom.fileInputEl.click());

  dom.fileInputEl.addEventListener("change", async (e) => {
    const files = Array.from(e.target.files || []);
    dom.fileInputEl.value = "";
    for (const file of files) {
      await handleFileSelect(file);
    }
  });

  ["dragenter", "dragover", "dragleave", "drop"].forEach(evt => {
    dom.dropZone.addEventListener(evt, (e) => {
      e.preventDefault();
      e.stopPropagation();
    });
  });

  ["dragenter", "dragover"].forEach(evt => {
    dom.dropZone.addEventListener(evt, () => dom.dropZone.classList.add("drag-over"));
  });
  ["dragleave", "drop"].forEach(evt => {
    dom.dropZone.addEventListener(evt, () => dom.dropZone.classList.remove("drag-over"));
  });

  dom.dropZone.addEventListener("drop", async (e) => {
    const files = Array.from(e.dataTransfer?.files || []);
    for (const file of files) {
      await handleFileSelect(file);
    }
  });
}

async function handleFileSelect(file) {
  let type = file.type;
  if (!type && /\.md$/i.test(file.name)) type = "text/markdown";
  if (!type && /\.txt$/i.test(file.name)) type = "text/plain";

  if (!ALLOWED_TYPES.has(type)) {
    alert(`Unsupported file type: ${file.name} (${type || "unknown"})`);
    return;
  }
  if (file.size > MAX_FILE_SIZE) {
    alert(`File too large: ${file.name} (max 15MB)`);
    return;
  }

  const tempId = "tmp_" + Math.random().toString(36).slice(2);
  const previewUrl = type.startsWith("image/") ? URL.createObjectURL(file) : null;
  const placeholder = {
    tempId, filename: file.name, contentType: type,
    previewUrl, r2Key: null, uploading: true
  };
  pendingAttachments.push(placeholder);
  renderChips();

  try {
    const uploaded = await uploadFile(file);
    placeholder.r2Key = uploaded.r2Key;
    placeholder.uploading = false;
    renderChips();
  } catch (err) {
    console.error("Upload failed:", err);
    alert(`Upload failed for ${file.name}: ${err.message}`);
    pendingAttachments = pendingAttachments.filter(a => a.tempId !== tempId);
    renderChips();
  }
}

// ================================
// LOGOUT MODAL
// ================================

function initLogoutModal() {
  dom.logoutBtn.addEventListener("click", () => {
    dom.logoutModal.classList.add('active');
  });

  dom.modalCancel.addEventListener('click', () => {
    dom.logoutModal.classList.remove('active');
  });

  dom.logoutModal.addEventListener('click', (e) => {
    if (e.target === dom.logoutModal) {
      dom.logoutModal.classList.remove('active');
    }
  });
}

function confirmLogout() {
  dom.logoutModal.classList.remove('active');

  authToken = null;
  userId = null;
  chats = [];
  currentIndex = null;

  localStorage.removeItem("authToken");
  localStorage.removeItem("userId");
  localStorage.removeItem("secure_chat_chats");
  localStorage.removeItem("secure_chat_index");

  dom.messagesEl.innerHTML = "";
  dom.chatListEl.innerHTML = "";
  const DEFAULT_CHAT_TITLE = "Orion AI Messages";
  dom.chatTitleEl.textContent = DEFAULT_CHAT_TITLE;

  // Reset auth modal state
  resetAuthModal();
  renderChatList();
  renderMessages();
}

function resetAuthModal() {
  dom.authModalTitle.textContent = "Welcome Back";
  dom.authModalSubtitle.textContent = "Sign in to access your chats";
  dom.authError.textContent = "";
  dom.authUsername.value = "";
  dom.authPassword.value = "";
  dom.tabLogin.classList.add("active");
  dom.tabRegister.classList.remove("active");
}

async function uploadFile(file) {
  if (!authToken) {
    throw new Error("Not logged in or missing auth token");
  }

  const form = new FormData();
  form.append("file", file);

  const res = await fetch(`${WORKER_URL}/upload`, {
    method: "POST",
    headers: { "Authorization": `Bearer ${authToken}` },
    body: form
  });

  if (res.status === 401) {
    await handleUnauthorized();
    throw new Error("Unauthorized");
  }

  const raw = await res.text();
  let data = {};
  try {
    data = raw ? JSON.parse(raw) : {};
  } catch {
    throw new Error(`Invalid JSON from upload: ${raw}`);
  }

  if (!res.ok) {
    throw new Error(data.detail || data.error || `Upload returned ${res.status}`);
  }

  return data;
}

function renderChips() {
  dom.chipsEl.innerHTML = "";
  pendingAttachments.forEach((att) => {
    const chip = document.createElement("div");
    chip.className = "chip" + (att.uploading ? " uploading" : "");

    if (att.previewUrl) {
      const img = document.createElement("img");
      img.src = att.previewUrl;
      chip.appendChild(img);
    } else {
      const icon = document.createElement("span");
      icon.textContent = att.contentType === "application/pdf" ? "📄" : "📝";
      chip.appendChild(icon);
    }

    const name = document.createElement("span");
    name.className = "chip-name";
    name.textContent = att.uploading ? `${att.filename} (uploading…)` : att.filename;
    chip.appendChild(name);

    if (!att.uploading) {
      const remove = document.createElement("button");
      remove.className = "chip-remove";
      remove.type = "button";
      remove.textContent = "✕";
      remove.addEventListener("click", () => {
        if (att.previewUrl) URL.revokeObjectURL(att.previewUrl);
        pendingAttachments = pendingAttachments.filter(a => a !== att);
        renderChips();
      });
      chip.appendChild(remove);
    }

    dom.chipsEl.appendChild(chip);
  });
}

// ================================
// SIDEBAR
// ================================

function closeSidebar() {
  if (window.innerWidth <= 768) {
    dom.sidebarEl.classList.remove("open");
    if (sidebarBackdropEl) sidebarBackdropEl.classList.remove("visible");
  } else {
    dom.sidebarEl.classList.add("collapsed");
  }
  const hamburgerIcon = dom.toggleSidebarBtn.querySelector(".hide-icon");
  const chevronIcon = dom.toggleSidebarBtn.querySelector(".show-icon");
  if (hamburgerIcon) hamburgerIcon.classList.remove("hidden");
  if (chevronIcon) chevronIcon.classList.add("hidden");
}

function initSidebar() {
  sidebarBackdropEl = document.createElement("div");
  sidebarBackdropEl.className = "sidebar-backdrop";
  document.body.appendChild(sidebarBackdropEl);

  const hamburgerIcon = dom.toggleSidebarBtn.querySelector(".hide-icon");
  const chevronIcon = dom.toggleSidebarBtn.querySelector(".show-icon");

  function openSidebar() {
    if (window.innerWidth <= 768) {
      dom.sidebarEl.classList.add("open");
      sidebarBackdropEl.classList.add("visible");
    } else {
      dom.sidebarEl.classList.remove("collapsed");
    }
    hamburgerIcon.classList.add("hidden");
    chevronIcon.classList.remove("hidden");
  }

  function setInitialState() {
    if (window.innerWidth <= 768) {
      closeSidebar();
    } else {
      openSidebar();
      sidebarBackdropEl.classList.remove("visible");
    }
  }

  setInitialState();

  dom.toggleSidebarBtn.addEventListener("click", () => {
    if (window.innerWidth <= 768) {
      if (dom.sidebarEl.classList.contains("open")) {
        closeSidebar();
      } else {
        openSidebar();
      }
    } else {
      if (dom.sidebarEl.classList.contains("collapsed")) {
        openSidebar();
      } else {
        closeSidebar();
      }
    }
  });

  sidebarBackdropEl.addEventListener("click", closeSidebar);

  let touchStartX = 0;
  document.addEventListener("touchstart", e => {
    if (window.innerWidth > 768) return;
    touchStartX = e.changedTouches[0].screenX;
  });

  document.addEventListener("touchend", e => {
    if (window.innerWidth > 768) return;
    const touchEndX = e.changedTouches[0].screenX;
    const deltaX = touchEndX - touchStartX;

    if (touchStartX < 50 && deltaX > 60 && !dom.sidebarEl.classList.contains("open")) {
      openSidebar();
    }
    if (deltaX < -60 && dom.sidebarEl.classList.contains("open")) {
      closeSidebar();
    }
  });
}

// ================================
// SCROLL BUTTONS
// ================================

function updateScrollBtnPosition() {
  const inputHeight = dom.inputArea.offsetHeight;
  const bottom = (inputHeight + 20) + "px";
  dom.scrollTopBtn.style.bottom = bottom;
  dom.scrollBottomBtn.style.bottom = bottom;
}

function initScrollButtons() {
  autoResize();

  dom.textarea.addEventListener("input", autoResize);
  window.addEventListener("resize", () => {
    requestAnimationFrame(updateScrollBtnPosition);
  });

  const inputResizeObserver = new ResizeObserver(() => {
    requestAnimationFrame(updateScrollBtnPosition);
  });
  inputResizeObserver.observe(dom.inputArea);

  let lastScrollTop = 0;
  dom.messagesEl.addEventListener("scroll", () => {
    updateScrollBtnPosition();
    const distanceFromTop = dom.messagesEl.scrollTop;
    const distanceFromBottom = dom.messagesEl.scrollHeight - dom.messagesEl.scrollTop - dom.messagesEl.clientHeight;
    const canScroll = dom.messagesEl.scrollHeight > dom.messagesEl.clientHeight;

    if (!canScroll) {
      dom.scrollTopBtn.style.display = "none";
      dom.scrollBottomBtn.style.display = "none";
    } else if (distanceFromTop <= 50) {
      dom.scrollTopBtn.style.display = "none";
      dom.scrollBottomBtn.style.display = "flex";
    } else if (distanceFromBottom <= 50) {
      dom.scrollTopBtn.style.display = "flex";
      dom.scrollBottomBtn.style.display = "none";
    } else {
      const isScrollingUp = dom.messagesEl.scrollTop < lastScrollTop;
      if (isScrollingUp) {
        dom.scrollTopBtn.style.display = "none";
        dom.scrollBottomBtn.style.display = "flex";
      } else {
        dom.scrollTopBtn.style.display = "flex";
        dom.scrollBottomBtn.style.display = "none";
      }
    }
    lastScrollTop = dom.messagesEl.scrollTop;
  });

  dom.scrollTopBtn.addEventListener("click", () => {
    dom.messagesEl.scrollTo({ top: 0, behavior: "smooth" });
  });

  dom.scrollBottomBtn.addEventListener("click", () => {
    dom.messagesEl.scrollTo({ top: dom.messagesEl.scrollHeight, behavior: "smooth" });
  });

  setTimeout(() => {
    updateScrollBtnPosition();
    dom.messagesEl.dispatchEvent(new Event("scroll"));
  }, 100);
}
function autoResize() {
  dom.inputEl.style.height = "auto";
  dom.inputEl.style.height = Math.min(dom.inputEl.scrollHeight, 200) + "px";
}

// ================================
// SEND MESSAGE
// ================================

async function sendMessage() {
  const text = dom.inputEl.value.trim();
  const readyAttachments = pendingAttachments.filter(a => !a.uploading && a.r2Key);

  if (!text && readyAttachments.length === 0) return;

  if (pendingAttachments.some(a => a.uploading)) {
    alert("Please wait for attachments to finish uploading.");
    return;
  }

  if (readyAttachments.length > 0 && currentProvider === "gemini") {
    alert("Gemini doesn't support file/image attachments. Please switch to OpenAI or Anthropic, or remove the attachment.");
    return;
  }

  if (currentIndex === null) createNewChat();
  const chat = chats[currentIndex];

  const userMessage = {
    role: "user",
    content: text,
    time: formatDateTime(),
    model: dom.modelSelector.options[dom.modelSelector.selectedIndex].text
  };

  if (readyAttachments.length > 0) {
    userMessage.attachments = readyAttachments.map(a => ({
      r2Key: a.r2Key,
      filename: a.filename,
      contentType: a.contentType
    }));
  }

  chat.messages.push(userMessage);

  if (chat.title === "New Chat" || !chat.title) {
    if (text) {
      const firstLine = text.split(/\r?\n/)[0];
      chat.title = firstLine.length > 40 ? firstLine.slice(0, 40) + "…" : firstLine;
    } else if (readyAttachments.length > 0) {
      chat.title = `📎 ${readyAttachments[0].filename}`;
    }
  }

  chat.messages.push({ role: "assistant", content: "__TYPING__", time: formatDateTime() });
  renderMessages();

  dom.inputEl.value = "";
  pendingAttachments.forEach(a => { if (a.previewUrl) URL.revokeObjectURL(a.previewUrl); });
  pendingAttachments = [];
  renderChips();
  autoResize();
  requestAnimationFrame(updateScrollBtnPosition);

  saveChats();
  saveChatsToWorker();

  activeAbortController = new AbortController();

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
      headers: { "Content-Type": "application/json", "Authorization": `Bearer ${authToken}` },
      body: JSON.stringify({
        provider: currentProvider,
        model: currentModel,
        messages: cleanMessages
      }),
      signal: activeAbortController.signal,
    });

    if (res.status === 401) { await handleUnauthorized(); return; }

    const rawText = await res.text();
    let data = {};
    try {
      data = rawText ? JSON.parse(rawText) : {};
    } catch {
      throw new Error(`Invalid JSON from worker: ${rawText}`);
    }

    if (!res.ok) {
      throw new Error(data.detail || data.error || `Worker returned ${res.status}`);
    }

    chat.messages[chat.messages.length - 1] = {
      role: "assistant",
      content: extractAnswer(data),
      time: formatDateTime(),
      model: dom.modelSelector.options[dom.modelSelector.selectedIndex].text
    };
  } catch (e) {
    if (e.name === "AbortError") {
      return;
    }
    console.error("sendMessage failed:", e);
    chat.messages[chat.messages.length - 1] = {
      role: "assistant",
      content: "Error: " + e.message,
      time: formatDateTime(),
      model: dom.modelSelector.options[dom.modelSelector.selectedIndex].text
    };
  } finally {
    activeAbortController = null;
  }

  saveChats();
  saveChatsToWorker();
  renderMessages();
  renderChatList();
}

async function sendMessageRetry() {
  if (currentIndex === null) createNewChat();
  const chat = chats[currentIndex];

  const hasAttachments = chat.messages
    .slice(-10)
    .some(m => Array.isArray(m.attachments) && m.attachments.length > 0);

  if (hasAttachments && currentProvider === "gemini") {
    alert("This conversation contains attachments, which Gemini doesn't support. Please switch to OpenAI or Anthropic to retry.");
    return;
  }

  chat.messages.push({ role: "assistant", content: "__TYPING__", time: formatDateTime() });
  renderMessages();
  saveChats();
  saveChatsToWorker();

  activeAbortController = new AbortController();

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
      headers: { "Content-Type": "application/json", "Authorization": `Bearer ${authToken}` },
      body: JSON.stringify({
        provider: currentProvider,
        model: currentModel,
        messages: cleanMessages.map(m => ({
          role: m.role,
          content: m.content,
          ...(m.attachments ? { attachments: m.attachments } : {})
        }))
      }),
      signal: activeAbortController.signal,
    });

    if (res.status === 401) { await handleUnauthorized(); return; }

    const rawText = await res.text();
    let data = {};
    try {
      data = rawText ? JSON.parse(rawText) : {};
    } catch {
      throw new Error(`Invalid JSON from worker: ${rawText}`);
    }

    if (!res.ok) {
      throw new Error(data.detail || data.error || `Worker returned ${res.status}`);
    }

    chat.messages[chat.messages.length - 1] = {
      role: "assistant",
      content: extractAnswer(data),
      time: formatDateTime(),
      model: dom.modelSelector.options[dom.modelSelector.selectedIndex].text
    };
  } catch (e) {
    if (e.name === "AbortError") {
      return;
    }
    console.error("sendMessageRetry failed:", e);
    chat.messages[chat.messages.length - 1] = {
      role: "assistant",
      content: "Error: " + e.message,
      time: formatDateTime(),
      model: dom.modelSelector.options[dom.modelSelector.selectedIndex].text
    };
  } finally {
    activeAbortController = null;
  }

  saveChats();
  saveChatsToWorker();
  renderMessages();
  renderChatList();
}

// ================================
// CHAT OPERATIONS
// ================================

function stopGenerating() {
  if (activeAbortController) {
    activeAbortController.abort();
  }
  if (currentIndex !== null && chats[currentIndex]) {
    const chat = chats[currentIndex];
    chat.messages = chat.messages.filter(m => m.content !== "__TYPING__");
    saveChats();
    renderMessages();
    renderChatList();
  }
}

async function loadChats() {
  try {
    const res = await fetch(`${WORKER_URL}/load?userId=${encodeURIComponent(userId)}`, {
      headers: { "Authorization": `Bearer ${authToken}` }
    });

    if (res.status === 401) {
      await handleUnauthorized();
      return;
    }

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
      headers: {
        "Content-Type": "application/json",
        "Authorization": `Bearer ${authToken}`
      },
      body: JSON.stringify({ userId, chats }),
    });
    if (res.status === 401) {
      await handleUnauthorized();
      return;
    }
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

  const pinned = chats.filter(c => c.pinned);
  const unpinned = chats.filter(c => !c.pinned);
  chats = [...pinned, ...unpinned];

  currentIndex = chats.findIndex(c => c === chats[0]) ?? 0;
  const currentId = chats[index]?.id;
  if (currentId) currentIndex = chats.findIndex(c => c.id === currentId);

  saveChats();
  renderChatList();
}
