// data/volumes.json を唯一の情報源として、
//  1) 入口ページ(このリポジトリ)自身の index.html / README.md
//  2) 各巻のサイトのヘッダー <ul class="volumes__list">
// を書き換える。巻を1つ増やしたときは、data/volumes.json に1件足してこれを実行するだけでよい。
//
// 使い方:
//   node tools/publish-volume.mjs                         … 入口ページだけ更新
//   node tools/publish-volume.mjs --sites <兄弟ディレクトリ>  … 入口ページ＋各サイトのヘッダーを更新
//
// Ⅲ（lesson-improvement-ai-50）は単一HTML構成のため対象外。
// data/volumes.json の該当エントリーに special があるものは自動でスキップする。
// 実行後は必ず node tools/verify-volumes.mjs で一致を確認してからcommit・pushする。

import { readFile, writeFile } from "node:fs/promises";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

import { renderReadmeTable, renderVolumesCards, renderVolumesList, totalRounds, totalVolumes } from "./render-volumes.mjs";

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const volumes = JSON.parse(await readFile(resolve(ROOT, "data/volumes.json"), "utf8"));

// このマシンのgitはcore.autocrlfでチェックアウト時にLF→CRLFへ変換する。
// リポジトリ自体はLFで管理されているので、読み込み時にLFへ揃えてから処理し、
// 書き込みもLFで行う（次のチェックアウトで再びCRLFに変換されるのは正常）。
async function readNormalized(path) {
  return (await readFile(path, "utf8")).replace(/\r\n/g, "\n");
}

function replaceBlock(source, startMarker, endMarker, replacement) {
  const markerStart = source.indexOf(startMarker);
  if (markerStart === -1) throw new Error(`開始マーカーが見つかりません: ${startMarker}`);
  const lineStart = source.lastIndexOf("\n", markerStart) + 1;
  const end = source.indexOf(endMarker, markerStart);
  if (end === -1) throw new Error(`終了マーカーが見つかりません: ${endMarker}`);
  return source.slice(0, lineStart) + replacement + "\n" + source.slice(end + endMarker.length + 1);
}

async function updateEntryPage() {
  const indexPath = resolve(ROOT, "index.html");
  let source = await readNormalized(indexPath);
  source = replaceBlock(source, `<ul class="volumes">`, `</ul>`, renderVolumesCards(volumes));

  const rounds = totalRounds(volumes);
  const count = totalVolumes(volumes);
  source = source.replace(
    /<meta name="description" content="生成AIを使ったことがない先生へ。職員室で実際につぶやかれた困りごとから始める、\d+冊\d+回のチャレンジ集です。1回10分。">/,
    `<meta name="description" content="生成AIを使ったことがない先生へ。職員室で実際につぶやかれた困りごとから始める、${count}冊${rounds}回のチャレンジ集です。1回10分。">`,
  );
  source = source.replace(
    /いまは\d+冊、<strong>\d+回分<\/strong>の困りごとが並んでいます。/,
    `いまは${count}冊、<strong>${rounds}回分</strong>の困りごとが並んでいます。`,
  );
  source = source.replace(/<h2>\d+のチャレンジ（全\d+回）<\/h2>/, `<h2>${count}のチャレンジ（全${rounds}回）</h2>`);
  await writeFile(indexPath, source);
  console.log(`更新: ${indexPath}`);

  const readmePath = resolve(ROOT, "README.md");
  let readme = await readNormalized(readmePath);
  const tableStart = readme.indexOf("| 巻 |");
  if (tableStart === -1) throw new Error("README.mdに表の開始（| 巻 |）が見つかりません");
  const tableEnd = readme.indexOf("\n\n", tableStart);
  if (tableEnd === -1) throw new Error("README.mdに表の終わり（空行）が見つかりません");
  readme = readme.slice(0, tableStart) + renderReadmeTable(volumes) + readme.slice(tableEnd);
  readme = readme.replace(/\*\*\d+冊・全\d+回。\*\*/, `**${count}冊・全${rounds}回。**`);
  await writeFile(readmePath, readme);
  console.log(`更新: ${readmePath}`);
}

async function updateSiteHeader(siteRepoPath, volume) {
  const indexPath = resolve(siteRepoPath, "index.html");
  let source = await readNormalized(indexPath);
  source = replaceBlock(source, `<ul class="volumes__list">`, `</ul>`, renderVolumesList(volumes, volume.repo));
  await writeFile(indexPath, source);
  console.log(`更新: ${indexPath}`);
}

const sitesArgIndex = process.argv.indexOf("--sites");
await updateEntryPage();

if (sitesArgIndex !== -1) {
  const siblingsDir = resolve(process.argv[sitesArgIndex + 1]);
  for (const v of volumes) {
    if (v.special) {
      console.log(`スキップ: ${v.roman}（${v.special.split("。")[0]}） — 手動で対応`);
      continue;
    }
    await updateSiteHeader(resolve(siblingsDir, v.repo), v);
  }
}

console.log("\n完了。node tools/verify-volumes.mjs で一致を確認してからcommit・pushしてください。");
