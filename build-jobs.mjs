// Builds one static, Google-indexable page per ACTIVE offer: jobs/<id>.html, and rewrites sitemap.xml.
// Run by GitHub Actions. Local test: CSV_FILE=offers.csv node tools-build/build-jobs.mjs
import fs from "node:fs";
const SITE="https://apex-ra.com";
const SHEET="https://docs.google.com/spreadsheets/d/1HJ8X35XIMYZoDQwoOSkvjhuU7HduyXPwOR15GGMNe8c/gviz/tq?tqx=out:csv&sheet=Offers";
const MAP={"status":"status","company":"c","position":"t","work mode":"w","location":"loc","salary / package":"pay","working hours":"sh","experience":"exp","language and level":"lang","graduation status":"grad","nationality":"nat","age":"age","transportation":"tr","interview":"iv","link":"link","notes":"note"};
const LB={pay:"المرتب والمزايا",sh:"مواعيد الشغل",w:"طريقة الشغل",loc:"المكان",lang:"اللغة والمستوى",exp:"الخبرة",grad:"المؤهل",nat:"الجنسية",age:"السن",tr:"المواصلات",iv:"الإنترفيو",note:"ملاحظات"};
const ORDER=["pay","sh","w","loc","lang","exp","grad","nat","age","tr","iv","note"];
const WM={WFS:"من المكتب",Hybrid:"هايبرد",WFH:"من البيت"};
const esc=s=>String(s==null?"":s).replace(/[&<>"']/g,c=>({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"}[c]));
function parseCSV(t){const rows=[];let r=[],f="",q=false;
  for(let i=0;i<t.length;i++){const ch=t[i];
    if(q){if(ch==='"'){if(t[i+1]==='"'){f+='"';i++}else q=false}else f+=ch}
    else if(ch==='"')q=true;
    else if(ch===","){r.push(f);f=""}
    else if(ch==="\n"||ch==="\r"){if(ch==="\r"&&t[i+1]==="\n")i++;r.push(f);f="";rows.push(r);r=[]}
    else f+=ch}
  if(f!==""||r.length){r.push(f);rows.push(r)}return rows}
function hash(s){let x=5381;for(let i=0;i<s.length;i++)x=((x<<5)+x+s.charCodeAt(i))>>>0;return x.toString(36)}
function fromCSV(t){const rows=parseCSV(t);if(rows.length<2)return[];
  const hd=rows[0].map(x=>MAP[x.trim().toLowerCase()]||null),out=[];
  for(let i=1;i<rows.length;i++){const o={};rows[i].forEach((v,j)=>{if(hd[j])o[hd[j]]=v.trim()});
    if(/^active$/i.test(o.status||"")&&o.t&&o.c){const w=(o.w||"").toUpperCase();o.w=w==="HYBRID"?"Hybrid":(w==="WFH"?"WFH":"WFS");o.id=hash((o.c+"|"+o.t+"|"+(o.loc||"")).toLowerCase());out.push(o)}}
  return out}
