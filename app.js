const WORKER_URL = "https://gptapi-proxy.barney-willis2.workers.dev";
const SYNC_URL = WORKER_URL;
const MODEL = "gpt-5-mini";

let chats = [];
let currentIndex = null;

const chatListEl = document.getElementById('chatList');
const messagesEl = document.getElementById('messages');
const headerEl = document.getElementById('chatHeader').querySelector('span');
const inputEl = document.getElementById('input');
const sidebarEl = document.querySelector('.sidebar');
const toggleSidebarBtn = document.getElementById('toggleSidebarBtn');
const toggleThemeBtn = document.getElementById('toggleThemeBtn');

function saveChats() {
  try {
    localStorage.setItem('secure_chat_chats', JSON.stringify(chats));
    localStorage.setItem('secure_chat_index', String(currentIndex));
  } catch(e){}
}

function loadChats() {
  try {
    const raw = localStorage.getItem('secure_chat_chats');
    const idx = localStorage.getItem('secure_chat_index');
    if (raw) {
      chats = JSON.parse(raw);
      currentIndex = idx !== null ? Number(idx) : (chats.length ? 0 : null);
    }
  } catch(e){ chats = []; currentIndex = null; }
  if (chats.length === 0) {
    createNewChat();
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
}

function deleteChatAt(i) {
  if (i < 0 || i >= chats.length) return;
  chats.splice(i, 1);
  if (chats.length === 0) { createNewChat(); return; }
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

    if (chat.title !== 'New Chat') {
      const delBtn = document.createElement('button');
      delBtn.className = 'delete-btn';
      delBtn.setAttribute('aria-label', 'Delete chat');
      delBtn.textContent = '×';
      delBtn.addEventListener('click', (ev) => {
        ev.stopPropagation();
        if (!confirm('Delete this chat?')) return;
        deleteChatAt(i);
      });
      item.appendChild(delBtn);
    }

    item.addEventListener('click', () => {
      currentIndex = i;
      renderChatList();
      renderMessages();
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
  saveChats();

  try {
    const recentMessages = chat.messages.slice(-10);
    const res = await fetch(WORKER_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        model: MODEL,
        messages: recentMessages
      }),
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

  saveChats();
  renderMessages();
}

document.getElementById('newChatBtn').addEventListener('click', () => {
  createNewChat();
});

document.getElementById('sendBtn').addEventListener('click', () => {
  sendMessage();
});

inputEl.addEventListener('keydown', (e) => {
  if (e.key === 'Enter' && !e.shiftKey) {
    e.preventDefault();
    sendMessage();
  }
});

toggleSidebarBtn.addEventListener('click', () => {
  const isHidden = sidebarEl.style.display === 'none';
  if (isHidden) {
    sidebarEl.style.display = 'flex';
    toggleSidebarBtn.textContent = 'Hide';
  } else {
    sidebarEl.style.display = 'none';
    toggleSidebarBtn.textContent = 'Show';
  }
});

toggleThemeBtn.addEventListener('click', () => {
  document.body.classList.toggle('dark-mode');
  if (document.body.classList.contains('dark-mode')) {
    toggleThemeBtn.textContent = 'Light';
  } else {
    toggleThemeBtn.textContent = 'Dark';
  }
});

(async () => {
  await loadChats();
  renderChatList();
  renderMessages();
})();
