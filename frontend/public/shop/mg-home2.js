/* ════════════════════════════════════════════════════════════
   MuscleGrid · Home 2 — total rebuild
   RULE: zero scroll listeners. IntersectionObserver + CSS only.
   ════════════════════════════════════════════════════════════ */
(function () {
  'use strict';
  var reduce = matchMedia('(prefers-reduced-motion: reduce)').matches;
  var root = document.querySelector('[data-mh]');
  if (!root) return;

  /* reveals — play once, always to completion */
  var rv = [].slice.call(root.querySelectorAll('[data-rv]'));
  if ('IntersectionObserver' in window && !reduce) {
    var io = new IntersectionObserver(function (es) {
      es.forEach(function (e) {
        if (e.isIntersecting) { e.target.classList.add('in'); io.unobserve(e.target); }
      });
    }, { threshold: .18 });
    rv.forEach(function (el) { io.observe(el); });
  } else rv.forEach(function (el) { el.classList.add('in'); });

  /* count-up stats — time-based, triggered once */
  function countUp(el) {
    var target = parseFloat(el.getAttribute('data-count'));
    if (reduce || !isFinite(target)) {
      el.firstChild.nodeValue = (target || 0).toLocaleString('en-IN'); return;
    }
    var t0 = null;
    function fr(ts) {
      if (!t0) t0 = ts;
      var p = Math.min(1, (ts - t0) / 1500);
      var e = 1 - Math.pow(1 - p, 3);
      el.firstChild.nodeValue = Math.round(target * e).toLocaleString('en-IN');
      if (p < 1) requestAnimationFrame(fr);
    }
    requestAnimationFrame(fr);
  }
  var counts = [].slice.call(root.querySelectorAll('[data-count]'));
  if ('IntersectionObserver' in window) {
    var cio = new IntersectionObserver(function (es) {
      es.forEach(function (e) {
        if (e.isIntersecting) { countUp(e.target); cio.unobserve(e.target); }
      });
    }, { threshold: .5 });
    counts.forEach(function (el) { cio.observe(el); });
  } else counts.forEach(countUp);

  /* embers — randomize positions/durations once (no per-frame JS) */
  var embers = [].slice.call(root.querySelectorAll('.mh-embers i'));
  embers.forEach(function (el) {
    el.style.left = (Math.random() * 100).toFixed(1) + '%';
    el.style.animationDuration = (7 + Math.random() * 9).toFixed(1) + 's';
    el.style.animationDelay = (-Math.random() * 14).toFixed(1) + 's';
  });

  /* video: pause when offscreen (battery), resume in view */
  var vid = root.querySelector('.mh-video video');
  if (vid && 'IntersectionObserver' in window && !reduce) {
    new IntersectionObserver(function (es) {
      es.forEach(function (e) {
        if (e.isIntersecting) { var p = vid.play(); if (p && p.catch) p.catch(function(){}); }
        else vid.pause();
      });
    }, { threshold: .15 }).observe(vid);
  }
})();


