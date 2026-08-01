// Global state
let sourceFilesBytes = []; // array of ArrayBuffer
let pagesData = [];
let sortableInstance = null;

// DOM Elements
const fileInput = document.getElementById('file-input');
const uploadBox = document.getElementById('upload-box');
const uploadArea = document.getElementById('upload-area');
const pagesGrid = document.getElementById('pages-grid');
const mainActions = document.getElementById('main-actions');
const loadingOverlay = document.getElementById('loading');
const loadingText = document.getElementById('loading-text');

// Modal Elements
const previewModal = document.getElementById('preview-modal');
const modalImg = document.getElementById('modal-img');
const closeModal = document.querySelector('.close-modal');

if (closeModal) {
    closeModal.onclick = () => previewModal.style.display = 'none';
}
if (previewModal) {
    previewModal.onclick = (e) => {
        if (e.target === previewModal) previewModal.style.display = 'none';
    };
}

// 隱藏所有卡片選單
document.addEventListener('click', () => {
    document.querySelectorAll('.card-menu-dropdown').forEach(d => d.classList.remove('show'));
});

// Advanced Panel
const advancedToggle = document.getElementById('advanced-panel-toggle');
const advancedContent = document.getElementById('advanced-panel-content');
const advancedIcon = document.getElementById('advanced-panel-icon');
if (advancedToggle) {
    advancedToggle.addEventListener('click', () => {
        advancedContent.classList.toggle('expanded');
        if (advancedContent.classList.contains('expanded')) {
            advancedIcon.classList.replace('ph-caret-down', 'ph-caret-up');
        } else {
            advancedIcon.classList.replace('ph-caret-up', 'ph-caret-down');
        }
    });
}

// Thumbnail Slider
const thumbnailSlider = document.getElementById('thumbnail-size-slider');
if (thumbnailSlider) {
    thumbnailSlider.addEventListener('input', (e) => {
        const size = e.target.value + 'px';
        document.querySelectorAll('.page-card:not(.add-page-card)').forEach(card => {
            card.style.minWidth = size;
        });
        pagesGrid.style.gridTemplateColumns = `repeat(auto-fill, minmax(${size}, 1fr))`;
    });
}

function openPreviewModal(imgSrc, rotation) {
    if (!previewModal) return;
    previewModal.style.display = 'flex';
    modalImg.src = imgSrc;
    modalImg.style.transform = `rotate(${rotation}deg)`;
}

// Init SortableJS
function initSortable() {
    if (sortableInstance) sortableInstance.destroy();
    sortableInstance = new Sortable(pagesGrid, {
        animation: 150,
        ghostClass: 'sortable-ghost',
        onEnd: updateSortOrder,
    });
}

function updateSortOrder() {
    // We don't strictly need to update state array immediately because we can read DOM order when downloading
}

// Handle Drag and Drop
['dragenter', 'dragover', 'dragleave', 'drop'].forEach(eventName => {
    uploadBox.addEventListener(eventName, preventDefaults, false);
});

function preventDefaults(e) {
    e.preventDefault();
    e.stopPropagation();
}

['dragenter', 'dragover'].forEach(eventName => {
    uploadBox.addEventListener(eventName, () => uploadBox.classList.add('dragover'), false);
});

['dragleave', 'drop'].forEach(eventName => {
    uploadBox.addEventListener(eventName, () => uploadBox.classList.remove('dragover'), false);
});

uploadBox.addEventListener('drop', (e) => {
    let dt = e.dataTransfer;
    let files = dt.files;
    if(files.length > 0) {
        handleFile(files[0]);
    }
});

fileInput.addEventListener('change', (e) => {
    if(e.target.files.length > 0) {
        handleFile(e.target.files[0]);
    }
});

document.getElementById('merge-file-input').addEventListener('change', (e) => {
    if(e.target.files.length > 0) {
        handleFile(e.target.files[0], true);
    }
});

