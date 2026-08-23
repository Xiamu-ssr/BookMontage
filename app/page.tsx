'use client';
/* eslint-disable @next/next/no-img-element -- local mutable assets should not enter an image optimizer cache */

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';

type ItemData = Record<string, unknown> & {
  title?: string; slug?: string; path?: string; subtitle?: string; summary?: string;
  story?: string; draft?: string; body?: string; file?: string; design?: string;
  voice?: string; role?: string; duration?: number; model?: string; status?: string; cover?: string;
  mime?: string; media_type?: string; source_url?: string; source_page?: string; note?: string;
  types?: string[]; nodes?: string[]; kinds?: string[]; tags?: string[]; detailed_description?: string; created_at?: string; copyright_sensitive?: boolean;
};
type Item = { id: string; type: string; parent: string | null; data: ItemData };
type Link = { source: string; target: string; kind: string };
type Snapshot = { format: number; data_root?: string; items: Item[]; links: Link[] };
type View = 'shelf' | 'book' | 'inspiration';
type BookMode = 'world' | 'chapter';
type WorldTab = 'character' | 'location' | 'faction' | 'prop' | 'relation' | 'temp';
type ChapterView = 'overview' | 'detail';
type PreviewTab = 'video' | 'assets' | 'tech' | 'prompt';
type FilmScope = 'shot' | 'sequence';
type GraphEdge = Link & { sourceItem: Item; targetItem: Item };
type LightboxImage = { src: string; alt: string };
type LightboxState = { images: LightboxImage[]; index: number };

