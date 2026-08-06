// Compress PDF Tool
ToolRouter.register('compress', {
    title: 'Compress PDF',
    description: 'Reduce file size while optimizing for maximal PDF quality.',
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
                <h3>Select a PDF file to compress</h3>
                <p>or drag and drop a PDF file here</p>
                <button class="upload-btn">Select PDF file</button>
                <input type="file" id="fileInput" accept=".pdf" hidden>
            </div>
            <div id="compressOptions" style="display:none;">
                <div id="fileInfo" class="file-list"></div>
                <div class="options-panel">
                    <h3>Target File Size</h3>
                    <div class="option-group">
                        <label>Enter your target size:</label>
                        <div style="display:flex; gap:10px; align-items:center;">
                            <input type="number" id="targetSize" value="1" min="0.01" step="0.1" style="width:120px;">
                            <select id="targetUnit" style="padding:8px 12px; border:1px solid var(--border); border-radius:var(--radius);">
                                <option value="MB">MB</option>
                                <option value="KB">KB</option>
                            </select>
                        </div>
                        <small style="color:var(--text-light);">The tool will compress to this size or smaller</small>
                    </div>
                </div>
                <div class="progress-container" id="progressArea" style="display:none;">
                    <div class="progress-bar"><div class="progress-fill" id="progressFill"></div></div>
                    <p class="progress-text" id="progressText">Compressing...</p>
                </div>
                <div class="action-section">
                    <button class="process-btn" id="compressBtn">
                        <i class="fas fa-compress-alt"></i> Compress PDF
                    </button>
                </div>
            </div>
        `;

        this.bindEvents();
    },

    bindEvents() {
        const uploadArea = document.getElementById('uploadArea');
        const fileInput = document.getElementById('fileInput');
        const self = this;

        uploadArea.onclick = () => fileInput.click();

        uploadArea.ondragover = (e) => { e.preventDefault(); uploadArea.classList.add('dragover'); };
        uploadArea.ondragleave = () => uploadArea.classList.remove('dragover');
        uploadArea.ondrop = (e) => {
            e.preventDefault();
            uploadArea.classList.remove('dragover');
            if (e.dataTransfer.files.length > 0) {
                const file = e.dataTransfer.files[0];
                if (file.type === 'application/pdf') {
                    self.loadFile(file);
                } else {
                    showToast('Please select a PDF file', 'error');
                }
            }
        };

        fileInput.onchange = (e) => {
            if (e.target.files.length > 0) {
                self.loadFile(e.target.files[0]);
            }
        };
    },

    loadFile(file) {
        this.file = file;
        document.getElementById('uploadArea').style.display = 'none';
        document.getElementById('compressOptions').style.display = 'block';

        document.getElementById('fileInfo').innerHTML = `
            <div class="file-item">
                <div class="file-icon"><i class="fas fa-file-pdf"></i></div>
                <div class="file-info">
                    <div class="file-name">${file.name}</div>
                    <div class="file-size">${formatFileSize(file.size)}</div>
                </div>
            </div>
        `;

        document.getElementById('compressBtn').onclick = () => this.process();
    },

    async process() {
        const btn = document.getElementById('compressBtn');
        const progressArea = document.getElementById('progressArea');
        const fill = document.getElementById('progressFill');
        const text = document.getElementById('progressText');

        const targetValue = parseFloat(document.getElementById('targetSize').value) || 1;
        const targetUnit = document.getElementById('targetUnit').value;
        const targetBytes = targetUnit === 'MB' ? targetValue * 1024 * 1024 : targetValue * 1024;

        btn.disabled = true;
        btn.innerHTML = '<span class="spinner"></span> Compressing...';
        progressArea.style.display = 'block';

        try {
            fill.style.width = '10%';
            text.textContent = 'Reading PDF...';

            const buffer = await this.file.arrayBuffer();
            const pdfBytes = new Uint8Array(buffer);

            fill.style.width = '25%';
            text.textContent = 'Loading PDF...';

            const pdf = await PDFLib.PDFDocument.load(pdfBytes);

            const compressedBytes = await this.compressToTarget(pdf, targetBytes, fill, text);

            fill.style.width = '90%';
            text.textContent = 'Finalizing...';

            const originalSize = this.file.size;
            const compressedSize = compressedBytes.length;
            const savings = Math.round((1 - compressedSize / originalSize) * 100);

            fill.style.width = '100%';

            if (compressedSize <= targetBytes) {
                text.textContent = 'Done! Compressed to ' + formatFileSize(compressedSize);
                downloadBytes(compressedBytes, 'compressed.pdf');
                showToast('PDF compressed! ' + formatFileSize(originalSize) + ' -> ' + formatFileSize(compressedSize) + ' (' + savings + '% smaller)');
            } else {
                text.textContent = 'Done! Closest possible: ' + formatFileSize(compressedSize);
                downloadBytes(compressedBytes, 'compressed.pdf');
                showToast('Best compression: ' + formatFileSize(originalSize) + ' -> ' + formatFileSize(compressedSize) + '. Could not reach ' + targetValue + ' ' + targetUnit);
            }
        } catch (error) {
            showToast('Error compressing PDF: ' + error.message, 'error');
        }

        btn.disabled = false;
        btn.innerHTML = '<i class="fas fa-compress-alt"></i> Compress PDF';
    },

    async compressToTarget(pdf, targetBytes, fill, text) {
        const levels = [
            { useObjectStreams: true, addDefaultPage: false },
            { useObjectStreams: true, addDefaultPage: false, objectsPerTick: 200 },
            { useObjectStreams: true, addDefaultPage: false, objectsPerTick: 100 },
            { useObjectStreams: true, addDefaultPage: false, objectsPerTick: 50 },
            { useObjectStreams: true, addDefaultPage: false, objectsPerTick: 20 },
            { useObjectStreams: true, addDefaultPage: false, objectsPerTick: 10 },
        ];

        let bestBytes = null;
        let bestSize = Infinity;

        for (let i = 0; i < levels.length; i++) {
            const percent = 30 + Math.round((i / levels.length) * 50);
            fill.style.width = percent + '%';
            text.textContent = 'Trying compression level ' + (i + 1) + '/' + levels.length + '...';

            const bytes = await pdf.save(levels[i]);
            const size = bytes.length;

            if (size <= targetBytes) {
                return bytes;
            }

            if (size < bestSize) {
                bestSize = size;
                bestBytes = bytes;
            }
        }

        text.textContent = 'Closest possible size achieved...';
        return bestBytes;
    }
});
