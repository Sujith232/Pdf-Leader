// Merge PDF Tool
ToolRouter.register('merge', {
    title: 'Merge PDF',
    description: 'Combine multiple PDFs into one document in the order you want.',
    files: [],

    init() {
        this.files = [];
        this.render();
    },

    render() {
        const workspace = document.getElementById('toolWorkspace');
        workspace.innerHTML = `
            <div class="upload-area" id="uploadArea">
                <i class="fas fa-cloud-upload-alt"></i>
                <h3>Select PDF files to merge</h3>
                <p>or drag and drop PDF files here</p>
                <button class="upload-btn">Select PDF files</button>
                <input type="file" id="fileInput" accept=".pdf" multiple hidden>
                <p class="file-types">Supported format: PDF</p>
            </div>
            <div class="file-list" id="fileList" style="display:none;"></div>
            <div class="options-panel" id="optionsPanel" style="display:none;">
                <h3>Merge Options</h3>
                <p style="color: var(--text-light); font-size: 0.9rem;">Drag and drop files to reorder them before merging.</p>
            </div>
            <div class="action-section" id="actionSection" style="display:none;">
                <button class="process-btn" id="mergeBtn">
                    <i class="fas fa-object-group"></i> Merge PDF
                </button>
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
            this.addFiles(Array.from(e.dataTransfer.files).filter(f => f.type === 'application/pdf'));
        });
        fileInput.addEventListener('change', (e) => this.addFiles(Array.from(e.target.files)));
    },

    addFiles(newFiles) {
        this.files = [...this.files, ...newFiles];
        this.updateFileList();
    },

    updateFileList() {
        const fileList = document.getElementById('fileList');
        const optionsPanel = document.getElementById('optionsPanel');
        const actionSection = document.getElementById('actionSection');

        if (this.files.length === 0) {
            fileList.style.display = 'none';
            optionsPanel.style.display = 'none';
            actionSection.style.display = 'none';
            return;
        }

        fileList.style.display = 'block';
        optionsPanel.style.display = 'block';
        actionSection.style.display = 'block';

        fileList.innerHTML = '';
        this.files.forEach((file, index) => {
            const item = createFileItem(file, index, (i) => {
                this.files.splice(i, 1);
                this.updateFileList();
            });
            fileList.appendChild(item);
        });

        // Make sortable
        new Sortable(fileList, {
            handle: '.drag-handle',
            animation: 150,
            onEnd: (evt) => {
                const [moved] = this.files.splice(evt.oldIndex, 1);
                this.files.splice(evt.newIndex, 0, moved);
            }
        });

        document.getElementById('mergeBtn').onclick = () => this.process();
    },

    async process() {
        const btn = document.getElementById('mergeBtn');
        btn.disabled = true;
        btn.innerHTML = '<span class="spinner"></span> Merging...';

        try {
            const mergedPdf = await PDFLib.PDFDocument.create();

            for (const file of this.files) {
                const arrayBuffer = await readFileAsArrayBuffer(file);
                const pdf = await PDFLib.PDFDocument.load(arrayBuffer);
                const pages = await mergedPdf.copyPages(pdf, pdf.getPageIndices());
                pages.forEach(page => mergedPdf.addPage(page));
            }

            const mergedBytes = await mergedPdf.save();
            downloadBytes(mergedBytes, 'merged.pdf');
            showToast('PDF files merged successfully!');
        } catch (error) {
            showToast('Error merging PDFs: ' + error.message, 'error');
        }

        btn.disabled = false;
        btn.innerHTML = '<i class="fas fa-object-group"></i> Merge PDF';
    }
});
