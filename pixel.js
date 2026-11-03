/*
  Website measurement for the public customer pages (WEBSITE-TRACKING.md; until 2026-11-03 the Meta Pixel only). One file, one notice,
  one "No thanks", on every public page and the booking page:
    <script src="pixel.js" defer></script>
  - Each tool is OFF while its ID below is empty: nothing of it loads. IDs may also come from window.THM_CONFIG (same names).
      META_PIXEL_ID        Meta Pixel (digits, Events Manager)
      GA4_ID               Google Analytics 4 measurement ID ("G-...")
      GADS_ID              Google Ads tag ("AW-..."); GADS_PURCHASE_LABEL the booking conversion's label (empty = no conversion sent)
      CLARITY_ID           Microsoft Clarity project ID
  - Consent: a small notice with "No thanks" shows once while any tool is on. "No thanks", or a Global Privacy Control signal from the
    browser, stops every tool and the attribution below on this browser; the booking page shares the same choice. The Google tags run with
    Consent Mode v2: granted by default here (MODE 'notice', Jack 2026-10-21), denied after "No thanks". MODE = 'ask' loads nothing
    until the visitor taps OK (stricter; fewer numbers).
  - Never loads a tool on an address that carries a token, code or personal detail: only utm_*, gclid, fbclid, msclkid, org, theme and
    the booking page's service, beds and baths may be in the query (the booking page drops its zip, date and time from the address bar
    once read). Do not add this file to private pages (reports, accounts, reviews) anyway.
  - Events, window.thmTrack(name, params): view_item (pages marked data-view-item), zip_check {served}, begin_checkout, add_payment_info,
    purchase {value, transaction_id = the booking id}, generate_lead {form}, click_to_call and click_to_text (every tel: and sms: tap is
    caught here), and LCP, INP and CLS from real visits. GA4 gets them all; Meta gets ViewContent, Lead (a served ZIP, a quote or lead
    form), InitiateCheckout, Contact and Purchase with eventID = the booking id (so the server-side Conversions API can dedupe it);
    Google Ads gets the booking conversion. Names, phones, emails and addresses are never sent: only values, currency, ids and short
    labels pass, and Meta's automatic events and advanced matching stay off (leave them off in Events Manager too).
  - Clarity masks every form field on every page and the whole booking page (strict). Pick "Strict" masking in Clarity's settings too.
  - Attribution, window.thmAttribution(): the first and the last touch (utm_*, gclid, fbclid, msclkid, the referring site without its
    query, the landing path, when) kept in this browser for 90 days and sent with the booking (create-booking and confirm-booking read
    `attribution`; supabase/functions/_shared/attribution.ts). Works with every tool off; "No thanks" and GPC stop it.
*/
(function () {
  var META_PIXEL_ID = '';       // digits; empty = off
  var GA4_ID = '';              // 'G-XXXXXXXXXX'; empty = off
  var GADS_ID = '';             // 'AW-XXXXXXXXXX'; empty = off
  var GADS_PURCHASE_LABEL = ''; // the label of the "Booking" conversion in Google Ads; empty = no conversion sent
  var CLARITY_ID = '';          // Clarity project ID; empty = off
  var MODE = 'notice'; // 'notice' = load and show the notice with "No thanks" (Jack, 2026-10-21); 'ask' = load only after "OK"
  var OPT_KEY = 'thm_ads_optout', SEEN_KEY = 'thm_ads_notice', OK_KEY = 'thm_ads_ok', ATTR_KEY = 'thm_attribution';
  var ALLOWED = /^(utm_(source|medium|campaign|content|term|id)|gclid|fbclid|msclkid|org|theme|service|beds|baths)$/;
  var TOUCH = ['utm_source', 'utm_medium', 'utm_campaign', 'utm_term', 'utm_content', 'gclid', 'fbclid', 'msclkid'];
  var KEEP_DAYS = 90, DAY = 864e5;
  var cfg = window.THM_CONFIG || {};
  var script = document.currentScript;
  var started = false;

  function get(k) { try { return window.localStorage.getItem(k); } catch (e) { return null; } }
  function set(k, v) { try { window.localStorage.setItem(k, v); } catch (e) { /* private window: the choice lasts this page only */ } }
  function del(k) { try { window.localStorage.removeItem(k); } catch (e) { /* ignore */ } }
  function optedOut() { return navigator.globalPrivacyControl === true || get(OPT_KEY) === '1'; }
  function id(name, fallback, re) { return String(cfg[name] || (name === 'META_PIXEL_ID' && script && script.getAttribute('data-pixel-id')) || fallback || '').replace(re, ''); }
  var ids = {
    meta: id('META_PIXEL_ID', META_PIXEL_ID, /[^0-9]/g),
    ga4: id('GA4_ID', GA4_ID, /[^A-Za-z0-9-]/g),
    ads: id('GADS_ID', GADS_ID, /[^A-Za-z0-9-]/g),
    adsLabel: id('GADS_PURCHASE_LABEL', GADS_PURCHASE_LABEL, /[^A-Za-z0-9_-]/g),
    clarity: id('CLARITY_ID', CLARITY_ID, /[^A-Za-z0-9]/g),
  };
  function anyTool() { return !!(ids.meta || ids.ga4 || ids.ads || ids.clarity); }
  function safeAddress() {
    var ok = true;
    try { new URLSearchParams(location.search).forEach(function (_v, k) { if (!ALLOWED.test(k)) ok = false; }); } catch (e) { ok = false; }
    if (/(^|[#&])(access_token|token|code|key)=/i.test(location.hash.replace(/^#/, '&'))) ok = false;
    return ok;
  }

  // ---------- attribution: first and last touch, 90 days, this browser only ----------
  function readTouches() {
    var s = null;
    try { s = JSON.parse(get(ATTR_KEY) || 'null'); } catch (e) { s = null; }
    s = s && typeof s === 'object' ? s : {};
    var fresh = function (t) { return t && typeof t === 'object' && Date.now() - Date.parse(t.at) < KEEP_DAYS * DAY ? t : null; };
    return { first: fresh(s.first), last: fresh(s.last) };
  }
  function captureTouch() {
    if (optedOut()) { del(ATTR_KEY); return; }
    var t = {}, campaign = false, p;
    try { p = new URLSearchParams(location.search); } catch (e) { return; }
    TOUCH.forEach(function (k) { var v = p.get(k); if (v) { t[k] = v.slice(0, 200); campaign = true; } });
    try {
      if (document.referrer) {
        var r = new URL(document.referrer);
        if (r.host !== location.host) { t.referrer = (r.origin + r.pathname).slice(0, 200); campaign = true; }
      }
    } catch (e) { /* no referrer */ }
    t.landing = location.pathname.slice(0, 200);
    t.at = new Date().toISOString();
    var s = readTouches();
    if (!s.first) s.first = t;          // the first visit in 90 days, direct or not
    if (campaign || !s.last) s.last = t; // the latest visit that came from somewhere (a page view inside the site is not a touch)
    set(ATTR_KEY, JSON.stringify(s));
  }
  window.thmAttribution = function () {
    if (optedOut()) return null;
    var s = readTouches();
    return s.first || s.last ? { first: s.first, last: s.last } : null;
  };

  // ---------- the tools ----------
  function loadGoogle() {
    if (!ids.ga4 && !ids.ads) return;
    window.dataLayer = window.dataLayer || [];
    window.gtag = window.gtag || function () { window.dataLayer.push(arguments); };
    var g = MODE === 'ask' && get(OK_KEY) !== '1' ? 'denied' : 'granted';
    window.gtag('consent', 'default', { ad_storage: g, analytics_storage: g, ad_user_data: g, ad_personalization: g });
    window.gtag('js', new Date());
    if (ids.ga4) window.gtag('config', ids.ga4);
    if (ids.ads) window.gtag('config', ids.ads);
    var t = document.createElement('script'); t.async = true; t.src = 'https://www.googletagmanager.com/gtag/js?id=' + encodeURIComponent(ids.ga4 || ids.ads);
    document.head.appendChild(t);
  }
  function loadMeta() {
    if (!ids.meta || window.fbq) return;
    /* Meta's base code, unchanged */
    (function (f, b, e, v, n, t, s) { if (f.fbq) return; n = f.fbq = function () { n.callMethod ? n.callMethod.apply(n, arguments) : n.queue.push(arguments); };
      if (!f._fbq) f._fbq = n; n.push = n; n.loaded = true; n.version = '2.0'; n.queue = []; t = b.createElement(e); t.async = true; t.src = v;
      s = b.getElementsByTagName(e)[0]; s.parentNode.insertBefore(t, s); })(window, document, 'script', 'https://connect.facebook.net/en_US/fbevents.js');
    window.fbq('set', 'autoConfig', false, ids.meta); // no automatic button / form events
    window.fbq('init', ids.meta);
    window.fbq('track', 'PageView');
  }
  function loadClarity() {
    if (!ids.clarity) return;
    // Mask before Clarity starts: every form field, and on the booking page everything (strict).
    var fields = document.querySelectorAll('form, input, textarea, select');
    for (var i = 0; i < fields.length; i++) fields[i].setAttribute('data-clarity-mask', 'True');
    if (document.getElementById('bw-root')) document.body.setAttribute('data-clarity-mask', 'True');
    /* Clarity's base code */
    (function (c, l, a, r, i2, t, y) { c[a] = c[a] || function () { (c[a].q = c[a].q || []).push(arguments); }; t = l.createElement(r); t.async = 1;
      t.src = 'https://www.clarity.ms/tag/' + i2; y = l.getElementsByTagName(r)[0]; y.parentNode.insertBefore(t, y); })(window, document, 'clarity', 'script', ids.clarity);
  }

  // ---------- events ----------
  function compact(o) { var out = {}; for (var k in o) if (o[k] !== undefined && o[k] !== null && o[k] !== '') out[k] = o[k]; return out; }
  function num(v) { v = Number(v); return isFinite(v) && v > 0 ? Math.round(v * 100) / 100 : undefined; }
  function str(v, n) { return typeof v === 'string' && v ? v.slice(0, n || 60) : undefined; }
  var META = { view_item: 'ViewContent', begin_checkout: 'InitiateCheckout', purchase: 'Purchase', click_to_call: 'Contact', click_to_text: 'Contact', generate_lead: 'Lead' };
  window.thmTrack = function (name, p) {
    if (!started || optedOut()) return;
    p = p || {};
    var value = num(p.value), currency = value !== undefined ? 'USD' : undefined, item = str(p.item), txn = str(p.transaction_id, 64);
    var items = item ? [{ item_name: item }] : undefined;
    try {
      if (window.gtag && ids.ga4) {
        var g = name === 'zip_check' ? { served: p.served ? 'yes' : 'no' }
          : name === 'generate_lead' ? { form: str(p.form, 40) }
          : { transaction_id: txn, value: value, currency: currency, items: items };
        window.gtag('event', name, compact(g));
      }
      if (window.gtag && ids.ads && ids.adsLabel && name === 'purchase') {
        window.gtag('event', 'conversion', compact({ send_to: ids.ads + '/' + ids.adsLabel, value: value, currency: currency, transaction_id: txn }));
      }
      if (window.fbq) {
        var m = name === 'zip_check' ? (p.served ? 'Lead' : null) : name === 'generate_lead' && p.served === false ? null : META[name];
        if (m) window.fbq('track', m, compact({ value: value, currency: currency, content_name: item || str(p.form, 40) }), name === 'purchase' && txn ? { eventID: txn } : undefined);
      }
    } catch (e) { /* never break the page */ }
  };
  // The Meta-only call some pages used (web/site/site.js before 2026-11-03); kept so nothing breaks.
  window.thmPixel = {
    track: function (name, params) { if (name === 'FindLocation') window.thmTrack('zip_check', { served: true }); else if (started && !optedOut() && window.fbq) try { window.fbq('track', name, compact({ value: num(params && params.value), currency: params && params.value ? 'USD' : undefined })); } catch (e) { /* ignore */ } },
    optOut: function () {
      set(OPT_KEY, '1'); set(SEEN_KEY, '1'); del(ATTR_KEY);
      try { if (window.gtag) window.gtag('consent', 'update', { ad_storage: 'denied', analytics_storage: 'denied', ad_user_data: 'denied', ad_personalization: 'denied' }); } catch (e) { /* ignore */ }
      try { if (window.fbq) window.fbq('consent', 'revoke'); } catch (e) { /* ignore */ }
    },
  };
  function tapTracking() {
    document.addEventListener('click', function (e) {
      var a = e.target && e.target.closest ? e.target.closest('a[href^="tel:"], a[href^="sms:"]') : null;
      if (a) window.thmTrack(/^tel:/.test(a.getAttribute('href')) ? 'click_to_call' : 'click_to_text');
    }, true);
  }
  // Real-visit LCP, INP (the slowest interaction, the web-vitals reading for most visits) and CLS (largest session window), to GA4 once
  // when the page is hidden.
  function webVitals() {
    if (!ids.ga4 || !('PerformanceObserver' in window)) return;
    var lcp = 0, cls = 0, win = 0, winStart = 0, winLast = 0, inp = 0, sent = false;
    function watch(type, fn, extra) { try { var o = { type: type, buffered: true }; for (var k in extra) o[k] = extra[k]; new PerformanceObserver(function (l) { l.getEntries().forEach(fn); }).observe(o); } catch (e) { /* not supported */ } }
    watch('largest-contentful-paint', function (en) { lcp = en.startTime; });
    watch('layout-shift', function (en) {
      if (en.hadRecentInput) return;
      if (win && en.startTime - winLast < 1000 && en.startTime - winStart < 5000) win += en.value; else { win = en.value; winStart = en.startTime; }
      winLast = en.startTime; if (win > cls) cls = win;
    });
    watch('event', function (en) { if (en.interactionId && en.duration > inp) inp = en.duration; }, { durationThreshold: 40 });
    function send() {
      if (sent || optedOut() || !window.gtag) return;
      sent = true;
      if (lcp) window.gtag('event', 'LCP', { value: Math.round(lcp), metric_value: Math.round(lcp), non_interaction: true });
      if (inp) window.gtag('event', 'INP', { value: Math.round(inp), metric_value: Math.round(inp), non_interaction: true });
      window.gtag('event', 'CLS', { value: Math.round(cls * 1000), metric_value: Math.round(cls * 1000) / 1000, non_interaction: true });
    }
    document.addEventListener('visibilitychange', function () { if (document.visibilityState === 'hidden') send(); });
    window.addEventListener('pagehide', send);
  }

  // ---------- the notice ----------
  function notice(always) {
    if (!always && get(SEEN_KEY) === '1') return;
    var lift = document.body && document.body.classList.contains('has-mbar') && window.innerWidth < 800 ? 76 : 12; // above the phone bar
    var bar = document.createElement('div');
    bar.setAttribute('role', 'region');
    bar.setAttribute('aria-label', 'Measurement notice');
    bar.style.cssText = 'position:fixed;left:12px;right:12px;bottom:' + lift + 'px;z-index:2147483000;max-width:560px;margin:0 auto;padding:12px 14px;' +
      'background:#fff;color:#15121f;border:1px solid #d9dde6;border-radius:14px;box-shadow:0 6px 24px rgba(0,0,0,.12);' +
      'font:14px/1.45 -apple-system,BlinkMacSystemFont,"Segoe UI",Arial,sans-serif;display:flex;flex-wrap:wrap;gap:8px;align-items:center';
    var text = document.createElement('span');
    text.style.cssText = 'flex:1 1 260px';
    text.textContent = 'We use Google, Meta and Microsoft tools to see which of our ads work and how this site is used. No names, phone numbers or emails are sent.';
    var no = document.createElement('button');
    no.type = 'button'; no.textContent = 'No thanks';
    no.style.cssText = 'padding:7px 12px;border-radius:999px;border:1px solid #c9cfda;background:#fff;color:#15121f;font:inherit;cursor:pointer';
    var ok = document.createElement('button');
    ok.type = 'button'; ok.textContent = 'OK';
    ok.style.cssText = 'padding:7px 14px;border-radius:999px;border:0;background:#0a47a8;color:#fff;font:inherit;font-weight:700;cursor:pointer';
    no.onclick = function () { window.thmPixel.optOut(); bar.remove(); };
    ok.onclick = function () {
      set(SEEN_KEY, '1'); set(OK_KEY, '1'); bar.remove();
      if (MODE === 'ask') { load(); try { if (window.gtag) window.gtag('consent', 'update', { ad_storage: 'granted', analytics_storage: 'granted', ad_user_data: 'granted', ad_personalization: 'granted' }); } catch (e) { /* ignore */ } }
    };
    bar.appendChild(text); bar.appendChild(no); bar.appendChild(ok);
    (document.body || document.documentElement).appendChild(bar);
  }

  function load() {
    if (started) return;
    started = true;
    loadGoogle(); loadMeta(); loadClarity(); webVitals();
    var v = document.body && document.body.getAttribute('data-view-item');
    if (v) window.thmTrack('view_item', { item: v });
  }
  function start() {
    captureTouch();
    if (!anyTool() || optedOut() || !safeAddress()) return;
    tapTracking();
    if (MODE === 'ask') { if (get(OK_KEY) === '1') load(); else notice(true); return; }
    load();
    notice(false);
  }
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', start); else start();
})();
