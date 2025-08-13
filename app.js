const WORKER_URL = "https://gptapi-proxy.barney-willis2.workers.dev";
const SYNC_URL = WORKER_URL; // for clarity
const MODEL = "gpt-5-mini";

// Generate a stable anonymous ID for sync
const USER_ID_KEY = "secure_chat_user_id";
let userId = localStorage.getItem(USER_ID_KEY);
if (!userId) {
  userId = "anon_" + Math.random().toString(36).slice(2);
  localStorage.setItem(USER_ID_KEY, userId);
}

let chats = [];
let currentIndex = null;

const chatListEl = document.getElementById('chatList');
const messagesEl = document.getElementById('messages');
const headerEl = document.getElementById('chatHeader').querySelector('span');
const inputEl = document.getElementById('input');
const sidebarEl = document.querySelector('.sidebar');
const toggleSidebarBtn = document.getElementById('toggleSidebarBtn');
const toggleThemeBtn = document.getElementById('toggleThemeBtn');

async function saveChats() {
  try {
    // Save locally
    localStorage.setItem('secure_chat_chats', JSON.stringify(chats));
    if (currentIndex === null) {
      localStorage.removeItem('secure_chat_index');
    } else {
      localStorage.setItem('secure_chat_index', String(currentIndex));
    }

    // Save to Worker
    await fetch(`${SYNC_URL}/save`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ userId, chats })
    });
  } catch (e) {
    console.warn("Save to Worker failed:", e);
  }
}

async function loadChats() {
  try {
    // Load from Worker
    const res = await fetch(`${SYNC_URL}/load?userId=${encodeURIComponent(userId)}`);
    if (res.ok) {
      chats = await res.json();
    } else {
      chats = [];
    }

    // Also load local fallback (in case offline)
    const raw = localStorage.getItem('secure_chat_chats');
    const idx = localStorage.getItem('secure_chat_index');
    if (raw) {
      const localChats = JSON.parse(raw);
      // Merge local chats if Worker has none
      if (chats.length === 0) chats = localChats;
    }

    if (idx !== null) {
      const n = Number(idx);
      currentIndex = Number.isFinite(n) ? n : (chats.length ? 0 : null);
    } else {
      currentIndex = chats.length ? 0 : null;
    }

    if (currentIndex !== null && (currentIndex < 0 || currentIndex >= chats.length)) {
      currentIndex = chats.length ? 0 : null;
    }
  } catch (e) {
    console.warn("Load from Worker failed:", e);
    chats = [];
    currentIndex = null;
  }
}

function createNewChat() {
  const newChat = {
    id: Date.now().toString(),
    title: "New Chat",
    messages: [{ role: 'system', content: 'You are a helpful assistant.' }]
  };
  chats.unshift(newChat);
  currentIndex = 0;
  saveChats();
  renderChatList();
  renderMessages();
  chatListEl.scrollTop = 0;
  setTimeout(() => inputEl.focus(), 10);
}

function deleteChatAt(i) {
  if (i < 0 || i >= chats.length) return;
  chats.splice(i, 1);
  if (chats.length === 0) {
    currentIndex = null;
    saveChats();
    renderChatList();
    renderMessages();
    return;
  }
  if (currentIndex === i) currentIndex = Math.max(0, i - 1);
  else if (currentIndex > i) currentIndex--;
  saveChats();
  renderChatList();
  renderMessages();
}

function renderChatList() {
  chatListEl.innerHTML = '';
  chats.forEach((chat, i) => {
    const item = document.createElement('div');
    item.className = 'chat-item';
    if (i === currentIndex) item.classList.add('selected');

    const preview = document.createElement('div');
    preview.className = 'chat-preview';

    const firstUser = chat.messages.find(m => m.role === 'user');
    const userText = firstUser ? firstUser.content : chat.title || 'New Chat';
    const titleDiv = document.createElement('div');
    titleDiv.className = 'chat-title';
    titleDiv.textContent = userText;

    const lastAssistant = [...chat.messages].reverse().find(m => m.role === 'assistant');
    const assistantText = lastAssistant ? lastAssistant.content : '';
    const subDiv = document.createElement('div');
    subDiv.className = 'chat-subtitle';
    subDiv.textContent = assistantText;

    preview.appendChild(titleDiv);
    preview.appendChild(subDiv);
    item.appendChild(preview);

    const delBtn = document.createElement('button');
    delBtn.className = 'delete-btn';
    delBtn.setAttribute('aria-label', `Delete chat "${userText}"`);
    delBtn.innerHTML = '<svg viewBox="0 0 24 24" width="14" height="14"><path d="M6 6L18 18M6 18L18 6" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/></svg>';
    delBtn.addEventListener('click', (ev) => {
      ev.stopPropagation();
      if (!confirm('Delete this chat?')) return;
      deleteChatAt(i);
    });
    item.appendChild(delBtn);

    item.addEventListener('click', () => {
      currentIndex = i;
      renderChatList();
      renderMessages();
      setTimeout(() => inputEl.focus(), 10);
    });

    chatListEl.appendChild(item);
  });
}

