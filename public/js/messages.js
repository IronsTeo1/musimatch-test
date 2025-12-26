// public/js/messages.js
import { auth, db } from './firebase-config.js';
import {
  addDoc,
  collection,
  deleteDoc,
  doc,
  getDocs,
  onSnapshot,
  orderBy,
  query,
  serverTimestamp,
  setDoc,
  startAfter,
  updateDoc,
  limit,
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
const chatBackBtn = document.getElementById('chat-back-btn');
const messagesLayoutEl = document.querySelector('.messages-layout');

let activeThreadId = null;
let activeThreadData = null;
let threads = [];
let messages = [];
let openThreadMenuId = null;
let currentUserId = null;
let currentUserName = '';
let unsubThreads = null;
let unsubMessages = null;
let isMobile = window.matchMedia('(max-width: 900px)').matches;
let mobileView = 'list';
let oldestMsgDoc = null;
let messagesDone = false;
let loadingOlder = false;
const MSG_PAGE_SIZE = 30;
const profileIdCache = new Map();

function buildThreadId(uidA, uidB) {
  return [uidA, uidB].sort().join('__');
}

function formatDateTime(ts) {
  if (!ts) return '';
  const d = ts?.toDate ? ts.toDate() : new Date(ts);
  return d.toLocaleString('it-IT', { day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit' });
}

async function resolveProfileId(authUid) {
  if (!authUid) return null;
  if (profileIdCache.has(authUid)) return profileIdCache.get(authUid);
  try {
    const snap = await getDocs(query(collection(db, 'users'), where('authUid', '==', authUid), limit(1)));
    if (snap.empty) {
      profileIdCache.set(authUid, null);
      return null;
    }
    const docSnap = snap.docs[0];
    profileIdCache.set(authUid, docSnap.id);
    return docSnap.id;
  } catch (err) {
    console.error('[MusiMatch] Errore lettura profilo per authUid:', err);
    profileIdCache.set(authUid, null);
    return null;
  }
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
      if (isMobile) setMobileView('chat');
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
    const isOpen = openThreadMenuId === thread.id;
    menu.classList.toggle('open', isOpen);
    menu.hidden = !isOpen;
    const visitBtn = document.createElement('button');
    visitBtn.type = 'button';
    visitBtn.textContent = 'Visita profilo';
    visitBtn.addEventListener('click', async (e) => {
      e.stopPropagation();
      const pid = await resolveProfileId(otherId);
      if (pid) window.location.href = `profile.html?id=${pid}`;
    });
    const deleteBtn = document.createElement('button');
    deleteBtn.type = 'button';
    deleteBtn.textContent = 'Cancella chat';
    deleteBtn.addEventListener('click', async (e) => {
      e.stopPropagation();
      const ok = window.confirm('Vuoi cancellare questa chat?');
      if (!ok) return;
      openThreadMenuId = null;
      await deleteDoc(doc(db, 'threads', thread.id));
      renderThreads(threads);
    });
    menu.appendChild(visitBtn);
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
    chatNameEl.removeAttribute('data-auth-id');
    chatNameEl.classList.remove('chat-name-link');
    chatNameEl.onclick = null;
    if (chatInfoEl) chatInfoEl.textContent = '';
    chatHistoryEl.innerHTML = '';
    const p = document.createElement('p');
    p.className = 'muted';
    p.textContent = 'Clicca su una chat per visualizzarne i messaggi.';
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
  chatNameEl.dataset.authId = otherId || '';
  chatNameEl.classList.add('chat-name-link');
  chatNameEl.title = 'Visita profilo';
  chatNameEl.onclick = async () => {
    if (!chatNameEl.dataset.authId) return;
    const pid = await resolveProfileId(chatNameEl.dataset.authId);
    if (pid) window.location.href = `profile.html?id=${pid}`;
  };
  if (chatInfoEl) chatInfoEl.textContent = thread.updatedAt ? `Ultimo messaggio: ${formatDateTime(thread.updatedAt)}` : '';
  chatHistoryEl.innerHTML = '';
  if (!messages.length) {
    const p = document.createElement('p');
    p.className = 'muted';
    p.textContent = thread ? 'Nessun messaggio in questa chat.' : 'Clicca su una chat per visualizzarne i messaggi.';
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

function setMobileView(view = 'list') {
  mobileView = view;
  if (!messagesLayoutEl) return;
  const listMode = isMobile && view === 'list';
  const chatMode = isMobile && view === 'chat';
  messagesLayoutEl.classList.toggle('mobile-list', listMode);
  messagesLayoutEl.classList.toggle('mobile-chat', chatMode);
  if (chatBackBtn) {
    chatBackBtn.style.display = chatMode ? 'inline-flex' : 'none';
  }
}

function subscribeMessages(threadId, threadData) {
  if (unsubMessages) {
    unsubMessages();
    unsubMessages = null;
  }
  oldestMsgDoc = null;
  messagesDone = false;
  loadingOlder = false;
  if (!threadId) {
    messages = [];
    renderChat(null);
    return;
  }
  const msgsCol = collection(db, 'threads', threadId, 'messages');
  const qMsgs = query(msgsCol, orderBy('createdAt', 'desc'), limit(MSG_PAGE_SIZE));
  unsubMessages = onSnapshot(qMsgs, (snap) => {
    const batch = snap.docs.map((d) => ({ id: d.id, ...d.data() }));
    if (snap.docs.length) {
      oldestMsgDoc = snap.docs[snap.docs.length - 1];
    }
    if (snap.docs.length < MSG_PAGE_SIZE) messagesDone = true;
    messages = mergeMessages([], batch);
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

function mergeMessages(existing = [], incoming = []) {
  const map = new Map();
  existing.forEach((m) => {
    if (m?.id) map.set(m.id, m);
  });
  incoming.forEach((m) => {
    if (m?.id) map.set(m.id, m);
  });
  const result = Array.from(map.values());
  result.sort((a, b) => {
    const ta = a.createdAt?.toMillis ? a.createdAt.toMillis() : new Date(a.createdAt || 0).getTime();
    const tb = b.createdAt?.toMillis ? b.createdAt.toMillis() : new Date(b.createdAt || 0).getTime();
    return ta - tb;
  });
  return result;
}

async function loadOlderMessages() {
  if (!activeThreadId || messagesDone || loadingOlder || !oldestMsgDoc) return;
  loadingOlder = true;
  try {
    const msgsCol = collection(db, 'threads', activeThreadId, 'messages');
    const snap = await getDocs(query(msgsCol, orderBy('createdAt', 'desc'), startAfter(oldestMsgDoc), limit(MSG_PAGE_SIZE)));
    if (snap.empty) {
      messagesDone = true;
      return;
    }
    const older = snap.docs.map((d) => ({ id: d.id, ...d.data() }));
    oldestMsgDoc = snap.docs[snap.docs.length - 1];
    if (snap.docs.length < MSG_PAGE_SIZE) messagesDone = true;
    messages = mergeMessages(messages, older);
    renderChat(activeThreadData);
  } catch (err) {
    console.error('[MusiMatch] Errore caricamento messaggi precedenti:', err);
  } finally {
    loadingOlder = false;
  }
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
    const currentStillExists = activeThreadId && threads.find((t) => t.id === activeThreadId);
    if (!currentStillExists) {
      activeThreadId = null;
      activeThreadData = null;
      subscribeMessages(null, null);
    }
    renderThreads(threads);
    if (activeThreadId) {
      const t = threads.find((x) => x.id === activeThreadId);
      if (t) renderChat(t);
    } else {
      renderChat(null);
    }
    // Prefetch profile ids per partecipante remoto per evitare attese al click
    threads.forEach((t) => {
      const otherId = t.participants.find((p) => p !== currentUserId);
      if (otherId) resolveProfileId(otherId);
    });
    if (isMobile && mobileView === 'list') setMobileView('list');
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
  // Desktop: nessuna chat aperta di default
  activeThreadId = null;
  activeThreadData = null;

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
    chatInputEl.addEventListener('input', () => {
      chatInputEl.style.height = 'auto';
      chatInputEl.style.height = `${Math.min(chatInputEl.scrollHeight, 180)}px`;
    });
  }
  if (chatHistoryEl) {
    chatHistoryEl.addEventListener('scroll', () => {
      if (chatHistoryEl.scrollTop <= 20) {
        loadOlderMessages();
      }
    });
  }

  if (chatBackBtn) {
    chatBackBtn.addEventListener('click', () => {
      setMobileView('list');
    });
  }

  const handleResize = () => {
    isMobile = window.matchMedia('(max-width: 900px)').matches;
    if (!isMobile) {
      if (messagesLayoutEl) messagesLayoutEl.classList.remove('mobile-list', 'mobile-chat');
      if (chatBackBtn) chatBackBtn.style.display = 'none';
    } else {
      setMobileView(mobileView || 'list');
    }
  };
  window.addEventListener('resize', handleResize);
  handleResize();

  document.addEventListener('click', () => {
    if (openThreadMenuId) {
      openThreadMenuId = null;
      renderThreads(threads);
    }
  });
  document.addEventListener('pointerdown', (e) => {
    if (e.target.closest('.thread-menu-wrapper')) return;
    if (openThreadMenuId) {
      openThreadMenuId = null;
      renderThreads(threads);
    }
  }, { capture: true });
}

if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', initMessages, { once: true });
} else {
  initMessages();
}
