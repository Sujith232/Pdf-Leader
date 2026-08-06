// Compare PDF Tool
ToolRouter.register('compare', {
    title: 'Compare PDF',
    description: 'Show a side-by-side document comparison and easily spot changes between different file versions.',
    file1: null,
    file2: null,

    init() {
        this.file1 = null;
        this.file2 = null;
        this.render();
    },

    render() {
        const workspace = document.getElementById('toolWorkspace');
        workspace.innerHTML = `
            <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 1rem; margin-bottom: 2rem;">
                <div class="upload-area" id="uploadArea1">
                    <i class="fas fa-cloud-upload-alt"></i>
                    <h3>Original PDF</h3>
                    <p>Select the original document</p>
                    <button class="upload-btn">Select PDF</button>
                    <input type="file" id="fileInput1" accept=".pdf" hidden>
                </div>
                <div class="upload-area" id="uploadArea2">
                    <i class="fas fa-cloud-upload-alt"></i>
                    <h3>Modified PDF</h3>
                    <p>Select the modified document</p>
                    <button class="upload-btn">Select PDF</button>
                    <input type="file" id="fileInput2" accept=".pdf" hidden>
                </div>
            </div>
            <div id="compareResult" style="display:none;">
                <div class="compare-container">
                    <div class="compare-panel">
                        <h4>Original Document</h4>
                        <div id="compareCanvas1"></div>
                    </div>
                    <div class="compare-panel">
                        <h4>Modified Document</h4>
                        <div id="compareCanvas2"></div>
                    </div>
                </div>
                <div class="options-panel" style="margin-top: 1rem;">
                    <h3>Comparison Info</h3>
                    <p id="compareInfo"></p>
                </div>
            </div>
        `;

        this.initUpload('uploadArea1', 'fileInput1', 1);
        this.initUpload('uploadArea2', 'fileInput2', 2);
    },

    initUpload(areaId, inputId, num) {
        const area = document.getElementById(areaId);
        const input = document.getElementById(inputId);
        area.addEventListener('click', () => input.click());
        area.addEventListener('dragover', (e) => { e.preventDefault(); area.classList.add('dragover'); });
        area.addEventListener('dragleave', () => area.classList.remove('dragover'));
        area.addEventListener('drop', (e) => {
            e.preventDefault();
            area.classList.remove('dragover');
            const file = e.dataTransfer.files[0];
            if (file && file.type === 'application/pdf') this.loadFile(file, num);
        });
        input.addEventListener('change', (e) => { if (e.target.files[0]) this.loadFile(e.target.files[0], num); });
    },

    async loadFile(file, num) {
        const arrayBuffer = await readFileAsArrayBuffer(file);
        if (num === 1) {
            this.file1 = file;
            this.pdfBytes1 = new Uint8Array(arrayBuffer);
        } else {
            this.file2 = file;
            this.pdfBytes2 = new Uint8Array(arrayBuffer);
        }

        document.getElementById(`uploadArea${num}`).innerHTML = `
            <i class="fas fa-check-circle" style="color: #22c55e;"></i>
            <h3>${file.name}</h3>
            <p>${formatFileSize(file.size)}</p>
        `;

        if (this.pdfBytes1 && this.pdfBytes2) {
            this.compare();
        }
    },

    async compare() {
        document.getElementById('compareResult').style.display = 'block';

        const container1 = document.getElementById('compareCanvas1');
        const container2 = document.getElementById('compareCanvas2');
        container1.innerHTML = '';
        container2.innerHTML = '';

        const pages1 = await PDFWorker.getPageCount(this.pdfBytes1);
        const pages2 = await PDFWorker.getPageCount(this.pdfBytes2);

        for (let i = 1; i <= Math.min(pages1, 3); i++) {
            const canvas = document.createElement('canvas');
            await PDFWorker.renderPageToCanvas(this.pdfBytes1, i, canvas, 0.5);
            container1.appendChild(canvas);
        }

        for (let i = 1; i <= Math.min(pages2, 3); i++) {
            const canvas = document.createElement('canvas');
            await PDFWorker.renderPageToCanvas(this.pdfBytes2, i, canvas, 0.5);
            container2.appendChild(canvas);
        }

        document.getElementById('compareInfo').innerHTML = `
            <strong>Original:</strong> ${pages1} pages | <strong>Modified:</strong> ${pages2} pages |
            <strong>Page difference:</strong> ${Math.abs(pages1 - pages2)}
        `;

        showToast('Comparison complete!');
    }
});