const docs = [
  { id: 'bookmontage', title: 'BookMontage 使用手册', file: '/docs/bookmontage.md' },
  { id: 'models', title: '视频模型横评', file: '/docs/video-models.md' },
  { id: 'copyright', title: 'IP 二创发布风险', file: '/docs/copyright-risk.md' },
  { id: 'seedance25', title: 'Seedance 2.5', file: '/docs/seedance-2.5.md' },
  { id: 'seedance20', title: 'Seedance 2.0', file: '/docs/seedance-2.0.md' },
  { id: 'minimax', title: 'MiniMax H3', file: '/docs/minimax-h3.md' },
  { id: 'prompt-libraries', title: '创作数据源', file: '/docs/prompt-libraries.md' },
  { id: 'inspiration-library', title: '灵感库维护手册', file: '/docs/inspiration-library.md' },
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
  const folder = item.type === 'temp_asset' ? 'book-temp' : item.type === 'inspiration_asset' ? 'inspiration-assets' : 'book-assets';
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

function AutoScrollText({ children }: { children: React.ReactNode }) {
  const frame = useRef<HTMLSpanElement>(null);
  const content = useRef<HTMLSpanElement>(null);
  const [overflow, setOverflow] = useState(0);
  useEffect(() => {
    const measure = () => setOverflow(Math.max(0, (content.current?.scrollWidth ?? 0) - (frame.current?.clientWidth ?? 0)));
    measure();
    const observer = new ResizeObserver(measure);
    if (frame.current) observer.observe(frame.current);
    if (content.current) observer.observe(content.current);
    return () => observer.disconnect();
  }, [children]);
  return <span ref={frame} className={`auto-scroll-text ${overflow > 1 ? 'is-overflowing' : ''}`} style={{ '--scroll-distance': `${overflow}px`, '--scroll-duration': `${Math.max(5, overflow / 15)}s` } as React.CSSProperties}>
    <span ref={content}>{children}</span>
  </span>;
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

function ImageLightbox({ lightbox, onIndexChange, onClose }: { lightbox: LightboxState | null; onIndexChange: (index: number) => void; onClose: () => void }) {
  const [scale, setScale] = useState(1);
  const [pan, setPan] = useState({ x:0, y:0 });
  const viewport = useRef<HTMLDivElement>(null);
  const scaleRef = useRef(1);
  const panRef = useRef({ x:0, y:0 });
  const pointers = useRef(new Map<number, { x:number; y:number }>());
  const dragStart = useRef<{ x:number; y:number; panX:number; panY:number } | null>(null);
  const pinchDistance = useRef(0);
  const clampScale = (value: number) => Math.min(8, Math.max(1, value));
  const updatePan = useCallback((next: { x:number; y:number }) => {
    panRef.current = next;
    setPan(next);
  }, []);
  const zoom = useCallback((next: number, anchor?: { x:number; y:number }) => {
    const value = clampScale(next);
    const previous = scaleRef.current;
    scaleRef.current = value;
    setScale(value);
    if (value === 1) updatePan({ x:0, y:0 });
    else if (anchor && previous > 0) {
      const rect = viewport.current?.getBoundingClientRect();
      if (rect) {
        const x = anchor.x - rect.left - rect.width / 2;
        const y = anchor.y - rect.top - rect.height / 2;
        const ratio = value / previous;
        updatePan({ x:x - (x - panRef.current.x) * ratio, y:y - (y - panRef.current.y) * ratio });
      }
    }
  }, [updatePan]);
  const reset = useCallback(() => {
    scaleRef.current = 1;
    setScale(1);
    updatePan({ x:0, y:0 });
  }, [updatePan]);
  const image = lightbox?.images[lightbox.index];
  useEffect(() => {
    const target = viewport.current;
    if (!target || !image) return;
    const onWheel = (event: WheelEvent) => {
      event.preventDefault();
      zoom(scaleRef.current * Math.exp(-event.deltaY * .0015), { x:event.clientX, y:event.clientY });
    };
    target.addEventListener('wheel', onWheel, { passive:false });
    return () => target.removeEventListener('wheel', onWheel);
  }, [image, zoom]);
  useEffect(() => {
    if (!lightbox) return;
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'ArrowLeft' && lightbox.index > 0) onIndexChange(lightbox.index - 1);
      if (event.key === 'ArrowRight' && lightbox.index + 1 < lightbox.images.length) onIndexChange(lightbox.index + 1);
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [lightbox, onIndexChange]);
  if (!image || !lightbox) return null;
  const move = (index: number) => {
    if (index < 0 || index >= lightbox.images.length) return;
    reset();
    onIndexChange(index);
  };
  return <div className="media-lightbox" role="dialog" aria-modal="true" aria-label={image.alt} onMouseDown={event => { if (event.target === event.currentTarget) onClose(); }}>
    <div className="lightbox-toolbar"><button onClick={() => zoom(scaleRef.current - .35)} aria-label="缩小图片">−</button><button onClick={reset} aria-label="复位图片">↺</button><span>{Math.round(scale * 100)}%</span><button onClick={() => zoom(scaleRef.current + .35)} aria-label="放大图片">＋</button><button onClick={onClose} aria-label="关闭全屏图片">×</button></div>
    {lightbox.images.length > 1 && <><button className="lightbox-nav previous" disabled={lightbox.index === 0} onClick={() => move(lightbox.index - 1)} aria-label="上一张">‹</button><button className="lightbox-nav next" disabled={lightbox.index + 1 === lightbox.images.length} onClick={() => move(lightbox.index + 1)} aria-label="下一张">›</button><div className="lightbox-caption"><strong><AutoScrollText>{image.alt}</AutoScrollText></strong><span>{lightbox.index + 1} / {lightbox.images.length}</span></div></>}
    <div ref={viewport} className={`lightbox-viewport ${scale > 1 ? 'is-zoomed' : ''}`}
      onDoubleClick={event => zoom(scaleRef.current > 1 ? 1 : 2.5, { x:event.clientX, y:event.clientY })}
      onPointerDown={event => {
        event.currentTarget.setPointerCapture(event.pointerId);
        pointers.current.set(event.pointerId, { x:event.clientX, y:event.clientY });
        if (pointers.current.size === 1) dragStart.current = { x:event.clientX, y:event.clientY, panX:panRef.current.x, panY:panRef.current.y };
        if (pointers.current.size === 2) {
          const [a,b] = [...pointers.current.values()];
          pinchDistance.current = Math.hypot(a.x-b.x, a.y-b.y);
        }
      }}
      onPointerMove={event => {
        if (!pointers.current.has(event.pointerId)) return;
        pointers.current.set(event.pointerId, { x:event.clientX, y:event.clientY });
        if (pointers.current.size === 2) {
          const [a,b] = [...pointers.current.values()];
          const distance = Math.hypot(a.x-b.x, a.y-b.y);
          if (pinchDistance.current) zoom(scaleRef.current * distance / pinchDistance.current, { x:(a.x+b.x)/2, y:(a.y+b.y)/2 });
          pinchDistance.current = distance;
        } else if (scaleRef.current > 1 && dragStart.current) {
          updatePan({ x:dragStart.current.panX + event.clientX - dragStart.current.x, y:dragStart.current.panY + event.clientY - dragStart.current.y });
        }
      }}
      onPointerUp={event => {
        pointers.current.delete(event.pointerId);
        const remaining = [...pointers.current.values()][0];
        dragStart.current = remaining ? { x:remaining.x, y:remaining.y, panX:panRef.current.x, panY:panRef.current.y } : null;
        pinchDistance.current = 0;
      }}
      onPointerCancel={event => { pointers.current.delete(event.pointerId); dragStart.current = null; pinchDistance.current = 0; }}>
      <img src={image.src} alt={image.alt} draggable={false} style={{ transform:`translate(${pan.x}px, ${pan.y}px) scale(${scale})` }} />
    </div>
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
          <strong><AutoScrollText>{node.data.title}</AutoScrollText></strong><span>{typeLabels[node.type]}</span>
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
  const [lightbox, setLightbox] = useState<LightboxState | null>(null);
  const [graphId, setGraphId] = useState('');
  const [graphFullscreen, setGraphFullscreen] = useState(false);
  const [copiedCardId, setCopiedCardId] = useState('');
  const [inspirationCategoryId, setInspirationCategoryId] = useState('all');
  const [inspirationSubcategoryId, setInspirationSubcategoryId] = useState('all');
  const [inspirationTag, setInspirationTag] = useState('');
  const [inspirationId, setInspirationId] = useState('');
  const [pasteDraft, setPasteDraft] = useState<{ dataUrl: string; title: string; category: string; subcategory: string; types: string[]; tags: string; detailedDescription: string } | null>(null);
  const [inspirationNotice, setInspirationNotice] = useState('');
  const [inspirationSaving, setInspirationSaving] = useState(false);

  useEffect(() => {
    fetch('/generated/library.json', { cache: 'no-store' })
      .then(response => response.ok ? response.json() : Promise.reject(new Error(`HTTP ${response.status}`)))
      .then(setLibrary)
      .catch(error => setLoadError(error instanceof Error ? error.message : String(error)));
  }, []);

  useEffect(() => {
    const onEscape = (event: KeyboardEvent) => {
      if (event.key !== 'Escape') return;
      if (pasteDraft) setPasteDraft(null);
      else if (lightbox) setLightbox(null);
      else if (graphFullscreen) setGraphFullscreen(false);
      else if (docsOpen) setDocsOpen(false);
      else if (previewMenuOpen) setPreviewMenuOpen(false);
      else if (view === 'book' && bookMode === 'chapter' && chapterView === 'detail') setChapterView('overview');
      else if (view === 'book' || view === 'inspiration') setView('shelf');
    };
    window.addEventListener('keydown', onEscape);
    return () => window.removeEventListener('keydown', onEscape);
  }, [bookMode, chapterView, docsOpen, graphFullscreen, lightbox, pasteDraft, previewMenuOpen, view]);

  useEffect(() => {
    if (view !== 'inspiration') return;
    const onPaste = (event: ClipboardEvent) => {
      const target = event.target as HTMLElement | null;
      if (target?.matches('input,textarea,[contenteditable="true"]')) return;
      const image = [...(event.clipboardData?.items ?? [])].find(item => item.kind === 'file' && item.type.startsWith('image/'))?.getAsFile();
      if (!image) return;
      event.preventDefault();
      const activeSubcategory = library?.items.find(item => item.id === inspirationSubcategoryId && item.type === 'inspiration_subcategory');
      const activeCategory = library?.items.find(item => item.id === (activeSubcategory?.parent || inspirationCategoryId) && item.type === 'inspiration_category');
      const reader = new FileReader();
      reader.onload = () => setPasteDraft({ dataUrl:String(reader.result), title:'未命名灵感', category:String(activeCategory?.data.title || ''), subcategory:String(activeSubcategory?.data.title || ''), types:[], tags:'', detailedDescription:'' });
      reader.readAsDataURL(image);
    };
    window.addEventListener('paste', onPaste);
    return () => window.removeEventListener('paste', onPaste);
  }, [inspirationCategoryId, inspirationSubcategoryId, library, view]);

  const items = useMemo(() => {
    const latest = new Map<string, Item>();
    for (const item of library?.items ?? []) latest.set(item.id.slice(0, -4), item);
    return [...latest.values()];
  }, [library]);
  const links = library?.links ?? [];
  const itemByLogicalId = (id: string) => items.find(item => item.id.slice(0, -4) === id.slice(0, -4));
  const books = items.filter(item => item.type === 'book');
  const inspirationCategories = items.filter(item => item.type === 'inspiration_category');
  const inspirationSubcategories = items.filter(item => item.type === 'inspiration_subcategory');
  const allInspirations = items.filter(item => item.type === 'inspiration_asset');
  const subcategoryById = new Map(inspirationSubcategories.map(item => [item.id, item]));
  const categoryIdForInspiration = (item: Item) => subcategoryById.get(String(item.parent))?.parent || item.parent;
  const inspirationTags = [...new Set(allInspirations.flatMap(item => item.data.tags ?? []))].sort((left, right) => left.localeCompare(right, 'zh-CN'));
  const inspirations = allInspirations.filter(item => (inspirationCategoryId === 'all' || categoryIdForInspiration(item) === inspirationCategoryId)
    && (inspirationSubcategoryId === 'all' || item.parent === inspirationSubcategoryId)
    && (!inspirationTag || item.data.tags?.includes(inspirationTag)));
  const selectedInspiration = inspirations.find(item => item.id === inspirationId) ?? inspirations[0];
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

  function openLightbox(collection: Item[], selected?: Item) {
    const withImages = collection.filter(item => Boolean(item.data.file)).map(item => ({ id:item.id, src:mediaUrl(item), alt:String(item.data.title || '图片') }));
    if (!withImages.length) return;
    const index = Math.max(0, withImages.findIndex(item => item.id === selected?.id));
    setLightbox({ images:withImages.map(({ src, alt }) => ({ src, alt })), index });
  }

  function openSingleLightbox(src: string, alt: string) {
    setLightbox({ images:[{ src, alt }], index:0 });
  }

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

  function draftImage(file?: File | null) {
    if (!file || !file.type.startsWith('image/')) return;
    const reader = new FileReader();
    const activeSubcategory = inspirationSubcategories.find(item => item.id === inspirationSubcategoryId);
    const activeCategory = inspirationCategories.find(item => item.id === (activeSubcategory?.parent || inspirationCategoryId));
    reader.onload = () => setPasteDraft({
      dataUrl:String(reader.result),
      title:file.name.replace(/\.[^.]+$/, '') || '未命名灵感',
      category:String(activeCategory?.data.title || ''),
      subcategory:String(activeSubcategory?.data.title || ''),
      types:[],
      tags:'',
      detailedDescription:'',
    });
    reader.readAsDataURL(file);
  }

  async function savePasteDraft() {
    if (!pasteDraft) return;
    setInspirationSaving(true);
    setInspirationNotice('');
    try {
      const response = await fetch('http://127.0.0.1:3002/api/inspirations', {
        method:'POST',
        headers:{ 'Content-Type':'application/json' },
        body:JSON.stringify({
          data_url:pasteDraft.dataUrl,
          title:pasteDraft.title,
          category:pasteDraft.category,
          subcategory:pasteDraft.subcategory,
          types:pasteDraft.types,
          tags:pasteDraft.tags.split(/[,，]/).map(tag => tag.trim()).filter(Boolean),
          detailed_description:pasteDraft.detailedDescription,
        }),
      });
      const result = await response.json();
      if (!response.ok) throw new Error(result.error || `HTTP ${response.status}`);
      setLibrary(result.snapshot);
      const savedSubcategory = result.snapshot.items.find((item: Item) => item.type === 'inspiration_subcategory' && item.id === result.item.parent);
      setInspirationCategoryId(savedSubcategory?.parent || result.item.parent || 'all');
      setInspirationSubcategoryId(savedSubcategory?.id || 'all');
      setInspirationId(result.item.id);
      setPasteDraft(null);
      setInspirationNotice('已存入私人灵感库');
    } catch (error) {
      setInspirationNotice(error instanceof Error ? `${error.message}。请确认本地 BookMontage 正在运行。` : String(error));
    } finally {
      setInspirationSaving(false);
    }
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

  if (view === 'inspiration') return <main className="inspiration-stage">
    <div className="workspace-wash" />
    <header className="workspace-header inspiration-header">
      <button className="back-button" onClick={() => setView('shelf')} aria-label="返回书架">← <span>书架</span></button>
      <div className="wordmark"><span>BOOKMONTAGE</span><i>#</i><strong>灵感库</strong></div>
      <DocsButton onClick={() => setDocsOpen(true)} />
    </header>
    <section className="inspiration-shell">
      <aside className="inspiration-categories">
        <header><span>分类</span><b>{allInspirations.length}</b></header>
        <button className={inspirationCategoryId === 'all' ? 'active' : ''} onClick={() => { setInspirationCategoryId('all'); setInspirationSubcategoryId('all'); setInspirationTag(''); setInspirationId(''); }}><strong><AutoScrollText>全部</AutoScrollText></strong><span>{allInspirations.length}</span></button>
        {inspirationCategories.map(category => <div className="inspiration-category-group" key={category.id}>
          <button className={inspirationCategoryId === category.id && inspirationSubcategoryId === 'all' ? 'active' : ''} onClick={() => { setInspirationCategoryId(category.id); setInspirationSubcategoryId('all'); setInspirationTag(''); setInspirationId(''); }}>
            <strong><AutoScrollText>{category.data.title}</AutoScrollText></strong><span>{allInspirations.filter(item => categoryIdForInspiration(item) === category.id).length}</span>
          </button>
          {inspirationCategoryId === category.id && inspirationSubcategories.filter(item => item.parent === category.id).map(subcategory => <button className={`inspiration-subcategory ${inspirationSubcategoryId === subcategory.id ? 'active' : ''}`} key={subcategory.id} onClick={() => { setInspirationSubcategoryId(subcategory.id); setInspirationTag(''); setInspirationId(''); }}>
            <strong><AutoScrollText>{subcategory.data.title}</AutoScrollText></strong><span>{allInspirations.filter(item => item.parent === subcategory.id).length}</span>
          </button>)}
        </div>)}
      </aside>
      <div className="inspiration-catalog">
        <header className="inspiration-toolbar">
          <div><h1>{inspirationSubcategoryId !== 'all' ? inspirationSubcategories.find(item => item.id === inspirationSubcategoryId)?.data.title : inspirationCategoryId === 'all' ? '全部灵感' : inspirationCategories.find(item => item.id === inspirationCategoryId)?.data.title}</h1><p>粘贴截图，写下标题，剩下的交给 Harness 整理。</p></div>
          <label className="file-pick">选择图片<input type="file" accept="image/png,image/jpeg,image/webp,image/gif" onChange={event => draftImage(event.target.files?.[0])} /></label>
        </header>
        {inspirationTags.length > 0 && <nav className="inspiration-tags" aria-label="标签筛选"><button className={!inspirationTag ? 'active' : ''} onClick={() => setInspirationTag('')}>全部标签</button>{inspirationTags.map(tag => <button key={tag} className={inspirationTag === tag ? 'active' : ''} onClick={() => setInspirationTag(tag)}>#{tag}</button>)}</nav>}
        <div className={`inspiration-grid ${inspirations.length ? '' : 'is-empty'}`}>
          {!inspirations.length && <div className="paste-hint"><kbd>⌘ V</kbd><strong>把喜欢的画面贴进来</strong><span>也支持 Ctrl V 或选择本地图片</span></div>}
          {inspirations.map(item => <article key={item.id} className={`inspiration-card ${selectedInspiration?.id === item.id ? 'active' : ''}`}>
            <button className="inspiration-select" onClick={() => setInspirationId(item.id)} onDoubleClick={() => openLightbox(inspirations, item)}>
              <img src={mediaUrl(item)} alt={String(item.data.title || '')} />
              <span><strong><AutoScrollText>{item.data.title}</AutoScrollText></strong><em><AutoScrollText>{[...(item.data.types || []), ...(item.data.tags || [])].map(tag => `#${tag}`).join(' ') || '等待整理'}</AutoScrollText></em></span>
            </button>
            <button className="copy-path" onClick={() => copyAssetPath(item)} aria-label={`复制${item.data.title}的文件位置`} title="复制名称与文件位置"><CopyIcon copied={copiedCardId === item.id} /></button>
          </article>)}
        </div>
      </div>
      <aside className="inspiration-inspector">
        {selectedInspiration ? <>
          <button className="inspector-image" onClick={() => openLightbox(inspirations, selectedInspiration)} aria-label="全屏查看灵感图片"><img src={mediaUrl(selectedInspiration)} alt="" /></button>
          <h2>{selectedInspiration.data.title}</h2>
          <p>{[inspirationCategories.find(item => item.id === categoryIdForInspiration(selectedInspiration))?.data.title, subcategoryById.get(String(selectedInspiration.parent))?.data.title].filter(Boolean).join(' / ') || '尚未归类'}</p>
          <div>{[...(selectedInspiration.data.types || []), ...(selectedInspiration.data.tags || [])].map(tag => <span key={tag}>#{tag}</span>)}</div>
          <section className="inspiration-description"><strong>详细描述</strong><p>{selectedInspiration.data.detailed_description || '等待 Harness 逐图补全。'}</p></section>
          <button className="copy-inspiration" onClick={() => copyAssetPath(selectedInspiration)}><CopyIcon copied={copiedCardId === selectedInspiration.id} /> 复制给 Harness</button>
        </> : <div className="inspector-empty"><span>灵</span><p>选中一张图片查看</p></div>}
      </aside>
    </section>
    {inspirationNotice && <div className="inspiration-notice" role="status">{inspirationNotice}</div>}
    {pasteDraft && <div className="paste-overlay" role="dialog" aria-modal="true" aria-label="保存粘贴图片" onMouseDown={event => { if (event.target === event.currentTarget) setPasteDraft(null); }}>
      <section className="paste-sheet">
        <img src={pasteDraft.dataUrl} alt="粘贴预览" />
        <form onSubmit={event => { event.preventDefault(); savePasteDraft(); }}>
          <span>存入灵感库</span>
          <label>标题<input autoFocus value={pasteDraft.title} onChange={event => setPasteDraft({ ...pasteDraft, title:event.target.value })} /></label>
          <label>一级分类<select value={pasteDraft.category} onChange={event => setPasteDraft({ ...pasteDraft, category:event.target.value, subcategory:'' })}><option value="">选择一级分类</option>{inspirationCategories.map(category => <option key={category.id} value={String(category.data.title)}>{category.data.title}</option>)}</select></label>
          <label>二级分类<select value={pasteDraft.subcategory} disabled={!pasteDraft.category} onChange={event => setPasteDraft({ ...pasteDraft, subcategory:event.target.value })}><option value="">选择二级分类</option>{inspirationSubcategories.filter(subcategory => inspirationCategories.find(category => category.id === subcategory.parent)?.data.title === pasteDraft.category).map(subcategory => <option key={subcategory.id} value={String(subcategory.data.title)}>{subcategory.data.title}</option>)}</select></label>
          <fieldset className="inspiration-type-picker"><legend>类型标签（可多选）</legend>{['角色','场景'].map(type => <button type="button" key={type} className={pasteDraft.types.includes(type) ? 'active' : ''} onClick={() => setPasteDraft({ ...pasteDraft, types:pasteDraft.types.includes(type) ? pasteDraft.types.filter(value => value !== type) : [...pasteDraft.types, type] })}>{type}</button>)}</fieldset>
          <label>标签<input value={pasteDraft.tags} onChange={event => setPasteDraft({ ...pasteDraft, tags:event.target.value })} placeholder="仙侠，天宫，云海" /></label>
          <label>详细描述<textarea value={pasteDraft.detailedDescription} onChange={event => setPasteDraft({ ...pasteDraft, detailedDescription:event.target.value })} placeholder="可留空，由 Harness 观察图片后补全反向提示词式描述。" /></label>
          <footer><button type="button" onClick={() => setPasteDraft(null)}>取消</button><button className="save-inspiration" disabled={inspirationSaving || !pasteDraft.title.trim()}>{inspirationSaving ? '正在保存' : '保存'}</button></footer>
        </form>
      </section>
    </div>}
    <ImageLightbox key={lightbox?.images[lightbox.index]?.src || 'closed'} lightbox={lightbox} onIndexChange={index => setLightbox(current => current ? { ...current, index } : current)} onClose={() => setLightbox(null)} />
    <DocsDrawer open={docsOpen} onClose={() => setDocsOpen(false)} />
  </main>;

  if (view === 'shelf') return <main className="home-stage">
    {ambient && <video className="ambient-video" src={mediaUrl(ambient)} poster={mediaUrl(cover)} autoPlay muted loop playsInline />}
    <div className="home-wash" />
    <header className="home-header">
      <div className="wordmark"><span>BOOKMONTAGE</span><i>#</i><strong>书间</strong></div>
      <DocsButton onClick={() => setDocsOpen(true)} />
    </header>
    <section className="bookshelf" aria-label="书架">
      <div className="shelf-lines" aria-hidden="true"><i/><i/><i/></div>
      <div className="book-grid"><button className="book-card inspiration-book" onClick={() => setView('inspiration')} aria-label="打开灵感库">
        <span className="inspiration-cover">{allInspirations.slice(0, 6).map(item => <img key={item.id} src={mediaUrl(item)} alt="" />)}{!allInspirations.length && <i><b>灵</b><em>INSPIRATION</em></i>}</span>
        <span className="book-card-glass"><strong>灵感库</strong><em>{allInspirations.length ? `${inspirationCategories.length} 个分类 · ${allInspirations.length} 张藏图` : '把世界的碎片收进来'}</em></span>
      </button>{books.map(item => { const itemCover = items.find(candidate => candidate.id === item.data.cover); return <button key={item.id} className="book-card" onClick={() => openBook(item)} aria-label={`打开《${item.data.title}》`}>
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
                <span><strong><AutoScrollText>{item.data.title}</AutoScrollText></strong></span>
              </button>
              {thumbnail?.data.file && <button className="copy-path" onClick={() => copyAssetPath(thumbnail)} aria-label={`复制${thumbnail.data.title}的文件位置`} title="复制名称与文件位置"><CopyIcon copied={copiedCardId === thumbnail.id} /></button>}
            </article>; })}</div>
          </div>
          <div className="book-seam" />
          <div className="glass-page asset-page">
            {entity && entity.type === 'temp_asset' ? <><h1>{entity.data.title}</h1><TempPreview item={entity} onZoom={openSingleLightbox} /></> : entity && <>
              <h1>{entity.data.title}</h1>
              {entityAssets.length > 0 ? <>
                <div className="asset-switcher">{entityAssets.map((asset, index) => <button key={asset.id} className={assetIndex === index ? 'active' : ''} onClick={() => setAssetIndex(index)}>{asset.data.title}</button>)}</div>
                <figure className="entity-visual"><button className="zoomable-media" onClick={() => openLightbox(entityAssets, entityAsset)} aria-label="全屏查看图片"><img src={mediaUrl(entityAsset)} alt={String(entityAsset?.data.title || entity.data.title)} /></button><figcaption>{entityAsset?.data.title}</figcaption></figure>
              </> : <div className="text-asset"><p>{entity.data.design}</p></div>}
            </>}
          </div>
        </> : <>
          <div className="glass-page entity-page relation-index">
            <div className="entity-list graph-list">{relationGraphs.map(item => <button key={item.id} className={relationGraph?.id === item.id ? 'active' : ''} onClick={() => setGraphId(item.id)}>
              <i className="graph-thumb"><b>{String(item.data.title || '').startsWith('角色') ? '人' : '盟'}</b><span><em/><em/><em/></span></i>
              <span><strong><AutoScrollText>{item.data.title}</AutoScrollText></strong></span>
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
    <ImageLightbox key={lightbox?.images[lightbox.index]?.src || 'closed'} lightbox={lightbox} onIndexChange={index => setLightbox(current => current ? { ...current, index } : current)} onClose={() => setLightbox(null)} />
    {graphFullscreen && relationGraph && <div className="graph-fullscreen" role="dialog" aria-modal="true" aria-label={String(relationGraph.data.title)} onMouseDown={event => { if (event.target === event.currentTarget) setGraphFullscreen(false); }}>
      <GraphCanvas graph={relationGraph} nodes={graphNodes} edges={graphEdges} media={graphMedia} fullscreen onClose={() => setGraphFullscreen(false)} />
    </div>}
    <DocsDrawer open={docsOpen} onClose={() => setDocsOpen(false)} />
  </main>;
}
