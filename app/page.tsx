'use client';
/* eslint-disable @next/next/no-img-element -- local mutable assets should not enter an image optimizer cache */

import { useEffect, useMemo, useState } from 'react';

type ItemData = Record<string, unknown> & {
  title?: string; slug?: string; path?: string; subtitle?: string; summary?: string;
  story?: string; draft?: string; body?: string; file?: string; design?: string;
  voice?: string; role?: string; duration?: number; model?: string; status?: string; cover?: string;
};
type Item = { id: string; type: string; parent: string | null; data: ItemData };
type Link = { source: string; target: string; kind: string };
type Snapshot = { format: number; items: Item[]; links: Link[] };
type View = 'shelf' | 'book';
type BookMode = 'world' | 'chapter';
type WorldTab = 'character' | 'location' | 'faction' | 'prop';
type PreviewTab = 'video' | 'assets' | 'tech' | 'prompt';
type FilmScope = 'shot' | 'chapter';

const docs = [
  { id: 'bookmontage', title: 'BookMontage 使用手册', file: '/docs/bookmontage.md' },
  { id: 'seedance', title: 'Seedance 2.5', file: '/docs/seedance-2.5.md' },
  { id: 'minimax', title: 'MiniMax H3', file: '/docs/minimax-h3.md' },
];

const worldTabs: { id: WorldTab; title: string }[] = [
  { id: 'character', title: '角色' },
  { id: 'location', title: '地图' },
  { id: 'faction', title: '阵营' },
  { id: 'prop', title: '道具' },
];

function mediaUrl(item?: Item) {
  return item?.data.file ? `/book-assets/${String(item.data.file).split('/').pop()}` : '';
}