/* ════ GENESIS · self-playing particle cinema (time-based; starts in view) ════ */
(function () {
  'use strict';
  var sec = document.querySelector('[data-gx]');
  var cv = document.querySelector('[data-gx-canvas]');
  if (!sec || !cv) return;
  var reduce = matchMedia('(prefers-reduced-motion: reduce)').matches;
  if (reduce) {
    [].slice.call(sec.querySelectorAll('.gx-phase')).forEach(function (p) {
      p.style.opacity = 1; p.style.visibility = 'visible';
    });
    return;
  }
  var clamp01 = function (v) { return Math.min(1, Math.max(0, v)); };
  function win(p, a, b) { return clamp01((p - a) / (b - a)); }
  var TAU = Math.PI * 2;
  var ctx = cv.getContext('2d');
  var dpr = Math.min(devicePixelRatio || 1, 2);
  var W = 0, H = 0, CX = 0, CY = 0, R = 0;
  var MOB = matchMedia('(max-width:760px)').matches;
  var N = MOB ? 1300 : 2400;
  var ps = [], textPts = [];

  function chaosT(rnd) { var a = rnd[0]*TAU, r = Math.sqrt(rnd[1])*Math.max(W,H)*.75;
    return [CX+Math.cos(a)*r, CY+Math.sin(a)*r]; }
  function coreT(rnd) { var a = rnd[0]*TAU, r = (rnd[1]+rnd[2])*.5; r = r*r*R*.34;
    return [CX+Math.cos(a)*r, CY+Math.sin(a)*r*.92]; }
  function gridT(rnd) {
    if (rnd[2] < .55) { var sp = Math.floor(rnd[0]*12)/12*TAU + TAU/24, d = (.12+rnd[1]*.88)*R;
      return [CX+Math.cos(sp)*d, CY+Math.sin(sp)*d]; }
    var ring = [.38,.66,.94][Math.floor(rnd[0]*3)]*R, a2 = rnd[1]*TAU;
    return [CX+Math.cos(a2)*ring, CY+Math.sin(a2)*ring];
  }
  function buildText() {
    var oc = document.createElement('canvas'); var s = MOB ? 3 : 4;
    oc.width = W; oc.height = H;
    var ox = oc.getContext('2d');
    ox.fillStyle = '#fff';
    var fs = Math.min(W*.155, H*.26);
    ox.font = '800 ' + fs + 'px "Saira Condensed", sans-serif';
    ox.textAlign = 'center'; ox.textBaseline = 'middle';
    ox.fillText('MUSCLEGRID', W/2, H*.42);
    var d = ox.getImageData(0, 0, W, H).data;
    textPts = [];
    for (var y = 0; y < H; y += s) for (var x = 0; x < W; x += s)
      if (d[(y*W+x)*4+3] > 128) textPts.push([x, y]);
  }
  function build() {
    var b = cv.getBoundingClientRect();
    W = Math.round(b.width); H = Math.round(b.height);
    if (!W || !H) return;
    cv.width = W*dpr; cv.height = H*dpr;
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    CX = W/2; CY = H*.46; R = Math.min(W, H)*.42;
    buildText();
    ps = [];
    for (var i = 0; i < N; i++) {
      var rnd = [Math.random(), Math.random(), Math.random(), Math.random()];
      ps.push({ chaos: chaosT(rnd), core: coreT(rnd), grid: gridT(rnd),
        text: textPts.length ? textPts[i % textPts.length] : [CX, CY],
        size: .6 + rnd[3]*1.6, warm: rnd[2] < .72, ph: rnd[0]*TAU, speed: .4 + rnd[1]*.9 });
    }
  }
  function ease(u){ return u < .5 ? 2*u*u : 1 - Math.pow(-2*u+2, 2)/2; }
  /* CONTINUOUS LOOP — no steps, no end state, nothing to sync.
     chaos→core→grid→MUSCLEGRID→hold→dissolve→repeat */
  function timeline(t) {
    t = t % 19;
    if (t < 3)    return ease(t/3)*.3;
    if (t < 4.2)  return .3;
    if (t < 7.2)  return .3 + ease((t-4.2)/3)*.32;
    if (t < 8.4)  return .62;
    if (t < 11.4) return .62 + ease((t-8.4)/3)*.33;
    if (t < 16.5) return .95;
    return .95*(1 - ease((t-16.5)/2.5));
  }
  function lerp(a, b, t) { return a + (b - a)*t; }
  function pulses(t, alpha) {
    if (alpha <= 0) return;
    ctx.globalAlpha = alpha;
    for (var k = 0; k < 12; k++) {
      var a = k/12*TAU + TAU/24, d = ((t*.25 + k*.083) % 1)*R;
      var x = CX + Math.cos(a)*d, y = CY + Math.sin(a)*d;
      var g = ctx.createRadialGradient(x, y, 0, x, y, 14);
      g.addColorStop(0, 'rgba(255,240,200,.9)');
      g.addColorStop(.4, 'rgba(245,130,32,.5)');
      g.addColorStop(1, 'rgba(245,130,32,0)');
      ctx.fillStyle = g; ctx.beginPath(); ctx.arc(x, y, 14, 0, TAU); ctx.fill();
    }
    ctx.globalAlpha = 1;
  }
  var p1 = sec.querySelector('[data-gxp="1"]'), p2 = sec.querySelector('[data-gxp="2"]'),
      p3 = sec.querySelector('[data-gxp="3"]'),
      dots = [].slice.call(sec.querySelectorAll('[data-gxd]'));
  function dom(p) {
    var o1 = win(p, .04, .12)*(1 - win(p, .26, .36));
    p1.style.opacity = o1.toFixed(3);
    p1.style.transform = 'translateY(' + ((1-o1)*22).toFixed(1) + 'px)';
    p1.style.visibility = o1 <= 0 ? 'hidden' : 'visible';
    var o2 = win(p, .4, .5)*(1 - win(p, .6, .7));
    p2.style.opacity = o2.toFixed(3);
    p2.style.transform = 'translateY(' + ((1-o2)*22).toFixed(1) + 'px)';
    p2.style.visibility = o2 <= 0 ? 'hidden' : 'visible';
    var o3 = win(p, .82, .94);
    p3.style.opacity = o3.toFixed(3);
    p3.style.transform = 'translateY(' + ((1-o3)*28).toFixed(1) + 'px)';
    p3.style.visibility = o3 <= 0 ? 'hidden' : 'visible';
    var ph = p < .34 ? 0 : p < .66 ? 1 : 2;
    for (var k = 0; k < dots.length; k++) dots[k].classList.toggle('on', k === ph);
  }
  var started = false, t0 = 0, visible = false;
  function render(now) {
    if (!visible) { requestAnimationFrame(render); return; }
    var t = (now - t0)/1000;
    var prog = timeline(t);
    var toCore = win(prog, 0, .26), toGrid = win(prog, .34, .58), toText = win(prog, .66, .88);
    ctx.clearRect(0, 0, W, H);
    ctx.globalCompositeOperation = 'lighter';
    var coreA = toCore*(1 - toGrid*.85)*(1 - toText);
    if (coreA > .01) {
      var cr = R*(.3 + .06*Math.sin(t*2))*(1 + toGrid*.4);
      var g = ctx.createRadialGradient(CX, CY, 0, CX, CY, cr);
      g.addColorStop(0, 'rgba(255,225,160,' + (.5*coreA) + ')');
      g.addColorStop(.35, 'rgba(245,130,32,' + (.32*coreA) + ')');
      g.addColorStop(1, 'rgba(245,130,32,0)');
      ctx.fillStyle = g; ctx.beginPath(); ctx.arc(CX, CY, cr, 0, TAU); ctx.fill();
    }
    var gridA = toGrid*(1 - toText);
    if (gridA > .01) {
      ctx.strokeStyle = 'rgba(245,130,32,' + (.16*gridA) + ')'; ctx.lineWidth = 1;
      for (var k = 0; k < 12; k++) {
        var a = k/12*TAU + TAU/24;
        ctx.beginPath(); ctx.moveTo(CX, CY); ctx.lineTo(CX+Math.cos(a)*R, CY+Math.sin(a)*R); ctx.stroke();
      }
      for (var q = 0; q < 3; q++) {
        ctx.beginPath(); ctx.arc(CX, CY, [.38,.66,.94][q]*R, 0, TAU);
        ctx.strokeStyle = 'rgba(244,197,24,' + (.10*gridA) + ')'; ctx.stroke();
      }
      pulses(t, gridA);
    }
    for (var i = 0; i < ps.length; i++) {
      var p = ps[i];
      var x = p.chaos[0], y = p.chaos[1];
      x = lerp(x, p.core[0], toCore); y = lerp(y, p.core[1], toCore);
      x = lerp(x, p.grid[0], toGrid); y = lerp(y, p.grid[1], toGrid);
      x = lerp(x, p.text[0], toText); y = lerp(y, p.text[1], toText);
      var drift = (1 - toText)*(3 + (1 - toGrid)*9);
      x += Math.cos(t*p.speed + p.ph)*drift;
      y += Math.sin(t*p.speed*1.2 + p.ph)*drift;
      var alpha = .25 + .45*Math.abs(Math.sin(t*p.speed + p.ph));
      alpha = lerp(alpha, .85, toText);
      ctx.fillStyle = (p.warm ? 'rgba(245,150,50,' : 'rgba(255,235,200,') + alpha.toFixed(3) + ')';
      var sz = p.size*(1 - toText*.35);
      ctx.fillRect(x - sz/2, y - sz/2, sz, sz);
    }
    ctx.globalCompositeOperation = 'source-over';
    dom(prog);
    requestAnimationFrame(render);
  }
  function boot() {
    build();
    if ('IntersectionObserver' in window) {
      new IntersectionObserver(function (es) {
        es.forEach(function (e) {
          if (e.isIntersecting) {
            if (!started) { started = true; t0 = performance.now(); }
            visible = true;
          } else visible = false;
        });
      }, { threshold: .25 }).observe(sec);
    } else { started = true; t0 = performance.now(); visible = true; }
    requestAnimationFrame(render);
  }
  if (document.fonts && document.fonts.ready) {
    document.fonts.load('800 80px "Saira Condensed"').then(function () {
      document.fonts.ready.then(boot);
    }).catch(boot);
  } else boot();
  addEventListener('resize', build);
})();


