/*
  Meta Pixel for the public customer pages (UNBUILT-SPEC D2; PAID-ADS.md). One file, one setting.
    <script src="pixel.js" defer></script>                          uses PIXEL_ID below
    <script src="pixel.js" data-pixel-id="1234567890" defer></script>  or an ID on the tag (or window.THM_CONFIG.META_PIXEL_ID)
  - OFF while the ID is empty: nothing loads, nothing is shown.
  - Consent: a small notice with "No thanks" shows once; "No thanks", or a Global Privacy Control signal from the browser, stops the
    pixel on this browser. It shares its opt-out with the booking page (booking-widget.html), so one "No thanks" covers both.
    Set MODE = 'ask' to load nothing until the visitor taps OK (stricter; fewer ad numbers).
  - Never loads on an address that carries a token, code or personal detail: only utm_*, fbclid, gclid, org and theme are allowed in
    the query, so a private link (reports, accounts, reviews) can never reach Meta. Do not add this file to those pages anyway.
  - Sends PageView, plus standard events a page asks for with window.thmPixel.track('Lead'). Names, phones, emails and addresses are
    never sent (only value, currency and content_name pass), and automatic events / advanced matching are switched off here
    (also leave "Automatic advanced matching" off in Meta Events Manager).
*/
(function () {
  var PIXEL_ID = ''; // paste the Meta Pixel ID (digits) from Events Manager; empty = off
  var MODE = 'notice'; // 'notice' = load and show the notice with "No thanks" (Jack, 2026-10-21); 'ask' = load only after "OK"
  var OPT_KEY = 'thm_ads_optout', SEEN_KEY = 'thm_ads_notice', OK_KEY = 'thm_ads_ok';
  var ALLOWED = /^(utm_(source|medium|campaign|content|term|id)|fbclid|gclid|org|theme)$/;
  var EVENTS = { PageView: 1, ViewContent: 1, Lead: 1, Contact: 1, Schedule: 1, CompleteRegistration: 1, Purchase: 1, FindLocation: 1 };
  var script = document.currentScript;
  var loaded = false;

  function get(k) { try { return window.localStorage.getItem(k); } catch (e) { return null; } }
  function set(k, v) { try { window.localStorage.setItem(k, v); } catch (e) { /* private window: the choice lasts this page only */ } }
  function optedOut() { return navigator.globalPrivacyControl === true || get(OPT_KEY) === '1'; }
  function pixelId() {
    var fromTag = script && script.getAttribute('data-pixel-id');
    var fromCfg = window.THM_CONFIG && window.THM_CONFIG.META_PIXEL_ID;
    return String(fromTag || fromCfg || PIXEL_ID || '').replace(/[^0-9]/g, '');
  }
  function safeAddress() {
    var ok = true;
    try { new URLSearchParams(location.search).forEach(function (_v, k) { if (!ALLOWED.test(k)) ok = false; }); } catch (e) { ok = false; }
    if (/(^|[#&])(access_token|token|code|key)=/i.test(location.hash.replace(/^#/, '&'))) ok = false;
    return ok;
  }

  function load(id) {
    if (loaded || window.fbq) return;
    /* Meta's base code, unchanged */
    (function (f, b, e, v, n, t, s) { if (f.fbq) return; n = f.fbq = function () { n.callMethod ? n.callMethod.apply(n, arguments) : n.queue.push(arguments); };
      if (!f._fbq) f._fbq = n; n.push = n; n.loaded = true; n.version = '2.0'; n.queue = []; t = b.createElement(e); t.async = true; t.src = v;
      s = b.getElementsByTagName(e)[0]; s.parentNode.insertBefore(t, s); })(window, document, 'script', 'https://connect.facebook.net/en_US/fbevents.js');
    window.fbq('set', 'autoConfig', false, id); // no automatic button / form events
    window.fbq('init', id);
    window.fbq('track', 'PageView');
    loaded = true;
  }

  function clean(params) {
    var out = {};
    if (!params || typeof params !== 'object') return out;
    if (typeof params.value === 'number' && isFinite(params.value)) out.value = Math.round(params.value * 100) / 100;
    if (typeof params.currency === 'string' && /^[A-Za-z]{3}$/.test(params.currency)) out.currency = params.currency.toUpperCase();
    if (typeof params.content_name === 'string') out.content_name = params.content_name.slice(0, 60);
    return out;
  }

  window.thmPixel = {
    track: function (name, params) {
      if (!loaded || optedOut() || !EVENTS[name] || !window.fbq) return;
      try { window.fbq('track', name, clean(params)); } catch (e) { /* never break the page */ }
    },
    optOut: function () {
      set(OPT_KEY, '1'); set(SEEN_KEY, '1');
      try { if (window.fbq) window.fbq('consent', 'revoke'); } catch (e) { /* ignore */ }
    },
  };

  function notice(id, always) {
    if (!always && get(SEEN_KEY) === '1') return;
    var bar = document.createElement('div');
    bar.setAttribute('role', 'region');
    bar.setAttribute('aria-label', 'Ad measurement notice');
    bar.style.cssText = 'position:fixed;left:12px;right:12px;bottom:12px;z-index:2147483000;max-width:560px;margin:0 auto;padding:12px 14px;' +
      'background:#fff;color:#15121f;border:1px solid #d9dde6;border-radius:14px;box-shadow:0 6px 24px rgba(0,0,0,.12);' +
      'font:14px/1.45 -apple-system,BlinkMacSystemFont,"Segoe UI",Arial,sans-serif;display:flex;flex-wrap:wrap;gap:8px;align-items:center';
    var text = document.createElement('span');
    text.style.cssText = 'flex:1 1 260px';
    text.textContent = 'We use a Meta pixel to see which of our ads work. No names, phone numbers or emails are sent.';
    var no = document.createElement('button');
    no.type = 'button'; no.textContent = 'No thanks';
    no.style.cssText = 'padding:7px 12px;border-radius:999px;border:1px solid #c9cfda;background:#fff;color:#15121f;font:inherit;cursor:pointer';
    var ok = document.createElement('button');
    ok.type = 'button'; ok.textContent = 'OK';
    ok.style.cssText = 'padding:7px 14px;border-radius:999px;border:0;background:#0a47a8;color:#fff;font:inherit;font-weight:700;cursor:pointer';
    no.onclick = function () { window.thmPixel.optOut(); bar.remove(); };
    ok.onclick = function () { set(SEEN_KEY, '1'); set(OK_KEY, '1'); bar.remove(); if (MODE === 'ask') load(id); };
    bar.appendChild(text); bar.appendChild(no); bar.appendChild(ok);
    (document.body || document.documentElement).appendChild(bar);
  }

  function start() {
    var id = pixelId();
    if (!id || optedOut() || !safeAddress()) return;
    if (MODE === 'ask') { if (get(OK_KEY) === '1') load(id); else notice(id, true); return; }
    load(id);
    notice(id, false);
  }
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', start); else start();
})();
