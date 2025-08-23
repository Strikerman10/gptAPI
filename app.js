// 🌐 Worker API base URL
const API_BASE = "https://your-worker-subdomain.workers.dev"; // ⬅️ replace with your Worker URL

// --- State ---
let chats = [];
let currentChat = null;

// --- DOM ---
const messagesDiv = document.getElementById("messages");
const input = document.getElementById("input");
const sendBtn = document.getElementById("sendBtn");
const newChatBtn = document.getElementById("newChatBtn");
const chatListDiv = document.getElementById("chatList");
const chatHeader = document.getElementById("chatHeader");
const toggleSidebarBtn = document.getElementById("toggleSidebarBtn");
const sidebar = document.querySelector(".sidebar");

// --- API helpers ---
async function sendMessage(model, messages) {
  const res = await fetch(`${API_BASE}/chat`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ model, messages })
  });

  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(err.error || "Failed to reach GPT");
  }
  return res.json();
}

async function saveChats(chats) {
  const res = await fetch(`${API_BASE}/save`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ chats })
  });
  if (!res.ok) throw new Error("Failed to save chats");
  return res.json();
}

async function loadChats() {
  const res = await fetch(`${API_BASE}/load`, {
    method: "GET",
    headers: { "Content-Type": "application/json" }
  });
  if (!res.ok) throw new Error("Failed to load chats");
  return res.json();
}

// --- UI helpers ---
function renderMessages(chat) {
  messagesDiv.innerHTML = "";
  chat.messages.forEach(msg => {
    const div = document.createElement("div");
    div.className = `message ${msg.role}`;
    div.textContent = msg.content;
    messagesDiv.appendChild(div);
  });
  messagesDiv.scrollTop = messagesDiv.scrollHeight;
}

function renderChatList() {
  chatListDiv.innerHTML = "";
  chats.forEach((chat, idx) => {
    const btn = document.createElement("button");
    btn.textContent = chat.title || `Chat ${idx + 1}`;
    btn.className = "chat-list-item";
    btn.onclick = () => {
      currentChat = chat;
      renderMessages(chat);
    };
    chatListDiv.appendChild(btn);
  });
}

function newChat() {
  const chat = { title: "New Chat", messages: [] };
  chats.push(chat);
  currentChat = chat;
  renderChatList();
  renderMessages(chat);
}

// --- Event listeners ---
sendBtn.addEventListener("click", async () => {
  const text = input.value.trim();
  if (!text || !currentChat) return;

  currentChat.messages.push({ role: "user", content: text });
  renderMessages(currentChat);
  input.value = "";

  try {
    const response = await sendMessage("gpt-4o-mini", currentChat.messages);
    const reply = response.choices[0].message.content;
    currentChat.messages.push({ role: "assistant", content: reply });
    renderMessages(currentChat);
    await saveChats(chats);
  } catch (err) {
    alert("Error: " + err.message);
  }
});

newChatBtn.addEventListener("click", () => {
  newChat();
  saveChats(chats);
});

toggleSidebarBtn.addEventListener("click", () => {
  sidebar.style.display = sidebar.style.display === "none" ? "block" : "none";
  toggleSidebarBtn.textContent = sidebar.style.display === "none" ? "Show" : "Hide";
});

// --- Init ---
(async () => {
  try {
    chats = await loadChats();
  } catch {
    chats = [];
  }
  if (chats.length === 0) {
    newChat();
  } else {
    currentChat = chats[chats.length - 1];
    renderChatList();
    renderMessages(currentChat);
  }
})();
