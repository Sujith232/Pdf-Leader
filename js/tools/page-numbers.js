// Page Numbers Tool
ToolRouter.register('page-numbers', {
    title: 'Add Page Numbers',
    description: 'Add page numbers into PDFs with ease. Choose your positions, dimensions, typography.',
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
                <h3>Select a PDF to add page numbers</h3>
                <p>or drag and drop a PDF file here</p>
                <button class="upload-btn">Select PDF file</button>
                <input type="file" id="fileInput" accept=".pdf" hidden>
            </div>
            <div id="numberOptions" style="display:none;">
                <div class="page-preview-container" id="pagePreview"></div>
                <div class="options-panel">
                    <h3>Page Number Options</h3>
                    <div class="option-row">
                        <div class="option-group">
                            <label>Position:</label>
                            <select id="numPosition">
                                <option value="bottom-center" selected>Bottom Center</option>
                                <option value="bottom-left">Bottom Left</option>
                                <option value="bottom-right">Bottom Right</option>
                                <option value="top-center">Top Center</option>
                                <option value="top-left">Top Left</option>
                                <option value="top-right">Top Right</option>
                            </select>
                        </div>
                        <div class="option-group">
                            <label>Font Size:</label>
                            <select id="numFontSize">
                                <option value="10">10</option>
                                <option value="12" selected>12</option>
                                <option value="14">14</option>
                                <option value="16">16</option>
                                <option value="20">20</option>
                            </select>
                        </div>
                    </div>
                    <div class="option-row">
                        <div class="option-group">
                            <label>Format:</label>
                            <select id="numFormat">
                                <option value="1, 2, 3" selected>1, 2, 3</option>
                                <option value="Page 1, Page 2">Page 1, Page 2</option>
                                <option value="1/N, 2/N">1/N, 2/N</option>
                            </select>
                        </div>
                        <div class="option-group">
                            <label>Start from:</label>
                            <input type="number" id="numStart" value="1" min="1">
                        </div>
                    </div>
                    <div class="option-group">
                        <label>Margins:</label>
                        <input type="number" id="numMargin" value="20" min="10" max="50" style="width: 100px;"> px from edge
                    </div>
                </div>
                <div class="action-section">
                    <button class="process-btn" id="numberBtn">
                        <i class="fas fa-hashtag"></i> Add Page Numbers
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
        document.getElementById('numberOptions').style.display = 'block';

        const pageCount = await PDFWorker.getPageCount(this.pdfBytes);
        const preview = document.getElementById('pagePreview');
        preview.innerHTML = `<h3>Document (${pageCount} pages)</h3>`;

        const canvas = document.createElement('canvas');
        await PDFWorker.renderPageToCanvas(this.pdfBytes, 1, canvas, 0.5);
        canvas.style.maxWidth = '200px';
        preview.appendChild(canvas);

        document.getElementById('numberBtn').onclick = () => this.process();
    },

    async process() {
        const btn = document.getElementById('numberBtn');
        btn.disabled = true;
        btn.innerHTML = '<span class="spinner"></span> Adding page numbers...';

        try {
            const pdf = await PDFLib.PDFDocument.load(this.pdfBytes);
            const pages = pdf.getPages();
            const pageCount = pages.length;
            const position = document.getElementById('numPosition').value;
            const fontSize = parseInt(document.getElementById('numFontSize').value);
            const format = document.getElementById('numFormat').value;
            const startFrom = parseInt(document.getElementById('numStart').value);
            const margin = parseInt(document.getElementById('numMargin').value);

            const helveticaFont = await pdf.embedFont(PDFLib.StandardFonts.Helvetica);

            pages.forEach((page, index) => {
                const { width, height } = page.getSize();
                let num = startFrom + index;
                let text = '';

                if (format === '1, 2, 3') {
                    text = num.toString();
                } else if (format === 'Page 1, Page 2') {
                    text = `Page ${num}`;
                } else if (format === '1/N, 2/N') {
                    text = `${num}/${pageCount}`;
                }

                const textWidth = helveticaFont.widthOfTextAtSize(text, fontSize);
                let x, y;

                if (position.startsWith('bottom')) {
                    y = margin;
                } else {
                    y = height - margin;
                }

                if (position.endsWith('center')) {
                    x = (width - textWidth) / 2;
                } else if (position.endsWith('left')) {
                    x = margin;
                } else {
                    x = width - textWidth - margin;
                }

                page.drawText(text, {
                    x, y,
                    size: fontSize,
                    font: helveticaFont,
                    color: PDFLib.rgb(0, 0, 0),
                });
            });

            const numberedBytes = await pdf.save();
            downloadBytes(numberedBytes, 'numbered.pdf');
            showToast('Page numbers added successfully!');
        } catch (error) {
            showToast('Error adding page numbers: ' + error.message, 'error');
        }

        btn.disabled = false;
        btn.innerHTML = '<i class="fas fa-hashtag"></i> Add Page Numbers';
    }
});
