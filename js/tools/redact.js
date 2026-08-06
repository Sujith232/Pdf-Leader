// Redact PDF Tool
ToolRouter.register('redact', {
    title: 'Redact PDF',
    description: 'Redact text and graphics to permanently remove sensitive information from a PDF.',
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
                <h3>Select a PDF to redact</h3>
                <p>or drag and drop a PDF file here</p>
                <button class="upload-btn">Select PDF file</button>
                <input type="file" id="fileInput" accept=".pdf" hidden>
            </div>
            <div id="redactOptions" style="display:none;">
                <div class="page-preview-container" id="pagePreview"></div>
                <div class="options-panel">
                    <h3>Redaction Settings</h3>
                    <div class="option-group">
                        <label>Specify areas to redact (text in format: x,y,width,height per line):</label>
                        <textarea id="redactAreas" rows="4" placeholder="50,100,200,30&#10;300,400,150,30" style="width: 100%; font-family: monospace;"></textarea>
                    </div>
                    <div class="option-group">
                        <label>Redaction color:</label>
                        <input type="color" id="redactColor" value="#000000">
                    </div>
                </div>
                <div class="action-section">
                    <button class="process-btn" id="redactBtn" style="background: #1e293b;">
                        <i class="fas fa-eraser"></i> Redact PDF
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
        document.getElementById('redactOptions').style.display = 'block';

        const pageCount = await PDFWorker.getPageCount(this.pdfBytes);
        const preview = document.getElementById('pagePreview');
        preview.innerHTML = `<h3>Document (${pageCount} pages)</h3>`;
        const canvas = document.createElement('canvas');
        await PDFWorker.renderPageToCanvas(this.pdfBytes, 1, canvas, 0.5);
        canvas.style.maxWidth = '300px';
        preview.appendChild(canvas);

        document.getElementById('redactBtn').onclick = () => this.process();
    },

    async process() {
        const btn = document.getElementById('redactBtn');
        btn.disabled = true;
        btn.innerHTML = '<span class="spinner"></span> Redacting...';

        try {
            const pdf = await PDFLib.PDFDocument.load(this.pdfBytes);
            const colorHex = document.getElementById('redactColor').value;
            const r = parseInt(colorHex.slice(1, 3), 16) / 255;
            const g = parseInt(colorHex.slice(3, 5), 16) / 255;
            const b = parseInt(colorHex.slice(5, 7), 16) / 255;

            const areasText = document.getElementById('redactAreas').value.trim();
            if (areasText) {
                const lines = areasText.split('\n');
                lines.forEach(line => {
                    const [x, y, w, h] = line.split(',').map(Number);
                    pdf.getPages().forEach(page => {
                        page.drawRectangle({
                            x, y,
                            width: w,
                            height: h,
                            color: PDFLib.rgb(r, g, b),
                        });
                    });
                });
            }

            const redactedBytes = await pdf.save();
            downloadBytes(redactedBytes, 'redacted.pdf');
            showToast('PDF redacted successfully!');
        } catch (error) {
            showToast('Error redacting PDF: ' + error.message, 'error');
        }

        btn.disabled = false;
        btn.innerHTML = '<i class="fas fa-eraser"></i> Redact PDF';
    }
});
