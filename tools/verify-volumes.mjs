// data/volumes.json から生成した断片が、実際に公開されている各サイトの内容と
// 一致しているかを確認する。新刊を追加する前の健全性チェックとしても、
// このツールを作った直後の検証としても使う。
//
// 使い方: node tools/verify-volumes.mjs [兄弟リポジトリを置いてあるディレクトリ]
// 省略時は、このリポジトリの1つ上のディレクトリ（gh repo clone を並べた場所）を見る。

import { readFile } from "node:fs/promises";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

import {
  renderReadmeTable,
  renderVolumesCards,
  renderVolumesList,
  totalRounds,
  totalVolumes,
} from "./render-volumes.mjs";

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const siblingsDir = resolve(process.argv[2] ?? resolve(ROOT, ".."));

const volumes = JSON.parse(await readFile(resolve(ROOT, "data/volumes.json"), "utf8"));

let failures = 0;

function report(label, ok, detail) {
  if (ok) {
    console.log(`OK  ${label}`);
  } else {
    failures += 1;
    console.log(`NG  ${label}`);
    if (detail) console.log(detail);
  }
}

// このマシンのgitはcore.autocrlfでチェックアウト時にLF→CRLFへ変換する。
// リポジトリ自体はLFで管理されているので、比較前にCRLFをLFへ戻す。
function normalizeEol(text) {
  return text.replace(/\r\n/g, "\n");
}

function extractBetween(source, startMarker, endMarker) {
  const markerStart = source.indexOf(startMarker);
  if (markerStart === -1) return null;
  // startMarker手前の行頭までの字下げも含めて取り出す（生成側は字下げ込みで出力するため）
  const lineStart = source.lastIndexOf("\n", markerStart) + 1;
  const end = source.indexOf(endMarker, markerStart);
  if (end === -1) return null;
  return source.slice(lineStart, end + endMarker.length);
}

// 1. 各巻のサイト自身のヘッダーを確認する（Ⅲのように特殊構成のものは special でスキップ）
for (const v of volumes) {
  if (v.special) {
    console.log(`SKIP ${v.roman}（${v.special.split("。")[0]}）`);
    continue;
  }
  const indexPath = resolve(siblingsDir, v.repo, "index.html");
  let source;
  try {
    source = normalizeEol(await readFile(indexPath, "utf8"));
  } catch {
    report(`${v.roman} (${v.repo}) index.htmlを読めない`, false, `  path: ${indexPath}`);
    continue;
  }
  const actual = extractBetween(source, `<ul class="volumes__list">`, `</ul>`);
  const expected = renderVolumesList(volumes, v.repo);
  report(`${v.roman} (${v.repo}) のヘッダー`, actual === expected, actual === expected ? "" : diff(expected, actual));
}

// 2. 入口ページ(ai-challenge)のカード一覧
{
  const entryPath = resolve(ROOT, "index.html");
  const source = normalizeEol(await readFile(entryPath, "utf8"));
  const actual = extractBetween(source, `<ul class="volumes">`, `</ul>`);
  const expected = renderVolumesCards(volumes);
  report("入口ページのカード一覧", actual === expected, actual === expected ? "" : diff(expected, actual));

  const rounds = totalRounds(volumes);
  const count = totalVolumes(volumes);
  const mustContain = [
    `<meta name="description" content="生成AIを使ったことがない先生へ。職員室で実際につぶやかれた困りごとから始める、${count}冊${rounds}回のチャレンジ集です。1回10分。">`,
    `いまは${count}冊、<strong>${rounds}回分</strong>の困りごとが並んでいます。`,
    `<h2>${count}のチャレンジ（全${rounds}回）</h2>`,
  ];
  for (const needle of mustContain) {
    report(`入口ページの「${count}冊${rounds}回」表記: ${needle.slice(0, 24)}...`, source.includes(needle));
  }
}

// 3. 入口ページ README.md の表
{
  const readmePath = resolve(ROOT, "README.md");
  const source = normalizeEol(await readFile(readmePath, "utf8"));
  const expected = renderReadmeTable(volumes);
  report("README.mdの表", source.includes(expected), source.includes(expected) ? "" : diff(expected, "(見つからず)"));
}

function diff(expected, actual) {
  return [
    "  --- expected ---",
    ...String(expected).split("\n").map((l) => `  ${l}`),
    "  --- actual ---",
    ...String(actual).split("\n").map((l) => `  ${l}`),
  ].join("\n");
}

console.log("");
if (failures > 0) {
  console.log(`${failures}件、生成結果と実際の内容がずれています。`);
  process.exit(1);
}
console.log("すべて一致。volumes.jsonからの生成結果は、現在公開されている内容と同じです。");
