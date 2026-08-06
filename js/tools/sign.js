// Sign PDF Tool
ToolRouter.register('sign', {
    title: 'Sign PDF',
    description: 'Sign yourself or request electronic signatures from others.',
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
                <h3>Select a PDF to sign</h3>
                <p>or drag and drop a PDF file here</p>
                <button class="upload-btn">Select PDF file</button>
                <input type="file" id="fileInput" accept=".pdf" hidden>
            </div>
            <div id="signOptions" style="display:none;">
                <div class="page-preview-container" id="pagePreview"></div>
                <div class="signature-pad-container">
                    <h3>Draw Your Signature</h3>
                    <canvas id="signaturePad" class="signature-pad" width="400" height="150"></canvas>
                    <div class="signature-actions">
                        <button id="clearSignature"><i class="fas fa-eraser"></i> Clear</button>
                        <button id="undoSignature"><i class="fas fa-undo"></i> Undo</button>
                    </div>
                </div>
                <div class="options-panel">
                    <h3>Signature Options</h3>
                    <div class="option-row">
                        <div class="option-group">
                            <label>Page:</label>
                            <select id="signPage"></select>
                        </div>
                        <div class="option-group">
                            <label>Position X:</label>
                            <input type="number" id="signX" value="100">
                        </div>
                        <div class="option-group">
                            <label>Position Y:</label>
                            <input type="number" id="signY" value="100">
                        </div>
                    </div>
                    <div class="option-group">
                        <label>Width:</label>
                        <input type="number" id="signWidth" value="150" min="50" max="400">
                    </div>
                </div>
                <div class="action-section">
                    <button class="process-btn" id="signBtn">
                        <i class="fas fa-signature"></i> Sign PDF
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
        document.getElementById('signOptions').style.display = 'block';

        const pageCount = await PDFWorker.getPageCount(this.pdfBytes);
        const pageSelect = document.getElementById('signPage');
        for (let i = 1; i <= pageCount; i++) {
            pageSelect.innerHTML += `<option value="${i}">Page ${i}</option>`;
        }

        const preview = document.getElementById('pagePreview');
        preview.innerHTML = `<h3>Document (${pageCount} pages)</h3>`;
        const canvas = document.createElement('canvas');
        await PDFWorker.renderPageToCanvas(this.pdfBytes, 1, canvas, 0.5);
        canvas.style.maxWidth = '200px';
        preview.appendChild(canvas);

        this.initSignaturePad();
        document.getElementById('signBtn').onclick = () => this.process();
    },

    initSignaturePad() {
        const canvas = document.getElementById('signaturePad');
        const ctx = canvas.getContext('2d');
        let drawing = false;
        let lastX = 0;
        let lastY = 0;
        let paths = [];
        let currentPath = [];
        let hasDrawn = false;

        ctx.strokeStyle = '#000';
        ctx.lineWidth = 2;
        ctx.lineCap = 'round';

        const getPos = (e) => {
            const rect = canvas.getBoundingClientRect();
            const scaleX = canvas.width / rect.width;
            const scaleY = canvas.height / rect.height;
            return {
                x: ((e.clientX || e.touches[0].clientX) - rect.left) * scaleX,
                y: ((e.clientY || e.touches[0].clientY) - rect.top) * scaleY
            };
        };

        const startDraw = (e) => {
            drawing = true;
            const pos = getPos(e);
            lastX = pos.x;
            lastY = pos.y;
            currentPath = [{ x: pos.x, y: pos.y }];
        };

        const draw = (e) => {
            if (!drawing) return;
            e.preventDefault();
            const pos = getPos(e);
            ctx.beginPath();
            ctx.moveTo(lastX, lastY);
            ctx.lineTo(pos.x, pos.y);
            ctx.stroke();
            lastX = pos.x;
            lastY = pos.y;
            currentPath.push({ x: pos.x, y: pos.y });
            hasDrawn = true;
        };

        const endDraw = () => {
            if (currentPath.length > 0) {
                paths.push([...currentPath]);
                currentPath = [];
            }
            drawing = false;
        };

        canvas.addEventListener('mousedown', startDraw);
        canvas.addEventListener('mousemove', draw);
        canvas.addEventListener('mouseup', endDraw);
        canvas.addEventListener('mouseleave', endDraw);
        canvas.addEventListener('touchstart', startDraw);
        canvas.addEventListener('touchmove', draw);
        canvas.addEventListener('touchend', endDraw);

        document.getElementById('clearSignature').addEventListener('click', () => {
            ctx.clearRect(0, 0, canvas.width, canvas.height);
            paths = [];
            hasDrawn = false;
        });

        document.getElementById('undoSignature').addEventListener('click', () => {
            if (paths.length > 0) {
                paths.pop();
                ctx.clearRect(0, 0, canvas.width, canvas.height);
                if (paths.length === 0) hasDrawn = false;
                paths.forEach(path => {
                    if (path.length < 2) return;
                    ctx.beginPath();
                    ctx.moveTo(path[0].x, path[0].y);
                    for (let i = 1; i < path.length; i++) {
                        ctx.lineTo(path[i].x, path[i].y);
                    }
                    ctx.stroke();
                });
            }
        });

        this.isCanvasBlank = () => !hasDrawn;
    },

    async process() {
        const btn = document.getElementById('signBtn');

        if (this.isCanvasBlank && this.isCanvasBlank()) {
            showToast('Please draw your signature first', 'error');
            return;
        }

        btn.disabled = true;
        btn.innerHTML = '<span class="spinner"></span> Signing...';

        try {
            const canvas = document.getElementById('signaturePad');

            // Convert canvas to Uint8Array for pdf-lib
            const dataUrl = canvas.toDataURL('image/png');
            const base64 = dataUrl.split(',')[1];
            const binaryString = atob(base64);
            const bytes = new Uint8Array(binaryString.length);
            for (let i = 0; i < binaryString.length; i++) {
                bytes[i] = binaryString.charCodeAt(i);
            }

            const pdf = await PDFLib.PDFDocument.load(this.pdfBytes);
            const signatureImage = await pdf.embedPng(bytes);

            const pageIndex = parseInt(document.getElementById('signPage').value) - 1;
            const page = pdf.getPage(pageIndex);
            const { width: pageWidth, height: pageHeight } = page.getSize();
            const x = parseInt(document.getElementById('signX').value);
            const width = parseInt(document.getElementById('signWidth').value);
            const height = width * (canvas.height / canvas.width);
            const y = pageHeight - parseInt(document.getElementById('signY').value) - height;

            page.drawImage(signatureImage, {
                x, y,
                width,
                height,
            });

            const signedBytes = await pdf.save();
            downloadBytes(signedBytes, 'signed.pdf');
            showToast('PDF signed successfully!');
        } catch (error) {
            showToast('Error signing PDF: ' + error.message, 'error');
        }

        btn.disabled = false;
        btn.innerHTML = '<i class="fas fa-signature"></i> Sign PDF';
    }
});
