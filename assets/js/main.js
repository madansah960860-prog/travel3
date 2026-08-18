/* ==========================================================================
   HARDPACK TRIP CO. — main.js
   Vanilla JavaScript. No frameworks, no build step, no dependencies.

   Modules
   01. Helpers
   02. Mobile navigation
   03. Crosshair cursor (pointer devices, reduced-motion aware)
   04. Baseline grid toggle
   05. Cookie consent (Accept / Reject / Manage) — no non-essential
       cookies or scripts fire before an explicit opt-in
   06. Accordions (FAQ)
   07. Tabs
   08. Back to top
   09. Form validation with inline error messages
   10. Destination filter + search
   11. Pricing monthly / annual toggle
   12. Trip planner (interactive itinerary builder)
   13. Packing checklist tool
   14. Year stamp
   ========================================================================== */
(function () {
  'use strict';

  /* ======================================================================
     01. HELPERS
     ====================================================================== */
  var $  = function (sel, ctx) { return (ctx || document).querySelector(sel); };
  var $$ = function (sel, ctx) { return Array.prototype.slice.call((ctx || document).querySelectorAll(sel)); };

  var prefersReducedMotion = window.matchMedia
    ? window.matchMedia('(prefers-reduced-motion: reduce)').matches
    : false;

  function store(key, value) {
    try {
      if (value === undefined) {
        var raw = window.localStorage.getItem(key);
        return raw === null ? null : JSON.parse(raw);
      }
      window.localStorage.setItem(key, JSON.stringify(value));
      return value;
    } catch (e) {
      // Private mode or storage disabled. Everything below degrades gracefully.
      return null;
    }
  }

  function removeStore(key) {
    try { window.localStorage.removeItem(key); } catch (e) { /* noop */ }
  }

  function usd(n) {
    return '$' + Math.round(n).toLocaleString('en-US');
  }

  function minutesToLabel(mins) {
    mins = Math.max(0, Math.round(mins));
    var h = Math.floor(mins / 60);
    var m = mins % 60;
    if (h && m) return h + 'h ' + m + 'm';
    if (h) return h + 'h';
    return m + 'm';
  }

  function to12Hour(value) {
    // value is "HH:MM" from an <input type="time">
    if (!value || value.indexOf(':') === -1) return value || '';
    var parts = value.split(':');
    var h = parseInt(parts[0], 10);
    var m = parts[1];
    var suffix = h >= 12 ? 'PM' : 'AM';
    var h12 = h % 12;
    if (h12 === 0) h12 = 12;
    return h12 + ':' + m + ' ' + suffix;
  }

  function escapeHTML(str) {
    return String(str)
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#39;');
  }

  /* ======================================================================
     02. MOBILE NAVIGATION
     ====================================================================== */
  function initNav() {
    var toggle = $('#navToggle');
    var nav = $('#primaryNav');
    if (!toggle || !nav) return;

    function close() {
      nav.classList.remove('is-open');
      toggle.setAttribute('aria-expanded', 'false');
    }

    toggle.addEventListener('click', function () {
      var open = toggle.getAttribute('aria-expanded') === 'true';
      if (open) {
        close();
      } else {
        nav.classList.add('is-open');
        toggle.setAttribute('aria-expanded', 'true');
        var firstLink = $('a', nav);
        if (firstLink) firstLink.focus();
      }
    });

    document.addEventListener('keydown', function (e) {
      if (e.key === 'Escape' && toggle.getAttribute('aria-expanded') === 'true') {
        close();
        toggle.focus();
      }
    });

    // Close the panel when the layout switches to the fixed sidebar.
    if (window.matchMedia) {
      var mq = window.matchMedia('(min-width: 1024px)');
      var onChange = function (e) { if (e.matches) close(); };
      if (mq.addEventListener) { mq.addEventListener('change', onChange); }
      else if (mq.addListener) { mq.addListener(onChange); }
    }
  }

  /* ======================================================================
     03. CROSSHAIR CURSOR
     Instant tracking, no easing. Disabled for touch and reduced motion.
     ====================================================================== */
  function initCrosshair() {
    if (prefersReducedMotion) return;
    if (!window.matchMedia) return;
    if (!window.matchMedia('(hover: hover) and (pointer: fine)').matches) return;
    if (window.innerWidth < 1024) return;

    var root = $('#crosshair');
    if (!root) return;
    var v = $('.crosshair__v', root);
    var h = $('.crosshair__h', root);
    if (!v || !h) return;

    document.body.classList.add('crosshair-on');

    var x = 0, y = 0, queued = false;
    function paint() {
      queued = false;
      v.style.transform = 'translateX(' + x + 'px)';
      h.style.transform = 'translateY(' + y + 'px)';
    }
    window.addEventListener('pointermove', function (e) {
      if (e.pointerType === 'touch') return;
      x = e.clientX;
      y = e.clientY;
      if (!queued) { queued = true; window.requestAnimationFrame(paint); }
    }, { passive: true });
  }

  /* ======================================================================
     04. BASELINE GRID TOGGLE
     The grid overlay is the signature detail. Users who find it noisy
     can switch it off, and the choice is remembered.
     ====================================================================== */
  function initGridToggle() {
    var saved = store('hp_grid');
    if (saved === 'off') document.body.classList.add('grid-off');

    $$('[data-grid-toggle]').forEach(function (btn) {
      function sync() {
        var off = document.body.classList.contains('grid-off');
        btn.setAttribute('aria-pressed', off ? 'false' : 'true');
        btn.textContent = off ? 'GRID: OFF' : 'GRID: ON';
      }
      btn.addEventListener('click', function () {
        document.body.classList.toggle('grid-off');
        store('hp_grid', document.body.classList.contains('grid-off') ? 'off' : 'on');
        sync();
      });
      sync();
    });
  }

  /* ======================================================================
     05. COOKIE CONSENT
     Essential cookies only until the visitor chooses. Analytics and
     advertising storage stay off unless explicitly accepted.
     ====================================================================== */
  var CONSENT_KEY = 'hp_consent_v1';

  function applyConsent(consent) {
    // This is where analytics / advertising tags would be initialised.
    // Nothing non-essential is loaded until the matching flag is true.
    window.hardpackConsent = consent;
    if (consent && consent.analytics) {
      document.documentElement.setAttribute('data-analytics', 'granted');
    } else {
      document.documentElement.removeAttribute('data-analytics');
    }
    if (consent && consent.ads) {
      document.documentElement.setAttribute('data-ads', 'granted');
    } else {
      document.documentElement.removeAttribute('data-ads');
    }
  }

  function initCookies() {
    var banner = $('#cookieBanner');
    var saved = store(CONSENT_KEY);

    if (saved) applyConsent(saved);

    if (!banner) return;

    var prefs = $('#cookiePrefs', banner);
    var btnAccept = $('#cookieAccept', banner);
    var btnReject = $('#cookieReject', banner);
    var btnManage = $('#cookieManage', banner);
    var btnSave = $('#cookieSave', banner);
    var cbAnalytics = $('#cookieAnalytics', banner);
    var cbAds = $('#cookieAds', banner);

    function show() {
      banner.classList.add('is-shown');
      document.body.classList.add('cookie-open');
    }
    function hide() {
      banner.classList.remove('is-shown');
      document.body.classList.remove('cookie-open');
    }
    function save(consent) {
      consent.timestamp = new Date().toISOString();
      store(CONSENT_KEY, consent);
      applyConsent(consent);
      hide();
    }

    if (!saved) show();

    if (btnAccept) btnAccept.addEventListener('click', function () {
      save({ essential: true, analytics: true, ads: true });
    });
    if (btnReject) btnReject.addEventListener('click', function () {
      save({ essential: true, analytics: false, ads: false });
    });
    if (btnManage) btnManage.addEventListener('click', function () {
      var open = prefs.classList.toggle('is-shown');
      btnManage.setAttribute('aria-expanded', open ? 'true' : 'false');
    });
    if (btnSave) btnSave.addEventListener('click', function () {
      save({
        essential: true,
        analytics: !!(cbAnalytics && cbAnalytics.checked),
        ads: !!(cbAds && cbAds.checked)
      });
    });

    // "Cookie settings" / "Do Not Sell or Share" links reopen the banner.
    $$('[data-cookie-reopen]').forEach(function (link) {
      link.addEventListener('click', function (e) {
        e.preventDefault();
        removeStore(CONSENT_KEY);
        applyConsent({ essential: true, analytics: false, ads: false });
        if (cbAnalytics) cbAnalytics.checked = false;
        if (cbAds) cbAds.checked = false;
        if (prefs) prefs.classList.add('is-shown');
        if (btnManage) btnManage.setAttribute('aria-expanded', 'true');
        show();
        if (btnSave) btnSave.focus();
      });
    });
  }

  /* ======================================================================
     06. ACCORDIONS
     ====================================================================== */
  function initAccordions() {
    $$('.acc-btn').forEach(function (btn) {
      var panelId = btn.getAttribute('aria-controls');
      var panel = panelId ? document.getElementById(panelId) : null;
      if (!panel) return;
      btn.addEventListener('click', function () {
        var open = btn.getAttribute('aria-expanded') === 'true';
        btn.setAttribute('aria-expanded', open ? 'false' : 'true');
        panel.setAttribute('data-open', open ? 'false' : 'true');
      });
    });
  }

  /* ======================================================================
     07. TABS
     ====================================================================== */
  function initTabs() {
    $$('[data-tabs]').forEach(function (group) {
      var tabs = $$('[role="tab"]', group);
      if (!tabs.length) return;

      function select(tab) {
        tabs.forEach(function (t) {
          var isSel = t === tab;
          t.setAttribute('aria-selected', isSel ? 'true' : 'false');
          t.setAttribute('tabindex', isSel ? '0' : '-1');
          var panel = document.getElementById(t.getAttribute('aria-controls'));
          if (panel) { if (isSel) { panel.removeAttribute('hidden'); } else { panel.setAttribute('hidden', ''); } }
        });
      }

      tabs.forEach(function (tab, i) {
        tab.addEventListener('click', function () { select(tab); });
        tab.addEventListener('keydown', function (e) {
          var next = null;
          if (e.key === 'ArrowRight') next = tabs[(i + 1) % tabs.length];
          if (e.key === 'ArrowLeft') next = tabs[(i - 1 + tabs.length) % tabs.length];
          if (e.key === 'Home') next = tabs[0];
          if (e.key === 'End') next = tabs[tabs.length - 1];
          if (next) { e.preventDefault(); select(next); next.focus(); }
        });
      });
    });
  }

  /* ======================================================================
     08. BACK TO TOP
     ====================================================================== */
  function initBackToTop() {
    var btn = $('#toTop');
    if (!btn) return;

    var sentinel = document.createElement('div');
    sentinel.style.cssText = 'position:absolute;top:600px;left:0;width:1px;height:1px;pointer-events:none;';
    document.body.appendChild(sentinel);

    if ('IntersectionObserver' in window) {
      var io = new IntersectionObserver(function (entries) {
        entries.forEach(function (entry) {
          btn.classList.toggle('is-shown', !entry.isIntersecting && entry.boundingClientRect.top < 0);
        });
      });
      io.observe(sentinel);
    } else {
      btn.classList.add('is-shown');
    }

    btn.addEventListener('click', function () {
      window.scrollTo(0, 0);
      var skip = $('.skip-link');
      if (skip) skip.focus();
    });
  }

  /* ======================================================================
     09. FORM VALIDATION
     Inline messages sit directly below the field they describe.
     ====================================================================== */
  var validators = {
    required: function (v) { return v.trim().length > 0; },
    email: function (v) { return /^[^\s@]+@[^\s@]+\.[a-z]{2,}$/i.test(v.trim()); },
    phone: function (v) { return v.trim() === '' || /^[\d\s().+-]{10,20}$/.test(v.trim()); },
    minlen: function (v, n) { return v.trim().length >= parseInt(n, 10); }
  };

  function fieldError(input, message) {
    var errId = input.getAttribute('aria-describedby');
    var err = errId ? document.getElementById(errId.split(' ').filter(function (id) {
      return id.indexOf('err-') === 0;
    })[0]) : null;
    if (!err) err = input.parentNode.querySelector('.err');
    if (!err) return;
    if (message) {
      err.textContent = message;
      err.classList.add('is-shown');
      input.setAttribute('aria-invalid', 'true');
    } else {
      err.textContent = '';
      err.classList.remove('is-shown');
      input.removeAttribute('aria-invalid');
    }
  }

  function validateField(input) {
    var value = input.value || '';
    var label = input.getAttribute('data-label') || 'This field';

    if (input.type === 'checkbox') {
      if (input.hasAttribute('required') && !input.checked) {
        fieldError(input, label + ' is required.');
        return false;
      }
      fieldError(input, '');
      return true;
    }

    if (input.hasAttribute('required') && !validators.required(value)) {
      fieldError(input, label + ' is required.');
      return false;
    }
    if (value.trim() && input.type === 'email' && !validators.email(value)) {
      fieldError(input, 'Enter a valid email address, for example name@company.com.');
      return false;
    }
    if (value.trim() && input.type === 'tel' && !validators.phone(value)) {
      fieldError(input, 'Enter a US phone number, for example +1 (503) 555-0182.');
      return false;
    }
    var min = input.getAttribute('data-minlen');
    if (min && value.trim() && !validators.minlen(value, min)) {
      fieldError(input, label + ' needs at least ' + min + ' characters. You have ' + value.trim().length + '.');
      return false;
    }
    fieldError(input, '');
    return true;
  }

  function initForms() {
    $$('form[data-validate]').forEach(function (form) {
      var fields = $$('input, textarea, select', form).filter(function (el) {
        return el.type !== 'submit' && el.type !== 'button' && el.type !== 'hidden';
      });
      var status = $('.form-status', form);

      fields.forEach(function (input) {
        input.addEventListener('blur', function () { validateField(input); });
        input.addEventListener('input', function () {
          if (input.getAttribute('aria-invalid') === 'true') validateField(input);
        });
      });

      form.addEventListener('submit', function (e) {
        e.preventDefault();
        var firstBad = null;
        fields.forEach(function (input) {
          if (!validateField(input) && !firstBad) firstBad = input;
        });

        if (firstBad) {
          if (status) {
            status.textContent = 'Something is missing. Check the highlighted fields below and send again.';
            status.classList.add('is-shown', 'is-error');
          }
          firstBad.focus();
          return;
        }

        if (status) {
          status.classList.remove('is-error');
          status.textContent = form.getAttribute('data-success') ||
            'Message received. A member of the Hardpack team replies within one business day.';
          status.classList.add('is-shown');
          status.setAttribute('tabindex', '-1');
          status.focus();
        }
        form.reset();
        fields.forEach(function (input) { fieldError(input, ''); });
      });
    });
  }

  /* ======================================================================
     10. DESTINATION FILTER + SEARCH
     ====================================================================== */
  function initFilters() {
    var root = $('[data-filter-root]');
    if (!root) return;

    var buttons = $$('[data-filter]', root);
    var search = $('#destSearch');
    var items = $$('[data-tags]', root);
    var count = $('#destCount');
    var empty = $('#destEmpty');
    var active = 'all';

    function run() {
      var q = search ? search.value.trim().toLowerCase() : '';
      var shown = 0;
      items.forEach(function (item) {
        var tags = (item.getAttribute('data-tags') || '').toLowerCase();
        var text = (item.textContent || '').toLowerCase();
        var matchTag = active === 'all' || tags.indexOf(active) !== -1;
        var matchText = !q || text.indexOf(q) !== -1;
        var show = matchTag && matchText;
        item.hidden = !show;
        if (show) shown++;
      });
      if (count) count.textContent = shown + (shown === 1 ? ' destination' : ' destinations');
      if (empty) empty.hidden = shown !== 0;
    }

    buttons.forEach(function (btn) {
      btn.addEventListener('click', function () {
        active = btn.getAttribute('data-filter');
        buttons.forEach(function (b) { b.setAttribute('aria-pressed', b === btn ? 'true' : 'false'); });
        run();
      });
    });

    if (search) search.addEventListener('input', run);
    run();
  }

  /* ======================================================================
     11. PRICING TOGGLE
     ====================================================================== */
  function initPricingToggle() {
    var toggle = $('#billingToggle');
    if (!toggle) return;
    var buttons = $$('[data-billing]', toggle);

    function set(mode) {
      buttons.forEach(function (b) {
        b.setAttribute('aria-pressed', b.getAttribute('data-billing') === mode ? 'true' : 'false');
      });
      $$('[data-price-monthly]').forEach(function (el) {
        el.textContent = mode === 'annual'
          ? el.getAttribute('data-price-annual')
          : el.getAttribute('data-price-monthly');
      });
      $$('[data-term]').forEach(function (el) {
        el.textContent = mode === 'annual' ? 'per year, billed annually' : 'per month, billed monthly';
      });
      $$('[data-saving]').forEach(function (el) {
        el.hidden = mode !== 'annual';
      });
    }

    buttons.forEach(function (b) {
      b.addEventListener('click', function () { set(b.getAttribute('data-billing')); });
    });
    set('monthly');
  }

  /* ======================================================================
     12. TRIP PLANNER
     A working itinerary builder. State lives in localStorage so a trip
     survives a page reload, exactly like the free tier of the product.
     ====================================================================== */
  var PLAN_KEY = 'hp_plan_v1';

  function initPlanner() {
    var planner = $('#planner');
    if (!planner) return;

    var form = $('#stopForm');
    var dayTabs = $('#dayTabs');
    var stopsWrap = $('#planStops');
    var tripName = $('#tripName');
    var tripTravelers = $('#tripTravelers');
    var totalStops = $('#totalStops');
    var totalMove = $('#totalMove');
    var totalCost = $('#totalCost');
    var totalPer = $('#totalPer');
    var planTitle = $('#planTitle');
    var dayCost = $('#dayCost');
    var addDayBtn = $('#addDay');
    var removeDayBtn = $('#removeDay');
    var clearBtn = $('#clearPlan');
    var printBtn = $('#printPlan');
    var loadSampleBtn = $('#loadSample');
    var saveNote = $('#saveNote');

    var sample = {
      name: 'Iceland Ring Road, 7 Days',
      travelers: 2,
      current: 0,
      days: [
        {
          label: 'Keflavík to Reykjavík',
          stops: [
            { time: '06:40', title: 'Land at Keflavík (KEF)', cat: 'Transit', move: 50, cost: 0, note: 'Overnight from Boston. Passport control is quick before 07:00.' },
            { time: '08:30', title: 'Pick up rental 4x4', cat: 'Transit', move: 20, cost: 92, note: 'Gravel and sand-and-ash protection added. Daily rate for a compact SUV.' },
            { time: '10:15', title: 'Sky Lagoon soak', cat: 'Activity', move: 35, cost: 69, note: 'Better jet-lag fix than a nap. Book the first slot of the day.' },
            { time: '14:00', title: 'Reykjavík old harbour walk', cat: 'Sightseeing', move: 15, cost: 0, note: 'Hallgrímskirkja, then down Laugavegur on foot.' },
            { time: '19:00', title: 'Dinner, Grandi district', cat: 'Food', move: 10, cost: 48, note: 'Fish stew and rye. Reserve two days out in summer.' }
          ]
        },
        {
          label: 'Golden Circle to Vík',
          stops: [
            { time: '08:00', title: 'Thingvellir National Park', cat: 'Sightseeing', move: 55, cost: 9, note: 'Parking fee only. Walk the rift between the plates.' },
            { time: '11:00', title: 'Geysir geothermal field', cat: 'Sightseeing', move: 50, cost: 0, note: 'Strokkur erupts every 6 to 10 minutes.' },
            { time: '13:30', title: 'Gullfoss overlook', cat: 'Sightseeing', move: 12, cost: 0, note: 'Upper viewpoint has the safer footing in wind.' },
            { time: '16:30', title: 'Seljalandsfoss', cat: 'Sightseeing', move: 95, cost: 8, note: 'Rain shell required. You walk behind the falls.' },
            { time: '19:30', title: 'Check in, Vík guesthouse', cat: 'Lodging', move: 45, cost: 186, note: 'Room for two, breakfast included.' }
          ]
        },
        {
          label: 'South coast and glacier lagoon',
          stops: [
            { time: '07:45', title: 'Reynisfjara black sand beach', cat: 'Sightseeing', move: 12, cost: 0, note: 'Stay far back from the waterline. Sneaker waves are lethal here.' },
            { time: '11:00', title: 'Fjaðrárgljúfur canyon rim', cat: 'Hike', move: 70, cost: 0, note: 'Two mile round trip on a maintained path.' },
            { time: '14:30', title: 'Jökulsárlón glacier lagoon', cat: 'Sightseeing', move: 120, cost: 0, note: 'Cross the road to Diamond Beach afterwards.' },
            { time: '16:00', title: 'Zodiac boat among the icebergs', cat: 'Activity', move: 10, cost: 132, note: 'Per person. Runs May through October only.' },
            { time: '19:45', title: 'Höfn langoustine dinner', cat: 'Food', move: 60, cost: 74, note: 'The town is the reason to push this far east.' }
          ]
        }
      ]
    };

    var plan = store(PLAN_KEY) || {
      name: '',
      travelers: 2,
      current: 0,
      days: [{ label: '', stops: [] }]
    };

    function persist() {
      plan.name = tripName ? tripName.value : plan.name;
      plan.travelers = tripTravelers ? Math.max(1, parseInt(tripTravelers.value, 10) || 1) : plan.travelers;
      var ok = store(PLAN_KEY, plan);
      if (saveNote) {
        saveNote.textContent = ok
          ? 'Saved in this browser. Nothing leaves your device on the free tier.'
          : 'Browser storage is blocked, so this plan will not survive a reload.';
      }
    }

    function renderDayTabs() {
      if (!dayTabs) return;
      dayTabs.innerHTML = '';
      plan.days.forEach(function (day, i) {
        var b = document.createElement('button');
        b.type = 'button';
        b.className = 'daytab';
        b.setAttribute('aria-selected', i === plan.current ? 'true' : 'false');
        b.textContent = 'Day ' + (i + 1);
        b.addEventListener('click', function () {
          plan.current = i;
          render();
          persist();
        });
        dayTabs.appendChild(b);
      });
      if (removeDayBtn) removeDayBtn.disabled = plan.days.length <= 1;
    }

    function renderStops() {
      if (!stopsWrap) return;
      var day = plan.days[plan.current];
      stopsWrap.innerHTML = '';

      if (!day.stops.length) {
        var empty = document.createElement('div');
        empty.className = 'plan-empty';
        empty.innerHTML = '<strong>Day ' + (plan.current + 1) + ' is empty</strong>' +
          'Add your first stop with the form on the left. Give it a time, a rough cost per person, ' +
          'and how long it takes to get there from the previous stop. The day totals update as you type.';
        stopsWrap.appendChild(empty);
        return;
      }

      var ul = document.createElement('ul');
      ul.className = 'plan-stops';

      day.stops
        .slice()
        .sort(function (a, b) { return a.time.localeCompare(b.time); })
        .forEach(function (stop) {
          var li = document.createElement('li');
          var idx = day.stops.indexOf(stop);
          li.innerHTML =
            '<span class="stop__time">' + escapeHTML(to12Hour(stop.time)) + '</span>' +
            '<span class="stop__main">' +
              '<span class="stop__title">' + escapeHTML(stop.title) + '</span>' +
              (stop.note ? '<p class="stop__desc">' + escapeHTML(stop.note) + '</p>' : '') +
              '<span class="stop__tags">' +
                '<span class="chip">' + escapeHTML(stop.cat) + '</span>' +
                '<span class="chip chip--move">Travel ' + minutesToLabel(stop.move) + '</span>' +
                '<span class="chip chip--cost">' + usd(stop.cost) + ' / person</span>' +
              '</span>' +
            '</span>';

          var del = document.createElement('button');
          del.type = 'button';
          del.className = 'stop-del';
          del.textContent = 'Remove';
          del.setAttribute('aria-label', 'Remove stop: ' + stop.title);
          del.addEventListener('click', function () {
            day.stops.splice(idx, 1);
            render();
            persist();
          });
          li.appendChild(del);
          ul.appendChild(li);
        });

      stopsWrap.appendChild(ul);
    }

    function renderTotals() {
      var travelers = plan.travelers || 1;
      var stops = 0, move = 0, cost = 0, dayTotal = 0;

      plan.days.forEach(function (day, i) {
        day.stops.forEach(function (s) {
          stops++;
          move += s.move;
          cost += s.cost;
          if (i === plan.current) dayTotal += s.cost;
        });
      });

      if (totalStops) totalStops.textContent = stops;
      if (totalMove) totalMove.textContent = minutesToLabel(move);
      if (totalCost) totalCost.textContent = usd(cost * travelers);
      if (totalPer) totalPer.textContent = usd(cost);
      if (dayCost) dayCost.textContent = usd(dayTotal) + ' per person';
      if (planTitle) {
        planTitle.textContent = (plan.name && plan.name.trim())
          ? plan.name.trim().toUpperCase()
          : 'UNTITLED TRIP';
      }
    }

    function render() {
      renderDayTabs();
      renderStops();
      renderTotals();
    }

    // Restore saved values into the header controls
    if (tripName) tripName.value = plan.name || '';
    if (tripTravelers) tripTravelers.value = plan.travelers || 2;

    if (tripName) tripName.addEventListener('input', function () { renderTotals(); persist(); });
    if (tripTravelers) tripTravelers.addEventListener('input', function () { renderTotals(); persist(); });

    if (form) {
      form.addEventListener('submit', function (e) {
        e.preventDefault();
        var title = $('#stopTitle');
        var time = $('#stopTime');
        var cat = $('#stopCat');
        var move = $('#stopMove');
        var cost = $('#stopCost');
        var note = $('#stopNote');

        var ok = true;
        [title, time].forEach(function (input) {
          if (!validateField(input)) ok = false;
        });
        if (!ok) { (title.getAttribute('aria-invalid') ? title : time).focus(); return; }

        plan.days[plan.current].stops.push({
          time: time.value,
          title: title.value.trim(),
          cat: cat.value,
          move: Math.max(0, parseInt(move.value, 10) || 0),
          cost: Math.max(0, parseFloat(cost.value) || 0),
          note: note.value.trim()
        });

        title.value = '';
        note.value = '';
        cost.value = '';
        move.value = '';
        render();
        persist();
        title.focus();
      });
    }

    if (addDayBtn) addDayBtn.addEventListener('click', function () {
      if (plan.days.length >= 14) {
        window.alert('The free planner tops out at 14 days. Pro removes the limit.');
        return;
      }
      plan.days.push({ label: '', stops: [] });
      plan.current = plan.days.length - 1;
      render();
      persist();
    });

    if (removeDayBtn) removeDayBtn.addEventListener('click', function () {
      if (plan.days.length <= 1) return;
      if (!window.confirm('Delete Day ' + (plan.current + 1) + ' and everything on it?')) return;
      plan.days.splice(plan.current, 1);
      plan.current = Math.max(0, plan.current - 1);
      render();
      persist();
    });

    if (clearBtn) clearBtn.addEventListener('click', function () {
      if (!window.confirm('Clear the whole trip? This cannot be undone.')) return;
      plan = { name: '', travelers: 2, current: 0, days: [{ label: '', stops: [] }] };
      if (tripName) tripName.value = '';
      if (tripTravelers) tripTravelers.value = 2;
      render();
      persist();
    });

    if (loadSampleBtn) loadSampleBtn.addEventListener('click', function () {
      plan = JSON.parse(JSON.stringify(sample));
      if (tripName) tripName.value = plan.name;
      if (tripTravelers) tripTravelers.value = plan.travelers;
      render();
      persist();
    });

    if (printBtn) printBtn.addEventListener('click', function () { window.print(); });

    render();
  }

  /* ======================================================================
     13. PACKING CHECKLIST TOOL
     ====================================================================== */
  function initChecklists() {
    $$('[data-checklist]').forEach(initOneChecklist);
  }

  function initOneChecklist(root) {
    var key = 'hp_checklist_' + (root.getAttribute('data-checklist') || 'default');
    var saved = store(key) || {};
    var boxes = $$('input[type="checkbox"]', root);
    var fill = $('.check-fill', root);
    var label = $('.check-label', root);
    var resetBtn = $('.check-reset', root);
    var printBtn = $('.check-print', root);

    function update() {
      var done = boxes.filter(function (b) { return b.checked; }).length;
      var pct = boxes.length ? Math.round((done / boxes.length) * 100) : 0;
      if (fill) fill.style.width = pct + '%';
      if (label) label.textContent = done + ' of ' + boxes.length + ' packed. ' + pct + '% done.';
      if (fill && fill.parentNode) {
        fill.parentNode.setAttribute('role', 'progressbar');
        fill.parentNode.setAttribute('aria-valuenow', String(pct));
        fill.parentNode.setAttribute('aria-valuemin', '0');
        fill.parentNode.setAttribute('aria-valuemax', '100');
        fill.parentNode.setAttribute('aria-label', 'Packing progress');
      }
    }

    boxes.forEach(function (box) {
      if (saved[box.id]) box.checked = true;
      box.addEventListener('change', function () {
        saved[box.id] = box.checked;
        store(key, saved);
        update();
      });
    });

    if (resetBtn) resetBtn.addEventListener('click', function () {
      boxes.forEach(function (b) { b.checked = false; });
      saved = {};
      store(key, saved);
      update();
    });

    if (printBtn) printBtn.addEventListener('click', function () { window.print(); });

    update();
  }

  /* ======================================================================
     14. YEAR STAMP
     ====================================================================== */
  function initYear() {
    var y = new Date().getFullYear();
    $$('[data-year]').forEach(function (el) { el.textContent = y; });
  }

  /* ======================================================================
     BOOT
     ====================================================================== */
  function boot() {
    initNav();
    initCrosshair();
    initGridToggle();
    initCookies();
    initAccordions();
    initTabs();
    initBackToTop();
    initForms();
    initFilters();
    initPricingToggle();
    initPlanner();
    initChecklists();
    initYear();
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', boot);
  } else {
    boot();
  }
})();
