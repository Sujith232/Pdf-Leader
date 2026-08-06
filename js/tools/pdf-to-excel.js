// PDF to Excel Tool
ToolRouter.register('pdf-to-excel', {
    title: 'PDF to Excel',
    description: 'Pull data straight from PDFs into Excel spreadsheets in a few short seconds.',
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
                <h3>Select a PDF to convert to Excel</h3>
                <p>or drag and drop a PDF file here</p>
                <button class="upload-btn">Select PDF file</button>
                <input type="file" id="fileInput" accept=".pdf" hidden>
            </div>
            <div id="pdfExcelOptions" style="display:none;">
                <div id="fileInfo" class="file-list"></div>
                <div class="progress-container" id="progressArea" style="display:none;">
                    <div class="progress-bar"><div class="progress-fill" id="progressFill"></div></div>
                    <p class="progress-text" id="progressText">Converting...</p>
                </div>
                <div class="action-section">
                    <button class="process-btn" id="pdfExcelBtn">
                        <i class="fas fa-file-excel"></i> Convert to Excel
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
        document.getElementById('pdfExcelOptions').style.display = 'block';
        document.getElementById('fileInfo').innerHTML = `
            <div class="file-item">
                <div class="file-icon"><i class="fas fa-file-pdf"></i></div>
                <div class="file-info">
                    <div class="file-name">${file.name}</div>
                    <div class="file-size">${formatFileSize(file.size)}</div>
                </div>
            </div>`;
        document.getElementById('pdfExcelBtn').onclick = () => this.process();
    },

    async process() {
        const btn = document.getElementById('pdfExcelBtn');
        const progressArea = document.getElementById('progressArea');
        const fill = document.getElementById('progressFill');
        const textEl = document.getElementById('progressText');
        btn.disabled = true;
        btn.innerHTML = '<span class="spinner"></span> Converting...';
        progressArea.style.display = 'block';

        try {
            fill.style.width = '30%';
            textEl.textContent = 'Uploading...';
            const formData = new FormData();
            formData.append('file', this.file);

            const apiBase = window.location.port === '8080' ? '' : 'http://localhost:8080';
            fill.style.width = '50%';
            textEl.textContent = 'Converting on server...';

            const resp = await fetch(apiBase + '/convert/pdf-to-xlsx', { method: 'POST', body: formData });

            if (!resp.ok) {
                const err = await resp.text();
                throw new Error(err || 'Conversion failed');
            }

            fill.style.width = '90%';
            textEl.textContent = 'Downloading...';

            const blob = await resp.blob();
            const url = URL.createObjectURL(blob);
            const a = document.createElement('a');
            a.href = url;
            a.download = this.file.name.replace(/\.pdf$/i, '.xlsx');
            document.body.appendChild(a);
            a.click();
            document.body.removeChild(a);
            setTimeout(() => URL.revokeObjectURL(url), 10000);

            fill.style.width = '100%';
            textEl.textContent = 'Done!';
            showToast('PDF converted to Excel!');
        } catch (error) {
            showToast('Error: ' + error.message, 'error');
        }

        btn.disabled = false;
        btn.innerHTML = '<i class="fas fa-file-excel"></i> Convert to Excel';
    }
});