const csv=process.env.CSV_FILE?fs.readFileSync(process.env.CSV_FILE,"utf8"):await (await fetch(SHEET)).text();
const offers=fromCSV(csv);
if(!offers.length){console.log("No active offers found; leaving the site untouched.");process.exit(0)}
const seen=new Set(),list=offers.filter(o=>!seen.has(o.id)&&seen.add(o.id));
const today=new Date().toISOString().slice(0,10);
function page(o){
  const meta=[WM[o.w]||o.w,o.loc].filter(Boolean);
  const rows=ORDER.filter(k=>o[k]&&!/^(not stated|n\/a|-)$/i.test(o[k])).map(k=>`<div><dt>${LB[k]}</dt><dd dir="auto">${esc(k==="w"?WM[o.w]||o.w:o[k])}</dd></div>`).join("");
  const title=`${o.t} - ${o.c}${o.loc?" - "+o.loc:""} | Apex`;
  const desc=`وظيفة ${o.t} في ${o.c}${o.loc?" ("+o.loc+")":""}${o.pay?" - "+o.pay:""}. قدّم دلوقتي من خلال Apex Recruitment Agency.`;
  const url=`${SITE}/jobs/${o.id}`;
  return `<!doctype html>
<html lang="ar" dir="rtl">
<head>
<meta charset="utf-8">
<base href="/">
<meta name="viewport" content="width=device-width,initial-scale=1,viewport-fit=cover">
<meta name="color-scheme" content="dark light">
<title>${esc(title)}</title>
<meta name="description" content="${esc(desc.slice(0,300))}">
<link rel="canonical" href="${url}">
<link rel="icon" type="image/png" href="icon-192.png">
<link rel="stylesheet" href="https://fonts.googleapis.com/css2?family=Cairo:wght@600;700;800;900&family=IBM+Plex+Sans+Arabic:wght@400;500;600&display=swap">
<link rel="stylesheet" href="tools.css">
<style>
.dl{display:grid;gap:0;margin:0}.dl div{display:grid;grid-template-columns:130px 1fr;gap:12px;padding:12px 0;border-bottom:1px solid var(--line)}.dl div:last-child{border:0}
.dl dt{color:var(--mute);font-size:14px;font-weight:600}.dl dd{margin:0;word-break:break-word}@media(max-width:420px){.dl div{grid-template-columns:1fr;gap:2px}}
.hd .co{color:var(--mute)}.hd h1{margin-top:6px}#closed{display:none;margin-top:20px}
</style>
</head>
<body>
<div id="bar"></div>
<main class="wrap">
<div class="ph hd"><div class="eyebrow">وظيفة</div><div class="co">${esc(o.c)}</div><h1 dir="auto">${esc(o.t)}</h1>
<div style="display:flex;flex-wrap:wrap;gap:6px;margin-top:12px">${meta.map(m=>`<span class="pill">${esc(m)}</span>`).join("")}</div></div>
<div class="card" id="closed"><p><b>الوظيفة دي اتقفلت.</b> شوف باقي الوظايف المتاحة.</p></div>
<div class="card" style="margin-top:20px"><dl class="dl">${rows}</dl></div>
<div class="row" style="margin-top:18px"><a class="btn p" id="ap" href="offers?job=${o.id}">قدّم على الوظيفة</a><a class="btn" href="offers">كل الوظايف</a></div>
</main>
<div id="foot"></div>
<script src="tools.js"></script>
<script>
(function(){var A=APEX,id=${JSON.stringify(o.id)};
 var ap=document.getElementById("ap");if(ap)ap.href=A.indexUrl(id);
 A.start();
 A.loadOffers(function(l,cached){if(cached)return;if(!l.some(function(x){return x.id===id})){document.getElementById("closed").style.display="block";if(ap)ap.style.display="none"}},function(){});
})();
</script>
</body>
</html>
`}
fs.rmSync("jobs",{recursive:true,force:true});fs.mkdirSync("jobs",{recursive:true});
for(const o of list)fs.writeFileSync(`jobs/${o.id}.html`,page(o));
const base=[["",1.0],["offers",0.9],["tools",0.6],["companies",0.6],["match",0.5],["english-test",0.5],["cv",0.5],["alerts",0.5],["refer",0.4],["scam-check",0.6]];
const urls=base.map(([p,pr])=>`  <url>\n    <loc>${SITE}/${p}</loc>\n    <priority>${pr}</priority>\n  </url>`);
for(const o of list)urls.push(`  <url>\n    <loc>${SITE}/jobs/${o.id}</loc>\n    <priority>0.7</priority>\n  </url>`);
fs.writeFileSync("sitemap.xml",`<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n${urls.join("\n")}\n</urlset>\n`);
console.log(`Built ${list.length} job pages.`);
