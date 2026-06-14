// ==========================
// CONFIG
// ==========================
const WORKER_URL = "https://gptapiv2.barney-willis2.workers.dev";

// Temporary user ID: will be asked once then stored in localStorage
let userId = localStorage.getItem("chat_user_id");


let chats = [];
let currentIndex = null;
let currentProvider = localStorage.getItem("chat_provider") || "openai";
let currentModel = localStorage.getItem("chat_model") || "gpt-5.4-mini-2026-03-17";

document.addEventListener("DOMContentLoaded", () => {
  const chatListEl = document.getElementById("chatList");
  const messagesEl = document.getElementById("messages");
  const chatTitleEl = document.getElementById("chatTitle");
  const inputEl = document.getElementById("input");

  function autoResize() {
    inputEl.style.height = "auto";
    inputEl.style.height = Math.min(inputEl.scrollHeight, 200) + "px";
  }
  inputEl.addEventListener("input", autoResize);
  autoResize();

  const themeToggleBtn    = document.getElementById("toggleThemeBtn");
  const sidebarEl         = document.querySelector(".sidebar");
  const toggleSidebarBtn  = document.getElementById("toggleSidebarBtn");
  const modelSelector     = document.getElementById("modelSelector");

  const backdropEl = document.createElement("div");
  backdropEl.className = "sidebar-backdrop";
  document.body.appendChild(backdropEl);

  const paletteBtn = document.getElementById("themeBtn");
  const paletteSheet = document.getElementById("paletteSheet");
  const sheetBackdrop = document.getElementById("sheetBackdrop");
  const closeSheetBtn = document.getElementById("closeSheetBtn");
  const paletteOptions = document.querySelectorAll(".sheet-option");

  const scrollTopBtn = document.getElementById("scrollTopBtn");
  const scrollBottomBtn = document.getElementById("scrollBottomBtn");
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
  const threshold = 200;

  // Show top button only after scrolling down
  scrollTopBtn.style.display = messagesEl.scrollTop > threshold ? "flex" : "none";

  // Show bottom button only when near top
  scrollBottomBtn.style.display = messagesEl.scrollTop <= threshold ? "flex" : "none";
});

scrollTopBtn.addEventListener("click", () => {
  messagesEl.scrollTo({ top: 0, behavior: "smooth" });
});

scrollBottomBtn.addEventListener("click", () => {
  messagesEl.scrollTo({ top: messagesEl.scrollHeight, behavior: "smooth" });
});

  messagesEl.dispatchEvent(new Event("scroll"));

  const hamburgerIcon = toggleSidebarBtn.querySelector(".hide-icon");
  const chevronIcon   = toggleSidebarBtn.querySelector(".show-icon");

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
  const parts = content.split(/```([\s\S]*?)```/g);
  let html = "";

  for (let i = 0; i < parts.length; i++) {
    if (i % 2 === 0) {
      // normal text
      html += `<div class="msg-paragraph">${escapeHTML(parts[i]).replace(/\n/g, "<br>")}</div>`;
    } else {
      // code block
      let code = parts[i].trim();

      // remove optional language line like "js\n"
      const firstLineBreak = code.indexOf("\n");
      let language = "";
      if (firstLineBreak !== -1) {
        const possibleLang = code.slice(0, firstLineBreak).trim();
        if (/^[a-zA-Z0-9_-]+$/.test(possibleLang)) {
          language = possibleLang;
          code = code.slice(firstLineBreak + 1);
        }
      }

      html += `
        <div class="code-block-wrapper" data-code="${encodeURIComponent(code)}">
          <button class="copy-code-btn" type="button">Copy</button>
          ${language ? `<div class="code-language">${language}</div>` : ""}
          <pre><code>${escapeHTML(code)}</code></pre>
        </div>
      `;
    }
  }

  return html;
}
  
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

    if (msg.role === "assistant" && msg.content !== "__TYPING__") {
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
        chat.messages.splice(idx, 1);
        chat.messages.push({ role: "assistant", content: "__TYPING__", time: formatDateTime() });

        saveChats();
        saveChatsToWorker();
        renderMessages();

        try {
          const cleanMessages = chat.messages
            .filter(m => m.content !== "__TYPING__")
            .slice(-10);

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

        chat.messages[chat.messages.length - 1] = {
            role: "assistant",
            content: answer,
            time: formatDateTime(),
            model: modelSelector.options[modelSelector.selectedIndex].text
          };
        } catch (e) {
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
      });

      reloadRow.appendChild(reloadBtn);
      wrapper.appendChild(reloadRow);
    }

    messagesEl.appendChild(wrapper);
  });

  messagesEl.querySelectorAll(".copy-code-btn").forEach(btn => {
    btn.addEventListener("click", async () => {
      const wrapper = btn.closest(".code-block-wrapper");
      const code = decodeURIComponent(wrapper.dataset.code);

      try {
        await navigator.clipboard.writeText(code);
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
      .slice(-10);

    console.log("About to send:", {
      provider: currentProvider,
      model: modelSelector.options[modelSelector.selectedIndex].text,
      messages: cleanMessages
    });

    const res = await fetch(`${WORKER_URL}/chat`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
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
      .slice(-10);

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
});

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

// Bottom sheet open/close
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

document.addEventListener("keydown", (e) => {
  if (e.key === "Escape" && paletteSheet.classList.contains("show")) {
    closePaletteSheet();
  }
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
