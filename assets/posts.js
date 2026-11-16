// 追番日常：已發布的貼文來自 data/posts.json（大家都看得到）；
// 用「新增貼文」上傳的照片是草稿，存在這台電腦瀏覽器的 IndexedDB，只有自己看得到。
// 草稿要發布：按「下載」拿到照片和設定，交給 AI 照 AGENTS.md 8.5 加進網站。

const esc = (s) => String(s ?? "").replace(/[&<>"']/g, (c) => (
  { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]
));
const today = () => new Date(Date.now() - new Date().getTimezoneOffset() * 60000).toISOString().slice(0, 10);

// ---------- 草稿資料庫（IndexedDB） ----------
const DB = {
  db: null,
  async open() {
    if (this.db) return this.db;
    this.db = await new Promise((ok, fail) => {
      const req = indexedDB.open("anime-notes-drafts", 1);
      req.onupgradeneeded = () => req.result.createObjectStore("drafts", { keyPath: "id" });
      req.onsuccess = () => ok(req.result);
      req.onerror = () => fail(req.error);
    });
    return this.db;
  },
  async tx(mode, fn) {
    const db = await this.open();
    return new Promise((ok, fail) => {
      const t = db.transaction("drafts", mode);
      const r = fn(t.objectStore("drafts"));
      t.oncomplete = () => ok(r && r.result);
      t.onerror = () => fail(t.error);
    });
  },
  all() { return this.tx("readonly", (s) => s.getAll()); },
  put(d) { return this.tx("readwrite", (s) => s.put(d)); },
  del(id) { return this.tx("readwrite", (s) => s.delete(id)); },
};

// 把照片縮到最長邊 1080px、轉成 JPEG（順便去掉 GPS 等 EXIF 資訊）
function shrink(file) {
  return new Promise((ok, fail) => {
    const img = new Image();
    img.onload = () => {
      const scale = Math.min(1, 1080 / Math.max(img.width, img.height));
      const c = document.createElement("canvas");
      c.width = Math.round(img.width * scale);
      c.height = Math.round(img.height * scale);
      c.getContext("2d").drawImage(img, 0, 0, c.width, c.height);
      c.toBlob((b) => (b ? ok(b) : fail(new Error("轉檔失敗"))), "image/jpeg", 0.85);
      URL.revokeObjectURL(img.src);
    };
    img.onerror = () => fail(new Error("讀不到這張照片"));
    img.src = URL.createObjectURL(file);
  });
}

// ---------- 畫面 ----------
let reviews = [];
let published = [];
const titleOf = (slug) => (reviews.find((r) => r.slug === slug) || {}).title;

function postHTML(p, draft) {
  const src = draft ? URL.createObjectURL(p.blob) : p.image;
  const title = p.review && titleOf(p.review);
  const accent = (reviews.find((r) => r.slug === p.review) || {}).accent || "sky";
  return `
    <article class="post px-box accent-${esc(accent)}${draft ? " draft" : ""}" data-id="${esc(p.id)}">
      <div class="post-top">
        <span>📷 ${esc(p.date)}</span>
        ${draft ? `<span class="stamp">草稿・只有你看得到</span>` : ""}
      </div>
      <img class="post-photo" src="${esc(src)}" alt="${esc(p.alt)}" loading="lazy">
      <div class="post-body">
        <p class="caption">${esc(p.caption)}</p>
        ${title ? `<a class="post-link" href="reviews/${esc(p.review)}.html">▶ 看《${esc(title)}》心得</a>` : ""}
        ${draft ? `
          <div class="actions">
            <button class="btn-px sm" data-act="download">下載</button>
            <button class="btn-px sm ghost" data-act="delete">刪除</button>
          </div>` : ""}
      </div>
    </article>`;
}