async function handleFile(file, isMerge = false) {
    if (file.type !== 'application/pdf') {
        alert('請上傳 PDF 檔案！');
        return;
    }

    showLoading(isMerge ? '正在讀取要合併的 PDF 檔案...' : '正在讀取 PDF 檔案...');
    try {
        const arrayBuffer = await file.arrayBuffer();
        
        if (!isMerge) {
            sourceFilesBytes = [];
            pagesData = [];
            pagesGrid.innerHTML = '';
        }
        
        const sourceDocIndex = sourceFilesBytes.length;
        // 複製一份 ArrayBuffer 存起來，因為 PDF.js 讀取時可能會 "detach" (轉移) 原始的 ArrayBuffer
        sourceFilesBytes.push(arrayBuffer.slice(0));
        
        // Load with PDF.js for rendering
        const loadingTask = pdfjsLib.getDocument({data: arrayBuffer});
        const currentPdfDoc = await loadingTask.promise;
        
        const numPages = currentPdfDoc.numPages;
        
        showLoading(`正在渲染頁面 (0/${numPages})...`);

        for (let i = 1; i <= numPages; i++) {
            const page = await currentPdfDoc.getPage(i);
            const viewport = page.getViewport({ scale: 1.5 }); // Scale 1.5 for better resolution
            
            const canvas = document.createElement('canvas');
            const ctx = canvas.getContext('2d');
            canvas.height = viewport.height;
            canvas.width = viewport.width;
            
            const renderContext = {
                canvasContext: ctx,
                viewport: viewport
            };
            
            await page.render(renderContext).promise;
            const imgData = canvas.toDataURL('image/png');
            
            const pageObj = {
                id: `doc${sourceDocIndex}-page${i}`,
                sourceDocIndex: sourceDocIndex,
                originalIndex: i, // 1-based
                rotation: 0,
                imgData: imgData,
                selected: true,
                canvasWidth: canvas.width,
                canvasHeight: canvas.height
            };
            
            pagesData.push(pageObj);
            createPageCard(pageObj);
            
            showLoading(`正在渲染頁面 (${i}/${numPages})...`);
        }
        
        // Hide upload area, show tools
        uploadArea.style.display = 'none';
        mainActions.style.display = 'flex';
        document.getElementById('advanced-panel').style.display = 'block';
        document.getElementById('instruction-bar').style.display = 'block';
        
        updateAddPageCard();
        initSortable();
        hideLoading();
        if(isMerge) document.getElementById('merge-file-input').value = ""; // reset input
    } catch (error) {
        console.error(error);
        alert('讀取檔案失敗，請確保這是一個有效的 PDF 檔案。');
        hideLoading();
        if(isMerge) document.getElementById('merge-file-input').value = "";
    }
}

function createPageCard(page) {
    const card = document.createElement('div');
    card.className = 'page-card selected'; // Default selected
    card.dataset.id = page.id;
    card.dataset.idx = page.originalIndex;
    
    // Checkbox
    const cbContainer = document.createElement('div');
    cbContainer.className = 'checkbox-container';
    
    const cb = document.createElement('input');
    cb.type = 'checkbox';
    cb.className = 'custom-checkbox';
    cb.id = `cb-${page.id}`;
    cb.checked = page.selected;
    cb.addEventListener('change', (e) => {
        page.selected = e.target.checked;
        if(page.selected) card.classList.add('selected');
        else card.classList.remove('selected');
    });
    
    const label = document.createElement('label');
    label.className = 'checkbox-label';
    label.setAttribute('for', `cb-${page.id}`);
    
    cbContainer.appendChild(cb);
    cbContainer.appendChild(label);
    
    // Preview
    const preview = document.createElement('div');
    preview.className = 'page-preview';
    
    const img = document.createElement('img');
    img.src = page.imgData;
    img.id = `img-${page.id}`;
    img.style.maxWidth = '100%';
    img.style.maxHeight = '100%';
    img.style.objectFit = 'contain';
    img.style.transition = 'transform 0.3s';
    
    preview.appendChild(img);
    
    // Info Action
    const info = document.createElement('div');
    info.className = 'page-info';
    
    const pageNum = document.createElement('div');
    pageNum.className = 'page-number';
    pageNum.innerHTML = `<i class="ph ph-file-text"></i> 第 ${page.originalIndex} 頁`;
    
    const actions = document.createElement('div');
    actions.className = 'page-actions';
    
    const rotBtn = document.createElement('button');
    rotBtn.className = 'btn btn-icon';
    rotBtn.title = "旋轉";
    rotBtn.innerHTML = '<i class="ph ph-arrows-clockwise"></i>';
    rotBtn.onclick = (e) => {
        e.preventDefault();
        e.stopPropagation();
        page.rotation = (page.rotation + 90) % 360;
        img.style.transform = `rotate(${page.rotation}deg)`;
    };
    
    const zoomBtn = document.createElement('button');
    zoomBtn.className = 'btn btn-icon';
    zoomBtn.title = "放大檢視";
    zoomBtn.innerHTML = '<i class="ph ph-magnifying-glass-plus"></i>';
    zoomBtn.onclick = (e) => {
        e.preventDefault();
        e.stopPropagation();
        if (typeof openPreviewModal === 'function') {
            openPreviewModal(page.imgData, page.rotation);
        }
    };

    actions.appendChild(zoomBtn);
    actions.appendChild(rotBtn);
    
    info.appendChild(pageNum);
    info.appendChild(actions);
    
    // Card Menu
    const menuBtn = document.createElement('div');
    menuBtn.className = 'card-menu-btn';
    menuBtn.innerHTML = '<i class="ph ph-dots-three-vertical"></i>';
    
    const dropdown = document.createElement('div');
    dropdown.className = 'card-menu-dropdown';
    
    const itemAdd = document.createElement('div');
    itemAdd.className = 'card-menu-item';
    itemAdd.innerHTML = '<i class="ph ph-plus-circle"></i> 加入 PDF 檔案';
    itemAdd.onclick = (e) => {
        e.stopPropagation();
        document.getElementById('merge-file-input').click();
        dropdown.classList.remove('show');
    };
    
    const itemMove = document.createElement('div');
    itemMove.className = 'card-menu-item';
    itemMove.innerHTML = '<i class="ph ph-arrows-left-right"></i> 移到第 _ 頁之後';
    itemMove.onclick = (e) => {
        e.stopPropagation();
        dropdown.classList.remove('show');
        moveSelectedAfterTarget(page);
    };
    
    dropdown.appendChild(itemAdd);
    dropdown.appendChild(itemMove);
    
    menuBtn.onclick = (e) => {
        e.stopPropagation();
        document.querySelectorAll('.card-menu-dropdown').forEach(d => {
            if(d !== dropdown) d.classList.remove('show');
        });
        dropdown.classList.toggle('show');
    };
    
    card.appendChild(cbContainer);
    card.appendChild(preview);
    card.appendChild(info);
    card.appendChild(menuBtn);
    card.appendChild(dropdown);
    
    // Toggle on card click
    card.addEventListener('click', (e) => {
        // Prevent toggling if clicked on specific buttons
        if (e.target.closest('.btn') || e.target.closest('.checkbox-label') || e.target.closest('.custom-checkbox')) return;
        cb.checked = !cb.checked;
        // manually dispatch change
        cb.dispatchEvent(new Event('change'));
    });
    
    pagesGrid.appendChild(card);
}

