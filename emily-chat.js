/* Emily chat bubble (2026-11-12; decisions 232, 414, cus-0027). One self-contained file, no libraries.
 *
 *   <script src="emily-chat.js" data-url="https://<project>.supabase.co/functions/v1/emily-chat" data-org="two-hour-maids"
 *           data-book="#book" defer></script>
 *
 * It never opens by itself: a small "Questions? Chat with Emily" button waits to be tapped. Talks to the emily-chat function, which
 * is switched off until the owner turns it on (then the bubble says to text us instead). The conversation id lives in this browser
 * only (localStorage; a fresh one if storage is blocked). No cookies, no tracking, nothing sent until the visitor types.
 */
(function () {
  'use strict';
  var me = document.currentScript;
  var URL_ = (me && me.getAttribute('data-url')) || '';
  var ORG = (me && me.getAttribute('data-org')) || 'two-hour-maids';
  var BOOK = (me && me.getAttribute('data-book')) || '';
  if (!URL_ || window.__emilyChat) return;
  window.__emilyChat = true;

  var es = /^es\b/i.test(navigator.language || '');
  var T = es
    ? { open: 'Preguntas? Chatee con Emily', title: 'Emily, Two Hour Maids', hello: 'Hola, soy Emily de Two Hour Maids. En que le puedo ayudar?', ph: 'Escriba su pregunta', send: 'Enviar', book: 'Ver precios y horarios', phone: 'Su telefono para que una gerente le escriba', save: 'Enviar', close: 'Cerrar', err: 'No pude enviar eso. Intente otra vez o escribanos al (763) 227-9124.' }
    : { open: 'Questions? Chat with Emily', title: 'Emily, Two Hour Maids', hello: "Hi, I'm Emily from Two Hour Maids. What can I help you with?", ph: 'Type your question', send: 'Send', book: 'See prices and open times', phone: 'Your phone, so a manager can text you', save: 'Send', close: 'Close', err: "That didn't go through. Try again, or text us at (763) 227-9124." };

  function sid() {
    var k = 'emily_chat_session', v = '';
    try { v = localStorage.getItem(k) || ''; } catch (e) { /* storage blocked */ }
    if (!/^[A-Za-z0-9_-]{16,80}$/.test(v)) {
      var a = new Uint8Array(18); (window.crypto || window.msCrypto).getRandomValues(a);
      v = Array.prototype.map.call(a, function (b) { return ('0' + b.toString(16)).slice(-2); }).join('');
      try { localStorage.setItem(k, v); } catch (e) { /* fine */ }
    }
    return v;
  }
  var SESSION = sid();

  var css = '' +
    '.ec-btn{position:fixed;right:16px;bottom:16px;z-index:2147483000;background:#1F5EFF;color:#fff;border:0;border-radius:999px;padding:12px 18px;font:600 15px Inter,system-ui,sans-serif;box-shadow:0 6px 20px rgba(31,94,255,.35);cursor:pointer}' +
    '.ec-btn:focus-visible,.ec-x:focus-visible,.ec-send:focus-visible{outline:3px solid #9DB8FF;outline-offset:2px}' +
    '.ec-panel{position:fixed;right:16px;bottom:16px;z-index:2147483001;width:min(380px,calc(100vw - 32px));height:min(560px,calc(100vh - 32px));background:#fff;color:#111827;border-radius:16px;box-shadow:0 12px 40px rgba(17,24,39,.25);display:none;flex-direction:column;overflow:hidden;font:15px/1.4 Inter,system-ui,sans-serif}' +
    '.ec-panel.on{display:flex}' +
    '.ec-head{display:flex;align-items:center;justify-content:space-between;padding:12px 14px;background:#1F5EFF;color:#fff;font-weight:600}' +
    '.ec-x{background:transparent;border:0;color:#fff;font-size:22px;line-height:1;cursor:pointer;padding:4px 8px}' +
    '.ec-log{flex:1;overflow-y:auto;padding:12px;display:flex;flex-direction:column;gap:8px;background:#F5F7FB}' +
    '.ec-m{max-width:85%;padding:9px 12px;border-radius:14px;white-space:pre-wrap;word-wrap:break-word}' +
    '.ec-e{align-self:flex-start;background:#fff;border:1px solid #E5E7EB}' +
    '.ec-v{align-self:flex-end;background:#1F5EFF;color:#fff}' +
    '.ec-act{align-self:flex-start;background:#fff;border:1px solid #1F5EFF;color:#1F5EFF;border-radius:999px;padding:8px 14px;font:600 14px Inter,system-ui,sans-serif;cursor:pointer;text-decoration:none}' +
    '.ec-form{display:flex;gap:8px;padding:10px;border-top:1px solid #E5E7EB;background:#fff}' +
    '.ec-in{flex:1;min-width:0;border:1px solid #D1D5DB;border-radius:10px;padding:10px;font:16px Inter,system-ui,sans-serif}' +
    '.ec-send{background:#1F5EFF;color:#fff;border:0;border-radius:10px;padding:0 14px;font:600 15px Inter,system-ui,sans-serif;cursor:pointer}' +
    '.ec-send[disabled]{opacity:.5}' +
    '.ec-dots{align-self:flex-start;color:#6B7280;font-size:13px;padding:4px 6px}' +
    '@media (prefers-color-scheme:dark){.ec-panel{background:#111827;color:#F9FAFB}.ec-log{background:#0B1220}.ec-e{background:#1F2937;border-color:#374151;color:#F9FAFB}.ec-form{background:#111827;border-color:#374151}.ec-in{background:#1F2937;border-color:#374151;color:#F9FAFB}.ec-act{background:#1F2937}}';
  var st = document.createElement('style'); st.textContent = css; document.head.appendChild(st);

  var btn = el('button', 'ec-btn', T.open); btn.type = 'button'; btn.setAttribute('aria-haspopup', 'dialog');
  var panel = el('div', 'ec-panel'); panel.setAttribute('role', 'dialog'); panel.setAttribute('aria-label', T.title);
  var head = el('div', 'ec-head', T.title);
  var x = el('button', 'ec-x', '×'); x.type = 'button'; x.setAttribute('aria-label', T.close);
  head.appendChild(x);
  var log = el('div', 'ec-log'); log.setAttribute('aria-live', 'polite');
  var form = el('form', 'ec-form');
  var input = el('input', 'ec-in'); input.type = 'text'; input.maxLength = 1000; input.placeholder = T.ph; input.setAttribute('aria-label', T.ph); input.autocomplete = 'off';
  var send = el('button', 'ec-send', T.send); send.type = 'submit';
  form.appendChild(input); form.appendChild(send);
  panel.appendChild(head); panel.appendChild(log); panel.appendChild(form);
  document.body.appendChild(btn); document.body.appendChild(panel);

  var started = false, busy = false, askedContact = false;
  btn.addEventListener('click', function () {
    panel.classList.add('on'); btn.style.display = 'none';
    if (!started) { started = true; say(T.hello, 'ec-e'); }
    setTimeout(function () { input.focus(); }, 30);
  });
  x.addEventListener('click', function () { panel.classList.remove('on'); btn.style.display = ''; btn.focus(); });
  document.addEventListener('keydown', function (e) { if (e.key === 'Escape' && panel.classList.contains('on')) x.click(); });

  form.addEventListener('submit', function (e) {
    e.preventDefault();
    var text = input.value.trim();
    if (!text || busy) return;
    input.value = '';
    say(text, 'ec-v');
    post({ org_slug: ORG, session_id: SESSION, message: text, page: location.pathname.slice(0, 200) }, function (r) {
      say(r.reply || T.err, 'ec-e');
      if (r.booking_link && BOOK) bookButton();
      if (r.ask_contact && !askedContact) { askedContact = true; contactForm(); }
    });
  });

  function post(body, done) {
    busy = true; send.disabled = true;
    var dots = el('div', 'ec-dots', '...'); log.appendChild(dots); scroll();
    fetch(URL_, { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify(body) })
      .then(function (r) { return r.json(); })
      .then(function (r) { dots.remove(); done(r || {}); })
      .catch(function () { dots.remove(); say(T.err, 'ec-e'); })
      .then(function () { busy = false; send.disabled = false; input.focus(); });
  }
  function bookButton() {
    var a = el('a', 'ec-act', T.book); a.href = BOOK;
    a.addEventListener('click', function () { x.click(); });
    log.appendChild(a); scroll();
  }
  function contactForm() {
    var f = el('form', 'ec-form'); f.style.borderTop = '0'; f.style.padding = '0'; f.style.background = 'transparent';
    var p = el('input', 'ec-in'); p.type = 'tel'; p.autocomplete = 'tel'; p.placeholder = T.phone; p.setAttribute('aria-label', T.phone);
    var b = el('button', 'ec-send', T.save); b.type = 'submit';
    f.appendChild(p); f.appendChild(b); log.appendChild(f); scroll();
    f.addEventListener('submit', function (e) {
      e.preventDefault();
      if (p.value.replace(/\D/g, '').length < 10 || busy) { p.focus(); return; }
      post({ org_slug: ORG, session_id: SESSION, contact: { phone: p.value.trim() } }, function (r) { f.remove(); say(r.reply || T.err, 'ec-e'); });
    });
  }
  function say(text, cls) { log.appendChild(el('div', 'ec-m ' + cls, text)); scroll(); }
  function scroll() { log.scrollTop = log.scrollHeight; }
  function el(tag, cls, text) { var n = document.createElement(tag); if (cls) n.className = cls; if (text != null) n.textContent = text; return n; }
})();