/* ════ ENERGY RIVER · flowing current behind bestsellers ════ */
(function () {
  'use strict';
  var cv = document.querySelector('[data-mh-river]');
  if (!cv) return;
  var reduce = matchMedia('(prefers-reduced-motion: reduce)').matches;
  if (reduce) return;
  var ctx = cv.getContext('2d');
  var dpr = Math.min(devicePixelRatio || 1, 2);
  var W = 0, H = 0, streams = [], sparks = [];
  var MOB = matchMedia('(max-width:760px)').matches;
  var TAU = Math.PI * 2;
  function build() {
    var b = cv.getBoundingClientRect();
    W = Math.round(b.width); H = Math.round(b.height);
    if (!W || !H) return;
    cv.width = W*dpr; cv.height = H*dpr;
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    streams = [];
    var n = MOB ? 4 : 7;
    for (var i = 0; i < n; i++) {
      streams.push({ y: H*(.08 + .84*i/(n-1)),
        a1: 16 + Math.random()*30, k1: .0016 + Math.random()*.0016, p1: Math.random()*TAU,
        a2: 8 + Math.random()*16,  k2: .005 + Math.random()*.004,  p2: Math.random()*TAU,
        a3: 18 + Math.random()*26, p3: Math.random()*TAU,          /* slow vertical wander */
        sp: .25 + Math.random()*.45, sp2: .4 + Math.random()*.6,
        packets: 1 + Math.floor(Math.random()*2), off: Math.random() });
    }
    sparks = [];
    var m = MOB ? 16 : 34;
    for (var j = 0; j < m; j++)
      sparks.push({ x: Math.random()*W, y: Math.random()*H, tw: Math.random()*TAU, sp: .5 + Math.random()*1.2,
        r: .6 + Math.random()*1.4 });
  }
  /* wind path: two overlapping waves + slow vertical wander = organic gusts */
  function yOn(s, x, t) {
    return s.y
      + Math.sin(x*s.k1 + s.p1 + t*s.sp) * s.a1
      + Math.sin(x*s.k2 - s.p2 - t*s.sp2) * s.a2 * Math.sin(t*.31 + s.p1 + x*.0008)
      + Math.sin(t*.17 + s.p3) * s.a3;
  }
  var visible = false;
  function render(nowMs) {
    if (!visible) { requestAnimationFrame(render); return; }
    var t = nowMs/1000;
    ctx.clearRect(0, 0, W, H);
    ctx.globalCompositeOperation = 'lighter';
    for (var i = 0; i < streams.length; i++) {
      var s = streams[i];
      /* wind line — fades in/out at edges like a gust */
      ctx.beginPath();
      for (var x = 0; x <= W; x += 10) {
        var y = yOn(s, x, t);
        x === 0 ? ctx.moveTo(x, y) : ctx.lineTo(x, y);
      }
      var lg = ctx.createLinearGradient(0, 0, W, 0);
      lg.addColorStop(0, 'rgba(245,130,32,0)');
      lg.addColorStop(.18, 'rgba(245,130,32,.11)');
      lg.addColorStop(.82, 'rgba(245,130,32,.11)');
      lg.addColorStop(1, 'rgba(245,130,32,0)');
      ctx.strokeStyle = lg;
      ctx.lineWidth = 1;
      ctx.stroke();
      /* packets riding the line */
      for (var p = 0; p < s.packets; p++) {
        var px = ((t*.09*s.sp*3 + s.off + p/s.packets) % 1) * (W + 120) - 60;
        var py = yOn(s, px, t);
        var g = ctx.createRadialGradient(px, py, 0, px, py, 16);
        g.addColorStop(0, 'rgba(255,240,200,.85)');
        g.addColorStop(.4, 'rgba(245,130,32,.4)');
        g.addColorStop(1, 'rgba(245,130,32,0)');
        ctx.fillStyle = g;
        ctx.beginPath(); ctx.arc(px, py, 16, 0, TAU); ctx.fill();
      }
    }
    /* ambient sparking dots */
    for (var j = 0; j < sparks.length; j++) {
      var sp = sparks[j]; sp.tw += .04*sp.sp;
      var a = Math.max(0, Math.sin(sp.tw));
      ctx.fillStyle = 'rgba(244,197,24,' + (a*.5).toFixed(3) + ')';
      ctx.beginPath(); ctx.arc(sp.x, sp.y, sp.r, 0, TAU); ctx.fill();
      if (a > .92) { /* occasional bright pop */
        ctx.fillStyle = 'rgba(255,255,255,' + ((a-.92)*4).toFixed(3) + ')';
        ctx.beginPath(); ctx.arc(sp.x, sp.y, sp.r*2.4, 0, TAU); ctx.fill();
      }
    }
    ctx.globalCompositeOperation = 'source-over';
    requestAnimationFrame(render);
  }
  build();
  if ('IntersectionObserver' in window) {
    new IntersectionObserver(function (es) {
      es.forEach(function (e) { visible = e.isIntersecting; });
    }, { threshold: .05 }).observe(cv);
  } else visible = true;
  addEventListener('resize', build);
  requestAnimationFrame(render);
})();


