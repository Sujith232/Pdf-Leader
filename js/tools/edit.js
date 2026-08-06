// Edit PDF Tool
ToolRouter.register('edit', {
    title: 'Edit PDF',
    description: 'Add text, images, shapes or freehand annotations to a PDF document.',
    file: null,
    currentPage: 1,
    annotations: {},
    currentTool: 'text',
    drawPaths: {},

    init() {
        this.file = null;
        this.currentPage = 1;
        this.annotations = {};
        this.drawPaths = {};
        this.render();
    },

    render() {
        const workspace = document.getElementById('toolWorkspace');
        workspace.innerHTML = `
            <div class="upload-area" id="uploadArea">
                <i class="fas fa-cloud-upload-alt"></i>
                <h3>Select a PDF to edit</h3>
                <p>or drag and drop a PDF file here</p>
                <button class="upload-btn">Select PDF file</button>
                <input type="file" id="fileInput" accept=".pdf" hidden>
            </div>
            <div id="editOptions" style="display:none;">
                <div class="edit-tools">
                    <button class="edit-tool-btn active" data-tool="text"><i class="fas fa-font"></i> Text</button>
                    <button class="edit-tool-btn" data-tool="draw"><i class="fas fa-pen"></i> Draw</button>
                    <button class="edit-tool-btn" data-tool="rect"><i class="fas fa-square"></i> Rectangle</button>
                    <button class="edit-tool-btn" data-tool="circle"><i class="fas fa-circle"></i> Circle</button>
                    <button class="edit-tool-btn" data-tool="line"><i class="fas fa-minus"></i> Line</button>
                </div>
                <div class="options-panel" id="editToolOptions">
                    <div class="option-row">
                        <div class="color-picker-group">
                            <label>Color:</label>
                            <input type="color" id="editColor" value="#000000">
                        </div>
                        <div class="option-group">
                            <label>Size:</label>
                            <input type="number" id="editSize" value="12" min="6" max="72" style="width: 60px;">
                        </div>
                        <div class="option-group" id="textInputGroup">
                            <label>Text:</label>
                            <input type="text" id="editText" placeholder="Enter text" style="width: 200px;">
                        </div>
                    </div>
                </div>
                <div class="page-preview-container">
                    <h3>Page <span id="currentPageNum">1</span> of <span id="totalPages">1</span></h3>
                    <div style="display: flex; gap: 0.5rem; margin-bottom: 1rem;">
                        <button class="btn btn-outline" id="prevPage" style="padding: 0.3rem 0.8rem;"><i class="fas fa-chevron-left"></i></button>
                        <button class="btn btn-outline" id="nextPage" style="padding: 0.3rem 0.8rem;"><i class="fas fa-chevron-right"></i></button>
                    </div>
                    <div style="position: relative; display: inline-block;">
                        <canvas id="editCanvas" style="border: 1px solid var(--border); cursor: crosshair;"></canvas>
                    </div>
                </div>
                <div class="action-section">
                    <button class="process-btn" id="editSaveBtn">
                        <i class="fas fa-save"></i> Save PDF
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
        this.pageCount = await PDFWorker.getPageCount(this.pdfBytes);
        this.currentPage = 1;
        this.annotations = {};
        this.drawPaths = {};

        document.getElementById('uploadArea').style.display = 'none';
        document.getElementById('editOptions').style.display = 'block';
        document.getElementById('totalPages').textContent = this.pageCount;

        document.querySelectorAll('.edit-tool-btn').forEach(btn => {
            btn.addEventListener('click', () => {
                document.querySelectorAll('.edit-tool-btn').forEach(b => b.classList.remove('active'));
                btn.classList.add('active');
                this.currentTool = btn.dataset.tool;
                document.getElementById('textInputGroup').style.display = this.currentTool === 'text' ? 'block' : 'none';
            });
        });

        this.currentTool = 'text';
        document.getElementById('textInputGroup').style.display = 'block';

        await this.renderPage();
        this.initCanvas();

        document.getElementById('prevPage').addEventListener('click', () => {
            if (this.currentPage > 1) {
                this.currentPage--;
                this.renderPage();
                document.getElementById('currentPageNum').textContent = this.currentPage;
            }
        });

        document.getElementById('nextPage').addEventListener('click', () => {
            if (this.currentPage < this.pageCount) {
                this.currentPage++;
                this.renderPage();
                document.getElementById('currentPageNum').textContent = this.currentPage;
            }
        });

        document.getElementById('editSaveBtn').onclick = () => this.process();
    },

    async renderPage() {
        const canvas = document.getElementById('editCanvas');
        await PDFWorker.renderPageToCanvas(this.pdfBytes, this.currentPage, canvas, 1);
        const ctx = canvas.getContext('2d');

        // Redraw annotations for this page
        const anns = this.annotations[this.currentPage] || [];
        anns.forEach(ann => this.drawAnnotation(ctx, ann));

        // Redraw draw paths for this page
        const paths = this.drawPaths[this.currentPage] || [];
        paths.forEach(pathData => {
            if (pathData.points.length < 2) return;
            ctx.strokeStyle = pathData.color;
            ctx.lineWidth = pathData.size;
            ctx.lineCap = 'round';
            ctx.beginPath();
            ctx.moveTo(pathData.points[0].x, pathData.points[0].y);
            for (let i = 1; i < pathData.points.length; i++) {
                ctx.lineTo(pathData.points[i].x, pathData.points[i].y);
            }
            ctx.stroke();
        });
    },

    initCanvas() {
        const canvas = document.getElementById('editCanvas');
        const ctx = canvas.getContext('2d');
        let drawing = false;
        let startX, startY;
        let tempCanvas = null;
        let currentDrawPoints = [];

        const getPos = (e) => {
            const rect = canvas.getBoundingClientRect();
            const scaleX = canvas.width / rect.width;
            const scaleY = canvas.height / rect.height;
            return {
                x: (e.clientX - rect.left) * scaleX,
                y: (e.clientY - rect.top) * scaleY
            };
        };

        canvas.addEventListener('mousedown', (e) => {
            const pos = getPos(e);
            drawing = true;
            startX = pos.x;
            startY = pos.y;
            currentDrawPoints = [{ x: pos.x, y: pos.y }];

            if (this.currentTool === 'draw') {
                ctx.beginPath();
                ctx.moveTo(pos.x, pos.y);
            } else if (this.currentTool === 'text') {
                const text = document.getElementById('editText').value || 'Text';
                const color = document.getElementById('editColor').value;
                const size = parseInt(document.getElementById('editSize').value);

                ctx.fillStyle = color;
                ctx.font = `${size}px Arial`;
                ctx.fillText(text, pos.x, pos.y);

                if (!this.annotations[this.currentPage]) this.annotations[this.currentPage] = [];
                this.annotations[this.currentPage].push({
                    type: 'text', x: pos.x, y: pos.y, text, color, size
                });
                drawing = false;
            } else {
                tempCanvas = ctx.getImageData(0, 0, canvas.width, canvas.height);
            }
        });

        canvas.addEventListener('mousemove', (e) => {
            if (!drawing) return;
            const pos = getPos(e);
            const color = document.getElementById('editColor').value;
            const size = parseInt(document.getElementById('editSize').value);

            if (this.currentTool === 'draw') {
                ctx.strokeStyle = color;
                ctx.lineWidth = size / 3;
                ctx.lineCap = 'round';
                ctx.lineTo(pos.x, pos.y);
                ctx.stroke();
                currentDrawPoints.push({ x: pos.x, y: pos.y });
            } else if (tempCanvas) {
                ctx.putImageData(tempCanvas, 0, 0);
                ctx.strokeStyle = color;
                ctx.lineWidth = 2;

                if (this.currentTool === 'rect') {
                    ctx.strokeRect(startX, startY, pos.x - startX, pos.y - startY);
                } else if (this.currentTool === 'circle') {
                    const rx = Math.abs(pos.x - startX) / 2;
                    const ry = Math.abs(pos.y - startY) / 2;
                    const cx = startX + (pos.x - startX) / 2;
                    const cy = startY + (pos.y - startY) / 2;
                    ctx.beginPath();
                    ctx.ellipse(cx, cy, rx, ry, 0, 0, Math.PI * 2);
                    ctx.stroke();
                } else if (this.currentTool === 'line') {
                    ctx.beginPath();
                    ctx.moveTo(startX, startY);
                    ctx.lineTo(pos.x, pos.y);
                    ctx.stroke();
                }
            }
        });

        const endDraw = (e) => {
            if (!drawing) return;
            drawing = false;
            const pos = getPos(e);
            const color = document.getElementById('editColor').value;

            if (!this.annotations[this.currentPage]) this.annotations[this.currentPage] = [];

            if (this.currentTool === 'draw') {
                if (!this.drawPaths[this.currentPage]) this.drawPaths[this.currentPage] = [];
                this.drawPaths[this.currentPage].push({
                    color,
                    size: parseInt(document.getElementById('editSize').value) / 3,
                    points: [...currentDrawPoints]
                });
                currentDrawPoints = [];
            } else if (this.currentTool !== 'text') {
                this.annotations[this.currentPage].push({
                    type: this.currentTool, startX, startY, endX: pos.x, endY: pos.y, color
                });
            }
            tempCanvas = null;
        };

        canvas.addEventListener('mouseup', endDraw);
        canvas.addEventListener('mouseleave', endDraw);
    },

    drawAnnotation(ctx, ann) {
        ctx.strokeStyle = ann.color;
        ctx.fillStyle = ann.color;

        if (ann.type === 'text') {
            ctx.font = `${ann.size}px Arial`;
            ctx.fillText(ann.text, ann.x, ann.y);
        } else if (ann.type === 'rect') {
            ctx.strokeRect(ann.startX, ann.startY, ann.endX - ann.startX, ann.endY - ann.startY);
        } else if (ann.type === 'circle') {
            const rx = Math.abs(ann.endX - ann.startX) / 2;
            const ry = Math.abs(ann.endY - ann.startY) / 2;
            const cx = ann.startX + (ann.endX - ann.startX) / 2;
            const cy = ann.startY + (ann.endY - ann.startY) / 2;
            ctx.beginPath();
            ctx.ellipse(cx, cy, rx, ry, 0, 0, Math.PI * 2);
            ctx.stroke();
        } else if (ann.type === 'line') {
            ctx.beginPath();
            ctx.moveTo(ann.startX, ann.startY);
            ctx.lineTo(ann.endX, ann.endY);
            ctx.stroke();
        }
    },

    async process() {
        const btn = document.getElementById('editSaveBtn');
        btn.disabled = true;
        btn.innerHTML = '<span class="spinner"></span> Saving...';

        try {
            const pdf = await PDFLib.PDFDocument.load(this.pdfBytes);

            // Collect all pages that have annotations or draw paths
            const allAnnotatedPages = new Set();
            Object.keys(this.annotations).forEach(k => allAnnotatedPages.add(parseInt(k)));
            Object.keys(this.drawPaths).forEach(k => allAnnotatedPages.add(parseInt(k)));

            for (const pageNum of allAnnotatedPages) {
                const pageIdx = pageNum - 1;
                const page = pdf.getPage(pageIdx);
                const { width, height } = page.getSize();

                // Render page to temp canvas
                const tempCanvas = document.createElement('canvas');
                await PDFWorker.renderPageToCanvas(this.pdfBytes, pageNum, tempCanvas, 1);
                const tempCtx = tempCanvas.getContext('2d');

                // Draw annotations on temp canvas
                const anns = this.annotations[pageNum] || [];
                anns.forEach(ann => this.drawAnnotation(tempCtx, ann));

                // Draw paths on temp canvas
                const paths = this.drawPaths[pageNum] || [];
                paths.forEach(pathData => {
                    if (pathData.points.length < 2) return;
                    tempCtx.strokeStyle = pathData.color;
                    tempCtx.lineWidth = pathData.size;
                    tempCtx.lineCap = 'round';
                    tempCtx.beginPath();
                    tempCtx.moveTo(pathData.points[0].x, pathData.points[0].y);
                    for (let i = 1; i < pathData.points.length; i++) {
                        tempCtx.lineTo(pathData.points[i].x, pathData.points[i].y);
                    }
                    tempCtx.stroke();
                });

                // Convert canvas to image and overlay on PDF page
                const dataUrl = tempCanvas.toDataURL('image/png');
                const base64 = dataUrl.split(',')[1];
                const bytes = Uint8Array.from(atob(base64), c => c.charCodeAt(0));
                const image = await pdf.embedPng(bytes);
                page.drawImage(image, { x: 0, y: 0, width, height });
            }

            const editedBytes = await pdf.save();
            downloadBytes(editedBytes, 'edited.pdf');
            showToast('PDF saved successfully!');
        } catch (error) {
            showToast('Error saving PDF: ' + error.message, 'error');
        }

        btn.disabled = false;
        btn.innerHTML = '<i class="fas fa-save"></i> Save PDF';
    }
});
