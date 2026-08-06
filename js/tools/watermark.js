// Watermark Tool
ToolRouter.register('watermark', {
    title: 'Add Watermark',
    description: 'Stamp an image or text over your PDF. Choose typography, transparency and position.',
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
                <h3>Select a PDF to add watermark</h3>
                <p>or drag and drop a PDF file here</p>
                <button class="upload-btn">Select PDF file</button>
                <input type="file" id="fileInput" accept=".pdf" hidden>
            </div>
            <div id="watermarkOptions" style="display:none;">
                <div class="page-preview-container" id="pagePreview"></div>
                <div class="options-panel">
                    <h3>Watermark Options</h3>
                    <div class="option-group">
                        <label>Watermark Type:</label>
                        <div class="radio-group">
                            <label class="radio-option"><input type="radio" name="wmType" value="text" checked> Text</label>
                            <label class="radio-option"><input type="radio" name="wmType" value="image"> Image</label>
                        </div>
                    </div>
                    <div id="textWatermarkOptions">
                        <div class="option-group">
                            <label>Text:</label>
                            <input type="text" id="wmText" value="CONFIDENTIAL" style="width: 100%;">
                        </div>
                        <div class="option-row">
                            <div class="option-group">
                                <label>Font Size:</label>
                                <input type="number" id="wmFontSize" value="50" min="10" max="200">
                            </div>
                            <div class="option-group">
                                <label>Color:</label>
                                <input type="color" id="wmColor" value="#cccccc">
                            </div>
                        </div>
                    </div>
                    <div id="imageWatermarkOptions" style="display:none;">
                        <div class="option-group">
                            <label>Select Image:</label>
                            <input type="file" id="wmImage" accept="image/*">
                        </div>
                    </div>
                    <div class="option-row">
                        <div class="option-group">
                            <label>Position:</label>
                            <select id="wmPosition">
                                <option value="center" selected>Center</option>
                                <option value="top-left">Top Left</option>
                                <option value="top-right">Top Right</option>
                                <option value="bottom-left">Bottom Left</option>
                                <option value="bottom-right">Bottom Right</option>
                                <option value="diagonal">Diagonal</option>
                            </select>
                        </div>
                        <div class="option-group">
                            <label>Opacity:</label>
                            <input type="range" id="wmOpacity" min="0.1" max="1" step="0.1" value="0.3" style="width: 100%;">
                        </div>
                    </div>
                    <div class="option-group">
                        <label>Rotation:</label>
                        <input type="range" id="wmRotation" min="0" max="360" value="0" style="width: 100%;">
                    </div>
                </div>
                <div class="action-section">
                    <button class="process-btn" id="watermarkBtn">
                        <i class="fas fa-tint"></i> Add Watermark
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

        document.querySelectorAll('input[name="wmType"]').forEach(radio => {
            radio.addEventListener('change', (e) => {
                document.getElementById('textWatermarkOptions').style.display = e.target.value === 'text' ? 'block' : 'none';
                document.getElementById('imageWatermarkOptions').style.display = e.target.value === 'image' ? 'block' : 'none';
            });
        });
    },

    async loadFile(file) {
        this.file = file;
        const arrayBuffer = await readFileAsArrayBuffer(file);
        this.pdfBytes = new Uint8Array(arrayBuffer);
        document.getElementById('uploadArea').style.display = 'none';
        document.getElementById('watermarkOptions').style.display = 'block';

        const pageCount = await PDFWorker.getPageCount(this.pdfBytes);
        const preview = document.getElementById('pagePreview');
        preview.innerHTML = `<h3>Document (${pageCount} pages)</h3>`;
        const canvas = document.createElement('canvas');
        await PDFWorker.renderPageToCanvas(this.pdfBytes, 1, canvas, 0.5);
        canvas.style.maxWidth = '200px';
        preview.appendChild(canvas);

        document.getElementById('watermarkBtn').onclick = () => this.process();
    },

    async process() {
        const btn = document.getElementById('watermarkBtn');
        btn.disabled = true;
        btn.innerHTML = '<span class="spinner"></span> Adding watermark...';

        try {
            const pdf = await PDFLib.PDFDocument.load(this.pdfBytes);
            const pages = pdf.getPages();
            const type = document.querySelector('input[name="wmType"]:checked').value;
            const position = document.getElementById('wmPosition').value;
            const opacity = parseFloat(document.getElementById('wmOpacity').value);
            const rotation = parseInt(document.getElementById('wmRotation').value);

            if (type === 'text') {
                const text = document.getElementById('wmText').value;
                const fontSize = parseInt(document.getElementById('wmFontSize').value);
                const colorHex = document.getElementById('wmColor').value;
                const r = parseInt(colorHex.slice(1, 3), 16) / 255;
                const g = parseInt(colorHex.slice(3, 5), 16) / 255;
                const b = parseInt(colorHex.slice(5, 7), 16) / 255;

                const font = await pdf.embedFont(PDFLib.StandardFonts.HelveticaBold);

                pages.forEach(page => {
                    const { width, height } = page.getSize();
                    const textWidth = font.widthOfTextAtSize(text, fontSize);
                    let x, y;

                    if (position === 'center') {
                        x = (width - textWidth) / 2;
                        y = height / 2;
                    } else if (position === 'diagonal') {
                        x = width / 2 - textWidth / 2;
                        y = height / 2;
                    } else if (position.includes('top')) {
                        y = height - 50;
                        x = position.includes('left') ? 50 : width - textWidth - 50;
                    } else {
                        y = 50;
                        x = position.includes('left') ? 50 : width - textWidth - 50;
                    }

                    page.drawText(text, {
                        x, y,
                        size: fontSize,
                        font,
                        color: PDFLib.rgb(r * opacity + (1 - opacity), g * opacity + (1 - opacity), b * opacity + (1 - opacity)),
                        rotate: PDFLib.degrees(position === 'diagonal' ? 45 : rotation),
                    });
                });
            } else if (type === 'image') {
                const imageFile = document.getElementById('wmImage').files[0];
                if (!imageFile) {
                    showToast('Please select an image for watermark', 'error');
                    return;
                }
                const imageBytes = await readFileAsArrayBuffer(imageFile);
                const isPng = imageFile.type === 'image/png';
                const image = isPng
                    ? await pdf.embedPng(new Uint8Array(imageBytes))
                    : await pdf.embedJpg(new Uint8Array(imageBytes));

                const imgWidth = 200;
                const imgHeight = (image.height / image.width) * imgWidth;

                pages.forEach(page => {
                    const { width, height } = page.getSize();
                    let x, y;

                    if (position === 'diagonal') {
                        x = (width - imgWidth) / 2;
                        y = (height - imgHeight) / 2;
                    } else if (position === 'center') {
                        x = (width - imgWidth) / 2;
                        y = (height - imgHeight) / 2;
                    } else if (position.includes('top')) {
                        y = height - imgHeight - 50;
                        x = position.includes('left') ? 50 : width - imgWidth - 50;
                    } else {
                        y = 50;
                        x = position.includes('left') ? 50 : width - imgWidth - 50;
                    }

                    const rot = position === 'diagonal' ? 45 : rotation;

                    page.drawImage(image, {
                        x, y,
                        width: imgWidth,
                        height: imgHeight,
                        opacity,
                        rotate: PDFLib.degrees(rot),
                    });
                });
            }

            const watermarkedBytes = await pdf.save();
            downloadBytes(watermarkedBytes, 'watermarked.pdf');
            showToast('Watermark added successfully!');
        } catch (error) {
            showToast('Error adding watermark: ' + error.message, 'error');
        }

        btn.disabled = false;
        btn.innerHTML = '<i class="fas fa-tint"></i> Add Watermark';
    }
});
