/* ─────────────────────────────────────────────────────────────────────────
   MuscleGrid Theme · theme.js
   All interactivity for the storefront — no framework, vanilla web platform.

   Owns: cart drawer + AJAX add-to-cart + qty controls + line removal
         search overlay + predictive search
         mobile nav drawer + mega menu
         PDP variant selector + qty stepper + spec tabs
         theme toggle + toast
   Reads: window.theme.routes / .moneyFormat / .strings (set by theme.liquid)
   ───────────────────────────────────────────────────────────────────────── */
(function () {
  'use strict';

  var theme = window.theme || (window.theme = {});
  var routes = theme.routes || {};
  var strings = theme.strings || {};

  /* ── Tiny DOM helpers ─────────────────────────────────────────────── */
  var $  = function (sel, root) { return (root || document).querySelector(sel); };
  var $$ = function (sel, root) { return Array.prototype.slice.call((root || document).querySelectorAll(sel)); };
  var on = function (el, ev, fn, opts) { el && el.addEventListener(ev, fn, opts || false); };
  var trapFocus = function (el) {
    var f = el.querySelectorAll('a[href], button:not([disabled]), input, [tabindex]:not([tabindex="-1"])');
    f.length && f[0].focus();
  };

  /* ── Money formatting (handles {{amount}} / {{amount_no_decimals}} etc.) ─ */
  function formatMoney(cents, fmt) {
    fmt = fmt || theme.moneyFormat || '₹{{amount}}';
    var v = (cents / 100);
    var withCommas = function (n, dp) {
      var parts = (typeof n === 'number' ? n : parseFloat(n)).toFixed(dp || 0).split('.');
      parts[0] = parts[0].replace(/(\d)(?=(\d\d)+\d$)/g, '$1,'); /* Indian numbering */
      return parts.join('.');
    };
    return fmt.replace(/\{\{\s*(amount|amount_no_decimals|amount_with_comma_separator|amount_no_decimals_with_comma_separator)\s*\}\}/g, function (_, key) {
      if (key.indexOf('no_decimals') > -1) return withCommas(Math.round(v), 0);
      return withCommas(v, 2);
    });
  }

  /* ── Toast ────────────────────────────────────────────────────────── */
  var toastEl = $('#MGToast');
  var toastT;
  function toast(msg, ok) {
    if (!toastEl) return;
    toastEl.innerHTML = (ok === false ? '' : '<svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="#1F8A4C" stroke-width="2" stroke-linecap="round"><path d="M5 12l5 5L20 7"/></svg>') + ' ' + msg;
    toastEl.hidden = false;
    clearTimeout(toastT);
    toastT = setTimeout(function () { toastEl.hidden = true; }, 2200);
  }

  /* ─────────────────────────────────────────────────────────────────────
     CART DRAWER + AJAX CART
     ───────────────────────────────────────────────────────────────────── */
  var Cart = {
    drawer:    null, scrim: null, body: null, foot: null, count: null, badge: null,
    subtotal:  null, total: null, shipping: null, shipBar: null, shipText: null, shipTotal: null, shipBlock: null,
    tpl:       null,

    init: function () {
      this.drawer   = $('[data-cart-drawer]');
      this.scrim    = $('[data-cart-scrim]');
      this.body     = $('[data-cart-body]');
      this.foot     = $('[data-cart-foot]');
      this.badge    = $('[data-cart-count]');
      this.count    = $('[data-cart-count-text]');
      this.subtotal = $('[data-cart-subtotal]');
      this.total    = $('[data-cart-total]');
      this.shipping = $('[data-cart-shipping]');
      this.shipBar  = $('[data-ship-bar]');
      this.shipText = $('[data-ship-text]');
      this.shipTotal= $('[data-ship-total]');
      this.shipBlock= $('[data-free-ship]');
      this.tpl      = $('#MGCartItemTpl');

      var self = this;
      $$('[data-toggle="cart"]').forEach(function (el) { on(el, 'click', function (e) { e.preventDefault(); self.open(); }); });
      $$('[data-cart-close]').forEach(function (el) { on(el, 'click', function () { self.close(); }); });
      on(this.scrim, 'click', function () { self.close(); });
      on(document, 'keydown', function (e) { if (e.key === 'Escape' && self.drawer && !self.drawer.hidden) self.close(); });

      /* AJAX add-to-cart intercept */
      $$('form[data-add-to-cart]').forEach(function (form) {
        on(form, 'submit', function (e) {
          /* If they clicked the "Buy now" / checkout button, let Shopify handle the form natively */
          var submitter = e.submitter;
          if (submitter && (submitter.name === 'checkout' || submitter.dataset.checkout)) return;
          e.preventDefault();
          self.add(form);
        });
      });

      this.refresh();
    },

    open: function () {
      this.drawer.hidden = false; this.scrim.hidden = false;
      this.drawer.setAttribute('aria-hidden', 'false');
      document.documentElement.style.overflow = 'hidden';
      trapFocus(this.drawer);
    },
    close: function () {
      this.drawer.hidden = true; this.scrim.hidden = true;
      this.drawer.setAttribute('aria-hidden', 'true');
      document.documentElement.style.overflow = '';
    },

    add: function (form) {
      var self = this;
      var fd = new FormData(form);
      var btn = form.querySelector('button[type="submit"]');
      var orig = btn ? btn.innerHTML : '';
      if (btn) { btn.disabled = true; btn.innerHTML = 'Adding…'; }
      fetch(routes.cartAdd, { method: 'POST', body: fd, headers: { 'Accept': 'application/json', 'X-Requested-With': 'XMLHttpRequest' } })
        .then(function (r) { return r.json().then(function (data) { return { ok: r.ok, data: data }; }); })
        .then(function (res) {
          if (!res.ok) {
            toast(res.data.description || 'Could not add to cart', false);
            return;
          }
          toast('Added · ' + (res.data.product_title || 'Item'));
          return self.refresh().then(function () { self.open(); });
        })
        .catch(function () { toast('Network error — try again', false); })
        .finally(function () { if (btn) { btn.disabled = false; btn.innerHTML = orig; } });
    },

    refresh: function () {
      var self = this;
      return fetch(routes.cart + '.js', { headers: { 'Accept': 'application/json' } })
        .then(function (r) { return r.json(); })
        .then(function (cart) {
          self.render(cart);
          self.bindCount(cart.item_count);
          return cart;
        });
    },

    bindCount: function (n) {
      if (!this.badge) return;
      this.badge.textContent = n;
      this.badge.hidden = n === 0;
      if (this.count) this.count.textContent = n;
    },

    render: function (cart) {
      if (!this.body) return;
      /* Empty state — re-render fresh */
      if (cart.item_count === 0) {
        this.body.innerHTML =
          '<div class="mg-drawer-empty">' +
            '<svg width="64" height="64" viewBox="0 0 24 24" fill="none" stroke="#C7C7C7" stroke-width="1.75" stroke-linecap="round"><path d="M3 5h3l2 12h11l2-9H7"/><circle cx="9" cy="21" r="1.5"/><circle cx="18" cy="21" r="1.5"/></svg>' +
            '<div style="font-family:var(--mg-font-headline);font-weight:700;font-size:14px;color:var(--mg-fg);margin-top:8px">Your cart is empty.</div>' +
            '<div style="font-size:13px;margin-top:6px">Browse our catalogue and add a product to get started.</div>' +
            '<a class="mg-btn mg-btn-primary" style="margin-top:24px" href="/collections/all">Shop catalogue</a>' +
          '</div>';
        if (this.foot) this.foot.hidden = true;
        if (this.shipBlock) this.shipBlock.hidden = true;
        return;
      }

      this.body.innerHTML = '';
      var self = this;
      cart.items.forEach(function (item) {
        var node = self.tpl.content.cloneNode(true);
        var thumb = $('[data-thumb]', node);
        if (item.image) {
          thumb.innerHTML = '<img src="' + item.image + '" alt="" style="width:100%;height:100%;object-fit:contain">';
        }
        $('[data-title]', node).textContent = item.product_title;
        $('[data-title]', node).setAttribute('href', item.url);
        $('[data-sku]', node).textContent =
          (item.sku ? item.sku : '') +
          (!item.product_has_only_default_variant && item.variant_title ? (item.sku ? ' · ' : '') + item.variant_title : '');
        $('[data-qty]', node).textContent = item.quantity;
        $('[data-price]', node).textContent = formatMoney(item.final_line_price);

        $('[data-dec]', node).addEventListener('click', function () { self.changeQty(item.key, item.quantity - 1); });
        $('[data-inc]', node).addEventListener('click', function () { self.changeQty(item.key, item.quantity + 1); });
        $('[data-remove]', node).addEventListener('click', function () { self.changeQty(item.key, 0); });

        self.body.appendChild(node);
      });

      if (this.subtotal) this.subtotal.textContent = formatMoney(cart.items_subtotal_price);
      var threshold = (strings.freeShipThreshold || 0) * 100; /* convert ₹ → paise */
      var freeShip = threshold > 0 && cart.items_subtotal_price >= threshold;
      if (this.shipping) this.shipping.textContent = freeShip ? 'FREE' : '₹250';
      if (this.total) this.total.textContent = formatMoney(cart.items_subtotal_price + (freeShip ? 0 : 25000));

      if (this.shipBlock) {
        this.shipBlock.hidden = threshold === 0;
        var pct = Math.min(100, (cart.items_subtotal_price / threshold) * 100);
        if (this.shipBar) this.shipBar.style.width = pct + '%';
        if (this.shipText) this.shipText.textContent = freeShip ? 'You unlocked Free Shipping! 🎉' : ('Add ' + formatMoney(threshold - cart.items_subtotal_price) + ' for free shipping');
        if (this.shipTotal) this.shipTotal.textContent = formatMoney(cart.items_subtotal_price);
      }

      if (this.foot) this.foot.hidden = false;
    },

    changeQty: function (key, qty) {
      var self = this;
      fetch(routes.cartChange, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'Accept': 'application/json' },
        body: JSON.stringify({ id: key, quantity: qty })
      })
        .then(function (r) { return r.json(); })
        .then(function (cart) {
          self.render(cart);
          self.bindCount(cart.item_count);
        })
        .catch(function () { toast('Could not update cart', false); });
    }
  };

  /* ─────────────────────────────────────────────────────────────────────
     SEARCH OVERLAY + PREDICTIVE SEARCH
     ───────────────────────────────────────────────────────────────────── */
  var Search = {
    overlay: null, panel: null, input: null, results: null,
    debounce: 0,

    init: function () {
      this.overlay = $('[data-search-overlay]');
      this.panel   = $('[data-search-panel]');
      this.input   = $('[data-search-input]');
      this.results = $('[data-search-results]');

      var self = this;
      $$('[data-toggle="search"]').forEach(function (el) { on(el, 'click', function (e) { e.preventDefault(); self.open(); }); });
      $$('[data-search-close]').forEach(function (el) { on(el, 'click', function () { self.close(); }); });
      $$('[data-search-suggest]').forEach(function (el) {
        on(el, 'click', function () {
          self.input.value = el.getAttribute('data-search-suggest');
          self.query();
        });
      });
      on(this.overlay, 'click', function (e) {
        if (e.target === self.overlay) self.close();
      });
      on(document, 'keydown', function (e) {
        if ((e.metaKey || e.ctrlKey) && e.key === 'k') { e.preventDefault(); self.open(); }
        if (e.key === 'Escape' && self.overlay && !self.overlay.hidden) self.close();
      });
      on(this.input, 'input', function () {
        clearTimeout(self.debounce);
        self.debounce = setTimeout(function () { self.query(); }, 220);
      });
    },

    open: function () {
      this.overlay.hidden = false;
      document.documentElement.style.overflow = 'hidden';
      setTimeout(function () { Search.input && Search.input.focus(); }, 60);
    },
    close: function () {
      this.overlay.hidden = true;
      document.documentElement.style.overflow = '';
    },

    query: function () {
      var q = (this.input.value || '').trim();
      var self = this;
      if (!q) { self.renderDefault(); return; }
      var url = (routes.predictiveSearch || '/search/suggest.json') +
        '?q=' + encodeURIComponent(q) +
        '&resources[type]=product,collection,page&resources[limit]=6&resources[options][unavailable_products]=last';
      fetch(url, { headers: { 'Accept': 'application/json' } })
        .then(function (r) { return r.json(); })
        .then(function (data) { self.renderResults(data.resources.results || {}); })
        .catch(function () { /* silent */ });
    },

    renderDefault: function () {
      /* Restore the "Popular" pills section that ships in the snippet */
      /* Easier: just reload — but that flickers. Just leave the existing markup alone. */
    },

    renderResults: function (r) {
      var html = '';
      var prods = r.products || [];
      var colls = r.collections || [];
      if (prods.length === 0 && colls.length === 0) {
        html = '<div class="mg-search-empty">No matches. Try a model number like MGH0648.</div>';
      } else {
        if (colls.length) {
          html += '<div class="mg-search-group"><h5>Collections</h5>';
          colls.forEach(function (c) {
            html +=
              '<a class="mg-search-result" href="' + c.url + '">' +
                '<div class="mg-search-result-thumb" style="background:var(--mg-iron-100)"></div>' +
                '<div class="mg-search-result-meta"><div class="mg-search-result-title">' + c.title + '</div></div>' +
                '<svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="#9A9A9A" stroke-width="1.75" stroke-linecap="round"><path d="M5 12h14m-6-7 7 7-7 7"/></svg>' +
              '</a>';
          });
          html += '</div>';
        }
        if (prods.length) {
          html += '<div class="mg-search-group"><h5>Products · ' + prods.length + ' result' + (prods.length === 1 ? '' : 's') + '</h5>';
          prods.forEach(function (p) {
            var img = p.image ? '<img src="' + p.image + '" alt="" style="max-width:80%;max-height:80%;object-fit:contain">' : '';
            var price = (p.price !== undefined) ? formatMoney(p.price) : '';
            html +=
              '<a class="mg-search-result" href="' + p.url + '">' +
                '<div class="mg-search-result-thumb" style="background:var(--mg-iron-100)">' + img + '</div>' +
                '<div class="mg-search-result-meta">' +
                  '<div class="mg-search-result-title">' + p.title + '</div>' +
                  (p.vendor ? '<div class="mg-search-result-sub">' + p.vendor + '</div>' : '') +
                '</div>' +
                '<div class="mg-search-result-price">' + price + '</div>' +
              '</a>';
          });
          html += '</div>';
        }
      }
      this.results.innerHTML = html;
    }
  };

  /* ─────────────────────────────────────────────────────────────────────
     MOBILE NAV
     ───────────────────────────────────────────────────────────────────── */
  var MobileNav = {
    nav: null, scrim: null,
    init: function () {
      this.nav = $('[data-mnav]'); this.scrim = $('[data-mnav-scrim]');
      var self = this;
      $$('[data-toggle="mobile-nav"]').forEach(function (el) { on(el, 'click', function () { self.open(); }); });
      $$('[data-mnav-close]').forEach(function (el) { on(el, 'click', function () { self.close(); }); });
      on(this.scrim, 'click', function () { self.close(); });
    },
    open:  function () { if (!this.nav) return; this.nav.hidden = false; this.scrim.hidden = false; document.documentElement.style.overflow = 'hidden'; },
    close: function () { if (!this.nav) return; this.nav.hidden = true;  this.scrim.hidden = true;  document.documentElement.style.overflow = ''; }
  };

  /* ─────────────────────────────────────────────────────────────────────
     MEGA MENU · hover to open panel matched by data-mega / data-mega-panel
     ───────────────────────────────────────────────────────────────────── */
  var Mega = {
    activePanel: null,
    init: function () {
      var triggers = $$('[data-mega]');
      var panels   = $$('[data-mega-panel]');
      var header   = $('.mg-header');
      if (!triggers.length || !panels.length) return;

      var self = this;
      triggers.forEach(function (t) {
        on(t, 'mouseenter', function () { self.show(t.getAttribute('data-mega')); });
        on(t, 'click', function (e) {
          e.preventDefault();
          var href = t.getAttribute('data-href');
          if (href) window.location.href = href;
        });
      });
      panels.forEach(function (p) {
        on(p, 'mouseenter', function () { self.show(p.getAttribute('data-mega-panel')); });
      });
      on(header, 'mouseleave', function () { self.hide(); });
    },
    show: function (key) {
      $$('[data-mega-panel]').forEach(function (p) {
        var match = p.getAttribute('data-mega-panel') === key;
        p.hidden = !match;
        if (match) this.activePanel = p;
      }.bind(this));
    },
    hide: function () { $$('[data-mega-panel]').forEach(function (p) { p.hidden = true; }); this.activePanel = null; }
  };

  /* ─────────────────────────────────────────────────────────────────────
     PDP · variant selector, qty stepper, spec tabs
     ───────────────────────────────────────────────────────────────────── */
  var PDP = {
    init: function () {
      this.variants();
      this.qty();
      this.tabs();
      this.thumbs();
    },

    variants: function () {
      var form = $('form[data-add-to-cart]');
      if (!form) return;
      var variantInput = form.querySelector('[data-variant-id]');
      if (!variantInput) return;

      var groups = {};
      $$('.mg-variant-opt', form).forEach(function (btn) {
        var idx = parseInt(btn.getAttribute('data-option-index'), 10);
        var val = btn.getAttribute('data-option-value');
        if (!idx || !val) return;
        groups[idx] = groups[idx] || [];
        groups[idx].push({ btn: btn, value: val });
        on(btn, 'click', function () {
          /* Single-select per group */
          $$('.mg-variant-opt[data-option-index="' + idx + '"]', form).forEach(function (sib) { sib.classList.remove('active'); });
          btn.classList.add('active');
          var sel = form.querySelector('[data-selected-' + idx + ']');
          if (sel) sel.textContent = val;
          PDP.updateVariant(form);
        });
      });
    },

    updateVariant: function (form) {
      /* Read product JSON embedded via metafield is more reliable but
         requires schema work. Simpler: parse the selected option values
         and match against window.__mgProduct if present, else accept the
         currently selected ID (Shopify ignores 'options[]' in /cart/add). */
      var values = $$('.mg-variant-opt.active', form).map(function (b) { return b.getAttribute('data-option-value'); });
      var prod = window.__mgProduct;
      if (!prod || !prod.variants) return;
      var match = prod.variants.find(function (v) {
        return v.options.every(function (opt, i) { return opt === values[i]; });
      });
      if (!match) return;
      var variantInput = form.querySelector('[data-variant-id]');
      if (variantInput) variantInput.value = match.id;
      /* Update price + ATC label */
      var lineTotal = form.querySelector('[data-line-total]');
      var qty = parseInt(form.querySelector('[data-qty-input]').value || 1, 10);
      if (lineTotal) lineTotal.textContent = formatMoney(match.price * qty);
      var submitBtn = form.querySelector('button[type="submit"]:not([name="checkout"])');
      if (submitBtn) submitBtn.disabled = !match.available;
    },

    qty: function () {
      var form = $('form[data-add-to-cart]');
      if (!form) return;
      var dec = form.querySelector('[data-qty-dec]');
      var inc = form.querySelector('[data-qty-inc]');
      var disp = form.querySelector('[data-qty]');
      var hidden = form.querySelector('[data-qty-input]');
      if (!disp || !hidden) return;
      function set(n) {
        n = Math.max(1, Math.min(99, n));
        disp.textContent = n; hidden.value = n;
        PDP.updateVariant(form);
      }
      on(dec, 'click', function () { set(parseInt(disp.textContent, 10) - 1); });
      on(inc, 'click', function () { set(parseInt(disp.textContent, 10) + 1); });
    },

    tabs: function () {
      var tabs = $('[data-tabs]');
      if (!tabs) return;
      var btns = $$('button[data-tab]', tabs);
      btns.forEach(function (btn) {
        on(btn, 'click', function () {
          var key = btn.getAttribute('data-tab');
          btns.forEach(function (b) { b.classList.toggle('active', b === btn); });
          $$('[data-panel]').forEach(function (p) {
            p.hidden = p.getAttribute('data-panel') !== key;
          });
        });
      });
    },

    thumbs: function () {
      var gallery = $('[data-gallery]');
      if (!gallery || gallery._mgGalleryBound) return;
      gallery._mgGalleryBound = true;
      var imgs = $$('img', gallery);
      // Crossfade setup: stack all images, fade the active one in.
      imgs.forEach(function (im, j) { im.hidden = false; im.classList.toggle('is-active', j === 0); });

      function show(i) {
        $$('.mg-pdp-thumb').forEach(function (x, k) { x.classList.toggle('active', k === i); });
        imgs.forEach(function (im, j) { im.classList.toggle('is-active', j === i); });
      }
      $$('.mg-pdp-thumb').forEach(function (t, i) { on(t, 'click', function () { show(i); }); });

      // Click-to-zoom lightbox (Apple-style) — built once, reused.
      var lb = $('[data-mg-lightbox]');
      if (!lb) {
        lb = document.createElement('div');
        lb.className = 'mg-lightbox';
        lb.setAttribute('data-mg-lightbox', '');
        lb.setAttribute('aria-hidden', 'true');
        lb.innerHTML = '<button class="mg-lightbox-close" aria-label="Close">\u00d7</button>' +
                       '<button class="mg-lightbox-nav prev" aria-label="Previous">\u2039</button>' +
                       '<img alt="">' +
                       '<button class="mg-lightbox-nav next" aria-label="Next">\u203a</button>';
        document.body.appendChild(lb);
      }
      var lbImg = $('img', lb);
      var current = 0;
      function activeIndex() { for (var j = 0; j < imgs.length; j++) { if (imgs[j].classList.contains('is-active')) return j; } return 0; }
      function openLb(i) {
        current = i;
        lbImg.src = imgs[i].src;
        lb.classList.add('in');
        lb.setAttribute('aria-hidden', 'false');
        document.body.style.overflow = 'hidden';
      }
      function closeLb() {
        lb.classList.remove('in');
        lb.setAttribute('aria-hidden', 'true');
        document.body.style.overflow = '';
      }
      function stepLb(d) {
        current = (current + d + imgs.length) % imgs.length;
        lbImg.src = imgs[current].src;
        show(current);
      }
      var main = $('.mg-pdp-main', gallery) || gallery;
      on(main, 'click', function (e) { if (e.target.tagName === 'IMG') openLb(activeIndex()); });
      on($('.mg-lightbox-close', lb), 'click', closeLb);
      on($('.mg-lightbox-nav.prev', lb), 'click', function (e) { e.stopPropagation(); stepLb(-1); });
      on($('.mg-lightbox-nav.next', lb), 'click', function (e) { e.stopPropagation(); stepLb(1); });
      on(lb, 'click', function (e) { if (e.target === lb) closeLb(); });
      on(document, 'keydown', function (e) {
        if (!lb.classList.contains('in')) return;
        if (e.key === 'Escape') closeLb();
        else if (e.key === 'ArrowLeft') stepLb(-1);
        else if (e.key === 'ArrowRight') stepLb(1);
      });
    }
  };

  /* ─────────────────────────────────────────────────────────────────────
     THEME TOGGLE (header button · cycles data-theme attribute)
     ───────────────────────────────────────────────────────────────────── */
  var ThemeToggle = {
    init: function () {
      var saved = localStorage.getItem('mgTheme');
      if (saved) document.body.dataset.theme = saved;
      $$('[data-toggle="theme"]').forEach(function (btn) {
        on(btn, 'click', function () {
          var next = document.body.dataset.theme === 'dark' ? 'light' : 'dark';
          document.body.dataset.theme = next;
          localStorage.setItem('mgTheme', next);
        });
      });
    }
  };

  /* ─────────────────────────────────────────────────────────────────────
     SCROLL REVEALS + COUNT-UP (Apple-style entrance animations · site-wide)
     Additive & passive — never hijacks scroll, so it can't affect the
     scroll-story video scrubbing. Honours prefers-reduced-motion.
     ───────────────────────────────────────────────────────────────────── */
  var Reveal = {
    booted: false,
    init: function () {
      if (this.booted) { this.scan(); return; }
      this.booted = true;
      var reduce = window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches;
      var noIO = !('IntersectionObserver' in window);
      if (reduce || noIO) {
        $$('[data-reveal], .mg-reveal').forEach(function (el) { el.classList.add('in'); });
        $$('[data-countup]').forEach(function (el) { el.textContent = el.getAttribute('data-countup'); });
        return;
      }
      var self = this;
      this.io = new IntersectionObserver(function (entries) {
        entries.forEach(function (e) {
          if (!e.isIntersecting) return;
          var el = e.target;
          el.classList.add('in');
          if (el.hasAttribute('data-countup')) self.count(el);
          self.io.unobserve(el);
        });
      }, { threshold: 0.12, rootMargin: '0px 0px -8% 0px' });
      this.scan();
    },
    scan: function () {
      if (!this.io) return;
      var io = this.io;
      $$('[data-reveal]:not(.in), .mg-reveal:not(.in)').forEach(function (el) { io.observe(el); });
      // Stagger children of any [data-reveal-group]
      $$('[data-reveal-group]').forEach(function (group) {
        if (group._staggered) return;
        group._staggered = true;
        var step = parseInt(group.getAttribute('data-reveal-group'), 10) || 70;
        Array.prototype.forEach.call(group.children, function (child, i) {
          if (!child.hasAttribute('data-reveal')) child.setAttribute('data-reveal', 'up');
          child.style.transitionDelay = (i * step) + 'ms';
          io.observe(child);
        });
      });
      $$('[data-countup]:not(.in)').forEach(function (el) { io.observe(el); });
    },
    count: function (el) {
      var raw = el.getAttribute('data-countup');
      var target = parseFloat(String(raw).replace(/[^0-9.]/g, ''));
      if (isNaN(target)) { el.textContent = raw; return; }
      var prefix = (String(raw).match(/^[^0-9.]+/) || [''])[0];
      var suffix = (String(raw).match(/[^0-9.]+$/) || [''])[0];
      var decimals = (String(raw).split('.')[1] || '').replace(/[^0-9]/g, '').length;
      var dur = 1400, start = null;
      function frame(ts) {
        if (!start) start = ts;
        var p = Math.min((ts - start) / dur, 1);
        var eased = 1 - Math.pow(1 - p, 3);
        var val = (target * eased).toFixed(decimals);
        el.textContent = prefix + Number(val).toLocaleString('en-IN') + suffix;
        if (p < 1) requestAnimationFrame(frame);
        else el.textContent = prefix + target.toLocaleString('en-IN') + suffix;
      }
      requestAnimationFrame(frame);
    }
  };

  /* ─────────────────────────────────────────────────────────────────────
     BOOT
     ───────────────────────────────────────────────────────────────────── */
  var QuickView = {
    booted: false,
    init: function () {
      this.modal = $('[data-qv]');
      this.scrim = $('[data-qv-scrim]');
      this.inner = $('[data-qv-inner]');
      if (!this.modal || this.booted) return;
      this.booted = true;
      var self = this;
      document.addEventListener('click', function (e) {
        var t = e.target.closest && e.target.closest('[data-quickview]');
        if (!t) return;
        e.preventDefault(); e.stopPropagation();
        self.open(t.getAttribute('data-quickview'));
      });
      on(this.scrim, 'click', function () { self.close(); });
      $$('[data-qv-close]').forEach(function (b) { on(b, 'click', function () { self.close(); }); });
      on(document, 'keydown', function (e) { if (e.key === 'Escape' && self.modal && !self.modal.hidden) self.close(); });
    },
    open: function (url) {
      var self = this;
      this.modal.hidden = false; this.scrim.hidden = false;
      this.modal.setAttribute('aria-hidden', 'false');
      document.documentElement.style.overflow = 'hidden';
      this.inner.innerHTML = '<div class="mg-qv-loading"><span class="mg-qv-spinner"></span><span>Loading…</span></div>';
      fetch(url + '.js', { headers: { 'Accept': 'application/json' } })
        .then(function (r) { return r.json(); })
        .then(function (p) { self.render(p, url); })
        .catch(function () { self.inner.innerHTML = '<div class="mg-qv-loading">Could not load. <a href="' + url + '">Open product page →</a></div>'; });
    },
    close: function () {
      this.modal.hidden = true; this.scrim.hidden = true;
      this.modal.setAttribute('aria-hidden', 'true');
      document.documentElement.style.overflow = '';
    },
    render: function (p, url) {
      var self = this;
      var img = (p.media && p.media[0] && p.media[0].preview_image && p.media[0].preview_image.src) || p.featured_image || '';
      var onSale = p.compare_at_price > p.price;
      function priceBlock(price, cmp) {
        var sale = cmp > price;
        return '<span class="mg-qv-now">' + formatMoney(price) + '</span>' + (sale ? ' <span class="mg-qv-was">' + formatMoney(cmp) + '</span>' : '');
      }
      var optionsHtml = '';
      if (!(p.variants.length === 1 && p.variants[0].title === 'Default Title')) {
        (p.options || []).forEach(function (optName, oi) {
          var values = [];
          p.variants.forEach(function (v) { var val = v.options[oi]; if (values.indexOf(val) === -1) values.push(val); });
          optionsHtml += '<div class="mg-qv-optgroup" data-opt-index="' + oi + '"><h4>' + optName + '</h4><div class="mg-qv-opts">' +
            values.map(function (val) { return '<button type="button" class="mg-qv-opt" data-opt-value="' + String(val).replace(/"/g, '&quot;') + '">' + val + '</button>'; }).join('') +
            '</div></div>';
        });
      }
      var firstAvail = p.variants.filter(function (v) { return v.available; })[0] || p.variants[0];
      this.inner.innerHTML =
        '<div class="mg-qv-media">' + (img ? '<img src="' + img + '" alt="' + String(p.title || '').replace(/"/g, '&quot;') + '">' : '') +
          (onSale ? '<span class="mg-qv-badge">Sale</span>' : '') + '</div>' +
        '<div class="mg-qv-info">' +
          (p.type ? '<div class="mg-eyebrow">' + p.type + '</div>' : '') +
          '<h2 class="mg-qv-title">' + p.title + '</h2>' +
          '<div class="mg-qv-price" data-qv-price>' + priceBlock(p.price, p.compare_at_price) + '</div>' +
          '<div class="mg-qv-desc">' + (p.description ? p.description.replace(/<[^>]+>/g, ' ').slice(0, 220).trim() + '…' : '') + '</div>' +
          optionsHtml +
          '<form data-qv-form><input type="hidden" name="id" value="' + firstAvail.id + '" data-qv-id>' +
            '<input type="hidden" name="quantity" value="1">' +
            '<div class="mg-qv-actions">' +
              '<button class="mg-btn mg-btn-primary" type="submit" data-qv-add' + (firstAvail.available ? '' : ' disabled') + '>' +
                (firstAvail.available ? 'Add to cart' : 'Out of stock') + '</button>' +
              '<a class="mg-btn mg-btn-ghost" href="' + url + '">Full details</a>' +
            '</div></form>' +
        '</div>';

      var chosen = firstAvail.options.slice();
      $$('.mg-qv-optgroup', this.inner).forEach(function (g) {
        var oi = parseInt(g.getAttribute('data-opt-index'), 10);
        $$('.mg-qv-opt', g).forEach(function (b) {
          if (b.getAttribute('data-opt-value') === chosen[oi]) b.classList.add('active');
          on(b, 'click', function () {
            $$('.mg-qv-opt', g).forEach(function (x) { x.classList.remove('active'); });
            b.classList.add('active');
            chosen[oi] = b.getAttribute('data-opt-value');
            self.matchVariant(p, chosen);
          });
        });
      });

      var form = $('[data-qv-form]', this.inner);
      on(form, 'submit', function (e) {
        e.preventDefault();
        if (window.MG && window.MG.Cart) { window.MG.Cart.add(form); self.close(); }
      });
    },
    matchVariant: function (p, chosen) {
      var match = p.variants.filter(function (v) { return v.options.every(function (o, i) { return o === chosen[i]; }); })[0];
      var idInput = $('[data-qv-id]', this.inner);
      var priceEl = $('[data-qv-price]', this.inner);
      var addBtn = $('[data-qv-add]', this.inner);
      if (!match) { if (addBtn) { addBtn.disabled = true; addBtn.textContent = 'Unavailable'; } return; }
      if (idInput) idInput.value = match.id;
      if (priceEl) {
        var sale = match.compare_at_price > match.price;
        priceEl.innerHTML = '<span class="mg-qv-now">' + formatMoney(match.price) + '</span>' + (sale ? ' <span class="mg-qv-was">' + formatMoney(match.compare_at_price) + '</span>' : '');
      }
      if (addBtn) { addBtn.disabled = !match.available; addBtn.textContent = match.available ? 'Add to cart' : 'Out of stock'; }
    }
  };

  var QuoteForm = {
    booted: false,
    init: function () {
      this.modal = $('[data-quote-modal]');
      this.scrim = $('[data-quote-scrim]');
      if (!this.modal || this.booted) return;
      this.booted = true;
      var self = this;
      document.addEventListener('click', function (e) {
        var t = e.target.closest && e.target.closest('[data-quote], a[href$="#quote"], a[href="/pages/quote"]');
        if (!t) return;
        e.preventDefault();
        self.open();
      });
      on(this.scrim, 'click', function () { self.close(); });
      $$('[data-quote-close]').forEach(function (b) { on(b, 'click', function () { self.close(); }); });
      on(document, 'keydown', function (e) { if (e.key === 'Escape' && self.modal && !self.modal.hidden) self.close(); });

      var form = $('[data-quote-form]');
      if (form) {
        on(form, 'submit', function (e) {
          var endpoint = (window.theme && theme.leadEndpoint) || '';
          // No CRM endpoint configured -> let the native Shopify contact form submit normally.
          if (!endpoint) return;
          e.preventDefault();
          self.submitToCrm(form, endpoint);
        });
      }
    },
    open: function () {
      this.modal.hidden = false; this.scrim.hidden = false;
      this.modal.setAttribute('aria-hidden', 'false');
      document.documentElement.style.overflow = 'hidden';
      var f = this.modal.querySelector('input, select, textarea'); if (f) setTimeout(function(){ f.focus(); }, 80);
    },
    close: function () {
      this.modal.hidden = true; this.scrim.hidden = true;
      this.modal.setAttribute('aria-hidden', 'true');
      document.documentElement.style.overflow = '';
    },
    val: function (form, name) { var el = form.querySelector('[name="' + name + '"]'); return el ? el.value.trim() : ''; },
    submitToCrm: function (form, endpoint) {
      var self = this;
      var status = form.querySelector('[data-quote-status]');
      var btn = form.querySelector('[data-quote-submit]');
      var payload = {
        name: this.val(form, 'contact[name]'),
        phone: this.val(form, 'contact[phone]'),
        email: this.val(form, 'contact[email]'),
        state: this.val(form, 'contact[state]'),
        requirement: this.val(form, 'contact[requirement]'),
        source: 'website'
      };
      if (!payload.name || !payload.phone || !payload.email || !payload.state || !payload.requirement) {
        if (status) { status.hidden = false; status.className = 'mg-quote-status err'; status.textContent = 'Please fill in all fields.'; }
        return;
      }
      var origHtml = btn ? btn.innerHTML : '';
      if (btn) { btn.disabled = true; btn.textContent = 'Sending…'; }
      if (status) status.hidden = true;
      var headers = { 'Content-Type': 'application/json', 'Accept': 'application/json' };
      if (window.theme && theme.leadApiKey) headers['x-api-key'] = theme.leadApiKey;
      fetch(endpoint, { method: 'POST', headers: headers, body: JSON.stringify(payload) })
        .then(function (r) { if (!r.ok) throw new Error('bad status ' + r.status); return r.json().catch(function(){ return {}; }); })
        .then(function () {
          if (status) { status.hidden = false; status.className = 'mg-quote-status ok'; status.textContent = 'Thank you! Your request is in — our team will reach out within 24 hours.'; }
          form.reset();
        })
        .catch(function () {
          // CRM failed — fall back to the native Shopify contact form so the lead is never lost.
          if (status) { status.hidden = false; status.className = 'mg-quote-status'; status.textContent = 'Submitting…'; }
          HTMLFormElement.prototype.submit.call(form);
        })
        .finally(function () { if (btn) { btn.disabled = false; btn.innerHTML = origHtml; } });
    }
  };

  var Magnetic = {
    booted: false,
    init: function () {
      if (this.booted) return;
      var fine = window.matchMedia && window.matchMedia('(hover: hover) and (pointer: fine)').matches;
      var reduce = window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches;
      if (!fine || reduce) return;
      this.booted = true;
      var strength = 0.32, max = 8;
      document.addEventListener('pointermove', function (e) {
        var btn = e.target.closest && e.target.closest('.mg-btn, [data-magnetic]');
        if (!btn) return;
        var r = btn.getBoundingClientRect();
        var dx = e.clientX - (r.left + r.width / 2);
        var dy = e.clientY - (r.top + r.height / 2);
        var tx = Math.max(-max, Math.min(max, dx * strength));
        var ty = Math.max(-max, Math.min(max, dy * strength));
        btn.style.transform = 'translate(' + tx + 'px,' + ty + 'px)';
      });
      document.addEventListener('pointerout', function (e) {
        var btn = e.target.closest && e.target.closest('.mg-btn, [data-magnetic]');
        if (btn) btn.style.transform = '';
      });
    }
  };

  function boot() {
    Cart.init();
    Search.init();
    MobileNav.init();
    Mega.init();
    PDP.init();
    ThemeToggle.init();
    Reveal.init();
    Magnetic.init();
    QuickView.init();
    QuoteForm.init();
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', boot);
  } else {
    boot();
  }

  /* Theme editor re-binds */
  document.addEventListener('shopify:section:load',   boot);
  document.addEventListener('shopify:section:unload', boot);

  /* Expose for sections that need to ping it */
  window.MG = { Cart: Cart, Search: Search, toast: toast, formatMoney: formatMoney, Reveal: Reveal, Magnetic: Magnetic, QuickView: QuickView, QuoteForm: QuoteForm };
})();
