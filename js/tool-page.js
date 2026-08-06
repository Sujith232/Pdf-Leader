// Tool Page Router
const ToolRouter = {
    tools: {},

    register(name, config) {
        this.tools[name] = config;
    },

    getTool(name) {
        return this.tools[name];
    },

    async init() {
        const params = new URLSearchParams(window.location.search);
        const toolName = params.get('t');

        if (!toolName || !this.tools[toolName]) {
            this.show404();
            return;
        }

        const tool = this.tools[toolName];
        document.getElementById('toolTitle').textContent = tool.title;
        document.getElementById('toolDescription').textContent = tool.description;
        document.title = `PDF Leader - ${tool.title}`;

        if (tool.init) {
            await tool.init();
        }
    },

    show404() {
        document.getElementById('toolWorkspace').innerHTML = `
            <div style="text-align: center; padding: 4rem;">
                <h2>Tool not found</h2>
                <p style="color: var(--text-light); margin-bottom: 1rem;">The requested tool could not be found.</p>
                <a href="index.html" class="btn btn-primary">Go Home</a>
            </div>
        `;
    }
};

document.addEventListener('DOMContentLoaded', () => {
    ToolRouter.init();
});
