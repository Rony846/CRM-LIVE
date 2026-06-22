/* Shared product-detail hydration. Uses window.__MGPRODUCT (baked into SEO pages at /store/p/{slug})
   if present; otherwise resolves the product from ?id= or the /store/p/{slug} path and fetches it. */
(function(){
  var prod=null, qty=1;
  function $(id){ return document.getElementById(id); }

  function render(p){
    prod=p; window.__mgProducts[p.id]=p;
    document.title=p.title+' · MuscleGrid';
    if($('pdpCrumb')) $('pdpCrumb').textContent=p.title;
    if($('pType')) $('pType').textContent=p.type||'';
    if($('pTitle')) $('pTitle').textContent=p.title;
    if($('pSub')) $('pSub').textContent=(p.description||'').slice(0,150);
    if($('pSku')) $('pSku').textContent='SKU · '+(p.sku||'—');
    if($('pPrice')) $('pPrice').textContent='₹'+MG.inr(p.price);
    if(p.compare_at){ if($('pWas')) $('pWas').textContent='₹'+MG.inr(p.compare_at);
      if($('pPct')) $('pPct').textContent='−'+Math.round((p.compare_at-p.price)/p.compare_at*100)+'%'; }
    else { if($('pWas')) $('pWas').style.display='none'; if($('pPct')) $('pPct').style.display='none'; }
    if($('emiVal')) $('emiVal').textContent='₹'+MG.inr(Math.round(p.price/12));
    if($('pDesc')) $('pDesc').textContent=p.description||'Premium MuscleGrid product. Contact us for full specifications.';
    var imgs=(p.gallery&&p.gallery.length?p.gallery:[p.image]).filter(Boolean);
    if($('mainImg')){ $('mainImg').src=imgs[0]||'/shop/inverter.png'; $('mainImg').alt=p.title; }
    if($('thumbs')){
      $('thumbs').innerHTML=imgs.map(function(src,i){
        return '<button class="mg-pdp-thumb" data-src="'+src+'" style="width:74px;height:74px;border:2px solid '+(i===0?'var(--mg-orange)':'var(--mg-iron-200)')+';border-radius:8px;overflow:hidden;background:#fff;cursor:pointer;padding:0"><img src="'+src+'" style="width:100%;height:100%;object-fit:contain"></button>';
      }).join('');
      document.querySelectorAll('.mg-pdp-thumb').forEach(function(b){ b.addEventListener('click',function(){
        $('mainImg').src=b.getAttribute('data-src');
        document.querySelectorAll('.mg-pdp-thumb').forEach(function(x){ x.style.borderColor='var(--mg-iron-200)'; }); b.style.borderColor='var(--mg-orange)'; }); });
    }
  }

  if($('qtyInc')) $('qtyInc').addEventListener('click',function(){ qty++; $('qtyVal').textContent=qty; });
  if($('qtyDec')) $('qtyDec').addEventListener('click',function(){ if(qty>1){ qty--; $('qtyVal').textContent=qty; } });
  if($('addBtn')) $('addBtn').addEventListener('click',function(){ if(prod){ MGCart.add(prod,qty); MG.toast('Added '+qty+' to cart ✓'); } });
  if($('buyBtn')) $('buyBtn').addEventListener('click',function(){ if(prod){ MGCart.add(prod,qty); location.href='/store/cart/'; } });

  if(window.__MGPRODUCT){ render(window.__MGPRODUCT); return; }
  var id=new URLSearchParams(location.search).get('id');
  if(!id){ var m=location.pathname.match(/\/store\/p\/([^\/]+)/); if(m) id=decodeURIComponent(m[1]); }
  if(!id){ location.href='/store/products/'; return; }
  fetch('/api/shop/product/'+encodeURIComponent(id)).then(function(r){ return r.json(); }).then(function(d){
    if(d && d.product) render(d.product);
    else document.querySelector('.mg-pdp').innerHTML='<p style="padding:80px;text-align:center">Product not found.</p>';
  });
})();
