// public/js/messages.js

const threadsListEl = document.getElementById('threads-list');
const threadsCountEl = document.getElementById('threads-count');
const chatNameEl = document.getElementById('chat-name');
const chatInfoEl = document.getElementById('chat-info');
const chatHistoryEl = document.getElementById('chat-history');
const chatEmptyEl = document.getElementById('chat-empty');

const mockThreads = [
  {
    id: 'coro-santa-maria',
    name: 'Coro Santa Maria',
    preview: 'Prove il martedì, ci sei?',
    updatedAt: new Date('2025-12-18T07:51:00'),
    messages: [
      { id: 'm1', from: 'them', text: 'Ciao! Stiamo cercando tenori, ti interessa?', at: new Date('2025-12-18T07:35:00') },
      { id: 'm2', from: 'me', text: 'Ciao, sì! Che tipo di repertorio?', at: new Date('2025-12-18T07:40:00') },
      { id: 'm3', from: 'them', text: 'Polifonia rinascimentale + coro pop una volta al mese.', at: new Date('2025-12-18T07:46:00') },
      { id: 'm4', from: 'them', text: 'Prove il martedì, ci sei?', at: new Date('2025-12-18T07:51:00') }
    ]
  },
  {
    id: 'sara-costa',
    name: 'Sara Costa',
    preview: 'Perfetto, ci sentiamo dopo!',
    updatedAt: new Date('2025-12-18T07:48:00'),
    messages: [
      { id: 's1', from: 'me', text: 'Ciao Sara, disponibile per accompagnamento voce + piano?', at: new Date('2025-12-18T07:30:00') },
      { id: 's2', from: 'them', text: 'Ciao! Sì, repertorio pop e jazz.', at: new Date('2025-12-18T07:33:00') },
      { id: 's3', from: 'me', text: 'Ottimo. Sabato sera zona centro?', at: new Date('2025-12-18T07:40:00') },
      { id: 's4', from: 'them', text: 'Perfetto, ci sentiamo dopo!', at: new Date('2025-12-18T07:48:00') }
    ]
  },
  {
    id: 'banda-san-carlo',
    name: 'Banda San Carlo',
    preview: 'Ti mando la scaletta?',
    updatedAt: new Date('2025-12-18T08:07:00'),
    messages: [
      { id: 'b1', from: 'them', text: 'Ciao, abbiamo posto per tromba prima parte.', at: new Date('2025-12-18T07:15:00') },
      { id: 'b2', from: 'me', text: 'Ciao! Quale repertorio? Concerti estivi?', at: new Date('2025-12-18T07:25:00') },
      { id: 'b3', from: 'them', text: 'Brani a tema per sfilate + qualche concerto in piazza.', at: new Date('2025-12-18T08:07:00') },
      { id: 'b4', from: 'them', text: 'Ti mando la scaletta?', at: new Date('2025-12-18T08:07:30') }
    ]
  }
];

let activeThreadId = null;

function formatDateTime(ts) {
  if (!ts) return '';
  const d = ts instanceof Date ? ts : new Date(ts);
  return d.toLocaleString('it-IT', { day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit' });
}

function formatTime(ts) {
  if (!ts) return '';
  const d = ts instanceof Date ? ts : new Date(ts);
  return d.toLocaleTimeString('it-IT', { hour: '2-digit', minute: '2-digit' });
}

function renderThreads(threads) {
  if (!threadsListEl) return;
  threadsListEl.innerHTML = '';
  if (threadsCountEl) threadsCountEl.textContent = `${threads.length} chat`;
  threads.forEach((thread) => {
    const btn = document.createElement('button');
    btn.type = 'button';
    btn.className = 'thread-item';
    if (thread.id === activeThreadId) btn.classList.add('active');
    btn.addEventListener('click', () => {
      activeThreadId = thread.id;
      renderThreads(threads);
      renderChat(thread);
    });

    const name = document.createElement('p');
    name.className = 'thread-name';
    name.textContent = thread.name || 'Profilo';

    const preview = document.createElement('p');
    preview.className = 'thread-preview muted';
    preview.textContent = thread.preview || '';

    const meta = document.createElement('span');
    meta.className = 'thread-meta muted xsmall';
    meta.textContent = formatDateTime(thread.updatedAt);

    btn.appendChild(name);
    btn.appendChild(preview);
    btn.appendChild(meta);
    threadsListEl.appendChild(btn);
  });
}

function renderChat(thread) {
  if (!chatHistoryEl || !chatNameEl) return;
  chatNameEl.textContent = thread?.name || 'Chat';
  if (chatInfoEl) chatInfoEl.textContent = thread?.updatedAt ? `Ultimo messaggio: ${formatDateTime(thread.updatedAt)}` : '';
  chatHistoryEl.innerHTML = '';
  if (!thread || !Array.isArray(thread.messages) || thread.messages.length === 0) {
    const p = document.createElement('p');
    p.className = 'muted';
    p.textContent = 'Nessun messaggio in questa chat.';
    chatHistoryEl.appendChild(p);
    return;
  }
  thread.messages.forEach((msg) => {
    const row = document.createElement('div');
    row.className = `msg-row ${msg.from === 'me' ? 'outgoing' : 'incoming'}`;
    const bubble = document.createElement('div');
    bubble.className = `msg-bubble ${msg.from === 'me' ? 'msg-out' : 'msg-in'}`;
    const text = document.createElement('p');
    text.className = 'msg-text';
    text.textContent = msg.text;
    const time = document.createElement('span');
    time.className = 'msg-time';
    time.textContent = formatDateTime(msg.at);
    bubble.appendChild(text);
    bubble.appendChild(time);
    row.appendChild(bubble);
    chatHistoryEl.appendChild(row);
  });
  chatHistoryEl.scrollTop = chatHistoryEl.scrollHeight;
}

function initMessages() {
  if (!threadsListEl || !chatHistoryEl) return;
  if (mockThreads.length > 0) {
    activeThreadId = mockThreads[0].id;
    renderThreads(mockThreads);
    renderChat(mockThreads[0]);
  } else {
    renderThreads([]);
    renderChat(null);
  }
}

if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', initMessages, { once: true });
} else {
  initMessages();
}
