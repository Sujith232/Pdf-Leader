// JPG to PDF Tool
ToolRouter.register('jpg-to-pdf', {
    title: 'JPG to PDF',
    description: 'Convert JPG images to PDF in seconds. Easily adjust orientation and margins.',
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
                <h3>Select JPG images to convert</h3>
                <p>or drag and drop image files here</p>
                <button class="upload-btn">Select Images</button>
                <input type="file" id="fileInput" accept="image/*" multiple hidden>
                <p class="file-types">Supported formats: JPG, PNG, GIF, BMP</p>
            </div>
            <div class="file-list" id="fileList" style="display:none;"></div>
            <div class="options-panel" id="optionsPanel" style="display:none;">
                <h3>Conversion Options</h3>
                <div class="option-row">
                    <div class="option-group">
                        <label>Page size:</label>
                        <select id="pageSize">
                            <option value="fit" selected>Fit to image</option>
                            <option value="a4">A4</option>
                            <option value="letter">Letter</option>
                            <option value="legal">Legal</option>
                        </select>
                    </div>
                    <div class="option-group">
                        <label>Orientation:</label>
                        <select id="orientation">
                            <option value="auto" selected>Auto detect</option>
                            <option value="portrait">Portrait</option>
                            <option value="landscape">Landscape</option>
                        </select>
                    </div>
                </div>
                <div class="option-row">
                    <div class="option-group">
                        <label>Margin (px):</label>
                        <input type="number" id="margin" value="0" min="0" max="100">
                    </div>
                </div>
            </div>
            <div class="action-section" id="actionSection" style="display:none;">
                <button class="process-btn" id="convertBtn">
                    <i class="fas fa-file-pdf"></i> Convert to PDF
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
            const files = Array.from(e.dataTransfer.files).filter(f => f.type.startsWith('image/'));
            this.addFiles(files);
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
            item.querySelector('.file-icon').innerHTML = '<i class="fas fa-file-image"></i>';
            fileList.appendChild(item);
        });

        new Sortable(fileList, {
            handle: '.drag-handle',
            animation: 150,
            onEnd: (evt) => {
                const [moved] = this.files.splice(evt.oldIndex, 1);
                this.files.splice(evt.newIndex, 0, moved);
            }
        });

        document.getElementById('convertBtn').onclick = () => this.process();
    },

    async process() {
        const btn = document.getElementById('convertBtn');
        btn.disabled = true;
        btn.innerHTML = '<span class="spinner"></span> Converting...';

        try {
            const { jsPDF } = window.jspdf;
            const pageSize = document.getElementById('pageSize').value;
            const orientation = document.getElementById('orientation').value;
            const margin = parseInt(document.getElementById('margin').value);

            let pdf = null;

            for (let i = 0; i < this.files.length; i++) {
                const file = this.files[i];
                const imgData = await readFileAsDataURL(file);

                const img = new Image();
                await new Promise((resolve) => {
                    img.onload = resolve;
                    img.src = imgData;
                });

                let imgOrientation = orientation;
                if (imgOrientation === 'auto') {
                    imgOrientation = img.width > img.height ? 'landscape' : 'portrait';
                }

                if (i === 0) {
                    // Create PDF with first image's settings
                    const format = pageSize === 'fit' ? undefined : pageSize;
                    pdf = new jsPDF({
                        orientation: imgOrientation,
                        unit: 'px',
                        format: format || [img.width + margin * 2, img.height + margin * 2],
                    });
                } else {
                    // Add new page for subsequent images
                    pdf.addPage();
                }

                if (pageSize !== 'fit') {
                    const pageWidth = pdf.internal.pageSize.getWidth();
                    const pageHeight = pdf.internal.pageSize.getHeight();
                    const scale = Math.min(
                        (pageWidth - margin * 2) / img.width,
                        (pageHeight - margin * 2) / img.height
                    );
                    const w = img.width * scale;
                    const h = img.height * scale;
                    const x = (pageWidth - w) / 2;
                    const y = (pageHeight - h) / 2;
                    pdf.addImage(imgData, 'JPEG', x, y, w, h, undefined, 'MEDIUM');
                } else {
                    pdf.addImage(imgData, 'JPEG', margin, margin, img.width, img.height, undefined, 'MEDIUM');
                }
            }

            pdf.save('images.pdf');
            showToast('Images converted to PDF successfully!');
        } catch (error) {
            showToast('Error converting images: ' + error.message, 'error');
        }

        btn.disabled = false;
        btn.innerHTML = '<i class="fas fa-file-pdf"></i> Convert to PDF';
    }
});
