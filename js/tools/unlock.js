// Unlock PDF Tool
ToolRouter.register('unlock', {
    title: 'Unlock PDF',
    description: 'Remove PDF password security, giving you the freedom to use your PDFs as you want.',
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
                <h3>Select a protected PDF to unlock</h3>
                <p>or drag and drop a PDF file here</p>
                <button class="upload-btn">Select PDF file</button>
                <input type="file" id="fileInput" accept=".pdf" hidden>
            </div>
            <div id="unlockOptions" style="display:none;">
                <div class="file-list" id="fileInfo"></div>
                <div class="options-panel">
                    <h3>Enter Password</h3>
                    <p style="color: var(--text-light); font-size: 0.9rem; margin-bottom: 1rem;">This PDF is password protected. Enter the password to unlock it.</p>
                    <div class="option-group">
                        <label>Password:</label>
                        <input type="password" id="unlockPassword" placeholder="Enter the PDF password" style="width: 100%;">
                    </div>
                </div>
                <div class="action-section">
                    <button class="process-btn" id="unlockBtn">
                        <i class="fas fa-lock-open"></i> Unlock PDF
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
        document.getElementById('unlockOptions').style.display = 'block';

        // Show file info
        document.getElementById('fileInfo').innerHTML = `
            <div class="file-item">
                <div class="file-icon"><i class="fas fa-lock"></i></div>
                <div class="file-info">
                    <div class="file-name">${file.name}</div>
                    <div class="file-size">${formatFileSize(file.size)}</div>
                </div>
            </div>
        `;

        document.getElementById('unlockBtn').onclick = () => this.process();

        // Allow pressing Enter in password field
        document.getElementById('unlockPassword').addEventListener('keypress', (e) => {
            if (e.key === 'Enter') this.process();
        });
    },

    async process() {
        const btn = document.getElementById('unlockBtn');
        const password = document.getElementById('unlockPassword').value;

        if (!password) {
            showToast('Please enter the password', 'error');
            document.getElementById('unlockPassword').focus();
            return;
        }

        btn.disabled = true;
        btn.innerHTML = '<span class="spinner"></span> Unlocking...';

        try {
            const arrayBuffer = await readFileAsArrayBuffer(this.file);

            // Load PDF with password to decrypt it
            const encryptedPdf = await PDFLib.PDFDocument.load(arrayBuffer, {
                password: password
            });

            // Create a brand new PDF without any encryption
            const cleanPdf = await PDFLib.PDFDocument.create();

            // Copy all pages from decrypted PDF to new clean PDF
            const pageIndices = encryptedPdf.getPageIndices();
            const copiedPages = await cleanPdf.copyPages(encryptedPdf, pageIndices);
            copiedPages.forEach(page => cleanPdf.addPage(page));

            // Copy metadata
            cleanPdf.setTitle(encryptedPdf.getTitle() || '');
            cleanPdf.setAuthor(encryptedPdf.getAuthor() || '');
            cleanPdf.setSubject(encryptedPdf.getSubject() || '');
            cleanPdf.setKeywords(encryptedPdf.getKeywords() || []);
            cleanPdf.setProducer(encryptedPdf.getProducer() || 'PDF Leader');
            cleanPdf.setCreator(encryptedPdf.getCreator() || 'PDF Leader');

            // Save the clean PDF - no encryption at all
            const unlockedBytes = await cleanPdf.save();

            downloadBytes(unlockedBytes, 'unlocked.pdf');
            showToast('PDF unlocked! Password removed completely.');
        } catch (error) {
            if (error.message && error.message.toLowerCase().includes('password')) {
                showToast('Wrong password! Please try again.', 'error');
            } else {
                showToast('Error: ' + error.message, 'error');
            }
        }

        btn.disabled = false;
        btn.innerHTML = '<i class="fas fa-lock-open"></i> Unlock PDF';
    }
});
