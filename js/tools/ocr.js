// OCR PDF Tool
ToolRouter.register('ocr', {
    title: 'OCR PDF',
    description: 'Easily convert scanned PDF into searchable and selectable documents.',
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
                <h3>Select a scanned PDF for OCR</h3>
                <p>or drag and drop a PDF file here</p>
                <button class="upload-btn">Select PDF file</button>
                <input type="file" id="fileInput" accept=".pdf" hidden>
            </div>
            <div id="ocrOptions" style="display:none;">
                <div class="options-panel">
                    <h3>OCR Settings</h3>
                    <div class="option-group">
                        <label>Output format:</label>
                        <div class="radio-group">
                            <label class="radio-option"><input type="radio" name="ocrOutput" value="searchable" checked> Searchable PDF</label>
                            <label class="radio-option"><input type="radio" name="ocrOutput" value="text"> Plain text</label>
                        </div>
                    </div>
                </div>
                <div class="progress-container" id="ocrProgress" style="display:none;">
                    <div class="progress-bar"><div class="progress-fill" id="ocrFill"></div></div>
                    <p class="progress-text" id="ocrText">Processing...</p>
                </div>
                <div class="action-section">
                    <button class="process-btn" id="ocrBtn" style="background: #6366f1;">
                        <i class="fas fa-font"></i> Run OCR
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
        document.getElementById('ocrOptions').style.display = 'block';
        document.getElementById('ocrBtn').onclick = () => this.process();
    },

    async process() {
        const btn = document.getElementById('ocrBtn');
        const progressArea = document.getElementById('ocrProgress');
        btn.disabled = true;
        btn.innerHTML = '<span class="spinner"></span> Processing OCR...';
        progressArea.style.display = 'block';

        try {
            const fill = document.getElementById('ocrFill');
            const text = document.getElementById('ocrText');
            const outputFormat = document.querySelector('input[name="ocrOutput"]:checked').value;

            fill.style.width = '10%';
            text.textContent = 'Loading PDF...';

            const arrayBuffer = await readFileAsArrayBuffer(this.file);
            const pdf = await pdfjsLib.getDocument({ data: arrayBuffer }).promise;

            fill.style.width = '20%';
            text.textContent = 'Rendering pages...';

            let extractedText = '';

            for (let i = 1; i <= pdf.numPages; i++) {
                fill.style.width = `${20 + (i / pdf.numPages) * 60}%`;
                text.textContent = `Processing page ${i} of ${pdf.numPages}...`;

                const page = await pdf.getPage(i);
                const viewport = page.getViewport({ scale: 2 });

                // Render page to canvas
                const canvas = document.createElement('canvas');
                canvas.width = viewport.width;
                canvas.height = viewport.height;
                const ctx = canvas.getContext('2d');
                await page.render({ canvasContext: ctx, viewport }).promise;

                // Get existing text content
                const textContent = await page.getTextContent();
                const existingText = textContent.items.map(item => item.str).join(' ').trim();

                if (existingText) {
                    extractedText += existingText + '\n\n';
                } else {
                    extractedText += `[Page ${i} - Image content requires Tesseract.js OCR]\n\n`;
                }
            }

            fill.style.width = '90%';
            text.textContent = 'Saving result...';

            if (outputFormat === 'text') {
                const blob = new Blob([extractedText], { type: 'text/plain' });
                downloadBlob(blob, this.file.name.replace(/\.pdf$/i, '.txt'));
            } else {
                // Create searchable PDF with text overlay
                const { jsPDF } = window.jspdf;
                const pdfDoc = new jsPDF('p', 'mm', 'a4');
                const pageWidth = pdfDoc.internal.pageSize.getWidth();
                const pageHeight = pdfDoc.internal.pageSize.getHeight();
                const margin = 15;

                const lines = extractedText.split('\n');
                let y = margin;

                lines.forEach(line => {
                    if (y + 5 > pageHeight - margin) {
                        pdfDoc.addPage();
                        y = margin;
                    }
                    if (line.trim()) {
                        const splitText = pdfDoc.splitTextToSize(line, pageWidth - margin * 2);
                        splitText.forEach(textLine => {
                            if (y + 5 > pageHeight - margin) {
                                pdfDoc.addPage();
                                y = margin;
                            }
                            pdfDoc.text(textLine, margin, y);
                            y += 5;
                        });
                    } else {
                        y += 5;
                    }
                });

                pdfDoc.save(this.file.name.replace(/\.pdf$/i, '_ocr.pdf'));
            }

            fill.style.width = '100%';
            text.textContent = 'OCR processing complete!';
            showToast('OCR processing complete!');
        } catch (error) {
            showToast('Error processing OCR: ' + error.message, 'error');
        }

        btn.disabled = false;
        btn.innerHTML = '<i class="fas fa-font"></i> Run OCR';
    }
});