function dialogueOf(item?: Item) {
  return [...String(item?.data.body || '').matchAll(/[‘“']([^’”']+)[’”']/g)].map(match => match[1]);
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
  return <div className="docs-overlay" role="dialog" aria-modal="true" aria-label="使用文档">
    <button className="docs-dismiss" onClick={onClose} aria-label="关闭文档">×</button>
    <section className="docs-glass">
      <nav>{docs.map(doc => <button key={doc.id} className={selected.id === doc.id ? 'active' : ''} onClick={() => setSelected(doc)}>{doc.title}</button>)}</nav>
      <div className="docs-content"><MarkdownView source={source} /></div>
    </section>
  </div>;
}

export default function Home() {
  const [library, setLibrary] = useState<Snapshot | null>(null);
  const [loadError, setLoadError] = useState('');
  const [view, setView] = useState<View>('shelf');
  const [bookMode, setBookMode] = useState<BookMode>('chapter');
  const [worldTab, setWorldTab] = useState<WorldTab>('character');
  const [entityId, setEntityId] = useState('');
  const [assetIndex, setAssetIndex] = useState(0);
  const [shotIndex, setShotIndex] = useState(0);
  const [previewTab, setPreviewTab] = useState<PreviewTab>('video');
  const [filmScope, setFilmScope] = useState<FilmScope>('shot');
  const [docsOpen, setDocsOpen] = useState(false);
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
  const links = library?.links ?? [];
  const book = items.find(item => item.type === 'book');
  const chapter = items.find(item => item.type === 'chapter' && item.parent === book?.id);
  const shots = items.filter(item => item.type === 'shot' && item.parent === chapter?.id);
  const shot = shots[Math.min(shotIndex, Math.max(shots.length - 1, 0))];
  const cover = items.find(item => item.id === book?.data.cover);
  const chapterFilm = items.filter(item => item.type === 'film' && item.parent === chapter?.id).at(-1);
  const clip = items.filter(item => item.type === 'clip' && item.parent === shot?.id).at(-1);
  const shotRefs = shot ? links.filter(link => link.source === shot.id && ['depends', 'relates'].includes(link.kind)).map(link => items.find(item => item.id === link.target)).filter((item): item is Item => Boolean(item)) : [];
  const shotVisuals = shotRefs.filter(item => item.type === 'asset');
  const worldItems = items.filter(item => {
    if (item.parent !== book?.id) return false;
    if (worldTab === 'prop') return ['system', 'relic'].includes(item.type);
    return item.type === worldTab;
  });
  const entity = worldItems.find(item => item.id === entityId) ?? worldItems[0];
  const entityAssets = entity ? links.filter(link => link.source === entity.id && link.kind === 'depends').map(link => items.find(item => item.id === link.target)).filter((item): item is Item => item?.type === 'asset') : [];
  const entityAsset = entityAssets[Math.min(assetIndex, Math.max(entityAssets.length - 1, 0))];
  const ambient = chapterFilm ?? clip;

  async function copyHarnessTask() {
    if (!shot) return;
    const prompt = `请在 BookMontage 中处理 ${shot.data.path || shot.id}（ID: ${shot.id}）。读取项目 Skill 和关联资产，保留人类草稿意图，完善 story 与 body；写回 SQLite 后运行 bookmontage export 和 bookmontage verify，等待人类审核。`;
    await navigator.clipboard.writeText(prompt);
    setCopied(true);
    window.setTimeout(() => setCopied(false), 1600);
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

  return <main className="workspace">
    {ambient && <video className="ambient-video workspace-video" src={mediaUrl(ambient)} poster={mediaUrl(cover)} autoPlay muted loop playsInline />}
    <div className="workspace-wash" />
    <header className="workspace-header">
      <button className="back-button" onClick={() => setView('shelf')} aria-label="返回书架">← <span>书架</span></button>
      <nav className="mode-switch" aria-label="书籍视图">
        <button className={bookMode === 'world' ? 'active' : ''} onClick={() => setBookMode('world')}>全局</button>
        <button className={bookMode === 'chapter' ? 'active' : ''} onClick={() => setBookMode('chapter')}>章节</button>
      </nav>
      <DocsButton onClick={() => setDocsOpen(true)} />
    </header>

    <section className="glass-book">
      {bookMode === 'world' && <>
        <nav className="side-bookmarks" aria-label="全局资产类别">{worldTabs.map(tab => <button key={tab.id} className={worldTab === tab.id ? 'active' : ''} onClick={() => { setWorldTab(tab.id); setEntityId(''); setAssetIndex(0); }}>{tab.title}</button>)}</nav>
        <div className="glass-page entity-page">
          <div className="entity-list">{worldItems.map(item => <button key={item.id} className={entity?.id === item.id ? 'active' : ''} onClick={() => { setEntityId(item.id); setAssetIndex(0); }}><strong>{item.data.title}</strong>{item.data.role && <span>{item.data.role}</span>}</button>)}</div>
        </div>
        <div className="book-seam" />
        <div className="glass-page asset-page">
          {entity && <>
            <h1>{entity.data.title}</h1>
            {entityAssets.length > 0 ? <>
              <div className="asset-switcher">{entityAssets.map((asset, index) => <button key={asset.id} className={assetIndex === index ? 'active' : ''} onClick={() => setAssetIndex(index)}>{asset.data.title}</button>)}</div>
              <figure className="entity-visual"><img src={mediaUrl(entityAsset)} alt={String(entityAsset?.data.title || entity.data.title)} /><figcaption>{entityAsset?.data.title}</figcaption></figure>
            </> : <div className="text-asset"><p>{entity.data.design}</p></div>}
          </>}
        </div>
      </>}

      {bookMode === 'chapter' && <>
        <div className="glass-page narrative-page">
          <div className="story-list">{shots.map((item, index) => <button key={item.id} className={shot?.id === item.id ? 'active' : ''} onClick={() => { setShotIndex(index); setPreviewTab('video'); setFilmScope('shot'); }}>
            <h2>{item.data.title}</h2><p>{item.data.story}</p>
            {dialogueOf(item).map((line, quoteIndex) => <blockquote key={quoteIndex}>“{line}”</blockquote>)}
          </button>)}</div>
        </div>
        <div className="book-seam" />
        <div className="glass-page preview-page">
          <nav className="preview-switcher" aria-label="镜头详情">
            <button className={previewTab === 'video' ? 'active' : ''} onClick={() => setPreviewTab('video')}>视频</button>
            <button className={previewTab === 'assets' ? 'active' : ''} onClick={() => setPreviewTab('assets')}>引用资产</button>
            <button className={previewTab === 'tech' ? 'active' : ''} onClick={() => setPreviewTab('tech')}>技术细节</button>
            <button className={previewTab === 'prompt' ? 'active' : ''} onClick={() => setPreviewTab('prompt')}>Head & Body</button>
          </nav>
          {previewTab === 'video' && <div className="video-view">
            <video controls src={mediaUrl(filmScope === 'chapter' ? chapterFilm : clip)} poster={mediaUrl(shotVisuals.at(-1) ?? cover)} />
            <div className="video-scope"><button className={filmScope === 'shot' ? 'active' : ''} onClick={() => setFilmScope('shot')}>本镜</button><button className={filmScope === 'chapter' ? 'active' : ''} onClick={() => setFilmScope('chapter')}>连续预演</button></div>
          </div>}
          {previewTab === 'assets' && <div className="reference-grid">{shotRefs.map(ref => <article key={ref.id}>{ref.type === 'asset' && <img src={mediaUrl(ref)} alt="" />}<strong>{ref.data.title}</strong><span>{ref.type}</span></article>)}</div>}
          {previewTab === 'tech' && shot && <div className="tech-sheet"><dl><div><dt>模型</dt><dd>{shot.data.model}</dd></div><div><dt>时长</dt><dd>{shot.data.duration} 秒</dd></div><div><dt>状态</dt><dd>{shot.data.status}</dd></div><div className="wide"><dt>人类草稿</dt><dd>{shot.data.draft}</dd></div></dl></div>}
          {previewTab === 'prompt' && shot && <div className="prompt-sheet"><section><h3>HEAD</h3>{shotRefs.map((ref, index) => <p key={ref.id}>@{index + 1}　{ref.data.title}</p>)}</section><section><h3>BODY</h3><p>{shot.data.body}</p></section><button onClick={copyHarnessTask}>{copied ? '已复制' : '复制给 Harness'}</button></div>}
        </div>
      </>}
    </section>
    <DocsDrawer open={docsOpen} onClose={() => setDocsOpen(false)} />
  </main>;
}
