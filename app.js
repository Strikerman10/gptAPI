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
  const paletteSelector = document.getElementById("paletteSelector");
  const themeToggleBtn = document.getElementById("toggleThemeBtn"); // 🌙/☀️ toggle
  const sidebarEl = document.querySelector(".sidebar");
  const toggleSidebarBtn = document.getElementById("toggleSidebarBtn");
  const paletteBtn = document.getElementById("themeBtn"); // 🎨 palette button

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
    Blue: { … }, // unchanged palettes shortened for brevity
    Amber: { … },
    Purple: { … },
    Red: { … },
    Teal: { … },
    Gray: { … },
    Amoled: { … }
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

  function applyTheme() { … } // unchanged

  // ==========================
  // UTILITIES
  // ==========================
  function saveChats() { … }
  function loadChats() { … }
  function formatTime(date = new Date()) {
    return date.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
  }

  // ==========================
  // WORKER INTEGRATION
  // ==========================
  async function loadChatsFromWorker() { … }
  async function saveChatsToWorker() { … }

  // ==========================
  // CHAT FUNCTIONS
  // ==========================
  function createNewChat() { … }
  function deleteChat(index) { … }
  function renderChatList() { … }

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

      // 🔹 Typing indicator support
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

    // Push user msg
    const userMessage = { role: "user", content: text, time: formatTime() };
    chat.messages.push(userMessage);

    // Set title
    if (chat.title === "New Chat" || !chat.title) {
      const firstLine = text.split(/\r?\n/)[0];
      chat.title = firstLine.length > 40 ? firstLine.slice(0, 40) + "…" : firstLine;
    }

    // Add placeholder assistant "__TYPING__"
    chat.messages.push({
      role: "assistant",
      content: "__TYPING__",
      time: formatTime()
    });

    renderMessages();
    inputEl.value = "";
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
      chat.messages[chat.messages.length - 1] = {
        role: "assistant",
        content: answer,
        time: formatTime()
      };
    } catch (e) {
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

  // Theme / palette / sidebar toggles ...
  // (left intact, omitted here to keep it short)

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
