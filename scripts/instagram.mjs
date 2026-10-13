// Atualiza a seção "No Instagram" do index.html com os posts mais recentes do @psi.cidpinheiro.
// Roda na GitHub Action .github/workflows/instagram.yml. Node 22+, sem dependências.
//
// Variáveis de ambiente:
//   IG_TOKEN  token de longa duração da API do Instagram (obrigatório)
//   GH_PAT    token do GitHub com permissão de escrita em Secrets (opcional, para salvar o token renovado)
//
// Se qualquer coisa falhar, o index.html não é tocado: a página continua com os últimos posts bons.

import { readFile, writeFile, mkdir, readdir, unlink } from 'node:fs/promises';
import { execFileSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import path from 'node:path';
import { pickPosts, replaceBlock, formatDate } from './instagram-lib.mjs';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const HTML_FILE = path.join(ROOT, 'index.html');
const IMG_DIR = path.join(ROOT, 'assets', 'instagram');
const CONFIG_FILE = path.join(ROOT, 'scripts', 'instagram.config.json');
const API = 'https://graph.instagram.com';
const FIELDS = 'id,caption,media_type,media_url,thumbnail_url,permalink,timestamp';

async function api(url) {
  const res = await fetch(url);
  const json = await res.json().catch(() => ({}));
  if (!res.ok || json.error) throw new Error(`API do Instagram: ${json.error?.message || res.status}`);
  return json;
}

async function refreshToken(token) {
  try {
    const { access_token: fresh, expires_in } = await api(`${API}/refresh_access_token?grant_type=ig_refresh_token&access_token=${encodeURIComponent(token)}`);
    console.log(`Token renovado: válido por mais ${Math.round(expires_in / 86400)} dias.`);
    if (!fresh || fresh === token) return token;
    console.log(`::add-mask::${fresh}`);
    if (process.env.GH_PAT && process.env.GITHUB_REPOSITORY) {
      execFileSync('gh', ['secret', 'set', 'IG_TOKEN', '--repo', process.env.GITHUB_REPOSITORY], {
        input: fresh, env: { ...process.env, GH_TOKEN: process.env.GH_PAT }, stdio: ['pipe', 'inherit', 'inherit'],
      });
      console.log('Secret IG_TOKEN atualizado com o token novo.');
    } else {
      console.log('::warning::A Meta devolveu um token novo, mas não há GH_PAT para salvá-lo. Configure o GH_PAT (ver README) ou o token antigo vai expirar.');
    }
    return fresh;
  } catch (err) {
    // Falha comum e inofensiva: token com menos de 24h. Segue com o token atual.
    console.log(`::warning::Não foi possível renovar o token agora (${err.message}).`);
    return token;
  }
}

async function download(url, id) {
  const res = await fetch(url);
  if (!res.ok) throw new Error(`Falha ao baixar imagem do post ${id}: ${res.status}`);
  const ext = (res.headers.get('content-type') || '').includes('webp') ? 'webp' : 'jpg';
  const name = `${id}.${ext}`;
  await writeFile(path.join(IMG_DIR, name), Buffer.from(await res.arrayBuffer()));
  return `assets/instagram/${name}`;
}

async function main() {
  let token = process.env.IG_TOKEN;
  if (!token) throw new Error('IG_TOKEN não configurado (Settings > Secrets and variables > Actions).');
  const config = JSON.parse(await readFile(CONFIG_FILE, 'utf8'));

  token = await refreshToken(token);
  const { data = [] } = await api(`${API}/me/media?fields=${FIELDS}&limit=25&access_token=${encodeURIComponent(token)}`);
  console.log(`${data.length} posts recebidos da API.`);

  const posts = pickPosts(data, config);
  if (posts.length < config.quantidade) {
    console.log(`::warning::Só ${posts.length} post(s) passaram no filtro. A página fica como está.`);
    return;
  }

  await mkdir(IMG_DIR, { recursive: true });
  for (const p of posts) p.file = await download(p.image, p.id);

  const keep = new Set(posts.map(p => path.basename(p.file)));
  for (const f of await readdir(IMG_DIR)) {
    if (!keep.has(f) && f !== '.gitkeep') await unlink(path.join(IMG_DIR, f));
  }

  const html = await readFile(HTML_FILE, 'utf8');
  const next = replaceBlock(html, posts);
  if (next !== html) {
    await writeFile(HTML_FILE, next);
    console.log('index.html atualizado:');
  } else {
    console.log('Nenhuma mudança no index.html. Posts atuais:');
  }
  for (const p of posts) console.log(`  ${formatDate(p.timestamp)}  ${p.permalink}`);
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  main().catch(err => { console.error(`::error::${err.message}`); process.exit(1); });
}
