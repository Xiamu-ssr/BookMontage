import { copyFileSync, readFileSync, writeFileSync } from 'node:fs';
import { extname, join, resolve } from 'node:path';
import { assetRoot, dataRoot, exportSnapshot, findItem, inspirationRoot, logicalId, makeId, openStore, putItem, putLink, versionOf } from './store.js';

const imageTypes = new Map([
  ['image/jpeg', '.jpg'], ['image/png', '.png'], ['image/webp', '.webp'], ['image/gif', '.gif'],
]);

function cleanTags(values = []) {
  return [...new Set(values.flatMap(value => String(value).split(/[,，]/)).map(value => value.trim()).filter(Boolean))].slice(0, 24);
}

function cleanTypes(values = []) {
  const supported = new Set(['角色', '场景']);
  return cleanTags(values).filter(value => supported.has(value));
}

function mimeOf(file) {
  const extension = extname(file).toLowerCase();
  return extension === '.png' ? 'image/png'
    : extension === '.webp' ? 'image/webp'
      : extension === '.gif' ? 'image/gif'
        : ['.jpg', '.jpeg'].includes(extension) ? 'image/jpeg'
          : '';
}

function namedContainer(db, type, parent, title) {
  const normalized = String(title || '').trim();
  if (!normalized) return null;
  const existing = db.prepare("SELECT id,type,parent,data FROM item WHERE type=? AND parent IS ? AND json_extract(data,'$.title')=? ORDER BY id DESC LIMIT 1").get(type, parent || null, normalized);
  if (existing) return { ...existing, data:JSON.parse(existing.data) };
  const item = { id:makeId(), type, parent:parent || null, data:{ title:normalized, created_at:new Date().toISOString() } };
  putItem(db, item);
  return item;
}

function inspirationParent(db, category, subcategory) {
  const categoryItem = namedContainer(db, 'inspiration_category', null, category);
  if (!categoryItem) return null;
  return namedContainer(db, 'inspiration_subcategory', categoryItem.id, subcategory) || categoryItem;
}

export function saveInspiration({ bytes, mime, title, category, subcategory, types = [], tags = [], detailed_description = '', source = 'clipboard' }) {
  if (!imageTypes.has(mime)) throw new Error(`Unsupported inspiration image type: ${mime}`);
  const buffer = Buffer.isBuffer(bytes) ? bytes : Buffer.from(bytes);
  if (!buffer.length) throw new Error('The inspiration image is empty');
  if (buffer.length > 25 * 1024 * 1024) throw new Error('The inspiration image exceeds 25 MB');
  const db = openStore();
  const parent = inspirationParent(db, category, subcategory);
  const id = makeId();
  const extension = imageTypes.get(mime);
  const relativeFile = `inspirations/${id}${extension}`;
  writeFileSync(join(inspirationRoot, `${id}${extension}`), buffer);
  const item = {
    id,
    type:'inspiration_asset',
    parent:parent?.id || null,
    data:{
      title:String(title || '未命名灵感').trim() || '未命名灵感',
      file:relativeFile,
      mime,
      media_type:'image',
      types:cleanTypes(types),
      tags:cleanTags(tags),
      detailed_description:String(detailed_description || '').trim(),
      source,
      created_at:new Date().toISOString(),
    },
  };
  putItem(db, item);
  db.close();
  exportSnapshot();
  return item;
}

export function updateInspiration(selector, metadata = {}) {
  const db = openStore();
  const selected = findItem(db, selector);
  if (selected.type !== 'inspiration_asset') throw new Error(`${selector} is not an inspiration asset`);
  const currentRow = db.prepare("SELECT id,type,parent,data FROM item WHERE substr(id,1,32)=? ORDER BY id DESC LIMIT 1").get(logicalId(selected.id));
  const current = { ...currentRow, data:JSON.parse(currentRow.data) };
  const parent = metadata.category !== undefined || metadata.subcategory !== undefined
    ? inspirationParent(db, metadata.category, metadata.subcategory)
    : null;
  const next = versionOf(current.id) + 1;
  if (next > 9999) throw new Error('Version space exhausted');
  const item = {
    id:`${logicalId(current.id)}${String(next).padStart(4, '0')}`,
    type:current.type,
    parent:metadata.category !== undefined || metadata.subcategory !== undefined ? parent?.id || null : current.parent,
    data:{
      ...current.data,
      ...(metadata.title !== undefined ? { title:String(metadata.title).trim() || current.data.title } : {}),
      ...(metadata.types !== undefined ? { types:cleanTypes(metadata.types) } : {}),
      ...(metadata.tags !== undefined ? { tags:cleanTags(metadata.tags) } : {}),
      ...(metadata.detailed_description !== undefined ? { detailed_description:String(metadata.detailed_description).trim() } : {}),
      updated_at:new Date().toISOString(),
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