function updateAddPageCard() {
    let addCard = document.getElementById('add-page-card');
    if (addCard) addCard.remove();
    
    if (pagesData.length === 0) return;
    
    addCard = document.createElement('div');
    addCard.id = 'add-page-card';
    addCard.className = 'add-page-card';
    addCard.innerHTML = '<i class="ph ph-plus"></i>';
    addCard.onclick = () => {
        document.getElementById('merge-file-input').click();
    };
    pagesGrid.appendChild(addCard);
}

function moveSelectedAfterTarget(targetPage) {
    const selectedPages = getSelectedPagesOrdered();
    if (selectedPages.length === 0) {
        document.getElementById(`cb-${targetPage.id}`).checked = true;
        document.getElementById(`cb-${targetPage.id}`).dispatchEvent(new Event('change'));
        selectedPages.push(targetPage);
    }
    
    const targetIdx = prompt(`您選取了 ${selectedPages.length} 頁。\n請輸入要將它們移動到哪一頁之後 (1 - ${pagesData.length}):\n(輸入 0 則移到最前面)`);
    if (targetIdx === null) return;
    
    let destIndex = parseInt(targetIdx);
    if (isNaN(destIndex) || destIndex < 0 || destIndex > pagesData.length) {
        alert('無效的頁碼');
        return;
    }
    
    const cards = Array.from(pagesGrid.querySelectorAll('.page-card:not(.add-page-card)'));
    let insertBeforeNode = null;
    if (destIndex === 0) {
        insertBeforeNode = cards[0];
    } else if (destIndex < cards.length) {
        insertBeforeNode = cards[destIndex];
    } else {
        insertBeforeNode = document.getElementById('add-page-card');
    }
    
    selectedPages.forEach(pg => {
        const cardNode = document.querySelector(`.page-card[data-id="${pg.id}"]`);
        if (cardNode) pagesGrid.insertBefore(cardNode, insertBeforeNode);
    });
}

// UI Helpers
function showLoading(text) {
    loadingText.innerText = text;
    loadingOverlay.style.display = 'flex';
}

function hideLoading() {
    loadingOverlay.style.display = 'none';
}

// Action Buttons
document.getElementById('select-all-btn').addEventListener('click', () => {
    document.querySelectorAll('.custom-checkbox').forEach(cb => {
        if (!cb.checked) {
            cb.checked = true;
            cb.dispatchEvent(new Event('change'));
        }
    });
});