/* ════ FX LAYER · beam, spotlight, parallax, tilt (no pinning anywhere) ════ */
(function () {
  'use strict';
  var root = document.querySelector('[data-mh]');
  if (!root) return;
  var reduce = matchMedia('(prefers-reduced-motion: reduce)').matches;
  var fine = matchMedia('(hover: hover) and (pointer: fine)').matches;
  var spot = root.querySelector('[data-mh-spot]');
  if (spot && fine && !reduce) {
    addEventListener('pointermove', function (e) {
      spot.style.setProperty('--mx', e.clientX + 'px');
      spot.style.setProperty('--my', e.clientY + 'px');
      spot.classList.add('on');
    }, { passive: true });
  }
  if (fine && !reduce) {
    [].slice.call(root.querySelectorAll('.mh-pc, .mh-mock')).forEach(function (card) {
      card.addEventListener('pointermove', function (e) {
        var r = card.getBoundingClientRect();
        var px = (e.clientX - r.left) / r.width - .5;
        var py = (e.clientY - r.top) / r.height - .5;
        card.style.transform = 'perspective(900px) rotateY(' + (px * 6).toFixed(2) +
          'deg) rotateX(' + (-py * 6).toFixed(2) + 'deg) translateY(-2px)';
      });
      card.addEventListener('pointerleave', function () { card.style.transform = ''; });
    });
  }
  if (reduce) return;
  var beamF = root.querySelector('[data-mh-beamfill]');
  var beamH = root.querySelector('[data-mh-beamhead]');
  var plx = [].slice.call(root.querySelectorAll('[data-plx]'));
  var vc;
  function frame() {
    var doc = document.documentElement;
    var max = doc.scrollHeight - innerHeight;
    var p = max > 0 ? Math.min(1, Math.max(0, (scrollY || doc.scrollTop) / max)) : 0;
    if (beamF) {
      beamF.style.height = (p * 100).toFixed(2) + '%';
      if (beamH) beamH.style.top = (p * 100).toFixed(2) + '%';
    }
    vc = innerHeight / 2;
    for (var i = 0; i < plx.length; i++) {
      var el = plx[i];
      var r = el.getBoundingClientRect();
      var f = parseFloat(el.getAttribute('data-plx')) || .1;
      var d = (r.top + r.height / 2 - vc) * f;
      el.style.transform = 'translate3d(0,' + d.toFixed(1) + 'px,0)';
    }
    requestAnimationFrame(frame);
  }
  requestAnimationFrame(frame);
})();


