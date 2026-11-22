/* Apex tools: shared helpers (language, header/footer, offers loader). Loaded by every tool page. */
(function(){
  var d=document,h=d.documentElement,KEY="apexLang",lang="ar";
  var WA="201115634954";
  var SHEET_URL="https://docs.google.com/spreadsheets/d/1HJ8X35XIMYZoDQwoOSkvjhuU7HduyXPwOR15GGMNe8c/gviz/tq?tqx=out:csv&sheet=Offers";
  try{var s=localStorage.getItem(KEY);if(s==="en"||s==="ar")lang=s}catch(e){}

  function esc(s){return String(s==null?"":s).replace(/[&<>"']/g,function(c){return {"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"}[c]})}

  /* ---- offers (same sheet + parsing as the offers page; shares its cache) ---- */
  function parseCSV(t){var rows=[],r=[],f="",q=false,i,ch;
    for(i=0;i<t.length;i++){ch=t[i];
      if(q){if(ch==='"'){if(t[i+1]==='"'){f+='"';i++}else q=false}else f+=ch}
      else if(ch==='"')q=true;
      else if(ch===","){r.push(f);f=""}
      else if(ch==="\n"||ch==="\r"){if(ch==="\r"&&t[i+1]==="\n")i++;r.push(f);f="";rows.push(r);r=[]}
      else f+=ch}
    if(f!==""||r.length){r.push(f);rows.push(r)}return rows}
  var MAP={"status":"status","company":"c","position":"t","work mode":"w","location":"loc","salary / package":"pay","working hours":"sh","experience":"exp","language and level":"lang","graduation status":"grad","nationality":"nat","age":"age","transportation":"tr","interview":"iv","link":"link","notes":"note"};
  function hash(s){var x=5381,i;for(i=0;i<s.length;i++)x=((x<<5)+x+s.charCodeAt(i))>>>0;return x.toString(36)}
  function fromCSV(t){
    var rows=parseCSV(t);if(rows.length<2)return [];
    var hd=rows[0].map(function(x){return MAP[x.trim().toLowerCase()]||null}),out=[];
    for(var i=1;i<rows.length;i++){var o={};
      rows[i].forEach(function(v,j){if(hd[j])o[hd[j]]=v.trim()});
      if(/^active$/i.test(o.status||"")&&o.t&&o.c){var w=(o.w||"").toUpperCase();o.w=w==="HYBRID"?"Hybrid":(w==="WFH"?"WFH":"WFS");o.id=hash((o.c+"|"+o.t+"|"+(o.loc||"")).toLowerCase());out.push(o)}}
    return out}
  /* cb(offers, fromCache) may be called twice: once from cache, once fresh. */
  function loadOffers(cb,fail){
    var got=false;
    try{var c=localStorage.getItem("apexCSV");if(c){var co=fromCSV(c);if(co.length){got=true;cb(co,true)}}}catch(e){}
    fetch(SHEET_URL+"&t="+Date.now()).then(function(r){if(!r.ok)throw 0;return r.text()})
      .then(function(t){var o=fromCSV(t);if(!o.length)throw 0;try{localStorage.setItem("apexCSV",t)}catch(e){}cb(o,false)})
      .catch(function(){if(!got&&fail)fail()});
  }

  /* ---- ref passthrough (recruiter link) ---- */
  function getRef(){
    var m=/[?&]ref=([A-Za-z0-9]+)/.exec(location.search);
    try{if(m){localStorage.setItem("apexRefTool",m[1])}else{m=[0,localStorage.getItem("apexRefTool")||""]}}catch(e){}
    return (m&&m[1])||"";
  }
  try{var _s=/[?&]src=([A-Za-z0-9_-]{1,20})/.exec(location.search);if(_s)localStorage.setItem("apexSrc",_s[1])}catch(e){}
  function indexUrl(id){var r=getRef(),q=[];if(id)q.push("job="+id);if(r)q.push("ref="+r);return "offers"+(q.length?"?"+q.join("&"):"")}

  /* ---- chrome: top bar, whatsapp button, footer ---- */
  var ICON_WA='<svg viewBox="0 0 24 24"><path d="M21 12a8 8 0 0 1-11.6 7.1L4 20l1-4.6A8 8 0 1 1 21 12Z"/></svg>';
  function chrome(opts){
    opts=opts||{};
    var bar=d.getElementById("bar");
    if(bar)bar.innerHTML='<div class="bar"><div class="wrap wide in"><a class="brand" href="tools"><img src="logo.png" alt="" width="32" height="32" onerror="this.style.display=\'none\'"><span>APEX</span></a><div class="tools-r">'+
      (opts.hub?'':'<a class="pillbtn" href="tools" data-ar="كل الأدوات" data-en="All tools">كل الأدوات</a>')+
      '<button class="pillbtn" id="lang" type="button" aria-label="Language">English</button></div></div></div>';
    var ft=d.getElementById("foot");
    if(ft)ft.innerHTML='<footer><div class="wrap wide"><span>© <span id="yr"></span> Apex Recruitment Agency</span><span><a href="offers" data-ar="الوظايف" data-en="Jobs">الوظايف</a> · <a href="about" data-ar="من نحن" data-en="About us">من نحن</a></span></div></footer>'+
      '<a class="fab" href="https://wa.me/'+WA+'" target="_blank" rel="noopener" aria-label="WhatsApp">'+ICON_WA+'</a>';
    var yr=d.getElementById("yr");if(yr)yr.textContent=new Date().getFullYear();
    var lb=d.getElementById("lang");if(lb)lb.addEventListener("click",function(){setLang(lang==="ar"?"en":"ar")});
  }

  var hooks=[];
  function paint(){
    h.lang=lang;h.dir=lang==="ar"?"rtl":"ltr";
    [].forEach.call(d.querySelectorAll("[data-ar]"),function(el){var v=el.getAttribute("data-"+lang);if(v!=null)el.textContent=v});
    [].forEach.call(d.querySelectorAll("[data-ph-ar]"),function(el){el.placeholder=el.getAttribute("data-ph-"+lang)||""});
    var lb=d.getElementById("lang");if(lb)lb.textContent=lang==="ar"?"English":"العربية";
    hooks.forEach(function(f){try{f(lang)}catch(e){}});
  }
  function setLang(l,keep){lang=l;if(!keep){try{localStorage.setItem(KEY,l)}catch(e){}}paint()}
  function onLang(f){hooks.push(f)}
  function start(opts){chrome(opts);paint()}

  function waLink(text){return "https://wa.me/"+WA+(text?"?text="+encodeURIComponent(text):"")}
  function openWA(text){var u=waLink(text),w=null;try{w=window.open(u,"_blank","noopener")}catch(e){}if(!w)location.href=u}

  window.APEX={esc:esc,loadOffers:loadOffers,fromCSV:fromCSV,start:start,onLang:onLang,lang:function(){return lang},setLang:setLang,
    WA:WA,waLink:waLink,openWA:openWA,indexUrl:indexUrl,getRef:getRef,hash:hash,
    t:function(ar,en){return lang==="ar"?ar:en}};
})();
