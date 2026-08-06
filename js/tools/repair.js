// Repair PDF Tool
ToolRouter.register('repair', {
    title: 'Repair PDF',
    description: 'Repair a damaged PDF and recover data from corrupt PDF. Fix PDF files with our Repair tool.',
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
                <h3>Select a damaged PDF to repair</h3>
                <p>or drag and drop a PDF file here</p>
                <button class="upload-btn">Select PDF file</button>
                <input type="file" id="fileInput" accept=".pdf" hidden>
            </div>
            <div id="repairOptions" style="display:none;">
                <div class="progress-container" id="repairProgress">
                    <div class="progress-bar"><div class="progress-fill" id="repairFill"></div></div>
                    <p class="progress-text" id="repairText">Ready to repair...</p>
                </div>
                <div class="action-section">
                    <button class="process-btn" id="repairBtn" style="background: #f59e0b;">
                        <i class="fas fa-wrench"></i> Repair PDF
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

    loadFile(file) {
        this.file = file;
        document.getElementById('uploadArea').style.display = 'none';
        document.getElementById('repairOptions').style.display = 'block';
        document.getElementById('repairBtn').onclick = () => this.process();
    },

    async process() {
        const btn = document.getElementById('repairBtn');
        const fill = document.getElementById('repairFill');
        const text = document.getElementById('repairText');
        btn.disabled = true;
        btn.innerHTML = '<span class="spinner"></span> Repairing...';

        try {
            fill.style.width = '20%';
            text.textContent = 'Reading PDF file...';

            const arrayBuffer = await readFileAsArrayBuffer(this.file);

            fill.style.width = '40%';
            text.textContent = 'Analyzing document structure...';

            let pdf = null;
            let pageCount = 0;

            // Try loading with ignoreEncryption
            try {
                pdf = await PDFLib.PDFDocument.load(arrayBuffer, { ignoreEncryption: true });
                pageCount = pdf.getPageCount();
            } catch (e1) {
                // If that fails, try creating new and copying pages
                try {
                    fill.style.width = '50%';
                    text.textContent = 'Attempting deep repair...';
                    const newPdf = await PDFLib.PDFDocument.create();
                    const tempPdf = await PDFLib.PDFDocument.load(arrayBuffer, {
                        ignoreEncryption: true,
                        updateMetadata: false
                    });
                    const indices = tempPdf.getPageIndices();
                    if (indices.length > 0) {
                        const pages = await newPdf.copyPages(tempPdf, indices);
                        pages.forEach(p => newPdf.addPage(p));
                    }
                    pdf = newPdf;
                    pageCount = pdf.getPageCount();
                } catch (e2) {
                    // Last resort: just copy raw bytes
                    pdf = await PDFLib.PDFDocument.load(arrayBuffer);
                    pageCount = pdf.getPageCount();
                }
            }

            fill.style.width = '80%';
            text.textContent = 'Saving repaired file...';

            const repairedBytes = await pdf.save();

            fill.style.width = '100%';
            text.textContent = `Done! ${pageCount} page(s) recovered.`;

            downloadBytes(repairedBytes, 'repaired.pdf');
            showToast(`PDF repaired! ${pageCount} page(s) recovered.`);
        } catch (error) {
            fill.style.width = '100%';
            text.textContent = 'Repair failed: ' + error.message;
            showToast('Error repairing PDF: ' + error.message, 'error');
        }

        btn.disabled = false;
        btn.innerHTML = '<i class="fas fa-wrench"></i> Repair PDF';
    }
});
