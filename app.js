const WORKER_URL = "https://gptapi-proxy.barney-willis2.workers.dev";


const SYNC_URL = WORKER_URL; // for clarity


const SYNC_URL = WORKER_URL;

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



@@ -21,60 +13,24 @@ const sidebarEl = document.querySelector('.sidebar');

const toggleSidebarBtn = document.getElementById('toggleSidebarBtn');

const toggleThemeBtn = document.getElementById('toggleThemeBtn');




async function saveChats() {


function saveChats() {

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


    localStorage.setItem('secure_chat_index', String(currentIndex));


  } catch(e){}

}




async function loadChats() {


function loadChats() {

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


      chats = JSON.parse(raw);


      currentIndex = idx !== null ? Number(idx) : (chats.length ? 0 : null);

    }


  } catch (e) {


    console.warn("Load from Worker failed:", e);


    chats = [];


    currentIndex = null;


  } catch(e){ chats = []; currentIndex = null; }


  if (chats.length === 0) {


    createNewChat();

  }

}



@@ -89,20 +45,12 @@ function createNewChat() {

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


  if (chats.length === 0) { createNewChat(); return; }

  if (currentIndex === i) currentIndex = Math.max(0, i - 1);

  else if (currentIndex > i) currentIndex--;

  saveChats();

@@ -136,22 +84,23 @@ function renderChatList() {

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


      setTimeout(() => inputEl.focus(), 10);

    });



    chatListEl.appendChild(item);

@@ -173,6 +122,7 @@ function renderMessages() {



    const time = document.createElement('div');

    time.className = 'msg-time';




    if (!msg.timestamp) {

      msg.timestamp = new Date().toLocaleTimeString([], {hour:'2-digit', minute:'2-digit'});

    }

@@ -203,14 +153,17 @@ async function sendMessage() {



  renderMessages();

  inputEl.value = '';


  await saveChats();


  saveChats();



  try {

    const recentMessages = chat.messages.slice(-10);

    const res = await fetch(WORKER_URL, {

      method: 'POST',

      headers: { 'Content-Type': 'application/json' },


      body: JSON.stringify({ model: MODEL, messages: recentMessages })


      body: JSON.stringify({


        model: MODEL,


        messages: recentMessages


      }),

    });



    const data = await res.json();

@@ -224,12 +177,17 @@ async function sendMessage() {

    chat.messages[chat.messages.length - 1] = { role: 'assistant', content: "Error: " + (e.message || e), timestamp: thinkingMessage.timestamp };

  }




  await saveChats();


  saveChats();

  renderMessages();

}




document.getElementById('newChatBtn').addEventListener('click', () => createNewChat());


document.getElementById('sendBtn').addEventListener('click', () => sendMessage());


document.getElementById('newChatBtn').addEventListener('click', () => {


  createNewChat();


});





document.getElementById('sendBtn').addEventListener('click', () => {


  sendMessage();


});



inputEl.addEventListener('keydown', (e) => {

  if (e.key === 'Enter' && !e.shiftKey) {

@@ -240,17 +198,27 @@ inputEl.addEventListener('keydown', (e) => {



toggleSidebarBtn.addEventListener('click', () => {

  const isHidden = sidebarEl.style.display === 'none';


  sidebarEl.style.display = isHidden ? 'flex' : 'none';


  toggleSidebarBtn.textContent = isHidden ? 'Hide' : 'Show';


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


  toggleThemeBtn.textContent = document.body.classList.contains('dark-mode') ? 'Light' : 'Dark';


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