function renderMessages() {
  messagesEl.innerHTML = '';
  if (currentIndex === null || !chats[currentIndex]) {
    headerEl.textContent = "Barney's ChatGPT";
    return;
  }
  const chat = chats[currentIndex];
  headerEl.textContent = "Barney's ChatGPT";
  chat.messages.slice(1).forEach(msg => {
    const mdiv = document.createElement('div');
    mdiv.className = 'message ' + (msg.role === 'user' ? 'user' : 'assistant');
    mdiv.textContent = msg.content;

    const time = document.createElement('div');
    time.className = 'msg-time';
    if (!msg.timestamp) {
      msg.timestamp = new Date().toLocaleTimeString([], {hour:'2-digit', minute:'2-digit'});
    }
    time.textContent = msg.timestamp;

    const wrapper = document.createElement('div');
    wrapper.appendChild(mdiv);
    wrapper.appendChild(time);
    messagesEl.appendChild(wrapper);
  });
  messagesEl.scrollTop = messagesEl.scrollHeight;
}

async function sendMessage() {
  const text = inputEl.value.trim();
  if (!text) return;
  if (currentIndex === null) createNewChat();
  const chat = chats[currentIndex];

  chat.messages.push({ role: 'user', content: text, timestamp: new Date().toLocaleTimeString([], {hour:'2-digit', minute:'2-digit'}) });

  if (chat.title === 'New Chat') {
    chat.title = text.length > 30 ? text.slice(0,30) + '…' : text;
  }

  const thinkingMessage = { role: 'assistant', content: 'Thinking...', timestamp: new Date().toLocaleTimeString([], {hour:'2-digit', minute:'2-digit'}) };
  chat.messages.push(thinkingMessage);

  renderMessages();
  inputEl.value = '';
  await saveChats();

  try {
    const recentMessages = chat.messages.slice(-10);
    const res = await fetch(WORKER_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ model: MODEL, messages: recentMessages })
    });

    const data = await res.json();
    if (data && data.choices && data.choices[0]) {
      const answer = data.choices[0].message.content;
      chat.messages[chat.messages.length - 1] = { role: 'assistant', content: answer, timestamp: thinkingMessage.timestamp };
    } else {
      chat.messages[chat.messages.length - 1] = { role: 'assistant', content: "Error: No response from AI.", timestamp: thinkingMessage.timestamp };
    }
  } catch (e) {
    chat.messages[chat.messages.length - 1] = { role: 'assistant', content: "Error: " + (e.message || e), timestamp: thinkingMessage.timestamp };
  }

  await saveChats();
  renderMessages();
}

document.getElementById('newChatBtn').addEventListener('click', () => createNewChat());
document.getElementById('sendBtn').addEventListener('click', () => sendMessage());

inputEl.addEventListener('keydown', (e) => {
  if (e.key === 'Enter' && !e.shiftKey) {
    e.preventDefault();
    sendMessage();
  }
});

toggleSidebarBtn.addEventListener('click', () => {
  const isHidden = sidebarEl.style.display === 'none';
  sidebarEl.style.display = isHidden ? 'flex' : 'none';
  toggleSidebarBtn.textContent = isHidden ? 'Hide' : 'Show';
});

toggleThemeBtn.addEventListener('click', () => {
  document.body.classList.toggle('dark-mode');
  toggleThemeBtn.textContent = document.body.classList.contains('dark-mode') ? 'Light' : 'Dark';
});

(async () => {
  await loadChats();
  renderChatList();
  renderMessages();
})();