document.getElementById('deselect-all-btn').addEventListener('click', () => {
    document.querySelectorAll('.custom-checkbox').forEach(cb => {
        if (cb.checked) {
            cb.checked = false;
            cb.dispatchEvent(new Event('change'));
        }
    });
});

// Home Button
document.getElementById('home-btn').addEventListener('click', () => {
    sourceFilesBytes = [];
    pagesData = [];
    pagesGrid.innerHTML = '';
    uploadArea.style.display = 'flex';
    mainActions.style.display = 'none';
    document.getElementById('instruction-bar').style.display = 'none';
    fileInput.value = "";
    if (sortableInstance) sortableInstance.destroy();
    sortableInstance = null;
});

// Rotate Selected Button
document.getElementById('rotate-selected-btn').addEventListener('click', () => {
    const selectedPages = getSelectedPagesOrdered();
    if (selectedPages.length === 0) {
        alert('請先勾選要旋轉的頁面！');
        return;
    }
    selectedPages.forEach(pg => {
        pg.rotation = (pg.rotation + 90) % 360;
        const img = document.getElementById(`img-${pg.id}`);
        if(img) img.style.transform = `rotate(${pg.rotation}deg)`;
    });
});

// Download PDF
document.getElementById('download-pdf-btn').addEventListener('click', async () => {
    const selectedPages = getSelectedPagesOrdered();
    if (selectedPages.length === 0) {
        alert('請至少選擇一頁！');
        return;
    }
    
    showLoading('正在產生 PDF，請稍候...');
    try {
        const { PDFDocument, degrees } = PDFLib;
        const newPdf = await PDFDocument.create();
        
        const loadedSourceDocs = [];
        for (let bytes of sourceFilesBytes) {
            loadedSourceDocs.push(await PDFDocument.load(bytes));
        }
        
        for (const pg of selectedPages) {
            const srcPdf = loadedSourceDocs[pg.sourceDocIndex];
            // originalIndex is 1-based, PDFLib is 0-based
            const [copiedPage] = await newPdf.copyPages(srcPdf, [pg.originalIndex - 1]);
            
            // Add user rotation
            if (pg.rotation !== 0) {
                const currentRot = copiedPage.getRotation().angle;
                copiedPage.setRotation(degrees(currentRot + pg.rotation));
            }
            
            newPdf.addPage(copiedPage);
        }
        
        const pdfBytes = await newPdf.save();
        const blob = new Blob([pdfBytes], { type: 'application/pdf' });
        const fileName = getGeneratedFileName(selectedPages, 'pdf');
        saveAs(blob, fileName);
    } catch (error) {
        console.error(error);
        alert('產生 PDF 時發生錯誤。');
    } finally {
        hideLoading();
    }
});

