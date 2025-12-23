// public/js/messages.js
import { auth, db } from './firebase-config.js';
import {
  addDoc,
  collection,
  deleteDoc,
  doc,
  onSnapshot,
  orderBy,
  query,
  serverTimestamp,
  setDoc,
  updateDoc,
  where
} from 'https://www.gstatic.com/firebasejs/12.6.0/firebase-firestore.js';
import { onAuthStateChanged } from 'https://www.gstatic.com/firebasejs/12.6.0/firebase-auth.js';

const threadsListEl = document.getElementById('threads-list');
const threadsCountEl = document.getElementById('threads-count');
const chatNameEl = document.getElementById('chat-name');
const chatInfoEl = document.getElementById('chat-info');
const chatHistoryEl = document.getElementById('chat-history');
const chatEmptyEl = document.getElementById('chat-empty');
const chatInputEl = document.getElementById('chat-input-text');
const chatSendBtn = document.getElementById('chat-send-btn');

let activeThreadId = null;
let activeThreadData = null;
let threads = [];
let messages = [];
let openThreadMenuId = null;
let currentUserId = null;
let currentUserName = '';
let unsubThreads = null;
let unsubMessages = null;

function buildThreadId(uidA, uidB) {
  return [uidA, uidB].sort().join('__');
}