async function render() {
  const feed = document.getElementById("feed");
  let drafts = [];
  try { drafts = await DB.all(); } catch (e) { /* 無痕模式等情況可能用不了 IndexedDB */ }
  drafts.sort((a, b) => (b.date + b.id).localeCompare(a.date + a.id));
  const html = [...drafts.map((d) => postHTML(d, true)), ...published.map((p) => postHTML(p, false))];
  feed.innerHTML = html.length ? html.join("") : `<p class="empty">▶ 還沒有貼文，按「新增貼文」放第一張照片吧！</p>`;
}

// 草稿的檔名：照 AGENTS.md 6 節的照片命名規則 YYYY-MM-DD-n.jpg
function draftFileName(d) {
  const sameDay = published.filter((p) => p.date === d.date).length;
  return `${d.date}-${sameDay + 1}.jpg`;
}

function download(d) {
  const name = draftFileName(d);
  const a = document.createElement("a");
  a.href = URL.createObjectURL(d.blob);
  a.download = name;
  a.click();
  const entry = { id: name.replace(".jpg", ""), image: `photos/${name}`, date: d.date, caption: d.caption, alt: d.alt };
  if (d.review) entry.review = d.review;
  const json = JSON.stringify(entry, null, 2);
  navigator.clipboard?.writeText(json).catch(() => {});
  alertBox(`已下載 ${name}，貼文設定也複製好了。\n把照片和下面這段交給 AI，說「照 AGENTS.md 8.5 發布這篇貼文」就可以。\n\n${json}`);
}

function alertBox(text) {
  let box = document.getElementById("notice");
  if (!box) {
    box = document.createElement("pre");
    box.id = "notice";
    box.className = "notice px-box";
    box.addEventListener("click", () => box.remove());
    document.querySelector(".upload-bar").after(box);
  }
  box.textContent = text + "\n\n（點一下關閉）";
  box.scrollIntoView({ behavior: "smooth", block: "center" });
}

async function init() {
  try { reviews = await (await fetch("data/reviews.json")).json(); } catch (e) { reviews = []; }
  try { published = await (await fetch("data/posts.json")).json(); } catch (e) { published = []; }

  const form = document.getElementById("upload");
  const photo = document.getElementById("photo");
  const preview = document.getElementById("preview");
  const select = document.getElementById("review");
  select.insertAdjacentHTML("beforeend", reviews.map((r) => `<option value="${esc(r.slug)}">${esc(r.title)}</option>`).join(""));

  const openForm = (show) => {
    form.hidden = !show;
    document.getElementById("open-upload").hidden = show;
    if (show) document.getElementById("date").value = today();
  };
  document.getElementById("open-upload").addEventListener("click", () => openForm(true));
  document.getElementById("cancel").addEventListener("click", () => { form.reset(); preview.hidden = true; openForm(false); });

  photo.addEventListener("change", () => {
    const f = photo.files[0];
    if (!f) return;
    preview.src = URL.createObjectURL(f);
    preview.hidden = false;
    document.getElementById("drop-hint").hidden = true;
  });

  form.addEventListener("submit", async (e) => {
    e.preventDefault();
    try {
      const blob = await shrink(photo.files[0]);
      await DB.put({
        id: String(Date.now()),
        blob,
        date: document.getElementById("date").value,
        caption: document.getElementById("caption").value.trim(),
        alt: document.getElementById("alt").value.trim(),
        review: select.value,
      });
      form.reset();
      preview.hidden = true;
      document.getElementById("drop-hint").hidden = false;
      openForm(false);
      render();
    } catch (err) {
      alertBox(`存草稿失敗：${err.message}`);
    }
  });

  document.getElementById("feed").addEventListener("click", async (e) => {
    const act = e.target.dataset.act;
    if (!act) return;
    const id = e.target.closest(".post").dataset.id;
    const d = (await DB.all()).find((x) => x.id === id);
    if (!d) return;
    if (act === "download") download(d);
    if (act === "delete" && confirm("確定刪除這篇草稿？刪掉就找不回來了。")) { await DB.del(id); render(); }
  });

  render();
}

init();
