// Excel to PDF Tool
ToolRouter.register('excel-to-pdf', {
    title: 'Excel to PDF',
    description: 'Make EXCEL spreadsheets easy to read by converting them to PDF.',
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
                <h3>Select an Excel file to convert</h3>
                <p>or drag and drop an Excel file here</p>
                <button class="upload-btn">Select Excel file</button>
                <input type="file" id="fileInput" accept=".csv,.xlsx" hidden>
                <p class="file-types">Supported formats: CSV, XLSX</p>
            </div>
            <div id="excelOptions" style="display:none;">
                <div id="fileInfo" class="file-list"></div>
                <div class="options-panel">
                    <h3>Sheet Info</h3>
                    <div id="sheetInfo"></div>
                </div>
                <div class="progress-container" id="progressArea" style="display:none;">
                    <div class="progress-bar"><div class="progress-fill" id="progressFill"></div></div>
                    <p class="progress-text" id="progressText">Converting...</p>
                </div>
                <div class="action-section">
                    <button class="process-btn" id="excelConvertBtn">
                        <i class="fas fa-file-pdf"></i> Convert to PDF
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
                if (file.name.endsWith('.csv') || file.name.endsWith('.xlsx')) self.loadFile(file);
                else showToast('Please select a CSV or XLSX file', 'error');
            }
        };
        fileInput.onchange = (e) => { if (e.target.files.length > 0) self.loadFile(e.target.files[0]); };
    },

    async loadFile(file) {
        this.file = file;
        document.getElementById('uploadArea').style.display = 'none';
        document.getElementById('excelOptions').style.display = 'block';
        document.getElementById('fileInfo').innerHTML = `
            <div class="file-item">
                <div class="file-icon"><i class="fas fa-file-excel"></i></div>
                <div class="file-info">
                    <div class="file-name">${file.name}</div>
                    <div class="file-size">${formatFileSize(file.size)}</div>
                </div>
            </div>`;
        if (file.name.endsWith('.xlsx')) {
            try {
                const zip = await JSZip.loadAsync(file);
                let count = 0;
                zip.forEach(p => { if (p.match(/^xl\/worksheets\/sheet\d+\.xml$/)) count++; });
                document.getElementById('sheetInfo').innerHTML = '<p style="color:var(--text-light);">' + count + ' sheet(s)</p>';
            } catch (e) {
                document.getElementById('sheetInfo').innerHTML = '<p style="color:#ef4444;">Error reading file</p>';
            }
        } else {
            document.getElementById('sheetInfo').innerHTML = '<p style="color:var(--text-light);">CSV ready</p>';
        }
        document.getElementById('excelConvertBtn').onclick = () => this.process();
    },

    async process() {
        const btn = document.getElementById('excelConvertBtn');
        const progressArea = document.getElementById('progressArea');
        const fill = document.getElementById('progressFill');
        const textEl = document.getElementById('progressText');
        btn.disabled = true;
        btn.innerHTML = '<span class="spinner"></span> Converting...';
        progressArea.style.display = 'block';
        try {
            if (this.file.name.endsWith('.csv')) {
                await this.convertCSV(fill, textEl);
            } else {
                await this.convertXLSXServer(fill, textEl);
            }
            showToast('Excel converted to PDF!');
        } catch (error) {
            showToast('Error: ' + error.message, 'error');
        }
        btn.disabled = false;
        btn.innerHTML = '<i class="fas fa-file-pdf"></i> Convert to PDF';
    },

    async convertXLSXServer(fill, textEl) {
        fill.style.width = '30%';
        textEl.textContent = 'Uploading...';
        const formData = new FormData();
        formData.append('file', this.file);
        const apiBase = window.location.port === '8080' ? '' : 'http://localhost:8080';
        fill.style.width = '50%';
        textEl.textContent = 'Converting on server...';
        const resp = await fetch(apiBase + '/convert/xlsx', { method: 'POST', body: formData });
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
            a.download = this.file.name.replace(/\.[^.]+$/, '.pdf');
            document.body.appendChild(a);
            a.click();
            document.body.removeChild(a);
            setTimeout(() => URL.revokeObjectURL(url), 10000);
        fill.style.width = '100%';
        textEl.textContent = 'Done!';
    },

    stripNamespaces(xml) {
        return xml
            .replace(/xmlns[^=]*="[^"]*"/g, '')
            .replace(/xmlns[^=]*='[^']*'/g, '')
            .replace(/<(\/?)[a-zA-Z]+:/g, '<$1');
    },

    parseXml(xml) {
        const clean = this.stripNamespaces(xml);
        const parser = new DOMParser();
        return parser.parseFromString(clean, 'application/xml');
    },

    async convertCSV(fill, textEl) {
        fill.style.width = '20%';
        textEl.textContent = 'Reading CSV...';
        const content = await this.file.text();
        const rows = this.parseCSV(content);
        fill.style.width = '50%';
        textEl.textContent = 'Building PDF...';
        const { jsPDF } = window.jspdf;
        const pdf = new jsPDF({ orientation: 'landscape', unit: 'mm', format: 'a4' });
        const pw = pdf.internal.pageSize.getWidth();
        const ph = pdf.internal.pageSize.getHeight();
        const margin = 10;
        if (rows.length === 0) return;
        const colCount = Math.max(...rows.map(r => r.length));
        const colWidth = (pw - margin * 2) / colCount;
        let y = margin;
        for (let r = 0; r < rows.length; r++) {
            if (y + 7 > ph - margin) { pdf.addPage(); y = margin; }
            const row = rows[r];
            if (r === 0) { pdf.setFillColor(220, 220, 220); pdf.rect(margin, y - 4, pw - margin * 2, 7, 'F'); pdf.setFont('helvetica', 'bold'); pdf.setFontSize(9); }
            else { pdf.setFont('helvetica', 'normal'); pdf.setFontSize(8); }
            for (let c = 0; c < row.length; c++) {
                pdf.setTextColor(0, 0, 0);
                pdf.text(row[c].substring(0, 40), margin + c * colWidth + 1, y);
            }
            pdf.setDrawColor(200, 200, 200); pdf.setLineWidth(0.2);
            pdf.line(margin, y + 1, pw - margin, y + 1);
            y += 7;
        }
        fill.style.width = '100%';
        textEl.textContent = 'Done!';
        pdf.save(this.file.name.replace(/\.[^.]+$/, '.pdf'));
    },

    async convertXLSX(fill, textEl) {
        fill.style.width = '10%';
        textEl.textContent = 'Reading XLSX...';
        const zip = await JSZip.loadAsync(this.file);

        // Parse shared strings
        const sharedStrings = [];
        if (zip.files['xl/sharedStrings.xml']) {
            const ssXml = await zip.files['xl/sharedStrings.xml'].async('string');
            const doc = this.parseXml(ssXml);
            const siNodes = doc.getElementsByTagName('si');
            for (let i = 0; i < siNodes.length; i++) {
                let str = '';
                const tNodes = siNodes[i].getElementsByTagName('t');
                for (let j = 0; j < tNodes.length; j++) str += tNodes[j].textContent;
                if (!str) {
                    // Rich text: concat from <r><t> nodes
                    const rNodes = siNodes[i].getElementsByTagName('r');
                    for (let j = 0; j < rNodes.length; j++) {
                        const rt = rNodes[j].getElementsByTagName('t');
                        for (let k = 0; k < rt.length; k++) str += rt[k].textContent;
                    }
                }
                sharedStrings.push(str);
            }
        }

        // Parse workbook.xml for sheet names
        const sheetNames = [];
        if (zip.files['xl/workbook.xml']) {
            const wbXml = await zip.files['xl/workbook.xml'].async('string');
            const doc = this.parseXml(wbXml);
            const sheetNodes = doc.getElementsByTagName('sheet');
            for (let i = 0; i < sheetNodes.length; i++) {
                sheetNames.push(sheetNodes[i].getAttribute('name'));
            }
        }

        // Find all sheet files
        const sheetFiles = [];
        zip.forEach((path, entry) => {
            const m = path.match(/^xl\/worksheets\/sheet(\d+)\.xml$/);
            if (m) sheetFiles.push({ num: parseInt(m[1]), entry });
        });
        sheetFiles.sort((a, b) => a.num - b.num);

        fill.style.width = '20%';
        textEl.textContent = 'Processing...';

        const { jsPDF } = window.jspdf;
        const pdf = new jsPDF({ orientation: 'landscape', unit: 'mm', format: 'a4' });
        const pw = pdf.internal.pageSize.getWidth();
        const ph = pdf.internal.pageSize.getHeight();
        const margin = 10;

        for (let s = 0; s < sheetFiles.length; s++) {
            fill.style.width = (20 + Math.round(((s + 1) / sheetFiles.length) * 65)) + '%';
            const sheetName = sheetNames[s] || 'Sheet ' + (s + 1);
            textEl.textContent = sheetName + '...';

            if (s > 0) pdf.addPage();

            const sheetXml = await sheetFiles[s].entry.async('string');
            const doc = this.parseXml(sheetXml);

            // Get rows
            const rowNodes = doc.getElementsByTagName('row');
            const allRows = [];

            for (let i = 0; i < rowNodes.length; i++) {
                const rowNode = rowNodes[i];
                const cNodes = rowNode.getElementsByTagName('c');
                const cells = [];

                for (let j = 0; j < cNodes.length; j++) {
                    const cNode = cNodes[j];
                    const ref = cNode.getAttribute('r') || '';
                    const type = cNode.getAttribute('t') || '';

                    // Column index
                    const colMatch = ref.match(/^([A-Z]+)/);
                    const colIdx = colMatch ? this.colToNum(colMatch[1]) - 1 : j;

                    // Get value from <v> element
                    let value = '';
                    const vNodes = cNode.getElementsByTagName('v');
                    if (vNodes.length > 0) value = vNodes[0].textContent;

                    // Resolve
                    if (type === 's') {
                        const idx = parseInt(value);
                        value = (!isNaN(idx) && idx < sharedStrings.length) ? sharedStrings[idx] : '';
                    } else if (type === 'b') {
                        value = value === '1' ? 'TRUE' : 'FALSE';
                    } else if (type === 'e') {
                        value = '#ERROR';
                    } else if (type === 'inlineStr') {
                        const isNodes = cNode.getElementsByTagName('is');
                        if (isNodes.length > 0) {
                            const tNodes = isNodes[0].getElementsByTagName('t');
                            value = '';
                            for (let k = 0; k < tNodes.length; k++) value += tNodes[k].textContent;
                        }
                    }

                    while (cells.length < colIdx) cells.push('');
                    cells[colIdx] = value;
                }

                if (cells.length > 0) allRows.push(cells);
            }

            // Sheet name header
            pdf.setFont('helvetica', 'bold');
            pdf.setFontSize(12);
            pdf.setTextColor(50, 50, 50);
            pdf.text(sheetName, margin, margin + 5);

            if (allRows.length === 0) {
                pdf.setFont('helvetica', 'italic');
                pdf.setFontSize(10);
                pdf.setTextColor(150, 150, 150);
                pdf.text('Empty sheet', margin, margin + 20);
                continue;
            }

            let maxCols = 0;
            for (const row of allRows) if (row.length > maxCols) maxCols = row.length;
            if (maxCols === 0) continue;

            const usableWidth = pw - margin * 2;
            const colWidth = usableWidth / maxCols;
            let y = margin + 15;

            // Header row
            const hdr = allRows[0];
            pdf.setFillColor(220, 220, 220);
            pdf.rect(margin, y - 5, usableWidth, 8, 'F');
            pdf.setFont('helvetica', 'bold');
            pdf.setFontSize(8);
            pdf.setTextColor(0, 0, 0);
            for (let c = 0; c < maxCols; c++) {
                const val = hdr[c] !== undefined ? String(hdr[c]) : '';
                pdf.text(val.substring(0, 35), margin + c * colWidth + 1, y);
            }
            pdf.setDrawColor(160, 160, 160);
            pdf.setLineWidth(0.5);
            pdf.line(margin, y + 3, pw - margin, y + 3);
            y += 8;

            // Data rows
            for (let r = 1; r < allRows.length; r++) {
                if (y + 6 > ph - margin) {
                    pdf.addPage();
                    y = margin;
                    // Repeat header
                    pdf.setFillColor(220, 220, 220);
                    pdf.rect(margin, y - 5, usableWidth, 8, 'F');
                    pdf.setFont('helvetica', 'bold');
                    pdf.setFontSize(8);
                    pdf.setTextColor(0, 0, 0);
                    for (let c = 0; c < maxCols; c++) {
                        const val = hdr[c] !== undefined ? String(hdr[c]) : '';
                        pdf.text(val.substring(0, 35), margin + c * colWidth + 1, y);
                    }
                    pdf.line(margin, y + 3, pw - margin, y + 3);
                    y += 8;
                }

                const row = allRows[r];
                if (r % 2 === 0) {
                    pdf.setFillColor(245, 245, 245);
                    pdf.rect(margin, y - 5, usableWidth, 6, 'F');
                }
                pdf.setFont('helvetica', 'normal');
                pdf.setFontSize(8);

                for (let c = 0; c < maxCols; c++) {
                    const x = margin + c * colWidth;
                    const val = row[c] !== undefined ? String(row[c]) : '';
                    const isNum = val !== '' && !isNaN(val);
                    if (isNum) {
                        pdf.setTextColor(0, 0, 0);
                        pdf.text(val, x + colWidth - pdf.getTextWidth(val) - 1, y);
                    } else {
                        pdf.setTextColor(30, 30, 30);
                        pdf.text(val.substring(0, 35), x + 1, y);
                    }
                }
                pdf.setDrawColor(230, 230, 230);
                pdf.setLineWidth(0.15);
                pdf.line(margin, y + 1, pw - margin, y + 1);
                y += 6;
            }

            // Column lines
            pdf.setDrawColor(200, 200, 200);
            pdf.setLineWidth(0.15);
            for (let c = 0; c <= maxCols; c++) {
                const x = margin + c * colWidth;
                if (x <= pw - margin) pdf.line(x, margin + 15, x, y);
            }
        }

        fill.style.width = '100%';
        textEl.textContent = 'Done!';
        pdf.save(this.file.name.replace(/\.[^.]+$/, '.pdf'));
    },

    colToNum(letters) {
        let result = 0;
        for (let i = 0; i < letters.length; i++) {
            result = result * 26 + (letters.charCodeAt(i) - 64);
        }
        return result;
    },

    parseCSV(content) {
        const rows = [];
        let current = '';
        let inQuote = false;
        const result = [];
        for (let i = 0; i < content.length; i++) {
            const ch = content[i];
            const next = content[i + 1];
            if (inQuote) {
                if (ch === '"' && next === '"') { current += '"'; i++; }
                else if (ch === '"') inQuote = false;
                else current += ch;
            } else {
                if (ch === '"') inQuote = true;
                else if (ch === ',') { result.push(current.trim()); current = ''; }
                else if (ch === '\n' || (ch === '\r' && next === '\n')) {
                    result.push(current.trim());
                    rows.push(result.splice(0));
                    current = '';
                    if (ch === '\r') i++;
                } else current += ch;
            }
        }
        if (current || result.length > 0) { result.push(current.trim()); rows.push(result); }
        return rows;
    }
});
