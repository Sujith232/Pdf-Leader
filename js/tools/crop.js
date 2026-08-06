// Crop PDF Tool
ToolRouter.register('crop', {
    title: 'Crop PDF',
    description: 'Crop margins of PDF documents or select specific areas, then apply changes.',
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
                <h3>Select a PDF to crop</h3>
                <p>or drag and drop a PDF file here</p>
                <button class="upload-btn">Select PDF file</button>
                <input type="file" id="fileInput" accept=".pdf" hidden>
            </div>
            <div id="cropOptions" style="display:none;">
                <div class="page-preview-container" id="pagePreview"></div>
                <div class="options-panel">
                    <h3>Crop Settings</h3>
                    <div class="option-row">
                        <div class="option-group">
                            <label>Top margin:</label>
                            <input type="number" id="cropTop" value="0" min="0"> px
                        </div>
                        <div class="option-group">
                            <label>Bottom margin:</label>
                            <input type="number" id="cropBottom" value="0" min="0"> px
                        </div>
                    </div>
                    <div class="option-row">
                        <div class="option-group">
                            <label>Left margin:</label>
                            <input type="number" id="cropLeft" value="0" min="0"> px
                        </div>
                        <div class="option-group">
                            <label>Right margin:</label>
                            <input type="number" id="cropRight" value="0" min="0"> px
                        </div>
                    </div>
                    <div class="option-group">
                        <label>Apply to:</label>
                        <select id="cropApplyTo">
                            <option value="all">All pages</option>
                            <option value="first">First page only</option>
                            <option value="last">Last page only</option>
                        </select>
                    </div>
                </div>
                <div class="action-section">
                    <button class="process-btn" id="cropBtn">
                        <i class="fas fa-crop-alt"></i> Crop PDF
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
        document.getElementById('cropOptions').style.display = 'block';

        const pageCount = await PDFWorker.getPageCount(this.pdfBytes);
        const preview = document.getElementById('pagePreview');
        preview.innerHTML = `<h3>Document (${pageCount} pages)</h3>`;
        const canvas = document.createElement('canvas');
        await PDFWorker.renderPageToCanvas(this.pdfBytes, 1, canvas, 0.5);
        canvas.style.maxWidth = '300px';
        preview.appendChild(canvas);

        document.getElementById('cropBtn').onclick = () => this.process();
    },

    async process() {
        const btn = document.getElementById('cropBtn');
        btn.disabled = true;
        btn.innerHTML = '<span class="spinner"></span> Cropping...';

        try {
            const top = parseInt(document.getElementById('cropTop').value) || 0;
            const bottom = parseInt(document.getElementById('cropBottom').value) || 0;
            const left = parseInt(document.getElementById('cropLeft').value) || 0;
            const right = parseInt(document.getElementById('cropRight').value) || 0;
            const applyTo = document.getElementById('cropApplyTo').value;

            const pdf = await PDFLib.PDFDocument.load(this.pdfBytes);
            const pages = pdf.getPages();

            pages.forEach((page, index) => {
                if (applyTo === 'first' && index !== 0) return;
                if (applyTo === 'last' && index !== pages.length - 1) return;

                const { width, height } = page.getSize();
                const newWidth = width - left - right;
                const newHeight = height - top - bottom;

                page.setCropBox(left, bottom, newWidth, newHeight);
                page.setMediaBox(left, bottom, newWidth, newHeight);
            });

            const croppedBytes = await pdf.save();
            downloadBytes(croppedBytes, 'cropped.pdf');
            showToast('PDF cropped successfully!');
        } catch (error) {
            showToast('Error cropping PDF: ' + error.message, 'error');
        }

        btn.disabled = false;
        btn.innerHTML = '<i class="fas fa-crop-alt"></i> Crop PDF';
    }
});
