'use client';
/* eslint-disable @next/next/no-img-element -- local mutable assets should not enter an image optimizer cache */

import { useEffect, useMemo, useState } from 'react';

type ItemData = Record<string, unknown> & {
  title?: string; slug?: string; path?: string; subtitle?: string; summary?: string;
  story?: string; draft?: string; body?: string; file?: string; design?: string;
  voice?: string; role?: string; duration?: number; model?: string; status?: string; cover?: string;
  mime?: string; media_type?: string; source_url?: string; source_page?: string; note?: string;
};
type Item = { id: string; type: string; parent: string | null; data: ItemData };
type Link = { source: string; target: string; kind: string };
type Snapshot = { format: number; items: Item[]; links: Link[] };
type View = 'shelf' | 'book';
type BookMode = 'world' | 'chapter';
type WorldTab = 'character' | 'location' | 'faction' | 'prop' | 'relation' | 'temp';
type ChapterView = 'overview' | 'detail';
type PreviewTab = 'video' | 'assets' | 'tech' | 'prompt';
type FilmScope = 'shot' | 'sequence';

const docs = [
  { id: 'bookmontage', title: 'BookMontage 使用手册', file: '/docs/bookmontage.md' },
  { id: 'seedance25', title: 'Seedance 2.5', file: '/docs/seedance-2.5.md' },
  { id: 'seedance20', title: 'Seedance 2.0', file: '/docs/seedance-2.0.md' },
  { id: 'minimax', title: 'MiniMax H3', file: '/docs/minimax-h3.md' },
  { id: 'pixverse', title: 'PixVerse V6 / C1', file: '/docs/pixverse-v6-c1.md' },
  { id: 'skyreels', title: 'SkyReels V4', file: '/docs/skyreels-v4.md' },
  { id: 'agnes', title: 'Agnes Video 2.0', file: '/docs/agnes-video-2.md' },
  { id: 'gemini', title: 'Gemini Omni Flash', file: '/docs/gemini-omni-flash.md' },
];

const worldTabs: { id: WorldTab; title: string }[] = [
  { id: 'character', title: '角色' },
  { id: 'location', title: '地图' },
  { id: 'faction', title: '阵营' },
  { id: 'prop', title: '道具' },
  { id: 'relation', title: '关系' },
  { id: 'temp', title: '临时素材' },
];

const relationLabels: Record<string, string> = {
  companion: '同行',
  member_of: '隶属',
  carries: '持有',
  issued_by: '颁发者',
  audits: '审查',
};

const typeLabels: Record<string, string> = {
  character: '角色', faction: '阵营', relic: '道具', system: '体系', location: '地图', temp_asset:'临时',
};

function mediaUrl(item?: Item) {
  if (!item?.data.file) return '';
  const folder = item.type === 'temp_asset' ? 'book-temp' : 'book-assets';
  return `/${folder}/${String(item.data.file).split('/').pop()}`;
}

function MediaThumb({ item }: { item?: Item }) {
  if (!item) return <span className="file-thumb">∅</span>;
  if (item.type !== 'temp_asset' || ['image','gif'].includes(String(item.data.media_type))) return <img src={mediaUrl(item)} alt="" />;
  if (item.data.media_type === 'video') return <video src={mediaUrl(item)} muted playsInline preload="metadata" />;
  return <span className="file-thumb">{String(item.data.file || '').split('.').pop()?.toUpperCase() || 'FILE'}</span>;
}

function TempPreview({ item }: { item: Item }) {
  const kind = String(item.data.media_type || 'document');
  return <div className="temp-preview">
    <div className="temp-stage">
      {['image','gif'].includes(kind) && <img src={mediaUrl(item)} alt={String(item.data.title || '')} />}
      {kind === 'video' && <video src={mediaUrl(item)} controls playsInline />}
      {kind === 'document' && <a className="document-preview" href={mediaUrl(item)} target="_blank" rel="noreferrer"><b>{String(item.data.file || '').split('.').pop()?.toUpperCase()}</b><span>打开文档</span></a>}
    </div>
    <footer><span>{item.data.mime || kind}</span>{item.data.note && <p>{item.data.note}</p>}{item.data.source_page && <a href={String(item.data.source_page)} target="_blank" rel="noreferrer">查看来源 ↗</a>}</footer>
  </div>;
}