function formatDateTime(ts) {
  if (!ts) return '';
  const d = ts?.toDate ? ts.toDate() : new Date(ts);
  return d.toLocaleString('it-IT', { day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit' });
}

function renderThreads(list) {
  if (!threadsListEl) return;
  threadsListEl.innerHTML = '';
  if (threadsCountEl) threadsCountEl.textContent = `${list.length} chat`;
  list.forEach((thread) => {
    const otherId = thread.participants.find((p) => p !== currentUserId) || thread.participants[0] || '';
    const otherName =
      (thread.participantNames && thread.participantNames[otherId]) ||
      thread.otherName ||
      otherId ||
      'Profilo';

    const btn = document.createElement('button');
    btn.type = 'button';
    btn.className = 'thread-item';
    if (thread.id === activeThreadId) btn.classList.add('active');
    btn.addEventListener('click', () => {
      activeThreadId = thread.id;
      activeThreadData = thread;
      renderThreads(threads);
      subscribeMessages(thread.id, thread);
    });

    const header = document.createElement('div');
    header.className = 'thread-header';

    const name = document.createElement('p');
    name.className = 'thread-name';
    name.textContent = otherName;

    const menuWrapper = document.createElement('div');
    menuWrapper.className = 'thread-menu-wrapper';

    const menuBtn = document.createElement('button');
    menuBtn.type = 'button';
    menuBtn.className = 'thread-menu-btn';
    menuBtn.title = 'Azioni chat';
    menuBtn.textContent = '⋮';
    menuBtn.addEventListener('click', (e) => {
      e.stopPropagation();
      openThreadMenuId = openThreadMenuId === thread.id ? null : thread.id;
      renderThreads(threads);
    });

    const menu = document.createElement('div');
    menu.className = 'thread-menu';
    if (openThreadMenuId === thread.id) {
      menu.classList.add('open');
    }
    const deleteBtn = document.createElement('button');
    deleteBtn.type = 'button';
    deleteBtn.textContent = 'Cancella chat';
    deleteBtn.addEventListener('click', async (e) => {
      e.stopPropagation();
      const ok = window.confirm('Cancella chat?');
      if (!ok) return;
      openThreadMenuId = null;
      await deleteDoc(doc(db, 'threads', thread.id));
      renderThreads(threads);
    });
    menu.appendChild(deleteBtn);
    menuWrapper.appendChild(menuBtn);
    menuWrapper.appendChild(menu);

    header.appendChild(name);
    header.appendChild(menuWrapper);

    const preview = document.createElement('p');
    preview.className = 'thread-preview muted';
    preview.textContent = thread.lastMessage || '';

    const meta = document.createElement('span');
    meta.className = 'thread-meta muted xsmall';
    meta.textContent = thread.updatedAt ? formatDateTime(thread.updatedAt) : '';

    btn.appendChild(header);
    btn.appendChild(preview);
    btn.appendChild(meta);
    threadsListEl.appendChild(btn);
  });
}

function renderChat(thread) {
  if (!chatHistoryEl || !chatNameEl) return;
  if (!thread) {
    chatNameEl.textContent = 'Chat';
    if (chatInfoEl) chatInfoEl.textContent = '';
    chatHistoryEl.innerHTML = '';
    const p = document.createElement('p');
    p.className = 'muted';
    p.textContent = 'Nessun messaggio. Seleziona una chat.';
    chatHistoryEl.appendChild(p);
    return;
  }
  const otherId = thread.participants.find((p) => p !== currentUserId) || '';
  const otherName =
    (thread.participantNames && thread.participantNames[otherId]) ||
    thread.otherName ||
    otherId ||
    'Chat';
  chatNameEl.textContent = otherName;
  if (chatInfoEl) chatInfoEl.textContent = thread.updatedAt ? `Ultimo messaggio: ${formatDateTime(thread.updatedAt)}` : '';
  chatHistoryEl.innerHTML = '';
  if (!messages.length) {
    const p = document.createElement('p');
    p.className = 'muted';
    p.textContent = 'Nessun messaggio in questa chat.';
    chatHistoryEl.appendChild(p);
    return;
  }
  messages.forEach((msg) => {
    const row = document.createElement('div');
    row.className = `msg-row ${msg.fromUid === currentUserId ? 'outgoing' : 'incoming'}`;
    const bubble = document.createElement('div');
    bubble.className = `msg-bubble ${msg.fromUid === currentUserId ? 'msg-out' : 'msg-in'}`;
    const text = document.createElement('p');
    text.className = 'msg-text';
    text.textContent = msg.text;
    const time = document.createElement('span');
    time.className = 'msg-time';
    time.textContent = formatDateTime(msg.createdAt);
    bubble.appendChild(text);
    bubble.appendChild(time);
    row.appendChild(bubble);
    chatHistoryEl.appendChild(row);
  });
  chatHistoryEl.scrollTop = chatHistoryEl.scrollHeight;
}

function subscribeMessages(threadId, threadData) {
  if (unsubMessages) {
    unsubMessages();
    unsubMessages = null;
  }
  if (!threadId) {
    messages = [];
    renderChat(null);
    return;
  }
  const msgsCol = collection(db, 'threads', threadId, 'messages');
  const qMsgs = query(msgsCol, orderBy('createdAt', 'asc'));
  unsubMessages = onSnapshot(qMsgs, (snap) => {
    messages = snap.docs.map((d) => ({ id: d.id, ...d.data() }));
    activeThreadData = threadData;
    renderChat(threadData);
  });
}

async function sendMessage(text) {
  if (!currentUserId || !activeThreadData || !text) return;
  const trimmed = text.trim();
  if (!trimmed) return;
  const otherId = activeThreadData.participants.find((p) => p !== currentUserId);
  if (!otherId) return;
  const threadRef = doc(db, 'threads', activeThreadData.id);
  await addDoc(collection(threadRef, 'messages'), {
    text: trimmed,
    fromUid: currentUserId,
    createdAt: serverTimestamp()
  });
  await updateDoc(threadRef, {
    lastMessage: trimmed,
    updatedAt: serverTimestamp(),
    lastSenderUid: currentUserId
  });
}

function subscribeThreads(userId) {
  if (unsubThreads) {
    unsubThreads();
    unsubThreads = null;
  }
  if (!userId) return;
  const qThreads = query(collection(db, 'threads'), where('participants', 'array-contains', userId));
  unsubThreads = onSnapshot(qThreads, (snap) => {
    threads = snap.docs.map((d) => ({ id: d.id, ...d.data() })).filter((t) => Array.isArray(t.participants));
    threads.sort((a, b) => (b.updatedAt?.toMillis?.() || 0) - (a.updatedAt?.toMillis?.() || 0));
    if (!activeThreadId || !threads.find((t) => t.id === activeThreadId)) {
      activeThreadId = threads.length ? threads[0].id : null;
      activeThreadData = threads.length ? threads[0] : null;
      if (activeThreadId) subscribeMessages(activeThreadId, activeThreadData);
      else subscribeMessages(null, null);
    }
    renderThreads(threads);
    if (activeThreadId) {
      const t = threads.find((x) => x.id === activeThreadId);
      if (t) renderChat(t);
    } else {
      renderChat(null);
    }
  });
}

function initMessages() {
  if (!threadsListEl || !chatHistoryEl) return;
  onAuthStateChanged(auth, (user) => {
    currentUserId = user?.uid || null;
    currentUserName = user?.displayName || user?.email || '';
    if (!currentUserId) {
      threads = [];
      messages = [];
      renderThreads(threads);
      renderChat(null);
      return;
    }
    subscribeThreads(currentUserId);
  });

  const handlerSend = () => {
    if (!chatInputEl) return;
    const text = chatInputEl.value;
    sendMessage(text);
    chatInputEl.value = '';
    chatInputEl.focus();
  };
  if (chatSendBtn) chatSendBtn.addEventListener('click', handlerSend);
  if (chatInputEl) {
    chatInputEl.addEventListener('keydown', (e) => {
      if (e.key === 'Enter' && !e.shiftKey) {
        e.preventDefault();
        handlerSend();
      }
    });
  }

  document.addEventListener('click', () => {
    if (openThreadMenuId) {
      openThreadMenuId = null;
      renderThreads(threads);
    }
  });
}

if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', initMessages, { once: true });
} else {
  initMessages();
}
