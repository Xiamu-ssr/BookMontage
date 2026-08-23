import { copyFileSync, readFileSync, writeFileSync } from 'node:fs';
import { extname, join, resolve } from 'node:path';
import { assetRoot, dataRoot, exportSnapshot, findItem, inspirationRoot, makeId, openStore, putItem, putLink } from './store.js';

const imageTypes = new Map([
  ['image/jpeg', '.jpg'], ['image/png', '.png'], ['image/webp', '.webp'], ['image/gif', '.gif'],
]);

function cleanTags(values = []) {
  return [...new Set(values.flatMap(value => String(value).split(/[,，]/)).map(value => value.trim()).filter(Boolean))].slice(0, 24);
}

function mimeOf(file) {
  const extension = extname(file).toLowerCase();
  return extension === '.png' ? 'image/png'
    : extension === '.webp' ? 'image/webp'
      : extension === '.gif' ? 'image/gif'
        : ['.jpg', '.jpeg'].includes(extension) ? 'image/jpeg'
          : '';
}

function categoryFor(db, title) {
  const normalized = String(title || '未分类').trim() || '未分类';
  const existing = db.prepare("SELECT id,type,parent,data FROM item WHERE type='inspiration_category' AND json_extract(data,'$.title')=? ORDER BY rowid LIMIT 1").get(normalized);
  if (existing) return { ...existing, data:JSON.parse(existing.data) };
  const category = { id:makeId(), type:'inspiration_category', parent:null, data:{ title:normalized, created_at:new Date().toISOString() } };
  putItem(db, category);
  return category;
}

export function saveInspiration({ bytes, mime, title, category, tags = [], source = 'clipboard' }) {
  if (!imageTypes.has(mime)) throw new Error(`Unsupported inspiration image type: ${mime}`);
  const buffer = Buffer.isBuffer(bytes) ? bytes : Buffer.from(bytes);
  if (!buffer.length) throw new Error('The inspiration image is empty');
  if (buffer.length > 25 * 1024 * 1024) throw new Error('The inspiration image exceeds 25 MB');
  const db = openStore();
  const parent = categoryFor(db, category);
  const id = makeId();
  const extension = imageTypes.get(mime);
  const relativeFile = `inspirations/${id}${extension}`;
  writeFileSync(join(inspirationRoot, `${id}${extension}`), buffer);
  const item = {
    id,
    type:'inspiration_asset',
    parent:parent.id,
    data:{
      title:String(title || '未命名灵感').trim() || '未命名灵感',
      file:relativeFile,
      mime,
      media_type:'image',
      tags:cleanTags(tags),
      source,
      created_at:new Date().toISOString(),
    },
  };
  putItem(db, item);
  db.close();
  exportSnapshot();
  return item;
}

export function saveInspirationDataUrl({ dataUrl, ...metadata }) {
  const matched = String(dataUrl || '').match(/^data:(image\/(?:jpeg|png|webp|gif));base64,([A-Za-z0-9+/=\s]+)$/);
  if (!matched) throw new Error('Clipboard payload is not a supported image data URL');
  return saveInspiration({ ...metadata, mime:matched[1], bytes:Buffer.from(matched[2].replace(/\s/g, ''), 'base64') });
}

export function importInspirationFile(file, metadata = {}) {
  const full = resolve(file);
  const mime = mimeOf(full);
  if (!mime) throw new Error('Only PNG, JPEG, WebP, and GIF files can enter the inspiration library');
  return saveInspiration({ ...metadata, mime, bytes:readFileSync(full), source:metadata.source || full });
}

export function adoptInspiration(sourceSelector, targetSelector, metadata = {}) {
  const db = openStore();
  const source = findItem(db, sourceSelector);
  const target = findItem(db, targetSelector);
  if (source.type !== 'inspiration_asset') throw new Error(`${sourceSelector} is not an inspiration asset`);
  if (!['character','location','faction','relic','system'].includes(target.type)) throw new Error(`${targetSelector} cannot own visual assets`);
  if (!target.parent) throw new Error(`${targetSelector} is not inside a book`);
  const sourceFile = join(dataRoot, String(source.data.file));
  const extension = extname(sourceFile).toLowerCase();
  const id = makeId();
  const relativeFile = `assets/${id}${extension}`;
  copyFileSync(sourceFile, join(assetRoot, `${id}${extension}`));
  const item = {
    id,
    type:'asset',
    parent:target.parent,
    data:{
      title:String(metadata.title || source.data.title),
      file:relativeFile,
      tags:cleanTags(source.data.tags || []),
      source_inspiration:source.id,
    },
  };
  putItem(db, item);
  putLink(db, { source:target.id, target:item.id, kind:'depends' });
  putLink(db, { source:item.id, target:source.id, kind:'derived_from' });
  db.close();
  exportSnapshot();
  return item;
}