function dialogueOf(item?: Item) {
  return [...String(item?.data.body || '').matchAll(/[‘“']([^’”']+)[’”']/g)].map(match => match[1]);
}

function chapterShortTitle(item?: Item) {
  return String(item?.data.title || '本章').split('·')[0].trim();
}

function InlineMarkdown({ text }: { text: string }) {
  const nodes: React.ReactNode[] = [];
  const expression = /\[([^\]]+)\]\((https?:\/\/[^)]+)\)|`([^`]+)`/g;
  let cursor = 0;
  for (const match of text.matchAll(expression)) {
    const start = match.index ?? 0;
    if (start > cursor) nodes.push(text.slice(cursor, start));
    if (match[1]) nodes.push(<a key={start} href={match[2]} target="_blank" rel="noreferrer">{match[1]}</a>);
    else nodes.push(<code key={start}>{match[3]}</code>);
    cursor = start + match[0].length;
  }
  nodes.push(text.slice(cursor));
  return <>{nodes}</>;
}

function MarkdownView({ source }: { source: string }) {
  const clean = source.replace(/^---[\s\S]*?---\s*/, '');
  const lines = clean.split('\n');
  const blocks: React.ReactNode[] = [];
  for (let index = 0; index < lines.length; index += 1) {
    const line = lines[index].trim();
    if (!line) continue;
    if (line.startsWith('```')) {
      const code: string[] = [];
      index += 1;
      while (index < lines.length && !lines[index].trim().startsWith('```')) { code.push(lines[index]); index += 1; }
      blocks.push(<pre key={`code-${index}`}><code>{code.join('\n')}</code></pre>);
    } else if (line.startsWith('# ')) blocks.push(<h1 key={index}>{line.slice(2)}</h1>);
    else if (line.startsWith('## ')) blocks.push(<h2 key={index}>{line.slice(3)}</h2>);
    else if (line.startsWith('### ')) blocks.push(<h3 key={index}>{line.slice(4)}</h3>);
    else if (/^[-*] /.test(line)) blocks.push(<p className="md-list" key={index}><span>—</span><span><InlineMarkdown text={line.slice(2)} /></span></p>);
    else if (/^\d+\. /.test(line)) blocks.push(<p className="md-list" key={index}><span>{line.match(/^\d+/)?.[0]}.</span><span><InlineMarkdown text={line.replace(/^\d+\. /, '')} /></span></p>);
    else blocks.push(<p key={index}><InlineMarkdown text={line} /></p>);
  }
  return <article className="markdown-body">{blocks}</article>;
}

function DocsButton({ onClick }: { onClick: () => void }) {
  return <button className="docs-button" onClick={onClick} aria-label="打开使用文档" title="使用文档">
    <svg viewBox="0 0 24 24" aria-hidden="true"><path d="M6 3.8h9.4L19 7.4v12.8H6z"/><path d="M15 3.8v4h4M9 12h7M9 15.5h7"/></svg>
  </button>;
}

function DocsDrawer({ open, onClose }: { open: boolean; onClose: () => void }) {
  const [selected, setSelected] = useState(docs[0]);
  const [source, setSource] = useState('');
  useEffect(() => {
    if (!open) return;
    fetch(selected.file, { cache: 'no-store' }).then(response => response.text()).then(setSource).catch(() => setSource('# 文档读取失败'));
  }, [open, selected]);
  if (!open) return null;
  return <div className="docs-overlay" role="dialog" aria-modal="true" aria-label="使用文档" onClick={onClose}>
    <button className="docs-dismiss" onClick={onClose} aria-label="关闭文档">×</button>
    <section className="docs-glass" onClick={event => event.stopPropagation()}>
      <nav>{docs.map(doc => <button key={doc.id} className={selected.id === doc.id ? 'active' : ''} onClick={() => setSelected(doc)}>{doc.title}</button>)}</nav>
      <div className="docs-content"><MarkdownView source={source} /></div>
    </section>
  </div>;
}

