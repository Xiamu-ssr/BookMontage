'use client';
/* eslint-disable @next/next/no-img-element -- local mutable assets should not be copied into an optimizer cache */

import { useEffect, useMemo, useState } from 'react';

type ItemData = Record<string, unknown> & {
  title?: string; slug?: string; path?: string; subtitle?: string; summary?: string;
  story?: string; draft?: string; body?: string; file?: string; prompt?: string;
  design?: string; voice?: string; role?: string; state?: string; duration?: number;
  model?: string; status?: string; cover?: string;
};
type Item = { id: string; type: string; parent: string | null; data: ItemData };
type Link = { source: string; target: string; kind: string };
type Snapshot = { format: number; items: Item[]; links: Link[] };
type ShelfView = 'shelf' | 'book';
type BookTab = 'world' | 'chapters';
type PreviewTab = 'film' | 'assets' | 'spec';
type WorldTab = 'character' | 'location' | 'faction' | 'system' | 'relic';

const worldTabs: { id: WorldTab; label: string; sigil: string }[] = [
  { id: 'character', label: '角色', sigil: '人' },
  { id: 'location', label: '山河', sigil: '境' },
  { id: 'faction', label: '阵营', sigil: '盟' },
  { id: 'system', label: '术法', sigil: '法' },
  { id: 'relic', label: '灵物', sigil: '器' },
];

function mediaUrl(item?: Item) {
  if (!item?.data.file) return '';
  return `/book-assets/${String(item.data.file).split('/').pop()}`;
}

function shortVersion(id?: string) {
  return id ? `v${Number(id.slice(-4))}` : 'v—';
}

