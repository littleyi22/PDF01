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
        document.getElementById('instruction-bar').style.display = 'block';
        
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
    
    card.appendChild(cbContainer);
    card.appendChild(preview);
    card.appendChild(info);
    
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
