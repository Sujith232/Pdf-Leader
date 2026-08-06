// PDF Worker - Shared PDF utilities
pdfjsLib.GlobalWorkerOptions.workerSrc = 'https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/pdf.worker.min.js';

const PDFWorker = {
    async renderPageToCanvas(pdfBytes, pageNum, canvas, scale = 1.5) {
        const pdf = await pdfjsLib.getDocument({ data: pdfBytes }).promise;
        const page = await pdf.getPage(pageNum);
        const viewport = page.getViewport({ scale });
        canvas.height = viewport.height;
        canvas.width = viewport.width;
        const ctx = canvas.getContext('2d');
        await page.render({ canvasContext: ctx, viewport }).promise;
    },

    async getPageCount(pdfBytes) {
        const pdf = await pdfjsLib.getDocument({ data: pdfBytes }).promise;
        return pdf.numPages;
    },

    async renderAllPages(pdfBytes, container, scale = 1) {
        const pdf = await pdfjsLib.getDocument({ data: pdfBytes }).promise;
        container.innerHTML = '';
        for (let i = 1; i <= pdf.numPages; i++) {
            const page = await pdf.getPage(i);
            const viewport = page.getViewport({ scale });
            const canvas = document.createElement('canvas');
            canvas.height = viewport.height;
            canvas.width = viewport.width;
            const ctx = canvas.getContext('2d');
            await page.render({ canvasContext: ctx, viewport }).promise;
            const wrapper = document.createElement('div');
            wrapper.className = 'page-preview';
            wrapper.appendChild(canvas);
            container.appendChild(wrapper);
        }
    },

    async getPageDimensions(pdfBytes, pageNum) {
        const pdf = await pdfjsLib.getDocument({ data: pdfBytes }).promise;
        const page = await pdf.getPage(pageNum);
        const viewport = page.getViewport({ scale: 1 });
        return { width: viewport.width, height: viewport.height };
    }
};
