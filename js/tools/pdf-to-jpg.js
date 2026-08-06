// PDF to JPG Tool
ToolRouter.register('pdf-to-jpg', {
    title: 'PDF to JPG',
    description: 'Convert each PDF page into a JPG or extract all images contained in a PDF.',
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
                <h3>Select a PDF to convert to JPG</h3>
                <p>or drag and drop a PDF file here</p>
                <button class="upload-btn">Select PDF file</button>
                <input type="file" id="fileInput" accept=".pdf" hidden>
            </div>
            <div id="jpgOptions" style="display:none;">
                <div class="options-panel">
                    <h3>Conversion Options</h3>
                    <div class="option-group">
                        <label>Output quality:</label>
                        <select id="jpgQuality">
                            <option value="0.5">Low (smaller files)</option>
                            <option value="0.7">Medium</option>
                            <option value="0.92" selected>High</option>
                        </select>
                    </div>
                    <div class="option-group">
                        <label>Page selection:</label>
                        <div class="radio-group">
                            <label class="radio-option"><input type="radio" name="jpgPages" value="all" checked> All pages</label>
                            <label class="radio-option"><input type="radio" name="jpgPages" value="range"> Specific pages</label>
                        </div>
                    </div>
                    <div class="option-group" id="jpgRangeGroup" style="display:none;">
                        <label>Pages (e.g., 1-3, 5):</label>
                        <input type="text" id="jpgRange" placeholder="1-3, 5">
                    </div>
                </div>
                <div class="action-section">
                    <button class="process-btn" id="jpgConvertBtn">
                        <i class="fas fa-file-image"></i> Convert to JPG
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

        document.querySelectorAll('input[name="jpgPages"]').forEach(radio => {
            radio.addEventListener('change', (e) => {
                document.getElementById('jpgRangeGroup').style.display = e.target.value === 'range' ? 'block' : 'none';
            });
        });
    },

    async loadFile(file) {
        this.file = file;
        const arrayBuffer = await readFileAsArrayBuffer(file);
        this.pdfBytes = new Uint8Array(arrayBuffer);
        document.getElementById('uploadArea').style.display = 'none';
        document.getElementById('jpgOptions').style.display = 'block';
        document.getElementById('jpgConvertBtn').onclick = () => this.process();
    },

    async process() {
        const btn = document.getElementById('jpgConvertBtn');
        btn.disabled = true;
        btn.innerHTML = '<span class="spinner"></span> Converting...';

        try {
            const quality = parseFloat(document.getElementById('jpgQuality').value);
            const pagesMode = document.querySelector('input[name="jpgPages"]:checked').value;

            const pdf = await pdfjsLib.getDocument({ data: this.pdfBytes }).promise;
            let pagesToConvert = [];

            if (pagesMode === 'all') {
                for (let i = 1; i <= pdf.numPages; i++) pagesToConvert.push(i);
            } else {
                const range = document.getElementById('jpgRange').value;
                pagesToConvert = this.parseRanges(range, pdf.numPages);
            }

            for (const pageNum of pagesToConvert) {
                const page = await pdf.getPage(pageNum);
                const viewport = page.getViewport({ scale: 2 });
                const canvas = document.createElement('canvas');
                canvas.height = viewport.height;
                canvas.width = viewport.width;
                const ctx = canvas.getContext('2d');
                await page.render({ canvasContext: ctx, viewport }).promise;

                const imgData = canvas.toDataURL('image/jpeg', quality);
                const link = document.createElement('a');
                link.href = imgData;
                link.download = `page_${pageNum}.jpg`;
                link.click();
            }

            showToast(`${pagesToConvert.length} page(s) converted to JPG!`);
        } catch (error) {
            showToast('Error converting PDF: ' + error.message, 'error');
        }

        btn.disabled = false;
        btn.innerHTML = '<i class="fas fa-file-image"></i> Convert to JPG';
    },

    parseRanges(str, max) {
        const pages = [];
        str.split(',').forEach(part => {
            part = part.trim();
            if (part.includes('-')) {
                const [start, end] = part.split('-').map(Number);
                for (let i = start; i <= Math.min(end, max); i++) pages.push(i);
            } else {
                const n = parseInt(part);
                if (n >= 1 && n <= max) pages.push(n);
            }
        });
        return [...new Set(pages)].sort((a, b) => a - b);
    }
});