// Download Compressed PDF
document.getElementById('download-compressed-btn').addEventListener('click', async () => {
    const selectedPages = getSelectedPagesOrdered();
    if (selectedPages.length === 0) {
        alert('請至少選擇一頁！');
        return;
    }

    const scaleInput = prompt("請輸入「解析度倍率」(建議 2.0 ~ 4.0)，預設為 3.0。\n數值越高字體越清晰，但處理時間較久且檔案較大：", "3.0");
    if (scaleInput === null) return;
    let renderScale = parseFloat(scaleInput);
    if (isNaN(renderScale) || renderScale < 1.0 || renderScale > 5.0) {
        alert('輸入格式錯誤或超出範圍，將使用預設值 3.0');
        renderScale = 3.0;
    }

    const qualityInput = prompt("請輸入「圖片壓縮品質」(0.1 ~ 1.0)，預設為 0.8。\n數值越高越清晰但檔案較大：", "0.8");
    if (qualityInput === null) return; // 使用者取消
    let quality = parseFloat(qualityInput);
    if (isNaN(quality) || quality < 0.1 || quality > 1.0) {
        alert('輸入格式錯誤或超出範圍，將使用預設值 0.8');
        quality = 0.8;
    }
    
    if (!confirm("確定要執行並下載壓縮版 PDF 嗎？")) return;
    
    // 專屬助手: 改為即時重新用高解析度渲染，不再依賴預覽用的低解析度圖片。
    showLoading(`準備以 ${renderScale} 倍解析度處理，請稍候...`);
    try {
        const { PDFDocument } = PDFLib;
        const newPdf = await PDFDocument.create();
        
        // 載入所有原始 PDF 以便重新渲染高畫質
        const loadedPdfJsDocs = [];
        for (let bytes of sourceFilesBytes) {
            const loadingTask = pdfjsLib.getDocument({data: bytes.slice(0)});
            loadedPdfJsDocs.push(await loadingTask.promise);
        }
        
        for (let i = 0; i < selectedPages.length; i++) {
            const pg = selectedPages[i];
            showLoading(`正在高畫質渲染並壓縮第 ${i + 1}/${selectedPages.length} 頁...`);
            
            const pdfDoc = loadedPdfJsDocs[pg.sourceDocIndex];
            const page = await pdfDoc.getPage(pg.originalIndex);
            const viewport = page.getViewport({ scale: renderScale });
            
            const canvas = document.createElement('canvas');
            const ctx = canvas.getContext('2d');
            canvas.width = viewport.width;
            canvas.height = viewport.height;
            
            await page.render({ canvasContext: ctx, viewport: viewport }).promise;
            
            // 處理使用者旋轉與背景色
            const finalCanvas = document.createElement('canvas');
            const finalCtx = finalCanvas.getContext('2d');
            
            if (pg.rotation === 90 || pg.rotation === 270) {
                finalCanvas.width = canvas.height;
                finalCanvas.height = canvas.width;
            } else {
                finalCanvas.width = canvas.width;
                finalCanvas.height = canvas.height;
            }
            
            finalCtx.fillStyle = '#FFFFFF';
            finalCtx.fillRect(0, 0, finalCanvas.width, finalCanvas.height);
            
            finalCtx.translate(finalCanvas.width/2, finalCanvas.height/2);
            finalCtx.rotate(pg.rotation * Math.PI / 180);
            finalCtx.drawImage(canvas, -canvas.width/2, -canvas.height/2);
            
            // 根據使用者輸入的品質轉為 JPEG
            const jpegDataUrl = finalCanvas.toDataURL('image/jpeg', quality);
            const jpgImage = await newPdf.embedJpg(jpegDataUrl);
            const newPage = newPdf.addPage([finalCanvas.width, finalCanvas.height]);
            newPage.drawImage(jpgImage, {
                x: 0,
                y: 0,
                width: finalCanvas.width,
                height: finalCanvas.height,
            });
        }
        
        showLoading('正在儲存 PDF 檔案...');
        const pdfBytes = await newPdf.save();
        const blob = new Blob([pdfBytes], { type: 'application/pdf' });
        const fileName = getGeneratedFileName(selectedPages, 'pdf').replace('.pdf', `_壓縮版(s${renderScale}_q${quality}).pdf`);
        saveAs(blob, fileName);
    } catch (error) {
        console.error(error);
        alert('產生壓縮 PDF 時發生錯誤。');
    } finally {
        hideLoading();
    }
});

// Download Images (ZIP)
document.getElementById('download-images-btn').addEventListener('click', async () => {
    const selectedPages = getSelectedPagesOrdered();
    if (selectedPages.length === 0) {
        alert('請至少選擇一頁！');
        return;
    }
    
    if (selectedPages.length === 1) {
        showLoading('正在準備單張圖片...');
        try {
            const pg = selectedPages[0];
            let finalDataUrl = pg.imgData;
            
            if (pg.rotation !== 0) {
                const img = new Image();
                img.src = pg.imgData;
                await new Promise(resolve => img.onload = resolve);
                const canvas = document.createElement('canvas');
                const ctx = canvas.getContext('2d');
                if (pg.rotation === 90 || pg.rotation === 270) {
                    canvas.width = pg.canvasHeight;
                    canvas.height = pg.canvasWidth;
                } else {
                    canvas.width = pg.canvasWidth;
                    canvas.height = pg.canvasHeight;
                }
                ctx.translate(canvas.width/2, canvas.height/2);
                ctx.rotate(pg.rotation * Math.PI / 180);
                ctx.drawImage(img, -pg.canvasWidth/2, -pg.canvasHeight/2);
                finalDataUrl = canvas.toDataURL('image/png');
            }
            
            const base64Response = await fetch(finalDataUrl);
            const blob = await base64Response.blob();
            const fileName = getGeneratedFileName(selectedPages, 'png');
            saveAs(blob, fileName);
        } catch (error) {
            console.error(error);
            alert('下載圖片時發生錯誤。');
        } finally {
            hideLoading();
        }
        return;
    }
    
    showLoading('正在封裝圖片ZIP，請稍候...');
    try {
        const zip = new JSZip();
        
        for (let i = 0; i < selectedPages.length; i++) {
            const pg = selectedPages[i];
            
            // Because page might be rotated, we need to draw it rotated to a canvas to get the final image data.
            let finalDataUrl = pg.imgData;
            
            if (pg.rotation !== 0) {
                const img = new Image();
                img.src = pg.imgData;
                await new Promise(resolve => img.onload = resolve);
                
                const canvas = document.createElement('canvas');
                const ctx = canvas.getContext('2d');
                
                if (pg.rotation === 90 || pg.rotation === 270) {
                    canvas.width = pg.canvasHeight;
                    canvas.height = pg.canvasWidth;
                } else {
                    canvas.width = pg.canvasWidth;
                    canvas.height = pg.canvasHeight;
                }
                
                ctx.translate(canvas.width/2, canvas.height/2);
                ctx.rotate(pg.rotation * Math.PI / 180);
                ctx.drawImage(img, -pg.canvasWidth/2, -pg.canvasHeight/2);
                
                finalDataUrl = canvas.toDataURL('image/png');
            }
            
            // 改轉換為 ArrayBuffer 並加上 {binary: true} 確保 jsZip 以最原生的二進位去封裝圖片
            const response = await fetch(finalDataUrl);
            const buffer = await response.arrayBuffer();
            const pnum = String(pg.originalIndex).padStart(3, '0');
            zip.file(`P${pnum}.png`, buffer, { binary: true });
        }
        
        const content = await zip.generateAsync({type:"blob"});
        const fileName = getGeneratedFileName(selectedPages, 'zip');
        saveAs(content, fileName);
        
    } catch (error) {
        console.error(error);
        alert('封裝圖片時發生錯誤。');
    } finally {
        hideLoading();
    }
});

