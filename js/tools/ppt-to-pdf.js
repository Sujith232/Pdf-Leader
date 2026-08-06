// PowerPoint to PDF Tool
ToolRouter.register('ppt-to-pdf', {
    title: 'PowerPoint to PDF',
    description: 'Make PPT and PPTX slideshows easy to view by converting them to PDF.',
    file: null,

    init() { this.file = null; this.render(); },

    render() {
        document.getElementById('toolWorkspace').innerHTML = `
            <div class="upload-area" id="uploadArea">
                <i class="fas fa-cloud-upload-alt"></i>
                <h3>Select a PowerPoint file to convert</h3>
                <p>or drag and drop a PPT file here</p>
                <button class="upload-btn">Select PowerPoint file</button>
                <input type="file" id="fileInput" accept=".pptx" hidden>
                <p class="file-types">Supported format: PPTX</p>
            </div>
            <div id="pptOpts" style="display:none;">
                <div id="fileInfo" class="file-list"></div>
                <div class="progress-container" id="progressArea" style="display:none;">
                    <div class="progress-bar"><div class="progress-fill" id="progressFill"></div></div>
                    <p class="progress-text" id="progressText">Converting...</p>
                </div>
                <div class="action-section">
                    <button class="process-btn" id="convertBtn"><i class="fas fa-file-pdf"></i> Convert to PDF</button>
                </div>
            </div>`;
        const self = this;
        const ua = document.getElementById('uploadArea');
        const fi = document.getElementById('fileInput');
        ua.onclick = () => fi.click();
        ua.ondragover = e => { e.preventDefault(); ua.classList.add('dragover'); };
        ua.ondragleave = () => ua.classList.remove('dragover');
        ua.ondrop = e => { e.preventDefault(); ua.classList.remove('dragover'); if (e.dataTransfer.files[0]) self.load(e.dataTransfer.files[0]); };
        fi.onchange = e => { if (e.target.files[0]) self.load(e.target.files[0]); };
    },

    async load(file) {
        this.file = file;
        document.getElementById('uploadArea').style.display = 'none';
        document.getElementById('pptOpts').style.display = 'block';
        document.getElementById('fileInfo').innerHTML = '<div class="file-item"><div class="file-icon"><i class="fas fa-file-powerpoint"></i></div><div class="file-info"><div class="file-name">' + file.name + '</div><div class="file-size">' + formatFileSize(file.size) + '</div></div></div>';
        document.getElementById('convertBtn').onclick = () => this.go();
    },

    async go() {
        const btn = document.getElementById('convertBtn');
        const pa = document.getElementById('progressArea');
        const fl = document.getElementById('progressFill');
        const tx = document.getElementById('progressText');
        btn.disabled = true; btn.innerHTML = '<span class="spinner"></span> Converting...'; pa.style.display = 'block';

        fl.style.width = '30%'; tx.textContent = 'Uploading...';

        try {
            const formData = new FormData();
            formData.append('file', this.file);

            fl.style.width = '50%'; tx.textContent = 'Converting on server...';

            const apiBase = window.location.port === '8080' ? '' : 'http://localhost:8080';
            const resp = await fetch(apiBase + '/convert/pptx', { method: 'POST', body: formData });

            if (!resp.ok) {
                const err = await resp.text();
                throw new Error(err || 'Conversion failed');
            }

            fl.style.width = '90%'; tx.textContent = 'Downloading...';

            const blob = await resp.blob();
            const url = URL.createObjectURL(blob);
            const a = document.createElement('a');
            a.href = url;
            a.download = this.file.name.replace(/\.pptx$/i, '.pdf');
            document.body.appendChild(a);
            a.click();
            document.body.removeChild(a);
            setTimeout(() => URL.revokeObjectURL(url), 10000);

            fl.style.width = '100%'; tx.textContent = 'Done!';
            showToast('PowerPoint converted to PDF!');
        } catch (err) {
            showToast('Error: ' + err.message, 'error');
        }

        btn.disabled = false; btn.innerHTML = '<i class="fas fa-file-pdf"></i> Convert to PDF';
    }
});
