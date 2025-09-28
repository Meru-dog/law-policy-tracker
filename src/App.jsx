import React, { useEffect, useMemo, useRef, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import "./index.css";

const DAYS_CHOICES = [7, 30, 90, 180, 365];

// 主要国別ソース（v2と同等。短縮版: 代表的なエンドポイントのみ）
const SOURCE_PRESETS = [
  { id: "egov_pcm_list", region: "jp", name: "e-Gov 意見募集", type: "rss", url: "https://public-comment.e-gov.go.jp/rss/pcm_list.xml", enabled: true },
  { id: "fsa_news", region: "jp", name: "金融庁 新着", type: "rss", url: "https://www.fsa.go.jp/fsaNewsListAll_rss2.xml", enabled: true },
  { id: "sec_press", region: "us", name: "SEC Press", type: "rss", url: "https://www.sec.gov/news/pressreleases.rss", enabled: true },
  { id: "sec_fr_api", region: "us", name: "Federal Register – SEC", type: "json_fr_api", url: "https://www.federalregister.gov/api/v1/documents.json?per_page=40&order=newest&conditions%5Bagencies%5D%5B%5D=securities-and-exchange-commission&conditions%5Btype%5D%5B%5D=PROPOSED_RULE&conditions%5Btype%5D%5B%5D=RULE&conditions%5Btype%5D%5B%5D=NOTICE", enabled: true },
  { id: "esma_news", region: "eu", name: "ESMA News", type: "rss", url: "https://www.esma.europa.eu/rss/news", enabled: true },
  // 追加: SEC 最新提出書類（EDGAR Atom）
  { id: "sec_filings_atom", region: "us", name: "SEC Current Filings (EDGAR)", type: "rss", url: "https://www.sec.gov/cgi-bin/browse-edgar?action=getcurrent&count=100&output=atom", enabled: true },
  // 追加: e-Gov 結果公示
  { id: "egov_pcm_result", region: "jp", name: "e-Gov 結果公示", type: "rss", url: "https://public-comment.e-gov.go.jp/rss/pcm_result.xml", enabled: true },
  // 追加: EBA News
  { id: "eba_news", region: "eu", name: "EBA News", type: "rss", url: "https://www.eba.europa.eu/rss/news", enabled: true },
];

const CATEGORY_DEFS = [
  { id: "markets_corporate", label: "金商法・会社法", color: "from-fuchsia-500 to-pink-500", icon: "📊" },
  { id: "payments_crypto", label: "資金決済法・暗号資産", color: "from-cyan-500 to-emerald-500", icon: "💰" },
  { id: "sec_rulemaking", label: "SECルールメイキング", color: "from-indigo-500 to-blue-500", icon: "📋" },
  { id: "sec_enforcement", label: "SECエンフォースメント", color: "from-amber-500 to-red-500", icon: "⚖️" },
  { id: "filings_disclosure", label: "開示・提出書類", color: "from-rose-500 to-pink-500", icon: "🗂️" },
  { id: "mna_finance", label: "M&A・ファイナンス", color: "from-amber-500 to-yellow-500", icon: "💹" },
  { id: "law_reform", label: "法令改正・制度", color: "from-emerald-500 to-teal-500", icon: "⚙️" },
  { id: "general", label: "その他", color: "from-slate-500 to-zinc-600", icon: "📄" },
];

const KEYWORD_RULES = [
  // 提出書類・開示
  { cat: "filings_disclosure", words: [
    "有価証券報告書","有報","四半期報告書","半期報告書","確認書","変更報告書","大量保有報告書","臨時報告書",
    "有価証券届出書","目論見書","訂正届出書","提出書類","disclosure","filing","8-k","10-k","10-q","6-k","13d","13g",
    "tender offer statement","registration statement","prospectus"
  ]},
  // M&A・ファイナンス
  { cat: "mna_finance", words: [
    "M&A","買収","合併","株式交換","公開買付","TOB","資本提携","第三者割当","有償割当","増資","資金調達","社債",
    "acquisition","merger","tender offer","financing","capital raising","bond","equity offering","private placement"
  ]},
  // 法令改正・制度
  { cat: "law_reform", words: [
    "改正","改定","パブリックコメント","政令","省令","告示","通達","法案","ガイダンス",
    "amendment","rulemaking","guidance","proposal","consultation"
  ]},
  { cat: "markets_corporate", words: ["金商法","金融商品取引法","有価証券","開示","上場","会社法","株主","取締役","securities","disclosure","IPO","prospectus"] },
  { cat: "payments_crypto", words: ["資金決済","暗号資産","仮想通貨","ステーブルコイン","crypto","blockchain","stablecoin","payment services"] },
  { cat: "sec_rulemaking", words: ["proposed rule","final rule","rulemaking","release no.","file no."] },
  { cat: "sec_enforcement", words: ["litigation release","enforcement","complaint","settled","sanction"] },
];

const PROXY_SERVERS_PRIMARY = [
  "https://corsproxy.io/?",
  "https://api.allorigins.win/get?url=",
  "https://r.jina.ai/http://",
];
const PROXY_SERVERS_FALLBACK = [
  "https://api.corsproxy.io/?",
  "https://thingproxy.freeboard.io/fetch/",
  "https://cors.bridged.cc/",
  "https://api.codetabs.com/v1/proxy?quest=",
  "https://cors-anywhere.herokuapp.com/",
];

const WHITEPAPER_WORDS = ["白書", "ホワイトペーパー", "white paper"];

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

function parseDate(input) {
  if (!input) return null;
  const d = new Date(input);
  return isNaN(d.getTime()) ? null : d;
}

function classify(item) {
  const text = `${item.title}\n${item.summary || ""}`.toLowerCase();
  const scores = new Map(CATEGORY_DEFS.map(c=>[c.id,0]));

  // 1) キーワードスコア
  for (const rule of KEYWORD_RULES) {
    let s = 0;
    for (const w of rule.words) {
      if (text.includes(String(w).toLowerCase())) s += 1;
    }
    if (s>0) scores.set(rule.cat, (scores.get(rule.cat)||0)+s);
  }

  // 2) 出所/リンクに基づくヒューリスティクス
  try {
    const u = new URL(item.link||'');
    const host = u.hostname.toLowerCase();
    const path = (u.pathname||'').toLowerCase()+ (u.search||'');

    // e-Gov → 法令改正・制度（パブコメ/結果公示）を強化
    if (host.includes('public-comment.e-gov.go.jp')) {
      scores.set('law_reform', (scores.get('law_reform')||0)+3);
    }

    // SEC EDGAR 現在提出一覧 → 開示・提出書類
    if (host.includes('sec.gov') && (path.includes('browse-edgar') || path.includes('edgar'))) {
      scores.set('filings_disclosure', (scores.get('filings_disclosure')||0)+4);
    }

    // ESMA/EBA → 規制・ガイダンス系（法令改正・制度）
    if (host.includes('esma.europa.eu') || host.includes('eba.europa.eu')) {
      scores.set('law_reform', (scores.get('law_reform')||0)+2);
    }

    // FSA → 金商法・会社法 or 法令改正（タイトルで判定）
    if (host.includes('fsa.go.jp')) {
      if (/(有価証券|届出|提出|目論見書|disclosure|filing)/.test(text)) {
        scores.set('filings_disclosure', (scores.get('filings_disclosure')||0)+2);
      } else {
        scores.set('law_reform', (scores.get('law_reform')||0)+1);
      }
    }
  } catch { /* no-op */ }

  // 3) 追加ヒューリスティクス（強めの判定）
  if (/(8-k|10-k|10-q|6-k|13d|13g|tender offer|registration statement|prospectus|届出書|目論見書|有価証券報告書|大量保有報告)/i.test(text)) {
    scores.set('filings_disclosure', (scores.get('filings_disclosure')||0)+3);
  }
  if (/(公開買付|tob|買収|合併|資金調達|第三者割当|増資|bond|equity offering|acquisition|merger)/i.test(text)) {
    scores.set('mna_finance', (scores.get('mna_finance')||0)+3);
  }
  if (/(意見募集|意見公募|結果公示|改正|rulemaking|guidance|consultation)/i.test(text)) {
    scores.set('law_reform', (scores.get('law_reform')||0)+2);
  }
  if (/(litigation release|enforcement|課徴金|行政処分)/i.test(text)) {
    scores.set('sec_enforcement', (scores.get('sec_enforcement')||0)+3);
  }

  // 最終カテゴリ＝最大スコア
  let best = { cat: 'general', score: -1 };
  for (const [cat, sc] of scores.entries()) {
    if (sc > best.score) best = { cat, score: sc };
  }
  return best.score > 0 ? best.cat : 'general';
}

function onlyWhitepaper(item) {
  const hay = `${item.title}\n${item.summary || ""}`;
  return WHITEPAPER_WORDS.some((w) => hay.includes(w));
}

// 無関係な情報（採用・イベント等）を除外
function shouldExclude(item) {
  const hay = `${item.title}\n${item.summary || ''}`.toLowerCase();
  const ng = [
    // 日本語
    "職員募集","採用","求人","人事","採用情報","インターン","説明会","セミナー","ウェビナー","イベント","メンテナンス","障害","停止","入札",
    // 英語
    "recruitment","hiring","job opening","career","internship","seminar","webinar","maintenance","outage"
  ];
  return ng.some((w)=> hay.includes(w.toLowerCase()));
}

function createTimeoutSignal(ms) {
  if (typeof AbortSignal !== 'undefined' && typeof AbortSignal.timeout === 'function') {
    return AbortSignal.timeout(ms);
  }
  const controller = new AbortController();
  setTimeout(() => controller.abort(new DOMException('TimeoutError','TimeoutError')), ms);
  return controller.signal;
}

async function fetchWithFallbacks(urls) {
  for (let i = 0; i < urls.length; i++) {
    try {
      const reqUrl = urls[i].startsWith('http') ? urls[i] : `https://r.jina.ai/http://` + urls[i].replace(/^https?:\/\//,'');
      const res = await fetch(reqUrl, {
        headers: { 'Accept': 'application/rss+xml, application/xml, text/xml, application/atom+xml, application/json' },
        signal: createTimeoutSignal(8000)
      });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const ct = res.headers.get('content-type') || '';
      let text;
      if (ct.includes('application/json')) {
        try {
          const data = await res.json();
          text = data?.contents || data?.body || data?.result || JSON.stringify(data);
        } catch { text = await res.text(); }
      } else { text = await res.text(); }
      if (!text || !text.trim()) throw new Error('Empty');
      return text;
    } catch (e) {
      await sleep(300);
    }
  }
  throw new Error('All proxies failed');
}

async function fetchJSON(url) {
  const res = await fetch(url, { signal: createTimeoutSignal(8000) });
  if (!res.ok) throw new Error('JSON取得に失敗');
  return await res.json();
}

export default function App() {
  const [sources, setSources] = useState(SOURCE_PRESETS);
  const [regionTab, setRegionTab] = useState("jp");
  const [category, setCategory] = useState("all");
  const [q, setQ] = useState("");
  const [daysBack, setDaysBack] = useState(30);
  const [onlyWP, setOnlyWP] = useState(false);
  const [loading, setLoading] = useState(false);
  const [items, setItems] = useState([]);
  const [error, setError] = useState(null);

  const [now, setNow] = useState(new Date());
  useEffect(() => { const id = setInterval(()=>setNow(new Date()), 60000); return ()=>clearInterval(id); }, []);

  const cutoff = useMemo(() => { const d = new Date(now); d.setDate(d.getDate() - Number(daysBack||30)); return d; }, [now, daysBack]);
  const activeSources = useMemo(
    () => sources.filter((s)=> s.enabled && s.region===regionTab),
    [sources, regionTab]
  );

  // 地域タブ切替時、当該地域の有効ソースがゼロなら既定を自動ON
  useEffect(()=>{
    const list = sources.filter((s)=>s.region===regionTab);
    if (list.length && list.every(s=>!s.enabled)) {
      setSources((prev)=> prev.map(s=> s.region===regionTab ? { ...s, enabled:true } : s));
    }
  }, [regionTab, sources]);

  async function load() {
    setLoading(true); setError(null);
    try {
      const batches = [];
      const BATCH = 3;
      for (let i=0;i<activeSources.length;i+=BATCH) batches.push(activeSources.slice(i,i+BATCH));
      const all = [];
      const startedAt = Date.now();

      for (const batch of batches) {
        const results = await Promise.allSettled(batch.map(async (s)=>{
          try {
            // キャッシュなしの簡易版（v2同等の体感を維持）
            if (s.type === 'rss') {
              const primary = [s.url, ...PROXY_SERVERS_PRIMARY.map(p=>p+encodeURIComponent(s.url))];
              const fallback = PROXY_SERVERS_FALLBACK.map(p=>p+encodeURIComponent(s.url));
              let text; try { text = await fetchWithFallbacks(primary); } catch { text = await fetchWithFallbacks(fallback); }
              const doc = new DOMParser().parseFromString(text, 'text/xml');
              // RSS/Atom 兼用の軽量パーサ
              const items = [];
              const isAtom = doc.querySelector('feed > entry');
              if (isAtom) {
                doc.querySelectorAll('feed > entry').forEach((el)=>{
                  items.push({ source:s.name, sourceId:s.id, region:s.region, title: el.querySelector('title')?.textContent?.trim()||'(no title)', link: el.querySelector('link[href]')?.getAttribute('href')||s.url, summary: el.querySelector('summary')?.textContent || el.querySelector('content')?.textContent || '', publishedAt: parseDate(el.querySelector('updated')?.textContent)||parseDate(el.querySelector('published')?.textContent)||new Date() });
                });
              } else {
                doc.querySelectorAll('item').forEach((it)=>{
                  items.push({ source:s.name, sourceId:s.id, region:s.region, title: it.querySelector('title')?.textContent?.trim()||'(no title)', link: it.querySelector('link')?.textContent?.trim()||s.url, summary: it.querySelector('description')?.textContent||'', publishedAt: parseDate(it.querySelector('pubDate')?.textContent)||parseDate(it.querySelector('dc\\:date')?.textContent)||new Date() });
                });
              }
              return items;
            } else if (s.type === 'json_fr_api') {
              const data = await fetchJSON(s.url);
              return (data?.results||[]).map((r)=>({ source:s.name, sourceId:s.id, region:s.region, title:r.title, link:r.html_url||r.pdf_url||r.public_inspection_pdf_url||r?.url||'', summary:r.abstract||r.title||'', publishedAt: parseDate(r.publication_date)||parseDate(r.signing_date)||new Date(), frType: r.document_type }));
            }
          } catch(e) { return []; }
        }));

        results.forEach((r)=>{ if (r.status==='fulfilled' && Array.isArray(r.value)) all.push(...r.value); });
        // 部分反映
        setItems((prev)=>{ const merged = Array.isArray(prev)&&prev.length? [...prev, ...all]: [...all]; return dedupeByKey(merged); });
        if (Date.now()-startedAt>8000) break; // 8秒で部分表示打ち切り
        await sleep(600);
      }

      const enriched = dedupeByKey(all)
        .map((it)=>({ ...it, cat: classify(it) }))
        .filter((it)=> !shouldExclude(it))
        // 発行日が欠落/不正なケース（RSSの揺れ）を救済: 直近365日に緩和
        .filter((it)=> {
          if (!it.publishedAt || !(it.publishedAt instanceof Date)) return false;
          return it.publishedAt >= cutoff || it.publishedAt >= new Date(Date.now() - 365*24*60*60*1000);
        })
        .filter((it)=> (onlyWP ? onlyWhitepaper(it) : true))
        .filter((it)=>{ const qs=q.trim().toLowerCase(); if(!qs)return true; return (it.title?.toLowerCase().includes(qs) || (it.summary||'').toLowerCase().includes(qs) || (it.source||'').toLowerCase().includes(qs)); })
        .sort((a,b)=> b.publishedAt - a.publishedAt);

      setItems(enriched);
    } catch(e) {
      setError(e.message||'取得に失敗しました');
    } finally {
      setLoading(false);
    }
  }

  useEffect(()=>{ load(); /* eslint-disable-next-line */ }, [regionTab, category, daysBack, onlyWP, sources]);

  const toggleSource = (id)=> setSources((prev)=> prev.map((s)=> s.id===id? { ...s, enabled: !s.enabled } : s));
  const addSource = (obj)=> setSources((prev)=> [{ ...obj, id: crypto.randomUUID() }, ...prev]);

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-900 via-slate-800 to-slate-900 text-white">
      <header className="sticky top-0 z-30 backdrop-blur bg-white/5 border-b border-white/10">
        <div className="max-w-7xl mx-auto px-4 py-4 flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
          <div className="flex items-center gap-3">
            <motion.span className="inline-flex h-10 w-10 items-center justify-center rounded-xl bg-gradient-to-br from-pink-500 to-violet-500 shadow-lg" animate={{ rotate:[0,5,-5,0] }} transition={{ duration:2, repeat:Infinity, repeatDelay:3 }}>⚖️</motion.span>
            <div>
              <h1 className="text-xl font-bold gradient-text">法律・政策情報トラッカー</h1>
              <p className="text-xs text-white/70">主要国の法令・パブコメ・SEC情報を統合表示</p>
            </div>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <RegionTabs value={regionTab} onChange={setRegionTab} />
            <CategoryPicker value={category} onChange={setCategory} />
            <label className="flex items-center gap-2 text-sm glass-effect px-3 py-2 rounded-xl">
              <span>期間</span>
              <select value={daysBack} onChange={(e)=>setDaysBack(Number(e.target.value))} className="bg-transparent outline-none">
                {DAYS_CHOICES.map((d)=>(<option key={d} value={d}>{d}日</option>))}
              </select>
            </label>
            <label className="flex items-center gap-2 text-sm glass-effect px-3 py-2 rounded-xl">
              <input type="checkbox" checked={onlyWP} onChange={(e)=>setOnlyWP(e.target.checked)} /> 白書のみ
            </label>
            {/* 復元: 更新ボタン */}
            <motion.button onClick={load} className="px-3 py-2 rounded-xl text-sm bg-gradient-to-br from-pink-500 to-violet-500 hover:opacity-90 shadow" whileHover={{ scale:1.05 }} whileTap={{ scale:0.95 }}>更新</motion.button>
          </div>
        </div>
      </header>

      <main className="max-w-7xl mx-auto px-4 py-6 grid grid-cols-1 lg:grid-cols-4 gap-6">
        <section className="lg:col-span-3">
          <AnimatePresence mode="popLayout">
            {loading && (
              <motion.div initial={{ opacity:0 }} animate={{ opacity:1 }} exit={{ opacity:0 }} className="p-4 rounded-2xl glass-effect">
                読み込み中…
              </motion.div>
            )}
            {error && (
              <motion.div initial={{ opacity:0 }} animate={{ opacity:1 }} exit={{ opacity:0 }} className="p-4 rounded-2xl bg-red-500/20 border border-red-500/40">
                取得エラー: {error}
              </motion.div>
            )}
            <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4">
              {items.map((it, idx)=>(
                <motion.a href={it.link} key={itemKey(it)} target="_blank" rel="noreferrer" initial={{ opacity:0, y:20 }} animate={{ opacity:1, y:0 }} transition={{ delay: idx*0.01 }} className="block rounded-2xl glass-effect hover:border-white/30 p-4 group card-hover">
                  <div className="flex items-center justify-between mb-2">
                    <span className={`text-[10px] uppercase tracking-wide px-2 py-1 rounded bg-gradient-to-r ${colorByCat(it.cat)} text-white/90`}>{labelByCat(it.cat)}</span>
                    <time className="text-xs text-white/60">{fmtDate(it.publishedAt)}</time>
                  </div>
                  <h3 className="font-semibold leading-snug group-hover:underline">{highlight(it.title, q)}</h3>
                  {it.summary && (<p className="mt-1 text-sm text-white/75 line-clamp-3">{highlight(collapse(it.summary), q)}</p>)}
                  <div className="mt-3 text-xs text-white/60">{it.source}</div>
                </motion.a>
              ))}
            </div>
            {!loading && items.length===0 && (<div className="text-white/70">該当データがありません。</div>)}
          </AnimatePresence>
        </section>
        <aside className="lg:col-span-1">
          <div className="sticky top-20 flex flex-col gap-4">
            <SourcePanel sources={sources} region={regionTab} onToggle={toggleSource} onAdd={addSource} />
          </div>
        </aside>
      </main>

      <footer className="max-w-7xl mx-auto px-4 pb-8 text-xs text-white/50">
        <p>※ ネットワーク状況により一部ソースは時間がかかる場合があります。</p>
      </footer>
    </div>
  );
}

function RegionTabs({ value, onChange }) {
  const tabs = [
    { id: "jp", label: "🇯🇵 日本" },
    { id: "us", label: "🇺🇸 米国" },
    { id: "eu", label: "🇪🇺 EU" },
  ];
  return (
    <div className="glass-effect rounded-xl p-1 flex gap-1">
      {tabs.map((t)=>(
        <motion.button key={t.id} onClick={()=>onChange(t.id)} className={`px-3 py-2 text-sm rounded-lg transition ${ value===t.id? 'bg-gradient-to-br from-pink-500 to-violet-500':'hover:bg-white/10' }`} whileHover={{ scale:1.02 }} whileTap={{ scale:0.98 }}>{t.label}</motion.button>
      ))}
    </div>
  );
}

function CategoryPicker({ value, onChange }) {
  return (
    <div className="glass-effect rounded-xl p-1 flex gap-1">
      <button onClick={()=>onChange('all')} className={`px-3 py-2 text-sm rounded-lg ${ value==='all'? 'bg-white/10':'hover:bg-white/10'}`}>すべて</button>
      {CATEGORY_DEFS.map((c)=>(
        <motion.button key={c.id} onClick={()=>onChange(c.id)} className={`px-3 py-2 text-sm rounded-lg bg-gradient-to-r ${c.color} ${ value===c.id? 'opacity-100':'opacity-60 hover:opacity-80'}`} whileHover={{ scale:1.02 }} whileTap={{ scale:0.98 }}>{c.label}</motion.button>
      ))}
    </div>
  );
}

function SourcePanel({ sources, region, onToggle, onAdd }) {
  const list = sources.filter((s)=>s.region===region);
  const ref = useRef(null);
  const handleAdd = () => {
    const url = ref.current?.value?.trim();
    if (!url) return;
    const guess = url.toLowerCase().includes('federalregister.gov/api') ? { type:'json_fr_api', name:'Federal Register – Custom' } : { type:'rss', name:'Custom RSS/Atom' };
    onAdd({ url, region, enabled:true, ...guess });
    ref.current.value = '';
  };
  return (
    <div className="rounded-2xl border border-white/10 glass-effect p-4">
      <h2 className="font-semibold mb-2">情報源（{region==='jp'?'国内':'海外'}）</h2>
      <ul className="space-y-2 mb-3">
        {list.map((s)=>(
          <li key={s.id} className="flex items-center justify-between gap-2 text-sm">
            <div>
              <div className="font-medium">{s.name}</div>
              <div className="text-white/60 break-all text-xs">{s.url}</div>
            </div>
            <button onClick={()=>onToggle(s.id)} className={`px-2 py-1 rounded-lg ${ s.enabled? 'bg-emerald-500/30':'bg-white/10'}`}>{s.enabled? 'ON':'OFF'}</button>
          </li>
        ))}
      </ul>
      <div className="flex items-center gap-2">
        <input ref={ref} placeholder="RSS/Atom/FR API のURLを追加" className="flex-1 glass-effect rounded-xl px-3 py-2 text-sm placeholder:text-white/50 focus:outline-none"/>
        <button onClick={handleAdd} className="px-3 py-2 rounded-xl text-sm bg-gradient-to-br from-cyan-500 to-emerald-500">追加</button>
      </div>
    </div>
  );
}

function labelByCat(id) { return CATEGORY_DEFS.find((c)=>c.id===id)?.label || 'その他'; }
function colorByCat(id) { return CATEGORY_DEFS.find((c)=>c.id===id)?.color || 'from-slate-500 to-zinc-600'; }
function fmtDate(d) { try { return new Intl.DateTimeFormat('ja-JP', { year:'numeric', month:'2-digit', day:'2-digit' }).format(d); } catch { return ''; } }
function collapse(s) { return s.replace(/<[^>]+>/g,' ').replace(/\s+/g,' ').trim(); }
function highlight(text, q) {
  if (!q) return text;
  const parts = String(text).split(new RegExp(`(${q.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")})`, 'ig'));
  return (<>{parts.map((p,i)=>(<span key={i} className={p.toLowerCase()===q.toLowerCase()? 'bg-yellow-400/40 px-0.5 rounded':''}>{p}</span>))}</>);
}

// 安定キー生成 & 重複排除
function itemKey(it) {
  const src = it.sourceId || it.source || 'src';
  const basis = `${it.link||''}${it.title||''}${it.summary||''}`;
  const ts = (it.publishedAt instanceof Date) ? it.publishedAt.getTime() : '';
  const key = `${src}||${basis}||${ts}`;
  if (key && key !== '||') return key;
  const fallback = (typeof crypto!== 'undefined' && crypto.randomUUID) ? crypto.randomUUID() : Math.random().toString(36).slice(2);
  return `${src}||${ts}||${fallback}`;
}

function dedupeByKey(list) {
  const seen = new Set();
  const out = [];
  for (const it of list || []) {
    const k = itemKey(it);
    if (seen.has(k)) continue;
    seen.add(k);
    out.push(it);
  }
  return out;
}


