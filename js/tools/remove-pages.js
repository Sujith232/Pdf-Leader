// Remove Pages Tool
ToolRouter.register('remove-pages', {
    title: 'Remove Pages',
    description: 'Remove unwanted pages from your PDF documents quickly and easily.',
    file: null,

    init() {
        this.file = null;
        this.render();
    },

    render() {
        const workspace = document.getElementById('toolWorkspace');
        workspace.innerHTML = `
            <div class="upload-area" id="uploadArea">
                <i class="fas fa-cloud-upload-alt"></i>
                <h3>Select a PDF to remove pages</h3>
                <p>or drag and drop a PDF file here</p>
                <button class="upload-btn">Select PDF file</button>
                <input type="file" id="fileInput" accept=".pdf" hidden>
            </div>
            <div id="removeOptions" style="display:none;">
                <div class="page-preview-container">
                    <h3>Click pages to select them for removal</h3>
                    <div class="pages-grid" id="pagesGrid"></div>
                </div>
                <div class="options-panel">
                    <h3>Quick Selection</h3>
                    <div class="option-group">
                        <label>Remove pages by range:</label>
                        <input type="text" id="removeRange" placeholder="e.g., 1-3, 5, 8-10">
                        <button class="btn btn-outline" id="selectRangeBtn" style="margin-top: 0.5rem;">Select Range</button>
                    </div>
                </div>
                <div class="action-section">
                    <button class="process-btn" id="removeBtn" style="background: #ef4444;">
                        <i class="fas fa-trash-alt"></i> Remove Selected Pages
                    </button>
                </div>
            </div>
        `;

        const uploadArea = document.getElementById('uploadArea');
        const fileInput = document.getElementById('fileInput');
        uploadArea.addEventListener('click', () => fileInput.click());
        uploadArea.addEventListener('dragover', (e) => { e.preventDefault(); uploadArea.classList.add('dragover'); });
        uploadArea.addEventListener('dragleave', () => uploadArea.classList.remove('dragover'));
        uploadArea.addEventListener('drop', (e) => {
            e.preventDefault();
            uploadArea.classList.remove('dragover');
            const file = e.dataTransfer.files[0];
            if (file && file.type === 'application/pdf') this.loadFile(file);
        });
        fileInput.addEventListener('change', (e) => { if (e.target.files[0]) this.loadFile(e.target.files[0]); });
    },

    async loadFile(file) {
        this.file = file;
        const arrayBuffer = await readFileAsArrayBuffer(file);
        this.pdfBytes = new Uint8Array(arrayBuffer);

        document.getElementById('uploadArea').style.display = 'none';
        document.getElementById('removeOptions').style.display = 'block';

        const pageCount = await PDFWorker.getPageCount(this.pdfBytes);
        const grid = document.getElementById('pagesGrid');
        grid.innerHTML = '';

        for (let i = 1; i <= pageCount; i++) {
            const thumb = document.createElement('div');
            thumb.className = 'page-thumb';
            thumb.dataset.page = i;
            const canvas = document.createElement('canvas');
            await PDFWorker.renderPageToCanvas(this.pdfBytes, i, canvas, 0.4);
            thumb.innerHTML = `<input type="checkbox" class="page-checkbox" data-page="${i}">`;
            thumb.prepend(canvas);
            thumb.insertAdjacentHTML('beforeend', `<div class="page-number">Page ${i}</div>`);
            thumb.addEventListener('click', (e) => {
                if (e.target.tagName !== 'INPUT') {
                    const cb = thumb.querySelector('.page-checkbox');
                    cb.checked = !cb.checked;
                    thumb.classList.toggle('selected', cb.checked);
                }
            });
            thumb.querySelector('.page-checkbox').addEventListener('change', (e) => {
                thumb.classList.toggle('selected', e.target.checked);
            });
            grid.appendChild(thumb);
        }

        document.getElementById('selectRangeBtn').addEventListener('click', () => {
            const range = document.getElementById('removeRange').value;
            if (!range) return;
            const pages = this.parseRanges(range, pageCount);
            document.querySelectorAll('.page-checkbox').forEach(cb => {
                const page = parseInt(cb.dataset.page);
                if (pages.includes(page - 1)) {
                    cb.checked = true;
                    cb.closest('.page-thumb').classList.add('selected');
                }
            });
        });

        document.getElementById('removeBtn').onclick = () => this.process();
    },

    parseRanges(str, max) {
        return parsePageRanges(str, max);
    },

    async process() {
        const btn = document.getElementById('removeBtn');
        const checked = Array.from(document.querySelectorAll('.page-checkbox:checked'))
            .map(cb => parseInt(cb.dataset.page) - 1);

        if (checked.length === 0) {
            showToast('Please select pages to remove', 'error');
            return;
        }

        btn.disabled = true;
        btn.innerHTML = '<span class="spinner"></span> Removing pages...';

        try {
            const pdf = await PDFLib.PDFDocument.load(this.pdfBytes);
            const totalPages = pdf.getPageCount();
            const keepPages = [];
            for (let i = 0; i < totalPages; i++) {
                if (!checked.includes(i)) keepPages.push(i);
            }

            if (keepPages.length === 0) {
                showToast('Cannot remove all pages', 'error');
                return;
            }

            const newPdf = await PDFLib.PDFDocument.create();
            const copiedPages = await newPdf.copyPages(pdf, keepPages);
            copiedPages.forEach(p => newPdf.addPage(p));

            const resultBytes = await newPdf.save();
            downloadBytes(resultBytes, 'removed_pages.pdf');
            showToast(`${checked.length} page(s) removed successfully!`);
        } catch (error) {
            showToast('Error removing pages: ' + error.message, 'error');
        }

        btn.disabled = false;
        btn.innerHTML = '<i class="fas fa-trash-alt"></i> Remove Selected Pages';
    }
});
