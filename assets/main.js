// 首頁：讀取 data/reviews.json，產生統計、類型／配音員篩選與心得卡片。
// 新增心得時不需要改這個檔案，只要更新 reviews.json（見 AGENTS.md 第 7 節）。

const esc = (s) => String(s).replace(/[&<>"']/g, (c) => (
  { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]
));

function cardHTML(r) {
  return `
    <a class="card px-box accent-${esc(r.accent)}" href="reviews/${esc(r.slug)}.html">
      <div class="card-top">
        <span class="emoji">${esc(r.emoji)}</span>
        <span class="score-badge">${esc(r.score)}</span>
      </div>
      <div class="card-body">
        <h2>${esc(r.title)}</h2>
        <p class="original">${esc(r.original)}・${esc(r.year)}</p>
        <p class="oneliner">${esc(r.oneliner)}</p>
        <div>${r.genres.map((g) => `<span class="tag">${esc(g)}</span>`).join("")}</div>
        <p class="cv">🎙️ ${r.cast.map((c) => esc(c.cv)).join("、")}</p>
        <div class="row">${esc(r.status)}・${esc(r.watched)}</div>
      </div>
    </a>`;
}

async function init() {
  const cards = document.getElementById("cards");
  const filters = document.getElementById("filters");
  const cvSelect = document.getElementById("cv-filter");
  let reviews = [];
  try {
    const res = await fetch("data/reviews.json");
    reviews = await res.json();
  } catch (e) {
    cards.innerHTML = `<p class="empty">讀不到 data/reviews.json。本機請用 <code>python3 -m http.server</code> 開啟。</p>`;
    return;
  }

  if (!reviews.length) {
    cards.innerHTML = `<p class="empty">▶ 第一篇心得準備中⋯⋯</p>`;
    return;
  }

  // 統計
  const scored = reviews.filter((r) => typeof r.score === "number");
  const avg = scored.length ? (scored.reduce((a, r) => a + r.score, 0) / scored.length).toFixed(1) : "-";
  const allCv = [...new Set(reviews.flatMap((r) => r.cast.map((c) => c.cv)))];
  document.getElementById("stat-count").textContent = reviews.length;
  document.getElementById("stat-avg").textContent = avg;
  document.getElementById("stat-cv").textContent = allCv.length;

  // 篩選：類型（按鈕）＋配音員（下拉選單），兩者可同時使用
  const genres = [...new Set(reviews.flatMap((r) => r.genres))];
  let genre = "全部";
  let cv = "";
  const render = () => {
    const list = reviews.filter((r) =>
      (genre === "全部" || r.genres.includes(genre)) &&
      (!cv || r.cast.some((c) => c.cv === cv)));
    cards.innerHTML = list.length ? list.map(cardHTML).join("") : `<p class="empty">沒有符合條件的心得。</p>`;
    filters.querySelectorAll("button").forEach((b) => b.classList.toggle("on", b.dataset.genre === genre));
  };
  filters.innerHTML = ["全部", ...genres].map((g) => `<button data-genre="${esc(g)}">${esc(g)}</button>`).join("");
  filters.addEventListener("click", (e) => {
    if (e.target.dataset.genre) { genre = e.target.dataset.genre; render(); }
  });
  cvSelect.innerHTML = `<option value="">🎙️ 全部配音員</option>` +
    allCv.map((n) => `<option value="${esc(n)}">${esc(n)}</option>`).join("");
  cvSelect.addEventListener("change", () => { cv = cvSelect.value; render(); });
  render();
}

init();
