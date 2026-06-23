/* MuscleGrid storefront runtime — cart, product cards, and the shared chrome
   (promo bar + sticky header + cart drawer + mobile nav). Injected on every /store page. */
(function(){
  window.MG = window.MG || {};
  var INR = function(n){ return Number(n||0).toLocaleString('en-IN',{maximumFractionDigits:0}); };
  MG.inr = INR;
  var esc = function(s){ return String(s||'').replace(/"/g,'&quot;').replace(/</g,'&lt;'); };
  var PHONE='099990 36254';
  var ICON={
    menu:'<svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M3 12h18M3 6h18M3 18h18"/></svg>',
    search:'<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="11" cy="11" r="8"/><path d="M21 21l-4.3-4.3"/></svg>',
    cart:'<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="9" cy="21" r="1"/><circle cx="20" cy="21" r="1"/><path d="M1 1h4l2.6 13.4a2 2 0 0 0 2 1.6h9.7a2 2 0 0 0 2-1.6L23 6H6"/></svg>',
    close:'<svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M18 6L6 18M6 6l12 12"/></svg>'
  };

  /* ---------------- cart (localStorage) ---------------- */
  window.MGCart = {
    key:'mg_cart',
    get(){ try{ return JSON.parse(localStorage.getItem(this.key))||[]; }catch(e){ return []; } },
    save(c){ localStorage.setItem(this.key, JSON.stringify(c)); this.badge(); MG.renderDrawer&&MG.renderDrawer(); },
    add(p, qty){ qty=qty||1; var c=this.get(); var e=c.find(x=>x.id===p.id);
      if(e) e.qty+=qty; else c.push({id:p.id,title:p.title,price:p.price,image:p.image,sku:p.sku,gst:(p.gst||18),qty:qty});
      this.save(c); },
    gstIncluded(){ return Math.round(this.get().reduce(function(s,x){ var r=(x.gst||18); var lt=x.price*x.qty; return s+(lt-lt/(1+r/100)); },0)); },
    setQty(id,q){ var c=this.get(); var e=c.find(x=>x.id===id); if(e){ e.qty=Math.max(1,q);} this.save(c); },
    remove(id){ this.save(this.get().filter(x=>x.id!==id)); },
    count(){ return this.get().reduce((s,x)=>s+x.qty,0); },
    total(){ return this.get().reduce((s,x)=>s+x.price*x.qty,0); },
    badge(){ document.querySelectorAll('[data-cart-count]').forEach(function(b){ var n=MGCart.count(); b.textContent=n; b.hidden=n===0; });
      document.querySelectorAll('[data-cart-count-text]').forEach(function(b){ b.textContent=MGCart.count(); }); }
  };

  /* ---------------- product card (listing/home) ---------------- */
  window.__mgProducts={};
  MG.card=function(p){ var pct=p.compare_at?Math.round((p.compare_at-p.price)/p.compare_at*100):0;
    return '<article class="mg-pc spec" data-product-id="'+p.id+'">'
      +'<a class="mg-pc-img" href="/store/p/'+(p.slug||p.id)+'/" aria-label="'+esc(p.title)+'">'
      +(p.compare_at?'<span class="mg-pc-tag mg-pc-tag-sale">Sale</span>':'')
      +(p.image?'<img src="'+p.image+'" alt="'+esc(p.title)+'" loading="lazy">':'<img src="/shop/inverter.png" alt="">')+'</a>'
      +'<div class="mg-pc-body">'+(p.type?'<div class="mg-pc-cat">'+p.type+'</div>':'')
      +'<h3 class="mg-pc-title"><a href="/store/p/'+(p.slug||p.id)+'/">'+p.title+'</a></h3>'
      +'<div class="mg-pc-price-row"><span class="mg-pc-now">₹'+INR(p.price)+'</span>'
      +(p.compare_at?'<span class="mg-pc-was">₹'+INR(p.compare_at)+'</span><span class="mg-pc-pct">−'+pct+'%</span>':'')+'</div>'
      +'<button class="mg-btn mg-btn-primary mg-pc-cta" type="button" data-add="'+p.id+'">Add to cart</button></div></article>'; };
  MG.renderGrid=function(sel,products){ products.forEach(function(p){ window.__mgProducts[p.id]=p; });
    var el=document.querySelector(sel); if(el) el.innerHTML=products.map(MG.card).join(''); };

  MG.toast=function(msg){ var t=document.createElement('div'); t.textContent=msg;
    t.style.cssText='position:fixed;bottom:24px;left:50%;transform:translateX(-50%);background:#1A1A1A;color:#fff;padding:12px 22px;border-radius:10px;font-weight:600;z-index:99999;box-shadow:0 8px 30px rgba(0,0,0,.3)';
    document.body.appendChild(t); setTimeout(function(){t.style.opacity='0';t.style.transition='.4s';},1400); setTimeout(function(){t.remove();},1900); };

  /* ---------------- shared chrome ---------------- */
  MG.mountChrome=function(){
    if(document.querySelector('[data-mg-chrome]')) return;
    // remove any simplified inline header/footer-promo
    document.querySelectorAll('header.mg-header, .mg-promo').forEach(function(e){ if(!e.hasAttribute('data-mg-chrome')) e.remove(); });
    var promoItems=[['Free shipping pan-India','On orders above ₹999'],['5-Year Warranty','On all lithium batteries'],['24×7 Support','Talk to a technician anytime'],['BIS Certified','IS 16242 inverter safety']];
    var marquee=''; for(var r=0;r<2;r++){ promoItems.forEach(function(p){ marquee+='<span class="mg-promo-item"><span class="mg-promo-dot"></span><b>'+p[0]+'</b>·<span style="color:#B5B5B5;font-weight:500">'+p[1]+'</span></span>'; }); }
    var head=document.createElement('div'); head.setAttribute('data-mg-chrome','1');
    head.innerHTML=
      '<div class="mg-promo" style="position:relative;z-index:101"><div class="mg-promo-marquee">'+marquee+'</div><span class="mg-promo-meta">+91 '+PHONE+'</span></div>'
      +'<header class="mg-header" style="position:sticky;top:0;z-index:100">'
      +'<div class="mg-header-inner" style="display:flex;align-items:center;justify-content:space-between;gap:16px;max-width:1320px;margin:0 auto;padding:12px 20px">'
      +'<button type="button" class="mg-icon-btn" data-toggle="mobile-nav" aria-label="Menu">'+ICON.menu+'</button>'
      +'<a class="mg-logo" href="/store/" style="display:flex;align-items:center;gap:10px;text-decoration:none;color:inherit">'
      +'<img src="/shop/logo-mark.png" width="40" height="40" alt="MuscleGrid">'
      +'<div class="mg-logo-text"><div class="mg-logo-word" style="font-family:var(--mg-font-display);font-weight:800;font-size:22px;line-height:1"><span style="color:var(--mg-orange)">Muscle</span>Grid</div><div class="mg-logo-tag" style="font-size:10.5px;color:var(--mg-fg-muted)">Consistency Through You</div></div></a>'
      +'<div class="mg-header-actions" style="display:flex;gap:6px;align-items:center">'
      +'<button type="button" class="mg-icon-btn" data-toggle="search" aria-label="Search">'+ICON.search+'</button>'
      +'<button type="button" class="mg-icon-btn" data-toggle="cart" aria-label="Cart" style="position:relative">'+ICON.cart+'<span class="mg-cart-badge" data-cart-count hidden>0</span></button>'
      +'</div></div></header>';
    document.body.insertBefore(head, document.body.firstChild);

    // cart drawer + mobile nav + search overlay
    var aux=document.createElement('div'); aux.setAttribute('data-mg-chrome','1');
    aux.innerHTML=
      '<div class="mg-drawer-scrim" data-scrim hidden style="z-index:109"></div>'
      +'<aside class="mg-drawer" data-cart-drawer hidden><div class="mg-drawer-head"><span>Cart · <span data-cart-count-text>0</span></span><button class="mg-icon-btn" data-close>'+ICON.close+'</button></div>'
      +'<div class="mg-drawer-body" data-cart-body></div>'
      +'<div class="mg-drawer-foot" data-cart-foot hidden><div class="mg-drawer-totals"><div class="row total" style="display:flex;justify-content:space-between;font-weight:800;font-size:18px;padding:10px 0"><span>Total</span><span data-cart-total></span></div></div>'
      +'<a class="mg-btn mg-btn-primary" href="/store/cart/" style="width:100%">Checkout →</a>'
      +'<div style="text-align:center;color:var(--mg-iron-400);font-size:11px;margin-top:8px">🔒 UPI · Cards · Net Banking · EMI</div></div></aside>'
      +'<aside class="mg-mnav" data-mnav hidden><div class="mg-mnav-head"><a class="mg-logo" href="/store/" style="display:flex;gap:8px;align-items:center;text-decoration:none;color:inherit"><img src="/shop/logo-mark.png" width="30" height="30"><div class="mg-logo-word" style="font-weight:800"><span style="color:var(--mg-orange)">Muscle</span>Grid</div></a><button class="mg-icon-btn" data-close>'+ICON.close+'</button></div>'
      +'<div class="mg-mnav-body"><a href="/store/build-battery/" style="color:var(--mg-orange);font-weight:800">⚡ Build Your Battery</a><a href="/store/products/">All products</a><a href="/store/products/?category=Inverter">Solar Inverters</a><a href="/store/products/?category=Battery">Lithium Batteries</a><a href="/store/products/?category=Stabilizer">Stabilizers</a><a href="tel:+91'+PHONE.replace(/ /g,'')+'">📞 24×7 · '+PHONE+'</a><a href="https://wa.me/919999036254">💬 Chat on WhatsApp</a></div>'
      +'<div class="mg-mnav-foot"><a class="mg-btn mg-btn-primary" href="tel:+91'+PHONE.replace(/ /g,'')+'" style="width:100%">Free Consultation</a></div></aside>'
      +'<div data-search-overlay hidden style="position:fixed;inset:0;background:rgba(0,0,0,.5);z-index:200;display:flex;align-items:flex-start;justify-content:center;padding-top:14vh"><form data-search-form style="background:#fff;border-radius:14px;padding:18px;width:min(560px,92vw);display:flex;gap:10px"><input name="q" placeholder="Search inverters, batteries, stabilizers…" autocomplete="off" style="flex:1;padding:14px;border:1px solid var(--mg-iron-200);border-radius:10px;font-size:16px"><button class="mg-btn mg-btn-primary" type="submit">Search</button></form></div>';
    document.body.appendChild(aux);

    // canonical footer (replaces any simplified inline footer)
    document.querySelectorAll('footer').forEach(function(f){ if(!f.hasAttribute('data-mg-chrome')) f.remove(); });
    var lk=function(h,t){ return '<a class="mgfl" href="'+h+'">'+t+'</a>'; };
    var foot=document.createElement('footer'); foot.setAttribute('data-mg-chrome','1'); foot.className='mg-foot';
    foot.innerHTML=
      '<style>'
      +'.mg-foot{background:radial-gradient(1000px 320px at 82% 0,#1d1d1d,var(--mg-iron-1000));color:var(--mg-fg-onDark);border-top:3px solid var(--mg-orange)}'
      +'.mg-foot a{text-decoration:none}.mg-foot .fw{max-width:1320px;margin:0 auto;padding:0 22px}'
      +'.mg-foot .trust{display:flex;flex-wrap:wrap;gap:16px;justify-content:space-between;padding:22px 0;border-bottom:1px solid #232323}'
      +'.mg-foot .trust span{display:inline-flex;align-items:center;gap:9px;color:#dcdcdc;font-size:14px;font-weight:600}'
      +'.mg-foot .trust b{font-size:18px}'
      +'.mg-foot .grid{display:grid;grid-template-columns:1.7fr 1fr 1fr 1fr;gap:34px;padding:42px 0 30px}'
      +'.mg-foot h4{font-family:var(--mg-font-headline);font-weight:700;font-size:12px;letter-spacing:.13em;text-transform:uppercase;color:#fff;margin:0 0 12px}'
      +'.mg-foot .mgfl{display:block;color:var(--mg-fg-onDark-muted);margin:9px 0;font-size:14px;transition:.15s}'
      +'.mg-foot .mgfl:hover{color:var(--mg-orange);transform:translateX(3px)}'
      +'.mg-foot .desc{color:var(--mg-fg-onDark-muted);max-width:330px;margin:12px 0 18px;line-height:1.65;font-size:14px}'
      +'.mg-foot .socs{display:flex;gap:10px}'
      +'.mg-foot .mgfs{width:40px;height:40px;border:1px solid #333;border-radius:11px;display:inline-flex;align-items:center;justify-content:center;color:#ddd;font-size:12px;font-weight:800;letter-spacing:.04em;transition:.15s}'
      +'.mg-foot .mgfs:hover{background:var(--mg-orange);color:#0E0E0E;border-color:var(--mg-orange);transform:translateY(-2px)}'
      +'.mg-foot .bottom{border-top:1px solid #232323;padding:20px 0 34px;display:flex;flex-wrap:wrap;gap:14px;align-items:center;justify-content:space-between;color:var(--mg-fg-onDark-muted);font-size:12.5px}'
      +'.mg-foot .bottom a{color:var(--mg-orange)}'
      +'.mg-foot .pay{display:flex;gap:7px;flex-wrap:wrap;align-items:center}'
      +'.mg-foot .pay i{font-style:normal;border:1px solid #333;border-radius:6px;padding:4px 10px;font-size:11px;font-weight:700;color:#ccc}'
      +'@media(max-width:820px){.mg-foot .grid{grid-template-columns:1fr 1fr;gap:26px}.mg-foot .bottom{flex-direction:column;align-items:flex-start}}'
      +'@media(max-width:480px){.mg-foot .trust span{font-size:12.5px;gap:6px}}'
      +'</style>'
      +'<div class="fw">'
      +'<div class="trust"><span><b>🚚</b> Free shipping pan-India</span><span><b>🛡️</b> Up to 8-year warranty</span><span><b>📞</b> 24×7 technician support</span><span><b>🇮🇳</b> Designed &amp; made in India</span></div>'
      +'<div class="grid">'
        +'<div><div style="font-family:var(--mg-font-display);font-weight:800;font-size:28px;line-height:1"><span style="color:var(--mg-orange)">Muscle</span>Grid</div>'
        +'<div style="font-family:var(--mg-font-mono);font-size:11px;letter-spacing:.14em;text-transform:uppercase;color:#8a8a8a;margin-top:5px">Consistency Through You</div>'
        +'<p class="desc">Industrial power, engineered for India. Solar inverters, LiFePO₄ lithium batteries &amp; mainline stabilizers — warranty-backed, 12,000+ homes powered.</p>'
        +'<div class="socs"><a class="mgfs" href="https://www.instagram.com/musclegrid_industries" aria-label="Instagram">IG</a><a class="mgfs" href="https://facebook.com/MuscleGrid" aria-label="Facebook">FB</a><a class="mgfs" href="https://wa.me/919999036254" aria-label="WhatsApp">WA</a></div></div>'
        +'<div><h4>Shop</h4>'+lk('/store/build-battery/','⚡ Build your battery')+lk('/store/products/','All products')+lk('/store/products/?category=Inverter','Solar inverters')+lk('/store/products/?category=Battery','Lithium batteries')+lk('/store/products/?category=Stabilizer','Stabilizers')+'</div>'
        +'<div><h4>Company</h4>'+lk('/store/about/','About us')+lk('/store/dealers/','Become a dealer')+lk('/store/support/','Support &amp; manuals')+lk('/store/contact/','Contact')+'</div>'
        +'<div><h4>Help &amp; Policies</h4>'+lk('/store/policies/privacy/','Privacy policy')+lk('/store/policies/terms/','Terms &amp; conditions')+lk('/store/policies/refund/','Refund &amp; returns')+lk('/store/policies/shipping/','Shipping policy')+'</div>'
      +'</div>'
      +'<div class="bottom"><span>© 2026 MuscleGrid Industries (Electronics Bay) · 704, Sector-16, Gurugram · <a href="tel:+919999036254">099990 36254</a> · <a href="mailto:service@musclegrid.in">service@musclegrid.in</a></span>'
      +'<span class="pay">We accept <i>UPI</i><i>Cards</i><i>NetBanking</i><i>EMI</i></span></div>'
      +'</div>';
    document.body.appendChild(foot);

    function open(sel){ document.querySelector('[data-scrim]').hidden=false; var d=document.querySelector(sel); if(d) d.hidden=false; document.body.style.overflow='hidden'; }
    function closeAll(){ document.querySelectorAll('[data-scrim],[data-cart-drawer],[data-mnav]').forEach(function(e){ e.hidden=true; }); document.body.style.overflow=''; }
    document.querySelector('[data-toggle="cart"]').addEventListener('click',function(){ MG.renderDrawer(); open('[data-cart-drawer]'); });
    document.querySelector('[data-toggle="mobile-nav"]').addEventListener('click',function(){ open('[data-mnav]'); });
    document.querySelector('[data-scrim]').addEventListener('click',closeAll);
    document.querySelectorAll('[data-close]').forEach(function(b){ b.addEventListener('click',closeAll); });
    var so=document.querySelector('[data-search-overlay]');
    document.querySelector('[data-toggle="search"]').addEventListener('click',function(){ so.hidden=false; var i=so.querySelector('input'); setTimeout(function(){i.focus();},50); });
    so.addEventListener('click',function(e){ if(e.target===so) so.hidden=true; });
    document.querySelector('[data-search-form]').addEventListener('submit',function(e){ e.preventDefault(); var q=e.target.q.value.trim(); if(q) location.href='/store/products/?q='+encodeURIComponent(q); });

    MG.renderDrawer=function(){
      var c=MGCart.get(), body=document.querySelector('[data-cart-body]'), foot=document.querySelector('[data-cart-foot]');
      if(!body) return;
      if(!c.length){ body.innerHTML='<div class="mg-drawer-empty" style="text-align:center;padding:40px 20px;color:var(--mg-iron-500)"><div style="font-size:48px">🛒</div><div style="margin-top:10px">Your cart is empty.</div><a class="mg-btn mg-btn-primary" style="margin-top:18px" href="/store/products/">Shop catalogue</a></div>'; foot.hidden=true; MGCart.badge(); return; }
      body.innerHTML=c.map(function(it){ return '<div class="mg-drawer-item" data-id="'+it.id+'" style="display:flex;gap:12px;padding:12px 0;border-bottom:1px solid var(--mg-iron-200)">'
        +'<div class="mg-drawer-thumb" style="width:60px;height:60px;border:1px solid var(--mg-iron-200);border-radius:8px;overflow:hidden;flex-shrink:0;background:#fff"><img src="'+(it.image||'/shop/inverter.png')+'" style="width:100%;height:100%;object-fit:contain"></div>'
        +'<div style="flex:1;min-width:0"><a class="mg-drawer-title" href="/store/product/?id='+it.id+'" style="font-weight:600;font-size:13px;color:var(--mg-fg);text-decoration:none;display:block;line-height:1.3">'+it.title+'</a>'
        +'<div class="mg-drawer-qty" style="display:inline-flex;align-items:center;border:1px solid var(--mg-iron-200);border-radius:6px;margin-top:6px"><button data-dec style="padding:4px 10px;border:none;background:none;cursor:pointer">−</button><span style="min-width:22px;text-align:center;font-weight:700">'+it.qty+'</span><button data-inc style="padding:4px 10px;border:none;background:none;cursor:pointer">+</button></div></div>'
        +'<div style="text-align:right"><div style="font-weight:800;font-size:14px">₹'+INR(it.price*it.qty)+'</div><button data-remove style="border:none;background:none;color:var(--mg-iron-400);cursor:pointer;font-size:18px;margin-top:6px">×</button></div></div>'; }).join('');
      document.querySelector('[data-cart-total]').textContent='₹'+INR(MGCart.total());
      foot.hidden=false; MGCart.badge();
    };
    document.querySelector('[data-cart-body]').addEventListener('click',function(e){
      var item=e.target.closest('[data-id]'); if(!item) return; var id=item.getAttribute('data-id'); var it=MGCart.get().find(x=>x.id===id); if(!it) return;
      if(e.target.closest('[data-inc]')) MGCart.setQty(id,it.qty+1);
      else if(e.target.closest('[data-dec]')) MGCart.setQty(id,it.qty-1);
      else if(e.target.closest('[data-remove]')) MGCart.remove(id);
    });
    MGCart.badge();
  };

  document.addEventListener('click',function(e){ var b=e.target.closest('[data-add]'); if(!b) return; e.preventDefault();
    var p=window.__mgProducts[b.getAttribute('data-add')]; if(p){ MGCart.add(p); MG.toast('Added to cart ✓'); } });
  document.addEventListener('DOMContentLoaded',function(){ MG.mountChrome(); MGCart.badge(); });
})();
