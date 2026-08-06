// Rotate PDF Tool
ToolRouter.register('rotate', {
    title: 'Rotate PDF',
    description: 'Rotate your PDFs the way you need them. You can even rotate multiple PDFs at once!',
    file: null,
    rotation: 90,

    init() {
        this.file = null;
        this.render();
    },

    render() {
        const workspace = document.getElementById('toolWorkspace');
        workspace.innerHTML = `
            <div class="upload-area" id="uploadArea">
                <i class="fas fa-cloud-upload-alt"></i>
                <h3>Select a PDF file to rotate</h3>
                <p>or drag and drop a PDF file here</p>
                <button class="upload-btn">Select PDF file</button>
                <input type="file" id="fileInput" accept=".pdf" hidden>
            </div>
            <div id="rotateOptions" style="display:none;">
                <div class="page-preview-container" id="pagePreview"></div>
                <div class="options-panel">
                    <h3>Rotation Options</h3>
                    <div class="option-group">
                        <label>Rotation angle:</label>
                        <div class="radio-group">
                            <label class="radio-option"><input type="radio" name="rotation" value="90" checked> 90° Right</label>
                            <label class="radio-option"><input type="radio" name="rotation" value="180"> 180°</label>
                            <label class="radio-option"><input type="radio" name="rotation" value="270"> 90° Left</label>
                        </div>
                    </div>
                    <div class="option-group">
                        <label>Apply to:</label>
                        <div class="radio-group">
                            <label class="radio-option"><input type="radio" name="applyTo" value="all" checked> All pages</label>
                            <label class="radio-option"><input type="radio" name="applyTo" value="selected"> Selected pages</label>
                        </div>
                    </div>
                </div>
                <div class="action-section">
                    <button class="process-btn" id="rotateBtn">
                        <i class="fas fa-redo"></i> Rotate PDF
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
        document.getElementById('rotateOptions').style.display = 'block';

        const pageCount = await PDFWorker.getPageCount(this.pdfBytes);
        const preview = document.getElementById('pagePreview');
        preview.innerHTML = '<h3>Document Pages</h3><div class="pages-grid" id="pagesGrid"></div>';
        const grid = document.getElementById('pagesGrid');

        for (let i = 1; i <= pageCount; i++) {
            const thumb = document.createElement('div');
            thumb.className = 'page-thumb selected';
            thumb.dataset.page = i;
            const canvas = document.createElement('canvas');
            await PDFWorker.renderPageToCanvas(this.pdfBytes, i, canvas, 0.5);
            thumb.innerHTML = `<input type="checkbox" class="page-checkbox" checked data-page="${i}">`;
            thumb.prepend(canvas);
            thumb.insertAdjacentHTML('beforeend', `<div class="page-number">Page ${i}</div>`);
            thumb.addEventListener('click', (e) => {
                if (e.target.tagName !== 'INPUT') {
                    const cb = thumb.querySelector('.page-checkbox');
                    cb.checked = !cb.checked;
                    thumb.classList.toggle('selected', cb.checked);
                }
            });
            grid.appendChild(thumb);
        }

        document.getElementById('rotateBtn').onclick = () => this.process();
    },

    async process() {
        const btn = document.getElementById('rotateBtn');
        btn.disabled = true;
        btn.innerHTML = '<span class="spinner"></span> Rotating...';

        try {
            const rotation = parseInt(document.querySelector('input[name="rotation"]:checked').value);
            const applyTo = document.querySelector('input[name="applyTo"]:checked').value;

            const pdf = await PDFLib.PDFDocument.load(this.pdfBytes);

            if (applyTo === 'selected') {
                const checked = Array.from(document.querySelectorAll('.page-checkbox:checked'))
                    .map(cb => parseInt(cb.dataset.page) - 1);
                checked.forEach(i => {
                    const page = pdf.getPage(i);
                    const currentRotation = page.getRotation().angle;
                    page.setRotation(PDFLib.degrees(currentRotation + rotation));
                });
            } else {
                pdf.getPages().forEach(page => {
                    const currentRotation = page.getRotation().angle;
                    page.setRotation(PDFLib.degrees(currentRotation + rotation));
                });
            }

            const rotatedBytes = await pdf.save();
            downloadBytes(rotatedBytes, 'rotated.pdf');
            showToast('PDF rotated successfully!');
        } catch (error) {
            showToast('Error rotating PDF: ' + error.message, 'error');
        }

        btn.disabled = false;
        btn.innerHTML = '<i class="fas fa-redo"></i> Rotate PDF';
    }
});