function getSelectedPagesOrdered() {
    const cards = Array.from(pagesGrid.querySelectorAll('.page-card'));
    const ordered = [];
    
    cards.forEach(card => {
        const id = card.dataset.id;
        const pageObj = pagesData.find(p => p.id === id);
        if (pageObj && pageObj.selected) {
            ordered.push(pageObj);
        }
    });
    
    return ordered;
}

function getGeneratedFileName(selectedPages, ext) {
    if (!selectedPages || selectedPages.length === 0) return `P001.${ext}`;
    if (selectedPages.length === 1) {
        const p = String(selectedPages[0].originalIndex).padStart(3, '0');
        return `P${p}.${ext}`;
    }
    const minP = Math.min(...selectedPages.map(p => p.originalIndex));
    const maxP = Math.max(...selectedPages.map(p => p.originalIndex));
    const firstP = String(minP).padStart(3, '0');
    const lastP = String(maxP).padStart(3, '0');
    return `P${firstP}-${lastP}.${ext}`;
}

// =======================
// 進階功能 (Advanced)
// =======================

// 加入浮水印
document.getElementById('watermark-btn').addEventListener('click', async () => {
    const selectedPages = getSelectedPagesOrdered();
    if (selectedPages.length === 0) { alert('請至少選擇一頁！'); return; }
    
    const text = prompt("請輸入浮水印文字：", "機密文件");
    if (!text) return;
    
    const sizeInput = prompt("請輸入文字大小 (預設 80)：", "80");
    if (sizeInput === null) return;
    const fontSize = parseInt(sizeInput) || 80;
    
    const posInput = prompt("請輸入位置代碼 (1:置中 2:左上 3:左下 4:右上 5:右下)：\n預設為 1", "1");
    if (posInput === null) return;
    const pos = parseInt(posInput) || 1;
    
    if (!confirm("確定要執行並下載浮水印 PDF 嗎？")) return;
    
    showLoading('正在產生浮水印 PDF，請稍候...');
    try {
        const { PDFDocument, degrees } = PDFLib;
        const newPdf = await PDFDocument.create();
        
        const loadedSourceDocs = [];
        for (let bytes of sourceFilesBytes) loadedSourceDocs.push(await PDFDocument.load(bytes));

        const wmCanvas = document.createElement('canvas');
        const wmCtx = wmCanvas.getContext('2d');
        wmCanvas.width = Math.max(fontSize * text.length + 100, 800);
        wmCanvas.height = Math.max(fontSize * 2 + 100, 800);
        wmCtx.translate(wmCanvas.width/2, wmCanvas.height/2);
        wmCtx.rotate(-Math.PI / 4);
        wmCtx.fillStyle = "rgba(150, 150, 150, 0.4)";
        wmCtx.font = `bold ${fontSize}px sans-serif`;
        wmCtx.textAlign = "center";
        wmCtx.textBaseline = "middle";
        wmCtx.fillText(text, 0, 0);
        const wmImg = await newPdf.embedPng(wmCanvas.toDataURL('image/png'));

        for (const pg of selectedPages) {
            const srcPdf = loadedSourceDocs[pg.sourceDocIndex];
            const [copiedPage] = await newPdf.copyPages(srcPdf, [pg.originalIndex - 1]);
            
            if (pg.rotation !== 0) {
                const currentRot = copiedPage.getRotation().angle;
                copiedPage.setRotation(degrees(currentRot + pg.rotation));
            }
            
            const { width, height } = copiedPage.getSize();
            let drawX, drawY;
            if (pos === 2) { drawX = 10; drawY = height - wmCanvas.height - 10; }
            else if (pos === 3) { drawX = 10; drawY = 10; }
            else if (pos === 4) { drawX = width - wmCanvas.width - 10; drawY = height - wmCanvas.height - 10; }
            else if (pos === 5) { drawX = width - wmCanvas.width - 10; drawY = 10; }
            else { drawX = width/2 - wmCanvas.width/2; drawY = height/2 - wmCanvas.height/2; }
            
            copiedPage.drawImage(wmImg, {
                x: drawX,
                y: drawY,
                width: wmCanvas.width,
                height: wmCanvas.height
            });
            newPdf.addPage(copiedPage);
        }
        
        const pdfBytes = await newPdf.save();
        saveAs(new Blob([pdfBytes], { type: 'application/pdf' }), getGeneratedFileName(selectedPages, 'pdf').replace('.pdf', '_浮水印.pdf'));
    } catch(e) { console.error(e); alert('錯誤'); }
    hideLoading();
});

