# 📒 追番手帳 Anime Notes

我的個人動漫心得網站。每看完一部動漫，就寫一篇固定格式的心得：評分、喜歡與不喜歡的地方、印象最深的一幕、推薦給誰。

🔗 網站：https://meimeielin.github.io/genAI_HW9/

## 這個專案的重點：一套讓 AI 接手的規則

這個網站不是一次做完就結束，而是用 [`AGENTS.md`](./AGENTS.md)（＋入口 [`CLAUDE.md`](./CLAUDE.md)）定義好規則，之後只要對 AI 說「幫我新增《XXX》的心得」，並附上自己的想法，AI 就能照同一套格式產生新頁面。

| 檔案 | 用途 |
|---|---|
| `AGENTS.md` | 規則手冊：目的、風格、結構、命名、寫作規則、禁止事項、驗收標準 |
| `CLAUDE.md` | Claude 的入口，指向 AGENTS.md |
| `reviews/_template.html` | 心得頁模板，12 個固定區塊 |
| `data/reviews.json` | 心得清單，首頁自動讀取 |
| `scripts/check.py` | 自動檢查新頁面有沒有照規則 |
| `NOTES.md` | 工作日誌，記錄每次做了什麼、下次從哪裡開始 |

## 本機預覽

```bash
python3 -m http.server 8000
# 打開 http://localhost:8000
python3 scripts/check.py   # 檢查格式
```

## 新增一篇心得

1. 對 AI 說：「照 AGENTS.md 幫我新增《作品名》的心得」，附上你的想法。
2. AI 會先列出缺的資訊一次問完，再從模板產生 `reviews/<slug>.html` 並更新 `reviews.json`。
3. 跑 `python3 scripts/check.py`，全部 ✅ 才算完成。
