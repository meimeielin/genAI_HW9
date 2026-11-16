#!/usr/bin/env python3
"""追番手帳檢查腳本（AGENTS.md 第 10 節）

用法：在專案根目錄執行  python3 scripts/check.py
只用 Python 標準函式庫，不需要安裝任何套件。
"""
import json
import re
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
REVIEWS = ROOT / "reviews"

ACCENTS = {"sakura", "sky", "matcha", "lemon", "lavender", "coral", "ocean", "ink"}
GENRES = {"奇幻", "科幻", "戀愛", "日常", "運動", "懸疑", "戰鬥", "搞笑",
        "致鬱", "治癒", "校園", "音樂", "冒險", "職場"}
STATUS = {"已完結", "追番中", "棄番"}
REQUIRED = ["slug", "title", "original", "emoji", "accent", "year", "status",
            "watched", "score", "genres", "cast", "oneliner", "written"]
# 第 4 節的區塊順序
SECTIONS = ['class="back', 'class="review-head', 'class="meta', 'class="oneliner',
            'class="scores', 'id="story"', 'id="likes"', 'id="dislikes"',
            'id="moment"', 'id="voice"', 'id="recommend"', 'class="review-foot']

errors, warnings = [], []


def err(msg):
    errors.append(msg)


def warn(msg):
    warnings.append(msg)


# ---- 1. reviews.json ----
try:
    data = json.loads((ROOT / "data" / "reviews.json").read_text(encoding="utf-8"))
except Exception as e:  # noqa: BLE001
    print(f"❌ data/reviews.json 無法解析：{e}")
    sys.exit(1)

if not isinstance(data, list):
    print("❌ data/reviews.json 最外層必須是陣列 [ ]")
    sys.exit(1)

seen = set()
for i, r in enumerate(data):
    who = r.get("slug", f"第 {i + 1} 筆")
    for k in REQUIRED:
        if k not in r:
            err(f"{who}：reviews.json 缺少欄位 {k}")
    slug = r.get("slug", "")
    if not re.fullmatch(r"[a-z0-9]+(-[a-z0-9]+)*", slug):
        err(f"{who}：slug 只能用小寫英文、數字和 -")
    if slug in seen:
        err(f"{who}：slug 重複")
    seen.add(slug)
    if r.get("accent") not in ACCENTS:
        err(f"{who}：accent「{r.get('accent')}」不在 8 個代表色裡")
    if r.get("status") not in STATUS:
        err(f"{who}：status 只能是 已完結／追番中／棄番")
    genres = r.get("genres", [])
    if not 1 <= len(genres) <= 4:
        err(f"{who}：類型要 1～4 個")
    for g in genres:
        if g not in GENRES:
            err(f"{who}：類型「{g}」不在清單裡（AGENTS.md 4.2）")
    cast = r.get("cast", [])
    if not 1 <= len(cast) <= 4:
        err(f"{who}：配音員要 1～4 位")
    for c in cast:
        if not (isinstance(c, dict) and c.get("role") and c.get("cv")):
            err(f"{who}：cast 每筆都要有 role 和 cv")
    score = r.get("score")
    if score == "?":
        warn(f"{who}：總分還是 ?，等主人補")
    elif not (isinstance(score, (int, float)) and 1 <= score <= 10 and score * 2 == int(score * 2)):
        err(f"{who}：score 必須是 1～10，以 0.5 為單位")
    if len(r.get("oneliner", "")) > 30:
        err(f"{who}：一句話短評超過 30 字")
    if not re.fullmatch(r"\d{4}-\d{2}", str(r.get("watched", ""))):
        err(f"{who}：watched 格式要是 YYYY-MM")
    if not re.fullmatch(r"\d{4}-\d{2}-\d{2}", str(r.get("written", ""))):
        err(f"{who}：written 格式要是 YYYY-MM-DD")

    # ---- 2. 對應的心得頁 ----
    page = REVIEWS / f"{slug}.html"
    if not page.exists():
        err(f"{who}：找不到 reviews/{slug}.html")
        continue
    html = page.read_text(encoding="utf-8")
    if "{{" in html:
        err(f"{who}：頁面還有沒換掉的 {{{{...}}}} 佔位符")
    if "<img" in html.lower():
        err(f"{who}：頁面不能放圖片（AGENTS.md 3.4）")
    if re.search(r"<style", html, re.I):
        err(f"{who}：不能在 HTML 裡寫 <style>")
    pos = [html.find(s) for s in SECTIONS]
    missing = [s for s, p in zip(SECTIONS, pos) if p < 0]
    if missing:
        err(f"{who}：缺少區塊 {', '.join(missing)}")
    elif pos != sorted(pos):
        err(f"{who}：區塊順序和模板不同")
    if f'accent-{r.get("accent")}' not in html:
        err(f"{who}：頁面代表色和 reviews.json 不一致")
    if r.get("oneliner") and r["oneliner"] not in html:
        err(f"{who}：頁面的一句話短評和 reviews.json 不一致")
    m = re.search(r'class="score-badge">([^<]+)<', html)
    if m and str(score) != m.group(1).strip():
        err(f"{who}：頁面總分 {m.group(1).strip()} 和 reviews.json 的 {score} 不一致")
    for g in genres:
        if f'<span class="tag">{g}</span>' not in html:
            err(f"{who}：頁面缺少類型「{g}」")
    page_cast = re.findall(r"<li class=\"px-box\"><b>([^<]+)</b>（CV：([^）]+)）", html)
    json_cast = [(c.get("role"), c.get("cv")) for c in cast if isinstance(c, dict)]
    if page_cast != json_cast:
        err(f"{who}：配音員筆記和 reviews.json 的 cast 不一致（頁面：{page_cast}）")
    if "待確認" in html:
        warn(f"{who}：頁面有「待確認」的資料")

# ---- 3. 孤兒頁面 ----
for p in REVIEWS.glob("*.html"):
    if not p.name.startswith("_") and p.stem not in seen:
        err(f"reviews/{p.name} 沒有列在 reviews.json，首頁看不到它")

# ---- 結果 ----
for w in warnings:
    print(f"⚠️  {w}")
for e in errors:
    print(f"❌ {e}")
if errors:
    print(f"\n共 {len(errors)} 個錯誤，請修正後再跑一次。")
    sys.exit(1)
print(f"✅ 檢查通過：{len(data)} 篇心得，格式全部正確。")