// 加入頁碼
document.getElementById('page-num-btn').addEventListener('click', async () => {
    const selectedPages = getSelectedPagesOrdered();
    if (selectedPages.length === 0) { alert('請至少選擇一頁！'); return; }
    
    const sizeInput = prompt("請輸入頁碼文字大小 (預設 24)：", "24");
    if (sizeInput === null) return;
    const fontSize = parseInt(sizeInput) || 24;
    
    const posInput = prompt("請輸入頁碼位置 (1:右下 2:左下 3:正下方 4:右上)：\n預設為 1", "1");
    if (posInput === null) return;
    const pos = parseInt(posInput) || 1;
    
    if (!confirm("確定要執行並下載加頁碼 PDF 嗎？")) return;
    
    showLoading('正在產生頁碼，請稍候...');
    try {
        const { PDFDocument, degrees } = PDFLib;
        const newPdf = await PDFDocument.create();
        const loadedSourceDocs = [];
        for (let bytes of sourceFilesBytes) loadedSourceDocs.push(await PDFDocument.load(bytes));

        for (let i = 0; i < selectedPages.length; i++) {
            const pg = selectedPages[i];
            const srcPdf = loadedSourceDocs[pg.sourceDocIndex];
            const [copiedPage] = await newPdf.copyPages(srcPdf, [pg.originalIndex - 1]);
            
            if (pg.rotation !== 0) copiedPage.setRotation(degrees(copiedPage.getRotation().angle + pg.rotation));
            
            const numCanvas = document.createElement('canvas');
            const numCtx = numCanvas.getContext('2d');
            numCtx.font = `bold ${fontSize}px sans-serif`;
            const textStr = `第 ${i+1} 頁 / 共 ${selectedPages.length} 頁`;
            const metrics = numCtx.measureText(textStr);
            numCanvas.width = Math.max(metrics.width + 20, 100);
            numCanvas.height = fontSize + 20;
            
            const ctx2 = numCanvas.getContext('2d');
            ctx2.fillStyle = "#000000";
            ctx2.font = `bold ${fontSize}px sans-serif`;
            ctx2.textAlign = "left";
            ctx2.textBaseline = "top";
            ctx2.fillText(textStr, 10, 10);
            
            const numImg = await newPdf.embedPng(numCanvas.toDataURL('image/png'));
            const { width, height } = copiedPage.getSize();
            
            let drawX, drawY;
            if (pos === 2) { drawX = 20; drawY = 20; }
            else if (pos === 3) { drawX = width/2 - numCanvas.width/2; drawY = 20; }
            else if (pos === 4) { drawX = width - numCanvas.width - 20; drawY = height - numCanvas.height - 20; }
            else { drawX = width - numCanvas.width - 20; drawY = 20; }
            
            copiedPage.drawImage(numImg, {
                x: drawX,
                y: drawY,
                width: numCanvas.width,
                height: numCanvas.height
            });
            newPdf.addPage(copiedPage);
        }
        
        const pdfBytes = await newPdf.save();
        saveAs(new Blob([pdfBytes], { type: 'application/pdf' }), getGeneratedFileName(selectedPages, 'pdf').replace('.pdf', '_加頁碼.pdf'));
    } catch(e) { console.error(e); alert('錯誤'); }
    hideLoading();
});

