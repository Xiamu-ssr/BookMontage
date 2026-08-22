'use client';
/* eslint-disable @next/next/no-img-element -- local mutable assets should not enter an image optimizer cache */

import { useEffect, useMemo, useState } from 'react';

type ItemData = Record<string, unknown> & {
  title?: string; slug?: string; path?: string; subtitle?: string; summary?: string;
  story?: string; draft?: string; body?: string; file?: string; design?: string;
  voice?: string; role?: string; duration?: number; model?: string; status?: string; cover?: string;
  mime?: string; media_type?: string; source_url?: string; source_page?: string; note?: string;
  types?: string[]; nodes?: string[]; kinds?: string[]; copyright_sensitive?: boolean;
};
type Item = { id: string; type: string; parent: string | null; data: ItemData };
type Link = { source: string; target: string; kind: string };
type Snapshot = { format: number; data_root?: string; items: Item[]; links: Link[] };
type View = 'shelf' | 'book';
type BookMode = 'world' | 'chapter';
type WorldTab = 'character' | 'location' | 'faction' | 'prop' | 'relation' | 'temp';
type ChapterView = 'overview' | 'detail';
type PreviewTab = 'video' | 'assets' | 'tech' | 'prompt';
type FilmScope = 'shot' | 'sequence';
type GraphEdge = Link & { sourceItem: Item; targetItem: Item };