export default function Home() {
  const [library, setLibrary] = useState<Snapshot | null>(null);
  const [loadError, setLoadError] = useState('');
  const [view, setView] = useState<View>('shelf');
  const [bookMode, setBookMode] = useState<BookMode>('world');
  const [worldTab, setWorldTab] = useState<WorldTab>('character');
  const [entityId, setEntityId] = useState('');
  const [assetIndex, setAssetIndex] = useState(0);
  const [chapterView, setChapterView] = useState<ChapterView>('overview');
  const [chapterId, setChapterId] = useState('');
  const [shotIndex, setShotIndex] = useState(0);
  const [previewTab, setPreviewTab] = useState<PreviewTab>('video');
  const [filmScope, setFilmScope] = useState<FilmScope>('shot');
  const [previewCount, setPreviewCount] = useState(1);
  const [sequenceOffset, setSequenceOffset] = useState(0);
  const [previewMenuOpen, setPreviewMenuOpen] = useState(false);
  const [docsOpen, setDocsOpen] = useState(false);
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    fetch('/generated/library.json', { cache: 'no-store' })
      .then(response => response.ok ? response.json() : Promise.reject(new Error(`HTTP ${response.status}`)))
      .then(setLibrary)
      .catch(error => setLoadError(error instanceof Error ? error.message : String(error)));
  }, []);

  useEffect(() => {
    const onEscape = (event: KeyboardEvent) => {
      if (event.key !== 'Escape') return;
      if (docsOpen) setDocsOpen(false);
      else if (previewMenuOpen) setPreviewMenuOpen(false);
      else if (view === 'book' && bookMode === 'chapter' && chapterView === 'detail') setChapterView('overview');
      else if (view === 'book') setView('shelf');
    };
    window.addEventListener('keydown', onEscape);
    return () => window.removeEventListener('keydown', onEscape);
  }, [bookMode, chapterView, docsOpen, previewMenuOpen, view]);

  const items = useMemo(() => {
    const latest = new Map<string, Item>();
    for (const item of library?.items ?? []) latest.set(item.id.slice(0, -4), item);
    return [...latest.values()];
  }, [library]);
  const links = library?.links ?? [];
  const itemByLogicalId = (id: string) => items.find(item => item.id.slice(0, -4) === id.slice(0, -4));
  const book = items.find(item => item.type === 'book');
  const chapters = items.filter(item => item.type === 'chapter' && item.parent === book?.id);
  const chapter = chapters.find(item => item.id === chapterId) ?? chapters[0];
  const shots = items.filter(item => item.type === 'shot' && item.parent === chapter?.id);
  const shot = shots[Math.min(shotIndex, Math.max(shots.length - 1, 0))];
  const cover = items.find(item => item.id === book?.data.cover);
  const chapterFilm = items.filter(item => item.type === 'film' && item.parent === chapter?.id).at(-1);
  const clipFor = (target?: Item) => items.filter(item => item.type === 'clip' && item.parent === target?.id).at(-1);
  const clip = clipFor(shot);
  const sequenceShot = shots[Math.min(shotIndex + sequenceOffset, shots.length - 1)];
  const displayClip = filmScope === 'sequence' ? clipFor(sequenceShot) : clip;
  const shotRefs = shot ? links.filter(link => link.source === shot.id && ['depends', 'relates'].includes(link.kind)).map(link => itemByLogicalId(link.target)).filter((item): item is Item => Boolean(item)) : [];
  const shotVisuals = shotRefs.filter(item => item.type === 'asset');
  const worldItems = items.filter(item => {
    if (item.parent !== book?.id) return false;
    if (worldTab === 'temp') return item.type === 'temp_asset';
    if (worldTab === 'prop') return ['system', 'relic'].includes(item.type);
    return item.type === worldTab;
  });
  const entity = worldItems.find(item => item.id === entityId) ?? worldItems[0];
  const assetsFor = (target?: Item) => target ? links.filter(link => link.source === target.id && link.kind === 'depends').map(link => itemByLogicalId(link.target)).filter((item): item is Item => item?.type === 'asset') : [];
  const thumbnailFor = (target?: Item) => target?.type === 'temp_asset' ? target : assetsFor(target)[0] ?? cover;
  const entityAssets = assetsFor(entity);
  const entityAsset = entityAssets[Math.min(assetIndex, Math.max(entityAssets.length - 1, 0))];
  const relationEdges = links.filter(link => relationLabels[link.kind]).map(link => ({ ...link, sourceItem: itemByLogicalId(link.source), targetItem: itemByLogicalId(link.target) })).filter((link): link is Link & { sourceItem: Item; targetItem: Item } => Boolean(link.sourceItem && link.targetItem));
  const relationNodes = [...new Map(relationEdges.flatMap(edge => [edge.sourceItem, edge.targetItem]).map(item => [item.id, item])).values()];
  const relationFocus = relationNodes.find(item => item.id === entityId) ?? relationNodes[0];
  const focusEdges = relationEdges.filter(edge => edge.sourceItem.id === relationFocus?.id || edge.targetItem.id === relationFocus?.id);
  const ambient = chapterFilm ?? clip;
  const remainingShots = Math.max(shots.length - shotIndex, 1);

  async function copyHarnessTask() {
    if (!shot) return;
    const prompt = `请在 BookMontage 中处理 ${shot.data.path || shot.id}（ID: ${shot.id}）。读取项目 Skill 和关联资产，保留人类草稿意图，完善 story 与 body；写回 SQLite 后运行 bookmontage export 和 bookmontage verify，等待人类审核。`;
    await navigator.clipboard.writeText(prompt);
    setCopied(true);
    window.setTimeout(() => setCopied(false), 1600);
  }

  function selectShot(index: number) {
    setShotIndex(index);
    setPreviewTab('video');
    setFilmScope('shot');
    setSequenceOffset(0);
    setPreviewMenuOpen(false);
  }

  function startSequence(count: number) {
    setPreviewCount(count);
    setSequenceOffset(0);
    setFilmScope('sequence');
    setPreviewMenuOpen(false);
  }

  if (!library || !book) return <main className="loading"><span>书间</span><p>{loadError || '正在读取藏书'}</p></main>;

  if (view === 'shelf') return <main className="home-stage">
    {ambient && <video className="ambient-video" src={mediaUrl(ambient)} poster={mediaUrl(cover)} autoPlay muted loop playsInline />}
    <div className="home-wash" />
    <header className="home-header">
      <div className="wordmark"><span>BOOKMONTAGE</span><i>#</i><strong>书间</strong></div>
      <DocsButton onClick={() => setDocsOpen(true)} />
    </header>
    <section className="bookshelf" aria-label="书架">
      <div className="shelf-lines" aria-hidden="true"><i/><i/><i/></div>
      <button className="book-card" onClick={() => setView('book')} aria-label={`打开《${book.data.title}》`}>
        <img src={mediaUrl(cover)} alt="" />
        <span className="book-card-glass"><strong>{book.data.title}</strong><em>{book.data.subtitle}</em></span>
      </button>
    </section>
    <DocsDrawer open={docsOpen} onClose={() => setDocsOpen(false)} />
  </main>;

  return <main className="workspace" onMouseDown={event => { if (event.target === event.currentTarget) setView('shelf'); }}>
    {ambient && <video className="ambient-video workspace-video" src={mediaUrl(ambient)} poster={mediaUrl(cover)} autoPlay muted loop playsInline />}
    <div className="workspace-wash" />
    <header className="workspace-header">
      <button className="back-button" onClick={() => setView('shelf')} aria-label="返回书架">← <span>书架</span></button>
      <nav className="mode-switch" aria-label="书籍视图">
        <button className={bookMode === 'world' ? 'active' : ''} onClick={() => setBookMode('world')}>全局</button>
        <button className={bookMode === 'chapter' ? 'active' : ''} onClick={() => { setBookMode('chapter'); setChapterView('overview'); }}>章节</button>
      </nav>
      <DocsButton onClick={() => setDocsOpen(true)} />
    </header>

    <section className="glass-book">
      {bookMode === 'world' && <>
        <nav className="side-bookmarks" aria-label="全局资产类别">{worldTabs.map(tab => <button key={tab.id} className={worldTab === tab.id ? 'active' : ''} onClick={() => { setWorldTab(tab.id); setEntityId(''); setAssetIndex(0); }}>{tab.title}</button>)}</nav>
        {worldTab !== 'relation' ? <>
          <div className="glass-page entity-page">
            <div className="entity-list">{worldItems.map(item => <button key={item.id} className={entity?.id === item.id ? 'active' : ''} onClick={() => { setEntityId(item.id); setAssetIndex(0); }}>
              <MediaThumb item={thumbnailFor(item)} />
              <span><strong>{item.data.title}</strong><small>{item.data.role || typeLabels[item.type]}</small></span>
            </button>)}</div>
          </div>
          <div className="book-seam" />
          <div className="glass-page asset-page">
            {entity && entity.type === 'temp_asset' ? <><h1>{entity.data.title}</h1><TempPreview item={entity} /></> : entity && <>
              <h1>{entity.data.title}</h1>
              {entityAssets.length > 0 ? <>
                <div className="asset-switcher">{entityAssets.map((asset, index) => <button key={asset.id} className={assetIndex === index ? 'active' : ''} onClick={() => setAssetIndex(index)}>{asset.data.title}</button>)}</div>
                <figure className="entity-visual"><img src={mediaUrl(entityAsset)} alt={String(entityAsset?.data.title || entity.data.title)} /><figcaption>{entityAsset?.data.title}</figcaption></figure>
              </> : <div className="text-asset"><p>{entity.data.design}</p></div>}
            </>}
          </div>
        </> : <>
          <div className="glass-page entity-page relation-index">
            <div className="entity-list">{relationNodes.map(item => <button key={item.id} className={relationFocus?.id === item.id ? 'active' : ''} onClick={() => setEntityId(item.id)}>
              <img src={mediaUrl(thumbnailFor(item))} alt="" />
              <span><strong>{item.data.title}</strong><small>{typeLabels[item.type]}</small></span>
            </button>)}</div>
          </div>
          <div className="book-seam" />
          <div className="glass-page relation-page">
            {relationFocus && <><h1>{relationFocus.data.title}</h1><div className="relation-canvas">
              <article className="relation-node relation-center"><img src={mediaUrl(thumbnailFor(relationFocus))} alt=""/><strong>{relationFocus.data.title}</strong><span>{typeLabels[relationFocus.type]}</span></article>
              {focusEdges.map((edge, index) => {
                const outgoing = edge.sourceItem.id === relationFocus.id;
                const neighbor = outgoing ? edge.targetItem : edge.sourceItem;
                const angle = (360 / Math.max(focusEdges.length, 1)) * index - 90;
                return <div className="relation-branch" key={`${edge.source}-${edge.target}-${edge.kind}`} style={{ '--angle': `${angle}deg` } as React.CSSProperties}>
                  <i/><em>{outgoing ? relationLabels[edge.kind] : `${relationLabels[edge.kind]} · 反向`}</em>
                  <button onClick={() => setEntityId(neighbor.id)}><img src={mediaUrl(thumbnailFor(neighbor))} alt=""/><strong>{neighbor.data.title}</strong><span>{typeLabels[neighbor.type]}</span></button>
                </div>;
              })}
            </div></>}
          </div>
        </>}
      </>}

      {bookMode === 'chapter' && <>
        <nav className="side-bookmarks chapter-bookmarks" aria-label="章节层级">
          <button className={chapterView === 'overview' ? 'active' : ''} onClick={() => setChapterView('overview')}>章节总览</button>
          {chapter && <button className={chapterView === 'detail' ? 'active' : ''} onClick={() => setChapterView('detail')}>{chapterShortTitle(chapter)}</button>}
        </nav>
        {chapterView === 'overview' ? <>
          <div className="glass-page chapter-index-page">
            <div className="chapter-list">{chapters.map((item, index) => <button key={item.id} className={chapter?.id === item.id ? 'active' : ''} onClick={() => { setChapterId(item.id); setShotIndex(0); }}><span>{String(index + 1).padStart(2, '0')}</span><strong>{item.data.title}</strong></button>)}</div>
          </div>
          <div className="book-seam" />
          <div className="glass-page chapter-overview-page">
            {chapter && <><span className="chapter-number">CHAPTER {String(chapters.indexOf(chapter) + 1).padStart(2, '0')}</span><h1>{chapter.data.title}</h1><p>{chapter.data.summary}</p><button className="enter-chapter" onClick={() => setChapterView('detail')}>进入本章 <span>→</span></button></>}
          </div>
        </> : <>
          <div className="glass-page narrative-page">
            <div className="story-list">{shots.map((item, index) => <button key={item.id} className={shot?.id === item.id ? 'active' : ''} onClick={() => selectShot(index)}>
              <h2>{item.data.title}</h2><p>{item.data.story}</p>
              {dialogueOf(item).map((line, quoteIndex) => <blockquote key={quoteIndex}>“{line}”</blockquote>)}
            </button>)}</div>
          </div>
          <div className="book-seam" />
          <div className="glass-page preview-page">
            <nav className="preview-switcher" aria-label="段落详情">
              <button className={previewTab === 'video' ? 'active' : ''} onClick={() => setPreviewTab('video')}>视频</button>
              <button className={previewTab === 'assets' ? 'active' : ''} onClick={() => setPreviewTab('assets')}>引用资产</button>
              <button className={previewTab === 'tech' ? 'active' : ''} onClick={() => setPreviewTab('tech')}>技术细节</button>
              <button className={previewTab === 'prompt' ? 'active' : ''} onClick={() => setPreviewTab('prompt')}>Head & Body</button>
            </nav>
            {previewTab === 'video' && <div className="video-view">
              <video key={displayClip?.id} controls autoPlay={filmScope === 'sequence'} src={mediaUrl(displayClip)} poster={mediaUrl(shotVisuals.at(-1) ?? cover)} onEnded={() => { if (filmScope === 'sequence' && sequenceOffset + 1 < previewCount) setSequenceOffset(sequenceOffset + 1); }} />
              <div className="video-scope"><button className={filmScope === 'shot' ? 'active' : ''} onClick={() => { setFilmScope('shot'); setPreviewMenuOpen(false); }}>本段</button><span className="sequence-picker"><button className={filmScope === 'sequence' ? 'active' : ''} onClick={() => setPreviewMenuOpen(!previewMenuOpen)}>往后预演</button>{previewMenuOpen && <span className="sequence-menu">{Array.from({ length: remainingShots }, (_, index) => index + 1).map(count => <button key={count} onClick={() => startSequence(count)}>从本段起 · {count} 段</button>)}</span>}</span>{filmScope === 'sequence' && <em>{sequenceOffset + 1} / {previewCount}</em>}</div>
            </div>}
            {previewTab === 'assets' && <div className="reference-grid">{shotRefs.map(ref => <article key={ref.id}>{ref.type === 'asset' && <img src={mediaUrl(ref)} alt="" />}<strong>{ref.data.title}</strong><span>{ref.type}</span></article>)}</div>}
            {previewTab === 'tech' && shot && <div className="tech-sheet"><dl><div><dt>模型</dt><dd>{shot.data.model}</dd></div><div><dt>时长</dt><dd>{shot.data.duration} 秒</dd></div><div><dt>状态</dt><dd>{shot.data.status}</dd></div><div className="wide"><dt>人类草稿</dt><dd>{shot.data.draft}</dd></div></dl></div>}
            {previewTab === 'prompt' && shot && <div className="prompt-sheet"><section><h3>HEAD</h3>{shotRefs.map((ref, index) => <p key={ref.id}>@{index + 1}　{ref.data.title}</p>)}</section><section><h3>BODY</h3><p>{shot.data.body}</p></section><button onClick={copyHarnessTask}>{copied ? '已复制' : '复制给 Harness'}</button></div>}
          </div>
        </>}
      </>}
    </section>
    <DocsDrawer open={docsOpen} onClose={() => setDocsOpen(false)} />
  </main>;
}
