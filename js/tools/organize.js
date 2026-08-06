// Organize PDF Tool
ToolRouter.register('organize', {
    title: 'Organize PDF',
    description: 'Sort pages of your PDF file however you like. Delete or add pages at your convenience.',
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
                <h3>Select a PDF to organize</h3>
                <p>or drag and drop a PDF file here</p>
                <button class="upload-btn">Select PDF file</button>
                <input type="file" id="fileInput" accept=".pdf" hidden>
            </div>
            <div id="organizeOptions" style="display:none;">
                <div class="page-preview-container">
                    <h3>Drag pages to reorder them</h3>
                    <div class="pages-grid" id="pagesGrid"></div>
                </div>
                <div class="action-section">
                    <button class="process-btn" id="organizeBtn">
                        <i class="fas fa-sort"></i> Apply Order
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
        this.pageOrder = [];

        document.getElementById('uploadArea').style.display = 'none';
        document.getElementById('organizeOptions').style.display = 'block';

        const pageCount = await PDFWorker.getPageCount(this.pdfBytes);
        const grid = document.getElementById('pagesGrid');
        grid.innerHTML = '';

        for (let i = 1; i <= pageCount; i++) {
            this.pageOrder.push(i - 1);
            const thumb = document.createElement('div');
            thumb.className = 'page-thumb';
            thumb.dataset.page = i - 1;
            const canvas = document.createElement('canvas');
            await PDFWorker.renderPageToCanvas(this.pdfBytes, i, canvas, 0.4);
            thumb.appendChild(canvas);
            thumb.insertAdjacentHTML('beforeend', `<div class="page-number">Page ${i}</div>`);
            grid.appendChild(thumb);
        }

        new Sortable(grid, {
            animation: 150,
            ghostClass: 'sortable-ghost',
            onEnd: (evt) => {
                const [moved] = this.pageOrder.splice(evt.oldIndex, 1);
                this.pageOrder.splice(evt.newIndex, 0, moved);
                // Update page numbers
                grid.querySelectorAll('.page-thumb').forEach((thumb, idx) => {
                    thumb.querySelector('.page-number').textContent = `Page ${idx + 1}`;
                });
            }
        });

        document.getElementById('organizeBtn').onclick = () => this.process();
    },

    async process() {
        const btn = document.getElementById('organizeBtn');
        btn.disabled = true;
        btn.innerHTML = '<span class="spinner"></span> Reordering...';

        try {
            const srcPdf = await PDFLib.PDFDocument.load(this.pdfBytes);
            const newPdf = await PDFLib.PDFDocument.create();

            const copiedPages = await newPdf.copyPages(srcPdf, this.pageOrder);
            copiedPages.forEach(page => newPdf.addPage(page));

            const organizedBytes = await newPdf.save();
            downloadBytes(organizedBytes, 'organized.pdf');
            showToast('PDF pages reordered successfully!');
        } catch (error) {
            showToast('Error organizing PDF: ' + error.message, 'error');
        }

        btn.disabled = false;
        btn.innerHTML = '<i class="fas fa-sort"></i> Apply Order';
    }
});
