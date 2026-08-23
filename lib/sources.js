import { execFileSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import { existsSync, mkdirSync, readFileSync, statSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { cacheRoot } from './store.js';

const CACHE_TTL = 6 * 60 * 60 * 1000;
const MEIGEN_CATALOG_URL = 'https://raw.githubusercontent.com/jau123/nanobanana-trending-prompts/main/prompts/prompts.json';
const MEIGEN_HOME = 'https://www.meigen.ai';
const MEIGEN_REPOSITORY = 'https://github.com/jau123/nanobanana-trending-prompts';
const WALLHAVEN_API = 'https://wallhaven.cc/api/v1/search';

export const sourceCatalogs = [
  {
    id:'seedance', title:'Seedance 2 Prompts', media:['video','prompt'], mode:'structured-catalog',
    command:'prompt-search', url:'https://seedance2prompts.com/zh',
  },
  {
    id:'meigen', title:'MeiGen / NanoBanana Trending Prompts', media:['image','prompt'], mode:'curated-catalog',
    command:'source-search --source meigen', url:MEIGEN_HOME,
  },
  {
    id:'wallhaven', title:'Wallhaven', media:['image'], mode:'official-api',
    command:'source-search --source wallhaven', url:'https://wallhaven.cc',
  },
];

function cacheIsFresh(file) {
  return existsSync(file) && Date.now() - statSync(file).mtimeMs < CACHE_TTL;
}

function readJson(file) { return JSON.parse(readFileSync(file, 'utf8')); }

function curlJson(url, { proxy } = {}) {
  const call = ['-fsSL','--compressed','--max-time','30','-A','BookMontage/0.1 (+local visual research)'];
  if (proxy) call.push('--proxy', proxy);
  call.push(url);
  return JSON.parse(execFileSync('curl', call, { encoding:'utf8', maxBuffer:32 * 1024 * 1024 }));
}

async function requestJson(url, { proxy } = {}) {
  if (proxy) return curlJson(url, { proxy });
  try {
    const response = await fetch(url, {
      headers:{ 'User-Agent':'BookMontage/0.1 (+local visual research)' },
      signal:AbortSignal.timeout(12_000),
    });
    if (!response.ok) throw new Error(`HTTP ${response.status}`);
    return await response.json();
  } catch (fetchError) {
    try { return curlJson(url); }
    catch (curlError) {
      const first = fetchError instanceof Error ? fetchError.message : String(fetchError);
      const second = curlError instanceof Error ? curlError.message : String(curlError);
      throw new Error(`${first}; curl fallback: ${second}`);
    }
  }
}

async function cachedJson(file, loader, { refresh = false } = {}) {
  if (!refresh && cacheIsFresh(file)) return readJson(file);
  try {
    const value = await loader();
    mkdirSync(cacheRoot, { recursive:true });
    writeFileSync(file, JSON.stringify(value));
    return value;
  } catch (error) {
    if (existsSync(file)) return readJson(file);
    throw error;
  }
}

function termsOf(query) { return String(query || '').trim().toLowerCase().split(/\s+/).filter(Boolean); }
function excerpt(value, length = 320) {
  const text = String(value || '').replace(/\s+/g, ' ').trim();
  return `${text.slice(0, length)}${text.length > length ? '…' : ''}`;
}
function normalizeOption(value) { return String(value || '').trim().toLowerCase(); }

async function searchMeigen(query, options) {
  const cacheFile = join(cacheRoot, 'image-prompts.json');
  const catalog = await cachedJson(cacheFile, async () => {
    const value = await requestJson(MEIGEN_CATALOG_URL, options);
    if (!Array.isArray(value)) throw new Error('MeiGen catalog is not an array');
    return value;
  }, options);
  const terms = termsOf(query);
  const model = normalizeOption(options.model || 'all');
  const category = normalizeOption(options.category || 'all');
  const matches = catalog.map(entry => {
    const prompt = String(entry.prompt || '');
    const author = String(entry.author || entry.author_name || '');
    const categories = (entry.categories || []).map(String);
    const haystacks = {
      prompt:prompt.toLowerCase(), author:author.toLowerCase(),
      categories:categories.join(' ').toLowerCase(), model:String(entry.model || '').toLowerCase(),
    };
    const keywordScore = terms.reduce((total, term) => total
      + (haystacks.categories.includes(term) ? 8 : 0)
      + (haystacks.model.includes(term) ? 5 : 0)
      + (haystacks.author.includes(term) ? 3 : 0)
      + (haystacks.prompt.includes(term) ? 1 : 0), 0);
    return { entry, categories, prompt, author, keywordScore };
  }).filter(({ entry, categories, keywordScore }) =>
    (terms.length === 0 || keywordScore > 0)
    && (model === 'all' || normalizeOption(entry.model) === model)
    && (category === 'all' || categories.some(value => normalizeOption(value).includes(category))));

  if (options.sort === 'popular') matches.sort((left, right) => Number(right.entry.likes || 0) - Number(left.entry.likes || 0));
  else if (options.sort === 'newest') matches.sort((left, right) => String(right.entry.date || '').localeCompare(String(left.entry.date || '')));
  else if (options.sort === 'random') matches.sort(() => Math.random() - 0.5);
  else matches.sort((left, right) => right.keywordScore - left.keywordScore || Number(right.entry.score || 0) - Number(left.entry.score || 0));

  return matches.slice(0, options.limit).map(({ entry, categories, prompt, author, keywordScore }) => {
    const title = `${categories[0] || 'AI Image'} · @${author || 'unknown'}`;
    const images = Array.isArray(entry.images) && entry.images.length ? entry.images : [entry.image].filter(Boolean);
    return {
      id:`meigen:${entry.id}`,
      source:'meigen',
      title,
      description:excerpt(prompt, 220),
      model:entry.model,
      categories,
      author,
      author_url:author ? `https://x.com/${author}` : null,
      published_at:entry.date,
      likes:Number(entry.likes || 0),
      views:Number(entry.views || 0),
      community_score:Number(entry.score || 0),
      rank:Number(entry.rank || 0),
      image_url:images[0] || null,
      image_urls:images,
      preview_url:entry.image || images[0] || null,
      page_url:entry.source_url,
      catalog_url:MEIGEN_HOME,
      repository:MEIGEN_REPOSITORY,
      search_score:keywordScore,
      ...(options.full ? { prompt } : { prompt_excerpt:excerpt(prompt) }),
      license:'CC BY 4.0 for the catalog; linked images retain creator rights',
      usage:'research_reference',
      stash:images[0] ? { url:images[0], title, source:entry.source_url } : null,
    };
  });
}

function wallhavenSort(value) {
  if (value === 'popular') return 'toplist';
  if (value === 'newest') return 'date_added';
  if (value === 'random') return 'random';
  return 'relevance';
}

async function searchWallhaven(query, options) {
  const url = new URL(WALLHAVEN_API);
  if (query.trim()) url.searchParams.set('q', query.trim());
  url.searchParams.set('categories', '111');
  url.searchParams.set('purity', '100');
  url.searchParams.set('sorting', wallhavenSort(options.sort));
  url.searchParams.set('order', 'desc');
  url.searchParams.set('page', String(options.page));
  if (options.sort === 'popular') url.searchParams.set('topRange', options.topRange || '1M');
  if (options.atleast) url.searchParams.set('atleast', options.atleast);
  if (options.ratio) url.searchParams.set('ratios', options.ratio);
  if (options.color) url.searchParams.set('colors', options.color.replace(/^#/, ''));
  if (process.env.WALLHAVEN_API_KEY) url.searchParams.set('apikey', process.env.WALLHAVEN_API_KEY);
  const cacheKey = createHash('sha256').update(url.toString()).digest('hex').slice(0, 16);
  const cacheFile = join(cacheRoot, `wallhaven-${cacheKey}.json`);
  const catalog = await cachedJson(cacheFile, () => requestJson(url.toString(), options), options);
  if (!Array.isArray(catalog.data)) throw new Error('Wallhaven response has no data array');
  return catalog.data.slice(0, options.limit).map(entry => {
    const title = `${query.trim() || 'Wallhaven 精选'} · ${entry.resolution} · ${entry.id}`;
    return {
      id:`wallhaven:${entry.id}`,
      source:'wallhaven',
      title,
      description:`${entry.category || 'image'} · ${entry.resolution} · ${entry.ratio}:1 · ${Number(entry.file_size || 0)} bytes`,
      category:entry.category,
      resolution:entry.resolution,
      width:entry.dimension_x,
      height:entry.dimension_y,
      ratio:entry.ratio,
      colors:entry.colors || [],
      views:Number(entry.views || 0),
      favorites:Number(entry.favorites || 0),
      published_at:entry.created_at,
      image_url:entry.path,
      image_urls:[entry.path].filter(Boolean),
      preview_url:entry.thumbs?.large || entry.thumbs?.original || entry.path,
      page_url:entry.url,
      original_source_url:entry.source || null,
      api:'https://wallhaven.cc/help/api',
      license:'unknown; verify the original creator and source before production use',
      usage:'research_reference',
      stash:entry.path ? { url:entry.path, title, source:entry.url } : null,
    };
  });
}

export async function searchSources(query = '', rawOptions = {}) {
  const source = normalizeOption(rawOptions.source || 'all');
  if (!['all','meigen','wallhaven'].includes(source)) throw new Error('--source must be all, meigen, or wallhaven');
  const sort = normalizeOption(rawOptions.sort || 'relevance');
  if (!['relevance','popular','newest','random'].includes(sort)) throw new Error('--sort must be relevance, popular, newest, or random');
  const options = {
    ...rawOptions,
    source,
    sort,
    model:rawOptions.model || 'all',
    category:rawOptions.category || 'all',
    limit:Math.max(1, Math.min(50, Number(rawOptions.limit) || 6)),
    page:Math.max(1, Number(rawOptions.page) || 1),
    atleast:rawOptions.atleast || '1920x1080',
    proxy:rawOptions.proxy || process.env.BOOKMONTAGE_HTTP_PROXY || process.env.HTTPS_PROXY || process.env.https_proxy || '',
  };
  const selected = source === 'all' ? ['meigen','wallhaven'] : [source];
  const settled = await Promise.allSettled(selected.map(name => name === 'meigen'
    ? searchMeigen(query, options)
    : searchWallhaven(query, options)));
  const results = [];
  const errors = [];
  settled.forEach((outcome, index) => {
    if (outcome.status === 'fulfilled') results.push(...outcome.value);
    else errors.push({ source:selected[index], message:outcome.reason instanceof Error ? outcome.reason.message : String(outcome.reason) });
  });
  return { query, sources:selected, results, errors };
}