const docs = [
  { id: 'bookmontage', title: 'BookMontage 使用手册', file: '/docs/bookmontage.md' },
  { id: 'models', title: '视频模型横评', file: '/docs/video-models.md' },
  { id: 'copyright', title: 'IP 二创发布风险', file: '/docs/copyright-risk.md' },
  { id: 'seedance25', title: 'Seedance 2.5', file: '/docs/seedance-2.5.md' },
  { id: 'seedance20', title: 'Seedance 2.0', file: '/docs/seedance-2.0.md' },
  { id: 'minimax', title: 'MiniMax H3', file: '/docs/minimax-h3.md' },
  { id: 'prompt-libraries', title: 'Seedance 实片库', file: '/docs/prompt-libraries.md' },
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

function CopyIcon({ copied = false }: { copied?: boolean }) {
  return <span aria-hidden="true">{copied ? '✓' : '⧉'}</span>;
}

function TempPreview({ item, onZoom }: { item: Item; onZoom: (src: string, alt: string) => void }) {
  const kind = String(item.data.media_type || 'document');
  return <div className="temp-preview">
    <div className="temp-stage">
      {['image','gif'].includes(kind) && <button className="zoomable-media" onClick={() => onZoom(mediaUrl(item), String(item.data.title || '图片'))} aria-label="全屏查看图片"><img src={mediaUrl(item)} alt={String(item.data.title || '')} /></button>}
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
    } else if (line.includes('|') && index + 1 < lines.length && /^\|?\s*:?-{3,}/.test(lines[index + 1].trim())) {
      const cells = (value: string) => value.trim().replace(/^\|/, '').replace(/\|$/, '').split('|').map(cell => cell.trim());
      const header = cells(lines[index]);
      const rows: string[][] = [];
      index += 2;
      while (index < lines.length && lines[index].trim().includes('|')) { rows.push(cells(lines[index])); index += 1; }
      index -= 1;
      blocks.push(<div className="md-table-wrap" key={`table-${index}`}><table><thead><tr>{header.map((cell, cellIndex) => <th key={cellIndex}><InlineMarkdown text={cell} /></th>)}</tr></thead><tbody>{rows.map((row, rowIndex) => <tr key={rowIndex}>{row.map((cell, cellIndex) => <td key={cellIndex}><InlineMarkdown text={cell} /></td>)}</tr>)}</tbody></table></div>);
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

function GraphCanvas({ graph, nodes, edges, media, fullscreen, onFullscreen, onClose }: {
  graph: Item; nodes: Item[]; edges: GraphEdge[]; media: Map<string, string>;
  fullscreen?: boolean; onFullscreen?: () => void; onClose?: () => void;
}) {
  const [pan, setPan] = useState({ x: 0, y: 0 });
  const [scale, setScale] = useState(1);
  const [drag, setDrag] = useState<{ x: number; y: number; panX: number; panY: number } | null>(null);
  const layout = useMemo(() => {
    const byId = new Map(nodes.map(node => [node.id, node]));
    const adjacency = new Map(nodes.map(node => [node.id, new Set<string>()]));
    for (const edge of edges) {
      if (!byId.has(edge.sourceItem.id) || !byId.has(edge.targetItem.id)) continue;
      adjacency.get(edge.sourceItem.id)?.add(edge.targetItem.id);
      adjacency.get(edge.targetItem.id)?.add(edge.sourceItem.id);
    }
    const seen = new Set<string>();
    const components: Item[][] = [];
    for (const node of nodes) {
      if (seen.has(node.id)) continue;
      const component: Item[] = [];
      const queue = [node.id];
      seen.add(node.id);
      while (queue.length) {
        const id = queue.shift() as string;
        component.push(byId.get(id) as Item);
        for (const neighbor of adjacency.get(id) ?? []) if (!seen.has(neighbor)) { seen.add(neighbor); queue.push(neighbor); }
      }
      components.push(component);
    }
    const positions = new Map<string, { x: number; y: number }>();
    let y = 90;
    let width = 1080;
    for (const component of components) {
      const columns = Math.max(1, Math.min(5, Math.ceil(Math.sqrt(component.length * 1.5))));
      const rows = Math.ceil(component.length / columns);
      const componentWidth = Math.max(300, columns * 190);
      const left = 90;
      component.forEach((node, index) => positions.set(node.id, { x: left + (index % columns) * 190, y: y + Math.floor(index / columns) * 145 }));
      width = Math.max(width, componentWidth + 180);
      y += Math.max(190, rows * 145 + 90);
    }
    return { positions, width, height: Math.max(720, y + 60) };
  }, [edges, nodes]);

  return <section className={`graph-view ${fullscreen ? 'is-fullscreen' : ''}`}>
    <header><strong>{graph.data.title}</strong><span>{nodes.length} 个节点</span><nav>
      <button onClick={() => setScale(Math.max(.45, scale - .15))} aria-label="缩小关系图">−</button>
      <button onClick={() => { setScale(1); setPan({ x: 0, y: 0 }); }} aria-label="复位关系图">↺</button>
      <button onClick={() => setScale(Math.min(1.6, scale + .15))} aria-label="放大关系图">＋</button>
      {fullscreen ? <button onClick={onClose} aria-label="退出全屏">×</button> : <button onClick={onFullscreen} aria-label="全屏查看关系图">⛶</button>}
    </nav></header>
    <div className="graph-viewport" onPointerDown={event => { event.currentTarget.setPointerCapture(event.pointerId); setDrag({ x:event.clientX, y:event.clientY, panX:pan.x, panY:pan.y }); }} onPointerMove={event => { if (drag) setPan({ x:drag.panX + event.clientX - drag.x, y:drag.panY + event.clientY - drag.y }); }} onPointerUp={() => setDrag(null)} onPointerCancel={() => setDrag(null)}>
      <div className="graph-world" style={{ width:layout.width, height:layout.height, transform:`translate(${pan.x}px, ${pan.y}px) scale(${scale})` }}>
        <svg viewBox={`0 0 ${layout.width} ${layout.height}`} aria-hidden="true">{edges.map(edge => {
          const source = layout.positions.get(edge.sourceItem.id); const target = layout.positions.get(edge.targetItem.id);
          if (!source || !target) return null;
          const x1 = source.x + 70, y1 = source.y + 48, x2 = target.x + 70, y2 = target.y + 48;
          return <g key={`${edge.source}-${edge.kind}-${edge.target}`}><line x1={x1} y1={y1} x2={x2} y2={y2}/><text x={(x1+x2)/2} y={(y1+y2)/2 - 7}>{relationLabels[edge.kind]}</text></g>;
        })}</svg>
        {nodes.map(node => { const position = layout.positions.get(node.id); return position && <article className="graph-node" key={node.id} style={{ left:position.x, top:position.y }}>
          {media.get(node.id) ? <img src={media.get(node.id)} alt=""/> : <i>{String(node.data.title || '?').slice(0,1)}</i>}
          <strong>{node.data.title}</strong><span>{typeLabels[node.type]}</span>
        </article>; })}
      </div>
    </div>
  </section>;
}

export default function Home() {
  const [library, setLibrary] = useState<Snapshot | null>(null);
  const [loadError, setLoadError] = useState('');
  const [view, setView] = useState<View>('shelf');
  const [selectedBookId, setSelectedBookId] = useState('');
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
  const [lightbox, setLightbox] = useState<{ src: string; alt: string } | null>(null);
  const [graphId, setGraphId] = useState('');
  const [graphFullscreen, setGraphFullscreen] = useState(false);
  const [copiedCardId, setCopiedCardId] = useState('');

  useEffect(() => {
    fetch('/generated/library.json', { cache: 'no-store' })
      .then(response => response.ok ? response.json() : Promise.reject(new Error(`HTTP ${response.status}`)))
      .then(setLibrary)
      .catch(error => setLoadError(error instanceof Error ? error.message : String(error)));
  }, []);

  useEffect(() => {
    const onEscape = (event: KeyboardEvent) => {
      if (event.key !== 'Escape') return;
      if (lightbox) setLightbox(null);
      else if (graphFullscreen) setGraphFullscreen(false);
      else if (docsOpen) setDocsOpen(false);
      else if (previewMenuOpen) setPreviewMenuOpen(false);
      else if (view === 'book' && bookMode === 'chapter' && chapterView === 'detail') setChapterView('overview');
      else if (view === 'book') setView('shelf');
    };
    window.addEventListener('keydown', onEscape);
    return () => window.removeEventListener('keydown', onEscape);
  }, [bookMode, chapterView, docsOpen, graphFullscreen, lightbox, previewMenuOpen, view]);

  const items = useMemo(() => {
    const latest = new Map<string, Item>();
    for (const item of library?.items ?? []) latest.set(item.id.slice(0, -4), item);
    return [...latest.values()];
  }, [library]);
  const links = library?.links ?? [];
  const itemByLogicalId = (id: string) => items.find(item => item.id.slice(0, -4) === id.slice(0, -4));
  const books = items.filter(item => item.type === 'book');
  const book = books.find(item => item.id === selectedBookId) ?? books[0];
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
  const shotRefs = shot ? links.filter(link => link.source === shot.id && link.kind === 'depends').map(link => itemByLogicalId(link.target)).filter((item): item is Item => Boolean(item) && item.type === 'asset') : [];
  const shotVisuals = shotRefs;
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
  const relationEdges = links.filter(link => relationLabels[link.kind]).map(link => ({ ...link, sourceItem: itemByLogicalId(link.source), targetItem: itemByLogicalId(link.target) })).filter((link): link is GraphEdge => Boolean(link.sourceItem && link.targetItem));
  const relationGraphs = items.filter(item => item.type === 'graph' && item.parent === book?.id);
  const relationGraph = relationGraphs.find(item => item.id === graphId) ?? relationGraphs[0];
  const graphNodes = items.filter(item => {
    const explicit = relationGraph?.data.nodes;
    if (explicit?.length) return explicit.some(id => id.slice(0, -4) === item.id.slice(0, -4));
    return (relationGraph?.data.types ?? ['character','faction','relic']).includes(item.type) && item.parent === book?.id;
  });
  const graphNodeIds = new Set(graphNodes.map(item => item.id));
  const graphEdges = relationEdges.filter(edge => graphNodeIds.has(edge.sourceItem.id) && graphNodeIds.has(edge.targetItem.id) && (!relationGraph?.data.kinds?.length || relationGraph.data.kinds.includes(edge.kind)));
  const graphMedia = new Map(graphNodes.map(node => [node.id, mediaUrl(node.type === 'temp_asset' ? node : assetsFor(node)[0])]));
  const ambient = chapterFilm ?? clip;
  const remainingShots = Math.max(shots.length - shotIndex, 1);

  async function copyHarnessTask(item: Item) {
    const scope = item.type === 'chapter' ? '章节' : '段落';
    const prompt = `请在 BookMontage 中处理${scope} ${item.data.path || item.id}（ID: ${item.id}）。读取项目 Skill 和关联资产，保留人类草稿意图，完善可读叙事与模型指令；写回 SQLite 后运行 bookmontage export 和 bookmontage verify，等待人类审核。`;
    await navigator.clipboard.writeText(prompt);
    setCopiedCardId(item.id);
    window.setTimeout(() => setCopiedCardId(current => current === item.id ? '' : current), 1600);
  }

  async function copyAssetPath(item?: Item) {
    if (!item?.data.file) return;
    const relative = String(item.data.file);
    const path = library?.data_root ? `${library.data_root}/${relative}` : `.bookmontage/${relative}`;
    await navigator.clipboard.writeText(`${item.data.title || relative}\n${path}`);
    setCopiedCardId(item.id);
    window.setTimeout(() => setCopiedCardId(current => current === item.id ? '' : current), 1600);
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

  function openBook(item: Item) {
    setSelectedBookId(item.id);
    setBookMode('world');
    setWorldTab('character');
    setEntityId('');
    setAssetIndex(0);
    setChapterView('overview');
    setChapterId('');
    setShotIndex(0);
    setView('book');
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
      <div className="book-grid">{books.map(item => { const itemCover = items.find(candidate => candidate.id === item.data.cover); return <button key={item.id} className="book-card" onClick={() => openBook(item)} aria-label={`打开《${item.data.title}》`}>
        <img src={mediaUrl(itemCover)} alt="" />
        <span className="book-card-glass"><strong>{item.data.title}</strong><em>{item.data.subtitle}</em></span>
      </button>; })}</div>
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
            <div className="entity-list asset-list">{worldItems.map(item => { const thumbnail = thumbnailFor(item); return <article key={item.id} className={`entity-card ${entity?.id === item.id ? 'active' : ''}`}>
              <button className="entity-card-select" onClick={() => { setEntityId(item.id); setAssetIndex(0); }}>
                <MediaThumb item={thumbnail} />
                <span><strong>{item.data.title}</strong></span>
              </button>
              {thumbnail?.data.file && <button className="copy-path" onClick={() => copyAssetPath(thumbnail)} aria-label={`复制${thumbnail.data.title}的文件位置`} title="复制名称与文件位置"><CopyIcon copied={copiedCardId === thumbnail.id} /></button>}
            </article>; })}</div>
          </div>
          <div className="book-seam" />
          <div className="glass-page asset-page">
            {entity && entity.type === 'temp_asset' ? <><h1>{entity.data.title}</h1><TempPreview item={entity} onZoom={(src, alt) => setLightbox({ src, alt })} /></> : entity && <>
              <h1>{entity.data.title}</h1>
              {entityAssets.length > 0 ? <>
                <div className="asset-switcher">{entityAssets.map((asset, index) => <button key={asset.id} className={assetIndex === index ? 'active' : ''} onClick={() => setAssetIndex(index)}>{asset.data.title}</button>)}</div>
                <figure className="entity-visual"><button className="zoomable-media" onClick={() => setLightbox({ src: mediaUrl(entityAsset), alt: String(entityAsset?.data.title || entity.data.title) })} aria-label="全屏查看图片"><img src={mediaUrl(entityAsset)} alt={String(entityAsset?.data.title || entity.data.title)} /></button><figcaption>{entityAsset?.data.title}</figcaption></figure>
              </> : <div className="text-asset"><p>{entity.data.design}</p></div>}
            </>}
          </div>
        </> : <>
          <div className="glass-page entity-page relation-index">
            <div className="entity-list graph-list">{relationGraphs.map(item => <button key={item.id} className={relationGraph?.id === item.id ? 'active' : ''} onClick={() => setGraphId(item.id)}>
              <i className="graph-thumb"><b>{String(item.data.title || '').startsWith('角色') ? '人' : '盟'}</b><span><em/><em/><em/></span></i>
              <span><strong>{item.data.title}</strong></span>
            </button>)}</div>
          </div>
          <div className="book-seam" />
          <div className="glass-page relation-page">
            {relationGraph && <GraphCanvas graph={relationGraph} nodes={graphNodes} edges={graphEdges} media={graphMedia} onFullscreen={() => setGraphFullscreen(true)} />}
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
            <div className="chapter-list">{chapters.map((item, index) => <article key={item.id} className={`chapter-card ${chapter?.id === item.id ? 'active' : ''}`}><button className="chapter-card-select" onClick={() => { setChapterId(item.id); setShotIndex(0); }}><span>{String(index + 1).padStart(2, '0')}</span><strong>{item.data.title}</strong></button><button className="copy-path" onClick={() => copyHarnessTask(item)} aria-label={`复制${item.data.title}的 Harness 任务`} title="复制章节任务"><CopyIcon copied={copiedCardId === item.id} /></button></article>)}</div>
          </div>
          <div className="book-seam" />
          <div className="glass-page chapter-overview-page">
            {chapter && <><span className="chapter-number">CHAPTER {String(chapters.indexOf(chapter) + 1).padStart(2, '0')}</span><h1>{chapter.data.title}</h1><p>{chapter.data.summary}</p><button className="enter-chapter" onClick={() => setChapterView('detail')}>进入本章 <span>→</span></button></>}
          </div>
        </> : <>
          <div className="glass-page narrative-page">
            <div className="story-list">{shots.map((item, index) => <article key={item.id} className={`story-card ${shot?.id === item.id ? 'active' : ''}`}><button className="story-card-select" onClick={() => selectShot(index)}>
              <h2>{item.data.title}</h2><p>{item.data.story}</p>
              {dialogueOf(item).map((line, quoteIndex) => <blockquote key={quoteIndex}>“{line}”</blockquote>)}
            </button><button className="copy-path" onClick={() => copyHarnessTask(item)} aria-label={`复制${item.data.title}的 Harness 任务`} title="复制段落任务"><CopyIcon copied={copiedCardId === item.id} /></button></article>)}</div>
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
            {previewTab === 'prompt' && shot && <div className="prompt-sheet"><section><h3>HEAD</h3>{shotRefs.map((ref, index) => <p key={ref.id}>@{index + 1}　{ref.data.title}</p>)}</section><section><h3>BODY</h3><p>{shot.data.body}</p></section></div>}
          </div>
        </>}
      </>}
    </section>
    {lightbox && <div className="media-lightbox" role="dialog" aria-modal="true" aria-label={lightbox.alt} onMouseDown={event => { if (event.target === event.currentTarget) setLightbox(null); }}>
      <button className="lightbox-close" onClick={() => setLightbox(null)} aria-label="关闭全屏图片">×</button>
      <img src={lightbox.src} alt={lightbox.alt} />
    </div>}
    {graphFullscreen && relationGraph && <div className="graph-fullscreen" role="dialog" aria-modal="true" aria-label={String(relationGraph.data.title)} onMouseDown={event => { if (event.target === event.currentTarget) setGraphFullscreen(false); }}>
      <GraphCanvas graph={relationGraph} nodes={graphNodes} edges={graphEdges} media={graphMedia} fullscreen onClose={() => setGraphFullscreen(false)} />
    </div>}
    <DocsDrawer open={docsOpen} onClose={() => setDocsOpen(false)} />
  </main>;
}