/* ════ GLOWING DUST · horizontal wind of light across the whole page ════ */
(function () {
  'use strict';
  var cv = document.querySelector('[data-mh-dust]');
  if (!cv) return;
  var reduce = matchMedia('(prefers-reduced-motion: reduce)').matches;
  if (reduce) return;
  var ctx = cv.getContext('2d');
  var dpr = Math.min(devicePixelRatio || 1, 2);
  var W = 0, H = 0, ds = [];
  var MOB = matchMedia('(max-width:760px)').matches;
  var N = MOB ? 90 : 230;
  var TAU = Math.PI * 2;
  function build() {
    W = innerWidth; H = innerHeight;
    cv.width = W*dpr; cv.height = H*dpr;
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    ds = [];
    for (var i = 0; i < N; i++) {
      ds.push({ x: Math.random()*W, y: Math.random()*H,
        v: 14 + Math.random()*42,            /* px/sec rightward */
        a1: 6 + Math.random()*18, s1: .2 + Math.random()*.5, p1: Math.random()*TAU,
        r: .4 + Math.random()*1.3, tw: Math.random()*TAU, ts: .6 + Math.random()*1.6,
        warm: Math.random() < .65, base: Math.random()*H });
    }
  }
  var last = 0;
  function render(now) {
    var dt = Math.min(.05, (now - last)/1000 || .016); last = now;
    var t = now/1000;
    ctx.clearRect(0, 0, W, H);
    ctx.globalCompositeOperation = 'lighter';
    for (var i = 0; i < ds.length; i++) {
      var d = ds[i];
      d.x += d.v * dt;
      if (d.x > W + 6) { d.x = -6; d.base = Math.random()*H; }
      var y = d.base + Math.sin(t*d.s1 + d.p1) * d.a1;
      d.tw += d.ts * dt * 2;
      var a = .12 + .3 * Math.abs(Math.sin(d.tw));
      ctx.fillStyle = (d.warm ? 'rgba(244,197,24,' : 'rgba(255,240,210,') + a.toFixed(3) + ')';
      ctx.beginPath(); ctx.arc(d.x, y, d.r, 0, TAU); ctx.fill();
      if (d.r > 1.4 && a > .3) {  /* faint streak on bigger motes */
        ctx.strokeStyle = 'rgba(244,197,24,' + (a*.25).toFixed(3) + ')';
        ctx.lineWidth = .6;
        ctx.beginPath(); ctx.moveTo(d.x - d.v*.14, y); ctx.lineTo(d.x, y); ctx.stroke();
      }
    }
    ctx.globalCompositeOperation = 'source-over';
    requestAnimationFrame(render);
  }
  build();
  addEventListener('resize', build);
  requestAnimationFrame(render);
})();
