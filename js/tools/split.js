// Split PDF Tool
ToolRouter.register('split', {
    title: 'Split PDF',
    description: 'Separate one page or a whole set for easy conversion into independent PDF files.',
    pdfBytes: null,

    init() {
        this.pdfBytes = null;
        this.render();
    },

    render() {
        const workspace = document.getElementById('toolWorkspace');
        workspace.innerHTML = `
            <div class="upload-area" id="uploadArea">
                <i class="fas fa-cloud-upload-alt"></i>
                <h3>Select a PDF file to split</h3>
                <p>or drag and drop a PDF file here</p>
                <button class="upload-btn">Select PDF file</button>
                <input type="file" id="fileInput" accept=".pdf" hidden>
            </div>
            <div id="splitOptions" style="display:none;">
                <div class="page-preview-container" id="pagePreview"></div>
                <div class="options-panel">
                    <h3>Split Options</h3>
                    <div class="option-group">
                        <label>Split mode:</label>
                        <div class="radio-group">
                            <label class="radio-option">
                                <input type="radio" name="splitMode" value="extract" checked> Extract selected pages into one PDF
                            </label>
                            <label class="radio-option">
                                <input type="radio" name="splitMode" value="range"> Extract by ranges (each range = separate file)
                            </label>
                            <label class="radio-option">
                                <input type="radio" name="splitMode" value="every"> Every N pages (each group = separate file)
                            </label>
                        </div>
                    </div>
                    <div class="option-group" id="rangeGroup" style="display:none;">
                        <label>Page ranges (e.g., 1-3, 5, 7-10):</label>
                        <input type="text" id="pageRanges" placeholder="1-3, 5, 7-10">
                        <small style="color:var(--text-light);">Each range becomes a separate PDF file</small>
                    </div>
                    <div class="option-group" id="everyNGroup" style="display:none;">
                        <label>Split every N pages:</label>
                        <input type="number" id="everyN" value="1" min="1">
                        <small style="color:var(--text-light);">Each group becomes a separate PDF file</small>
                    </div>
                </div>
                <div class="action-section">
                    <button class="process-btn" id="splitBtn">
                        <i class="fas fa-cut"></i> Split PDF
                    </button>
                </div>
            </div>
        `;

        this.bindEvents();
    },

    bindEvents() {
        const uploadArea = document.getElementById('uploadArea');
        const fileInput = document.getElementById('fileInput');
        const self = this;

        uploadArea.onclick = () => fileInput.click();

        uploadArea.ondragover = (e) => { e.preventDefault(); uploadArea.classList.add('dragover'); };
        uploadArea.ondragleave = () => uploadArea.classList.remove('dragover');
        uploadArea.ondrop = (e) => {
            e.preventDefault();
            uploadArea.classList.remove('dragover');
            if (e.dataTransfer.files.length > 0) {
                const file = e.dataTransfer.files[0];
                if (file.type === 'application/pdf') {
                    self.handleFile(file);
                } else {
                    showToast('Please select a PDF file', 'error');
                }
            }
        };

        fileInput.onchange = (e) => {
            if (e.target.files.length > 0) {
                self.handleFile(e.target.files[0]);
            }
        };

        document.querySelectorAll('input[name="splitMode"]').forEach(radio => {
            radio.onchange = (e) => {
                document.getElementById('rangeGroup').style.display = e.target.value === 'range' ? 'block' : 'none';
                document.getElementById('everyNGroup').style.display = e.target.value === 'every' ? 'block' : 'none';
            };
        });
    },

    async handleFile(file) {
        try {
            const buffer = await file.arrayBuffer();
            this.pdfBytes = new Uint8Array(buffer);

            document.getElementById('uploadArea').style.display = 'none';
            document.getElementById('splitOptions').style.display = 'block';

            // Get page count and render thumbnails
            const pdf = await pdfjsLib.getDocument({ data: this.pdfBytes.slice() }).promise;
            const pageCount = pdf.numPages;

            const preview = document.getElementById('pagePreview');
            preview.innerHTML = '<h3>Document Pages (' + pageCount + ' total)</h3><div class="pages-grid" id="pagesGrid"></div>';
            const grid = document.getElementById('pagesGrid');

            for (let i = 1; i <= pageCount; i++) {
                const thumb = document.createElement('div');
                thumb.className = 'page-thumb selected';
                const canvas = document.createElement('canvas');
                const page = await pdf.getPage(i);
                const viewport = page.getViewport({ scale: 0.5 });
                canvas.width = viewport.width;
                canvas.height = viewport.height;
                await page.render({ canvasContext: canvas.getContext('2d'), viewport }).promise;

                thumb.innerHTML = '<input type="checkbox" class="page-checkbox" checked data-page="' + i + '">';
                thumb.prepend(canvas);
                thumb.insertAdjacentHTML('beforeend', '<div class="page-number">Page ' + i + '</div>');

                const cb = thumb.querySelector('.page-checkbox');
                thumb.onclick = (e) => {
                    if (e.target.tagName !== 'INPUT') {
                        cb.checked = !cb.checked;
                        thumb.classList.toggle('selected', cb.checked);
                    }
                };
                cb.onchange = () => thumb.classList.toggle('selected', cb.checked);

                grid.appendChild(thumb);
            }

            document.getElementById('splitBtn').onclick = () => this.process();
        } catch (err) {
            showToast('Error loading PDF: ' + err.message, 'error');
        }
    },

    async process() {
        const btn = document.getElementById('splitBtn');
        btn.disabled = true;
        btn.innerHTML = '<span class="spinner"></span> Splitting...';

        try {
            const mode = document.querySelector('input[name="splitMode"]:checked').value;
            const srcPdf = await PDFLib.PDFDocument.load(this.pdfBytes);
            const totalPages = srcPdf.getPageCount();

            if (mode === 'extract') {
                const checked = [];
                document.querySelectorAll('.page-checkbox:checked').forEach(cb => {
                    checked.push(parseInt(cb.dataset.page) - 1);
                });

                if (checked.length === 0) {
                    showToast('Please select at least one page', 'error');
                    return;
                }

                const newPdf = await PDFLib.PDFDocument.create();
                const copiedPages = await newPdf.copyPages(srcPdf, checked);
                copiedPages.forEach(p => newPdf.addPage(p));
                const bytes = await newPdf.save();
                downloadBytes(bytes, 'extracted_pages.pdf');

            } else if (mode === 'range') {
                const ranges = document.getElementById('pageRanges').value.trim();
                if (!ranges) {
                    showToast('Please enter page ranges', 'error');
                    return;
                }

                const rangeParts = ranges.split(',').map(s => s.trim()).filter(s => s);

                for (let idx = 0; idx < rangeParts.length; idx++) {
                    const part = rangeParts[idx];
                    const pages = this.parseRange(part, totalPages);

                    if (pages.length === 0) {
                        showToast('Invalid range: ' + part, 'error');
                        return;
                    }

                    const newPdf = await PDFLib.PDFDocument.create();
                    const copiedPages = await newPdf.copyPages(srcPdf, pages);
                    copiedPages.forEach(p => newPdf.addPage(p));
                    const bytes = await newPdf.save();
                    downloadBytes(bytes, 'split_' + part.replace(/[^a-zA-Z0-9]/g, '_') + '.pdf');

                    if (idx < rangeParts.length - 1) {
                        await new Promise(r => setTimeout(r, 800));
                    }
                }

            } else if (mode === 'every') {
                const n = parseInt(document.getElementById('everyN').value) || 1;
                const totalFiles = Math.ceil(totalPages / n);

                for (let fileNum = 0; fileNum < totalFiles; fileNum++) {
                    const newPdf = await PDFLib.PDFDocument.create();
                    const startIdx = fileNum * n;
                    const endIdx = Math.min(startIdx + n, totalPages);
                    const indices = [];
                    for (let j = startIdx; j < endIdx; j++) indices.push(j);

                    const copiedPages = await newPdf.copyPages(srcPdf, indices);
                    copiedPages.forEach(p => newPdf.addPage(p));
                    const bytes = await newPdf.save();
                    downloadBytes(bytes, 'split_part_' + (fileNum + 1) + '_of_' + totalFiles + '.pdf');

                    if (fileNum < totalFiles - 1) {
                        await new Promise(r => setTimeout(r, 800));
                    }
                }
            }

            showToast('PDF split successfully!');
        } catch (error) {
            showToast('Error splitting PDF: ' + error.message, 'error');
        }

        btn.disabled = false;
        btn.innerHTML = '<i class="fas fa-cut"></i> Split PDF';
    },

    parseRange(str, max) {
        str = str.trim();
        const pages = [];
        if (str.includes('-')) {
            const parts = str.split('-');
            const start = parseInt(parts[0]);
            const end = parseInt(parts[1]);
            for (let i = start; i <= end && i <= max; i++) {
                if (i >= 1) pages.push(i - 1);
            }
        } else {
            const n = parseInt(str);
            if (n >= 1 && n <= max) pages.push(n - 1);
        }
        return [...new Set(pages)];
    }
});
