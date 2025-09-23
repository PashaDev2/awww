class UIManager {
    constructor() {
        if (UIManager.instance) {
            return UIManager.instance;
        }

        this.uiContainer = null;
        this.activeMessages = new Map(); // Use a Map to track persistent messages by ID
        this.theme = "default"; // Default theme
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
     * @param {string} themeName - The name of the theme to apply ('default', 'white', 'black').
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
     * @param {string} [options.side='left'] - The side of the screen ('left' or 'right').
     * @param {boolean} [options.persistent=false] - If true, the message stays until hideMessage is called.
     * @param {number} [options.duration=3000] - Duration in ms if not persistent.
     * @param {boolean} [options.showCloseButton=false] - If true, shows a close button (for persistent messages).
     * @param {function} [options.onClose=null] - A callback function to execute when the close button is clicked.
     */
    showMessage({
        id,
        content,
        side = "left",
        persistent = false,
        duration = 3000,
        showCloseButton = false,
        onClose = null,
    }) {
        if (!this.uiContainer) return;

        // If a message with this ID already exists, don't re-animate, just update content if needed.
        if (this.activeMessages.has(id)) {
            const existingEl = this.activeMessages.get(id);
            const contentEl = existingEl.querySelector(".message-content");
            if (contentEl.innerHTML !== content) {
                contentEl.innerHTML = this.formatContentForAnimation(content);
            }
            return;
        }

        const messageEl = document.createElement("div");
        messageEl.className = `ui-message ui-message-${side}`;
        messageEl.innerHTML = `
            <div class="message-content">${this.formatContentForAnimation(content)}</div>
            ${showCloseButton ? '<div class="close-button">&times;</div>' : ""}
        `;

        this.uiContainer.appendChild(messageEl);
        this.activeMessages.set(id, messageEl);

        // Animate in
        setTimeout(() => {
            messageEl.classList.add("visible");
        }, 50);

        // Handle the close button
        if (showCloseButton && onClose) {
            const closeButton = messageEl.querySelector(".close-button");
            closeButton.addEventListener("click", e => {
                e.stopPropagation(); // Prevent any other click events
                onClose(); // Execute the callback provided by the main app
                // The main app is now responsible for calling hideMessage
            });
        }

        // Set a timer to automatically hide if it's not persistent
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
        messageEl.classList.remove("visible"); // Trigger the hide animation

        // Remove from DOM and Map after the animation completes
        setTimeout(() => {
            if (messageEl.parentElement) {
                this.uiContainer.removeChild(messageEl);
            }
            this.activeMessages.delete(id);
        }, 500); // Must match the CSS transition duration
    }

    // Helper to wrap each character in a span for the animation
    formatContentForAnimation(content) {
        return content;
        return content
            .split("")
            .map((char, index) => {
                const delay = index * 0.02; // Stagger delay for each character
                return `<span style="transition-delay: ${delay}s">${
                    char === " " ? "&nbsp;" : char
                }</span>`;
            })
            .join("");
    }

    getThemeCSS() {
        const themes = {
            default: `
                :root {
                    --bg-gradient-start: #121212;
                    --bg-gradient-end: #050505;
                    --text-color: #EAEAEA;
                    --border-color: #333333;
                    --shadow-color: #333333;
                    --inset-shadow-color: #333333;
                    --text-shadow-color: #333333;
                    --close-button-color: #888888;
                    --close-button-hover-color: #ffffff;
                    --close-button-hover-shadow-color: red;
                }
            `,
            white: `
                :root {
                    --bg-gradient-start: rgba(245, 245, 250, 0.9);
                    --bg-gradient-end: rgba(235, 235, 245, 0.95);
                    --text-color: #3a3a3a;
                    --border-color: rgba(0, 0, 0, 0.1);
                    --shadow-color: rgba(0, 0, 0, 0.1);
                    --inset-shadow-color: rgba(255, 255, 255, 0.5);
                    --text-shadow-color: rgba(58, 58, 58, 0.2);
                    --close-button-color: #888888;
                    --close-button-hover-color: #000000;
                    --close-button-hover-shadow-color: #3a3a3a;
                }
            `,
            black: `
                :root {
                    --bg-gradient-start: rgba(10, 10, 10, 0.9);
                    --bg-gradient-end: rgba(0, 0, 0, 0.95);
                    --text-color: #00ff00;
                    --border-color: rgba(0, 255, 0, 0.3);
                    --shadow-color: rgba(0, 255, 0, 0.2);
                    --inset-shadow-color: rgba(0, 255, 0, 0.1);
                    --text-shadow-color: rgba(0, 255, 0, 0.7);
                    --close-button-color: rgba(0, 255, 0, 0.7);
                    --close-button-hover-color: #ffffff;
                    --close-button-hover-shadow-color: #00ff00;
                }
            `,
        };
        return themes[this.theme] || themes["default"];
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
        @import url('https://fonts.googleapis.com/css2?family=Roboto:wght@700&display=swap');
        .ui-container {
            position: fixed;
            bottom: 50px;
            left: 50px;
            right: 50px;
            pointer-events: none;
            z-index: 1000;
            display: flex;
            flex-direction: column;
            align-items: flex-start;
            gap: 12px;
        }

        .ui-message {
            background: linear-gradient(145deg, var(--bg-gradient-start), var(--bg-gradient-end));
            backdrop-filter: blur(10px);
            color: var(--text-color);
            padding: 16px 28px;
            border-radius: 4px;
            // font-family: "Roboto", Arial, sans-serif;
            font-size: 1.1em;
            border: 1px solid var(--border-color);
            box-shadow: 0 0 20px var(--shadow-color), inset 0 0 8px var(--inset-shadow-color);
            display: flex;
            align-items: center;
            gap: 20px;
            transition: opacity 0.5s ease, transform 0.5s cubic-bezier(0.23, 1, 0.32, 1);
            opacity: 0;
            text-shadow: 0 0 6px var(--text-shadow-color);
            // clip-path: polygon(0% 0%, 96% 0%, 100% 30%, 100% 100%, 4% 100%, 0% 70%);
        }
        
        .ui-message-left {
            transform: translateX(-30px);
            align-self: flex-start;
        }

        .ui-message-right {
            transform: translateX(30px);
            align-self: flex-end;
            clip-path: polygon(4% 0%, 100% 0%, 100% 70%, 96% 100%, 0% 100%, 0% 30%);
        }
        
        .ui-message.visible {
            opacity: 1;
            transform: translateX(0);
        }

        .message-content span {
            display: inline-block;
            opacity: 0;
            transform: translateY(18px);
            transition: opacity 0.4s ease, transform 0.4s ease;
        }

        .ui-message.visible .message-content span {
            opacity: 1;
            transform: translateY(0);
        }

        .close-button {
            font-family: 'Arial', sans-serif;
            font-size: 26px;
            line-height: 1;
            font-weight: bold;
            color: var(--close-button-color);
            cursor: pointer;
            pointer-events: all;
            transition: color 0.3s ease, transform 0.3s ease, text-shadow 0.3s ease;
        }
        .close-button:hover {
            color: var(--close-button-hover-color);
            transform: scale(1.1);
            text-shadow: 0 0 12px var(--close-button-hover-shadow-color);
        }
        `;
        document.head.appendChild(style);
    }
}

export const uiManager = new UIManager();