// 單頁拆分打包
document.getElementById('split-pdf-btn').addEventListener('click', async () => {
    const selectedPages = getSelectedPagesOrdered();
    if (selectedPages.length === 0) { alert('請至少選擇一頁！'); return; }
    
    if (!confirm("確定要將選取的頁面拆分並打包下載嗎？")) return;
    
    showLoading('正在拆分 PDF，請稍候...');
    try {
        const { PDFDocument, degrees } = PDFLib;
        const loadedSourceDocs = [];
        for (let bytes of sourceFilesBytes) loadedSourceDocs.push(await PDFDocument.load(bytes));
        
        const zip = new JSZip();
        
        for (let i = 0; i < selectedPages.length; i++) {
            const pg = selectedPages[i];
            const newPdf = await PDFDocument.create();
            const srcPdf = loadedSourceDocs[pg.sourceDocIndex];
            const [copiedPage] = await newPdf.copyPages(srcPdf, [pg.originalIndex - 1]);
            if (pg.rotation !== 0) copiedPage.setRotation(degrees(copiedPage.getRotation().angle + pg.rotation));
            newPdf.addPage(copiedPage);
            
            const pdfBytes = await newPdf.save();
            const pnum = String(i + 1).padStart(3, '0');
            zip.file(`P${pnum}.pdf`, pdfBytes);
        }
        
        const content = await zip.generateAsync({type:"blob"});
        saveAs(content, getGeneratedFileName(selectedPages, 'zip').replace('.zip', '_拆分.zip'));
    } catch(e) { console.error(e); alert('錯誤'); }
    hideLoading();
});

// 灰階黑白轉換
document.getElementById('grayscale-pdf-btn').addEventListener('click', async () => {
    const selectedPages = getSelectedPagesOrdered();
    if (selectedPages.length === 0) { alert('請至少選擇一頁！'); return; }

    const scaleInput = prompt("請輸入「解析度倍率」(建議 2.0 ~ 4.0)，預設為 3.0：", "3.0");
    if (scaleInput === null) return;
    let renderScale = parseFloat(scaleInput) || 3.0;

    if (!confirm("確定要執行並下載灰階版 PDF 嗎？")) return;

    showLoading('正在產生灰階 PDF，請稍候...');
    try {
        const { PDFDocument } = PDFLib;
        const newPdf = await PDFDocument.create();
        
        const loadedPdfJsDocs = [];
        for (let bytes of sourceFilesBytes) loadedPdfJsDocs.push(await pdfjsLib.getDocument({data: bytes.slice(0)}).promise);
        
        for (let i = 0; i < selectedPages.length; i++) {
            const pg = selectedPages[i];
            showLoading(`正在高畫質渲染並轉換灰階 第 ${i + 1}/${selectedPages.length} 頁...`);
            
            const pdfDoc = loadedPdfJsDocs[pg.sourceDocIndex];
            const page = await pdfDoc.getPage(pg.originalIndex);
            const viewport = page.getViewport({ scale: renderScale });
            
            const canvas = document.createElement('canvas');
            const ctx = canvas.getContext('2d');
            canvas.width = viewport.width;
            canvas.height = viewport.height;
            await page.render({ canvasContext: ctx, viewport: viewport }).promise;
            
            const finalCanvas = document.createElement('canvas');
            const finalCtx = finalCanvas.getContext('2d');
            
            if (pg.rotation === 90 || pg.rotation === 270) {
                finalCanvas.width = canvas.height;
                finalCanvas.height = canvas.width;
            } else {
                finalCanvas.width = canvas.width;
                finalCanvas.height = canvas.height;
            }
            
            finalCtx.fillStyle = '#FFFFFF';
            finalCtx.fillRect(0, 0, finalCanvas.width, finalCanvas.height);
            
            finalCtx.filter = 'grayscale(100%)';
            finalCtx.translate(finalCanvas.width/2, finalCanvas.height/2);
            finalCtx.rotate(pg.rotation * Math.PI / 180);
            finalCtx.drawImage(canvas, -canvas.width/2, -canvas.height/2);
            
            const jpegDataUrl = finalCanvas.toDataURL('image/jpeg', 0.8);
            const jpgImage = await newPdf.embedJpg(jpegDataUrl);
            const newPage = newPdf.addPage([finalCanvas.width, finalCanvas.height]);
            newPage.drawImage(jpgImage, { x: 0, y: 0, width: finalCanvas.width, height: finalCanvas.height });
        }
        
        const pdfBytes = await newPdf.save();
        saveAs(new Blob([pdfBytes], { type: 'application/pdf' }), getGeneratedFileName(selectedPages, 'pdf').replace('.pdf', '_灰階.pdf'));
    } catch(e) { console.error(e); alert('錯誤'); }
    hideLoading();
});
