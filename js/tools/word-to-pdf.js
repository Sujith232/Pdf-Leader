// Word to PDF Tool
ToolRouter.register('word-to-pdf', {
    title: 'Word to PDF',
    description: 'Make DOC and DOCX files easy to read by converting them to PDF.',
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
                <h3>Select a Word document to convert</h3>
                <p>or drag and drop a Word file here</p>
                <button class="upload-btn">Select Word file</button>
                <input type="file" id="fileInput" accept=".doc,.docx" hidden>
                <p class="file-types">Supported formats: DOC, DOCX</p>
            </div>
            <div id="wordPreview" style="display:none;">
                <div class="options-panel">
                    <h3>Document Preview</h3>
                    <div id="docPreviewContent" style="max-height: 400px; overflow-y: auto; padding: 1rem; background: #f8fafc; border-radius: 8px;"></div>
                </div>
                <div class="action-section">
                    <button class="process-btn" id="wordConvertBtn">
                        <i class="fas fa-file-pdf"></i> Convert to PDF
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
            if (file && (file.name.endsWith('.doc') || file.name.endsWith('.docx'))) this.loadFile(file);
        });
        fileInput.addEventListener('change', (e) => { if (e.target.files[0]) this.loadFile(e.target.files[0]); });
    },

    async loadFile(file) {
        this.file = file;
        document.getElementById('uploadArea').style.display = 'none';
        document.getElementById('wordPreview').style.display = 'block';

        try {
            const arrayBuffer = await readFileAsArrayBuffer(file);
            const result = await mammoth.extractRawText({ arrayBuffer });
            const preview = document.getElementById('docPreviewContent');
            preview.innerHTML = `<pre style="white-space: pre-wrap; font-family: Inter, sans-serif; font-size: 0.9rem;">${result.value}</pre>`;
        } catch (e) {
            document.getElementById('docPreviewContent').innerHTML = '<p style="color: #64748b;">Preview not available for this file format.</p>';
        }

        document.getElementById('wordConvertBtn').onclick = () => this.process();
    },

    async process() {
        const btn = document.getElementById('wordConvertBtn');
        btn.disabled = true;
        btn.innerHTML = '<span class="spinner"></span> Converting...';

        try {
            const arrayBuffer = await readFileAsArrayBuffer(this.file);
            const textResult = await mammoth.extractRawText({ arrayBuffer });
            const lines = textResult.value.split('\n');

            const { jsPDF } = window.jspdf;
            const pdf = new jsPDF('p', 'mm', 'a4');
            const pageWidth = pdf.internal.pageSize.getWidth();
            const pageHeight = pdf.internal.pageSize.getHeight();
            const margin = 15;
            const contentWidth = pageWidth - margin * 2;

            let y = margin;
            const lineHeight = 5;
            const fontSize = 11;

            pdf.setFont('helvetica', 'normal');
            pdf.setFontSize(fontSize);

            for (const line of lines) {
                if (y + lineHeight > pageHeight - margin) {
                    pdf.addPage();
                    y = margin;
                }

                // Check ## BEFORE # to avoid false match
                if (line.startsWith('## ')) {
                    pdf.setFont('helvetica', 'bold');
                    pdf.setFontSize(14);
                    pdf.text(line.replace(/^#+\s*/, ''), margin, y);
                    pdf.setFont('helvetica', 'normal');
                    pdf.setFontSize(fontSize);
                    y += 7;
                } else if (line.startsWith('# ')) {
                    pdf.setFont('helvetica', 'bold');
                    pdf.setFontSize(16);
                    pdf.text(line.replace(/^#+\s*/, ''), margin, y);
                    pdf.setFont('helvetica', 'normal');
                    pdf.setFontSize(fontSize);
                    y += 8;
                } else if (line.trim() === '') {
                    y += lineHeight;
                } else {
                    const splitText = pdf.splitTextToSize(line, contentWidth);
                    for (const textLine of splitText) {
                        if (y + lineHeight > pageHeight - margin) {
                            pdf.addPage();
                            y = margin;
                        }
                        pdf.text(textLine, margin, y);
                        y += lineHeight;
                    }
                }
            }

            pdf.save(this.file.name.replace(/\.[^.]+$/, '.pdf'));
            showToast('Word document converted to PDF!');
        } catch (error) {
            showToast('Error converting document: ' + error.message, 'error');
        }

        btn.disabled = false;
        btn.innerHTML = '<i class="fas fa-file-pdf"></i> Convert to PDF';
    }
});
