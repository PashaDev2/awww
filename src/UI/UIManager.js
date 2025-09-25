class UIManager {
    constructor() {
        if (UIManager.instance) {
            return UIManager.instance;
        }

        this.uiContainer = null;
        this.activeMessages = new Map(); // Use a Map to track persistent messages by ID
        this.theme = "dark"; // Default theme set to dark
        this.init();

        UIManager.instance = this;
    }

    init() {
        this.injectCSS();
        this.uiContainer = document.createElement("div");
        this.uiContainer.className = "ui-container";
        document.body.appendChild(this.uiContainer);
    }

    /**
     * Sets the theme for the UI.
     * @param {string} themeName - The name of the theme to apply ('light', 'dark').
     */
    setTheme(themeName) {
        this.theme = themeName;
        this.injectCSS();
    }

    /**
     * Displays or updates a message on the screen.
     * @param {object} options - The configuration for the message.
     * @param {string} options.id - A unique ID for the message.
     * @param {string} options.content - The HTML content of the message.
     * @param {string} [options.position='bottom-right'] - The position of the screen ('top-left', 'top-right', 'bottom-left', 'bottom-right').
     * @param {boolean} [options.persistent=false] - If true, the message stays until hideMessage is called.
     * @param {number} [options.duration=3000] - Duration in ms if not persistent.
     * @param {boolean} [options.showCloseButton=true] - If true, shows a close button.
     * @param {function} [options.onClose=null] - A callback function to execute when the close button is clicked.
     */
    showMessage({
        id,
        content,
        position = "bottom-right",
        persistent = false,
        duration = 3000,
        showCloseButton = true,
        onClose = null,
    }) {
        if (!this.uiContainer) return;

        // Set the container position
        this.uiContainer.className = `ui-container ui-container-${position}`;

        if (this.activeMessages.has(id)) {
            const existingEl = this.activeMessages.get(id);
            const contentEl = existingEl.querySelector(".message-content");
            if (contentEl.innerHTML !== content) {
                contentEl.innerHTML = content;
            }
            return;
        }

        const messageEl = document.createElement("div");
        messageEl.className = `ui-message`;
        messageEl.innerHTML = `
            <div class="message-content">${content}</div>
            ${
                showCloseButton
                    ? `<div class="close-button"><?xml version="1.0" encoding="utf-8"?><!-- Uploaded to: SVG Repo, www.svgrepo.com, Generator: SVG Repo Mixer Tools -->
<svg viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
<path fill-rule="evenodd" clip-rule="evenodd" d="M5.29289 5.29289C5.68342 4.90237 6.31658 4.90237 6.70711 5.29289L12 10.5858L17.2929 5.29289C17.6834 4.90237 18.3166 4.90237 18.7071 5.29289C19.0976 5.68342 19.0976 6.31658 18.7071 6.70711L13.4142 12L18.7071 17.2929C19.0976 17.6834 19.0976 18.3166 18.7071 18.7071C18.3166 19.0976 17.6834 19.0976 17.2929 18.7071L12 13.4142L6.70711 18.7071C6.31658 19.0976 5.68342 19.0976 5.29289 18.7071C4.90237 18.3166 4.90237 17.6834 5.29289 17.2929L10.5858 12L5.29289 6.70711C4.90237 6.31658 4.90237 5.68342 5.29289 5.29289Z" fill="currentColor"/>
</svg></div>`
                    : ""
            }
        `;

        this.uiContainer.appendChild(messageEl);
        this.activeMessages.set(id, messageEl);

        setTimeout(() => {
            messageEl.classList.add("visible");
        }, 50);

        if (showCloseButton) {
            const closeButton = messageEl.querySelector(".close-button");
            closeButton.addEventListener("click", e => {
                e.stopPropagation();
                if (onClose) {
                    onClose();
                }
                this.hideMessage(id);
            });
        }

        if (!persistent) {
            setTimeout(() => {
                this.hideMessage(id);
            }, duration);
        }
    }

    /**
     * Hides and removes a message by its ID.
     * @param {string} id The unique ID of the message to hide.
     */
    hideMessage(id) {
        if (!this.activeMessages.has(id)) return;

        const messageEl = this.activeMessages.get(id);
        messageEl.classList.remove("visible");

        setTimeout(() => {
            if (messageEl.parentElement) {
                this.uiContainer.removeChild(messageEl);
            }
            this.activeMessages.delete(id);
        }, 300); // Match CSS transition duration
    }

    getThemeCSS() {
        const themes = {
            light: `
                :root {
                    --background: #ffffff;
                    --foreground: #020817;
                    --card: #ffffff;
                    --card-foreground: #020817;
                    --popover: #ffffff;
                    --popover-foreground: #020817;
                    --primary: #18181b;
                    --primary-foreground: #fafafa;
                    --secondary: #f4f4f5;
                    --secondary-foreground: #18181b;
                    --muted: #f4f4f5;
                    --muted-foreground: #71717a;
                    --accent: #f4f4f5;
                    --accent-foreground: #18181b;
                    --border: #e4e4e7;
                    --input: #e4e4e7;
                    --ring: #18181b;
                    --radius: 0.5rem;
                }
            `,
            dark: `
                :root {
                    --background: #020817;
                    --foreground: #fafafa;
                    --card: #020817;
                    --card-foreground: #fafafa;
                    --popover: #020817;
                    --popover-foreground: #fafafa;
                    --primary: #fafafa;
                    --primary-foreground: #18181b;
                    --secondary: #27272a;
                    --secondary-foreground: #fafafa;
                    --muted: #27272a;
                    --muted-foreground: #a1a1aa;
                    --accent: #27272a;
                    --accent-foreground: #fafafa;
                    --border: #27272a;
                    --input: #27272a;
                    --ring: #fafafa;
                    --radius: 0.5rem;
                }
            `,
        };
        return themes[this.theme] || themes["dark"];
    }

    injectCSS() {
        const existingStyle = document.getElementById("ui-manager-styles");
        if (existingStyle) {
            existingStyle.remove();
        }

        const style = document.createElement("style");
        style.id = "ui-manager-styles";
        style.textContent = `
        ${this.getThemeCSS()}
        
        .ui-container {
            position: fixed;
            z-index: 1000;
            display: flex;
            flex-direction: column;
            gap: 12px;
            pointer-events: none;
            width: calc(100% - 40px);
            max-width: 420px;
        }

        .ui-container-top-left { top: 20px; left: 20px; align-items: flex-start; }
        .ui-container-top-right { top: 20px; right: 20px; align-items: flex-end; }
        .ui-container-bottom-left { bottom: 20px; left: 20px; align-items: flex-start; }
        .ui-container-bottom-right { bottom: 20px; right: 20px; align-items: flex-end; }

        .ui-message {
            background-color: var(--card);
            color: var(--card-foreground);
            padding: 16px;
            border-radius: var(--radius);
            font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif, "Apple Color Emoji", "Segoe UI Emoji", "Segoe UI Symbol";
            font-size: 1.25em;
            border: 1px solid var(--border);
            box-shadow: 0 4px 6px -1px rgba(0, 0, 0, 0.1), 0 2px 4px -1px rgba(0, 0, 0, 0.06);
            display: flex;
            align-items: center;
            gap: 12px;
            pointer-events: all;
            opacity: 0;
            transform: translateY(20px);
            transition: opacity 0.3s ease, transform 0.3s ease;
            width: 100%;
        }
        
        .ui-message.visible {
            opacity: 1;
            transform: translateY(0);
        }

        .message-content {
            flex-grow: 1;
            line-height: 1.5;
        }

        .close-button {
            font-size: 2rem;
            font-weight: 500;
            color: var(--muted-foreground);
            cursor: pointer;
            border-radius: 50%;
            width: 2.2rem;
            height: 2.2rem;
            display: flex;
            align-items: center;
            justify-content: center;
            flex-shrink: 0;
        }

        .close-button:hover {
            color: var(--accent-foreground);
        }

        @media (max-width: 768px) {
            .ui-container {
                left: 10px;
                right: 10px;
                width: auto;
                align-items: center;
            }
             .ui-container-top-left, .ui-container-top-right { top: 10px; }
             .ui-container-bottom-left, .ui-container-bottom-right { bottom: 10px; }
             .ui-message {
                max-width: 80vw;
             }
        }
        `;
        document.head.appendChild(style);
    }
}

export const uiManager = new UIManager();
