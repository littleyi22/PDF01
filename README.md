# 奕鈞老師 PDF拆分合併工具 2.1版

一個純前端、客戶端執行的瀏覽器 PDF 處理系統，提供陽光般明亮、美觀的介面，支援使用者上傳多份 PDF 檔案進行即時預覽、裁切、選頁與下載。

## 功能特色
- 📄 **PDF 預覽與整併**：支援多份 PDF 上傳，將所有頁面預覽呈現，自由拖曳調整頁面順序。
- 🔍 **放大檢視**：針對單一頁面提供高清晰的燈箱 (Modal) 縮放預覽，一覽無遺。
- 🔄 **頁面旋轉**：支援單張頁面的自由旋轉控制。
- 📥 **支援彈性輸出**：可依據所選頁碼自動打包匯出全新的 PDF，或轉出高畫質圖片檔（以 ZIP 壓縮或多張獨自下載的PNG）。
- 📝 **智慧檔名**：根據您自動選取的原始頁碼範圍（例：P001-005）自動為您命名下載的檔案。

## 使用技術
- HTML5 / Vanilla CSS / Vanilla JavaScript
- [PDF.js](https://mozilla.github.io/pdf.js/)：用於精準解析與圖層呈現 PDF 引擎。
- [PDF-Lib](https://pdf-lib.js.org/)：用於重組、建立、合併與輸出實體 PDF 結構檔。
- [JSZip](https://stuk.github.io/jszip/)：處理圖檔封裝，原生支援 Blob 轉換確保與 Windows 的最佳相容性。
- [SortableJS](https://sortablejs.github.io/Sortable/)：提供清爽、直覺的拖曳重排（Drag and Drop）支援。

## 版本更新 (v2.1)
- 全新視覺 UI：加入琥珀色與暖陽風格背景。
- 新增：點擊頁面後的圖片燈箱放大檢視模組。
- 修正：優化圖檔封裝演算法，解除 Windows Defender 安全阻擋異常判定。
- 修正：PDF 記憶體 ArrayBuffer detach 引發無法輸出檔案之系統錯亂漏洞。

## 授權
© 2026 奕鈞老師版權所有。
