// data/volumes.json を唯一の情報源として、各巻のヘッダー・入口ページの断片を生成する。
// verify-volumes.mjs が「生成結果 === 現在公開されている内容」であることを検証する。
// publish-volume.mjs が、新しい巻を1件足したときに全リポジトリへ反映する。

export function totalRounds(volumes) {
  return volumes.reduce((sum, v) => sum + v.rounds, 0);
}

export function totalVolumes(volumes) {
  return volumes.length;
}

// 各巻のサイト自身のヘッダーにある <ul class="volumes__list"> を生成する。
// currentRepo と一致する巻はリンクではなく <span class="volumes__current"> にする。
export function renderVolumesList(volumes, currentRepo) {
  const items = volumes.map((v) => {
    if (v.repo === currentRepo) {
      return `        <li><span class="volumes__current" aria-current="page" title="${v.title}">${v.navLabel}</span></li>`;
    }
    return `        <li><a href="${v.url}" title="${v.title}">${v.navLabel}</a></li>`;
  });
  return [`      <ul class="volumes__list">`, ...items, `      </ul>`].join("\n");
}

// 入口ページ(ai-challenge)のカード1枚分。
export function renderVolumeCard(v) {
  return [
    `        <li>`,
    `          <a class="volume" href="${v.url}">`,
    `            <span class="volume__head">`,
    `              <span class="volume__num">${v.roman}</span>`,
    `              <span class="volume__title">${v.title}</span>`,
    `            </span>`,
    `            <p class="volume__for">${v.audience}</p>`,
    `            <p class="volume__desc">${v.desc}</p>`,
    `            <p class="volume__count">${v.count}</p>`,
    `          </a>`,
    `        </li>`,
  ].join("\n");
}

// 入口ページの <ul class="volumes"> 全体。
export function renderVolumesCards(volumes) {
  const cards = volumes.map(renderVolumeCard).join("\n\n");
  return `      <ul class="volumes">\n${cards}\n      </ul>`;
}

// 入口ページ README.md の表の1行。
export function renderReadmeRow(v) {
  return `| ${v.roman} | [${v.title}](${v.url}) | ${v.audience} | ${v.rounds} |`;
}

export function renderReadmeTable(volumes) {
  const header = "| 巻 | 題名 | 誰向け | 回数 |\n|---|---|---|---|";
  return [header, ...volumes.map(renderReadmeRow)].join("\n");
}
