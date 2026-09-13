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

function initSidebar() {
  const backdropEl = document.createElement("div");
  backdropEl.className = "sidebar-backdrop";
  document.body.appendChild(backdropEl);

  const hamburgerIcon = dom.toggleSidebarBtn.querySelector(".hide-icon");
  const chevronIcon = dom.toggleSidebarBtn.querySelector(".show-icon");

  function openSidebar() {
    if (window.innerWidth <= 768) {
      dom.sidebarEl.classList.add("open");
      backdropEl.classList.add("visible");
    } else {
      dom.sidebarEl.classList.remove("collapsed");
    }
    hamburgerIcon.classList.add("hidden");
    chevronIcon.classList.remove("hidden");
  }

  function closeSidebar() {
    if (window.innerWidth <= 768) {
      dom.sidebarEl.classList.remove("open");
      backdropEl.classList.remove("visible");
    } else {
      dom.sidebarEl.classList.add("collapsed");
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
  dom.textarea.addEventListener("input", () => {
    requestAnimationFrame(updateScrollBtnPosition);
  });
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