export default function Home() {
  const [library, setLibrary] = useState<Snapshot | null>(null);
  const [loadError, setLoadError] = useState('');
  const [view, setView] = useState<ShelfView>('shelf');
  const [bookTab, setBookTab] = useState<BookTab>('chapters');
  const [worldTab, setWorldTab] = useState<WorldTab>('character');
  const [selectedBeat, setSelectedBeat] = useState(0);
  const [selectedLore, setSelectedLore] = useState(0);
  const [previewTab, setPreviewTab] = useState<PreviewTab>('film');
  const [detailMode, setDetailMode] = useState(false);
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    fetch('/generated/library.json', { cache: 'no-store' })
      .then(response => response.ok ? response.json() : Promise.reject(new Error(`HTTP ${response.status}`)))
      .then(setLibrary)
      .catch(error => setLoadError(error instanceof Error ? error.message : String(error)));
  }, []);

  const items = useMemo(() => {
    const latest = new Map<string, Item>();
    for (const item of library?.items ?? []) latest.set(item.id.slice(0, -4), item);
    return [...latest.values()];
  }, [library]);
  const book = items.find(item => item.type === 'book');
  const chapter = items.find(item => item.type === 'chapter' && item.parent === book?.id);
  const shots = items.filter(item => item.type === 'shot' && item.parent === chapter?.id);
  const assets = items.filter(item => item.type === 'asset' && item.parent === book?.id);
  const cover = items.find(item => item.id === book?.data.cover);
  const beat = shots[Math.min(selectedBeat, Math.max(shots.length - 1, 0))];
  const refs = beat ? (library?.links ?? [])
    .filter(link => link.source === beat.id && ['depends', 'relates'].includes(link.kind))
    .map(link => items.find(item => item.id === link.target))
    .filter((item): item is Item => Boolean(item)) : [];
  const clips = items.filter(item => item.type === 'clip' && item.parent === beat?.id);
  const clip = clips.at(-1);
  const chapterFilm = items.filter(item => item.type === 'film' && item.parent === chapter?.id).at(-1);
  const visualRefs = refs.filter(item => item.type === 'asset');
  const fallbackFrame = visualRefs.at(-1) ?? assets.find(item => item.data.slug === 'temple-inspector-keyframe') ?? cover;
  const loreItems = items.filter(item => item.type === worldTab && item.parent === book?.id);
  const lore = loreItems[Math.min(selectedLore, Math.max(loreItems.length - 1, 0))];
  const totalDuration = shots.reduce((sum, shot) => sum + Number(shot.data.duration || 0), 0);

  async function copyHarnessTask() {
    if (!beat) return;
    const prompt = `请在 BookMontage 中处理 ${beat.data.path || beat.id}（ID: ${beat.id}）。读取项目 Skill 和关联资产，保留人类草稿意图，完善 story 与 body；写回 SQLite 后运行 bookmontage export 和 bookmontage verify，等待人类审核。`;
    await navigator.clipboard.writeText(prompt);
    setCopied(true);
    window.setTimeout(() => setCopied(false), 1800);
  }

  if (!library || !book) {
    return <main className="loading-shell"><span className="brand-seal">卷</span><p>{loadError ? `藏书读取失败：${loadError}` : '正在展开藏书……'}</p></main>;
  }

  if (view === 'shelf') {
    return (
      <main className="library-shell">
        <div className="sun-haze" />
        <div className="floating-motes" aria-hidden="true">{Array.from({ length: 12 }).map((_, index) => <i key={index} />)}</div>
        <header className="library-header">
          <div className="brand-lockup"><span className="brand-seal">卷</span><div><p>BOOKMONTAGE</p><h1>书间</h1></div></div>
          <div className="quiet-status"><span /> Harness 可读 · SQLite 本地藏书</div>
        </header>
        <section className="shelf-stage" aria-labelledby="shelf-title">
          <div className="shelf-copy">
            <p className="eyebrow">一方世界，始于一卷</p>
            <h2 id="shelf-title">今日，翻开哪一个故事？</h2>
            <p>这里没有表格和新建按钮。你负责想象与裁定，Harness 替你整理、续写与执行。</p>
          </div>
          <div className="wooden-alcove">
            <div className="alcove-arch"><span>❦</span></div>
            <button className="hero-book" onClick={() => setView('book')} aria-label={`打开《${book.data.title}》`}>
              <span className="book-spine" /><span className="cover-art" style={{ backgroundImage: `url('${mediaUrl(cover)}')` }} /><span className="cover-vignette" />
              <span className="cover-frame"><small>第一卷</small><strong>{book.data.title}</strong><em>{book.data.subtitle}</em><b>❦</b></span>
            </button>
            <p className="open-hint"><span>↟</span> 轻触封面，入卷</p><div className="shelf-plank"><span /><span /><span /></div>
          </div>
          <div className="library-footnote"><span>藏书一卷</span><i /><span>{shots.length} 段镜头 · {totalDuration} 秒</span><i /><span>{assets.length} 项视觉资产已锚定</span></div>
        </section>
      </main>
    );
  }

  return (
    <main className="reading-room">
      <header className="book-toolbar">
        <button className="return-shelf" onClick={() => setView('shelf')}>← 回到书架</button>
        <div className="book-identity"><span>卷一</span><strong>{book.data.title}</strong><small>{book.data.status === 'draft' ? '创作中' : String(book.data.status || '')}</small></div>
        <div className="harness-location"><span>只读视图</span><code>{String(beat?.data.path || chapter?.data.path || '')}</code></div>
      </header>
      <nav className="ribbon-tabs" aria-label="书籍视图">
        <button className={bookTab === 'world' ? 'active' : ''} onClick={() => { setBookTab('world'); setDetailMode(false); }}>全局设定</button>
        <button className={bookTab === 'chapters' ? 'active' : ''} onClick={() => setBookTab('chapters')}>{chapter?.data.title}</button>
      </nav>

      <section className="open-book" aria-label={`打开的${book.data.title}`}>
        <span className="book-clasp left" aria-hidden="true" /><span className="book-clasp right" aria-hidden="true" />
        <div className="page page-left">
          <span className="ornament-corner tl">❦</span><span className="ornament-corner bl">❦</span>
          {bookTab === 'chapters' && !detailMode && <>
            <div className="page-heading"><div><p>CHAPTER ONE</p><h2>{chapter?.data.title}</h2></div><div className="chapter-actions"><span className="chapter-duration">{totalDuration} 秒 · {shots.length} 镜</span>{chapterFilm && <a href={mediaUrl(chapterFilm)} target="_blank">▶ 连续预演</a>}</div></div>
            <p className="chapter-lede">{chapter?.data.summary}</p>
            <div className="story-stream">{shots.map((shot, index) => (
              <button key={shot.id} className={`story-beat ${beat?.id === shot.id ? 'selected' : ''}`} onClick={() => { setSelectedBeat(index); setPreviewTab('film'); }}>
                <span className="beat-number">{String(index + 1).padStart(2, '0')}</span>
                <span className="beat-copy"><small>{String(index * Number(shot.data.duration || 10)).padStart(2, '0')}—{String((index + 1) * Number(shot.data.duration || 10)).padStart(2, '0')} 秒 · {shot.data.title}</small>{shot.data.story}</span>
                <span className="hover-assets">{(library.links ?? []).filter(link => link.source === shot.id).slice(0, 3).map(link => <i key={`${link.source}-${link.target}`}>{items.find(item => item.id === link.target)?.data.title}</i>)}</span>
              </button>
            ))}</div>
          </>}

          {bookTab === 'chapters' && detailMode && beat && <>
            <div className="page-heading detail-heading"><div><p>SHOT {String(selectedBeat + 1).padStart(3, '0')}</p><h2>Head & Body</h2></div><button className="text-button" onClick={() => setDetailMode(false)}>← 回叙事</button></div>
            <section className="spec-block"><header><span>HEAD · 引用</span><small>唯一事实源</small></header><div className="asset-reference-list">{refs.map((ref, index) => <span key={ref.id}><b>@{index + 1}</b><strong>{ref.data.title}</strong><i>{ref.type} · {shortVersion(ref.id)}</i></span>)}</div></section>
            <section className="spec-block body-block"><header><span>BODY · 模型提示</span><small>{beat.data.model}</small></header><p>{beat.data.body}</p></section>
            <button className="copy-harness" onClick={copyHarnessTask}><span>{copied ? '✓' : '⧉'}</span>{copied ? '已复制给 Harness' : '复制 Harness 任务'}</button>
          </>}

          {bookTab === 'world' && <>
            <div className="page-heading"><div><p>WORLD BIBLE</p><h2>全局设定</h2></div><span className="version-pill">单一事实源</span></div>
            <p className="chapter-lede">角色、地点和规则只在这里定义一次。镜头只保存引用；上游换版后，下游会亮起警告。</p>
            <div className="world-index">{worldTabs.map(tab => (
              <button key={tab.id} className={worldTab === tab.id ? 'active' : ''} onClick={() => { setWorldTab(tab.id); setSelectedLore(0); }}><span>{tab.sigil}</span><strong>{tab.label}</strong><small>{items.filter(item => item.type === tab.id).length} 项</small></button>
            ))}</div>
            <p className="world-note">“世界观不是提示词的附件；它是每个镜头共同引用的一本账。”</p>
          </>}
          <span className="page-number">— 12 —</span>
        </div>

        <div className="book-gutter"><span /></div>

        <div className="page page-right">
          <span className="ornament-corner tr">❦</span><span className="ornament-corner br">❦</span>
          {bookTab === 'chapters' && beat && <>
            <div className="preview-heading"><div><p>{beat.data.slug}</p><h2>{beat.data.title}</h2></div><button className="detail-toggle" onClick={() => setDetailMode(!detailMode)}>{detailMode ? '收起技术页' : '查看 Head & Body'}</button></div>
            <nav className="preview-tabs" aria-label="镜头预览">
              <button className={previewTab === 'film' ? 'active' : ''} onClick={() => setPreviewTab('film')}>成片</button>
              <button className={previewTab === 'assets' ? 'active' : ''} onClick={() => setPreviewTab('assets')}>引用资产</button>
              <button className={previewTab === 'spec' ? 'active' : ''} onClick={() => setPreviewTab('spec')}>生成约束</button>
            </nav>
            {previewTab === 'film' && <div className="film-preview">
              {clip ? <video controls src={mediaUrl(clip)} poster={mediaUrl(fallbackFrame)} /> : <div className="empty-film" style={{ backgroundImage: `url('${mediaUrl(fallbackFrame)}')` }}><span>候选成片尚未生成</span><small>关键画面 · {fallbackFrame?.data.title}</small></div>}
              <div className="film-caption"><span>{beat.data.model} · {beat.data.duration}s</span><b>{clip ? `${clip.data.status} · ${shortVersion(clip.id)}` : 'READY FOR GENERATION'}</b></div>
              <div className="selected-assets-strip"><p>当前镜头的事实引用</p><div>{refs.map(ref => <span key={ref.id}>{ref.data.title} · {shortVersion(ref.id)}</span>)}</div></div>
            </div>}
            {previewTab === 'assets' && <div className="asset-grid">{(visualRefs.length ? visualRefs : assets).slice(0, 3).map(asset => <article key={asset.id}><img src={mediaUrl(asset)} alt={String(asset.data.title)} /><div><small>{asset.data.scope === 'global' ? 'GLOBAL ASSET' : asset.type.toUpperCase()}</small><strong>{asset.data.title}</strong></div><span>{shortVersion(asset.id)}</span></article>)}</div>}
            {previewTab === 'spec' && <div className="constraint-sheet"><p>镜头生成约束</p><ul><li><span>时长</span>{beat.data.duration} 秒，16:9</li><li><span>模型</span>{beat.data.model}</li><li><span>状态</span>{beat.data.status}，生成后仍须人类验收</li><li><span>草稿</span>{beat.data.draft}</li><li><span>对白</span>写进动作发生的时间段，不依赖后期猜配</li></ul></div>}
          </>}

          {bookTab === 'world' && <>
            <div className="preview-heading"><div><p>{worldTabs.find(tab => tab.id === worldTab)?.label.toUpperCase()}</p><h2>{lore?.data.title || '尚未落笔'}</h2></div>{lore && <span className="version-pill">{shortVersion(lore.id)}</span>}</div>
            {worldTab === 'character' ? <>
              <div className="world-asset-hero" style={{ backgroundImage: `url('${mediaUrl(assets.find(item => item.data.slug === 'four-demons-character-bible'))}')` }}><span>角色总览 · 全局引用</span></div>
              <div className="character-list">{loreItems.map((item, index) => <button key={item.id} className={lore?.id === item.id ? 'active' : ''} onClick={() => setSelectedLore(index)}><strong>{item.data.title}</strong><small>{item.data.role} · {shortVersion(item.id)}</small></button>)}</div>
            </> : null}
            {lore && <article className="lore-card compact"><span>{worldTabs.find(tab => tab.id === worldTab)?.sigil}</span><small>{lore.type.toUpperCase()}</small><h2>{lore.data.title}</h2><p>{lore.data.design}</p>{lore.data.voice && <i>音色：{lore.data.voice}</i>}</article>}
          </>}
          <span className="page-number">— 13 —</span>
        </div>
      </section>
    </main>
  );
}
