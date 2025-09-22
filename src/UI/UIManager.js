class UIManager {
    constructor() {
        if (UIManager.instance) {
            return UIManager.instance;
        }

        this.uiContainer = null;
        this.activeMessages = new Map(); // Use a Map to track persistent messages by ID
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

    injectCSS() {
        const style = document.createElement("style");
        style.textContent = `
            .ui-container {
                position: fixed;
                top: 40px;
                left: 40px;
                right: 40px;
                bottom: 40px;
                pointer-events: none;
                z-index: 1000;
                display: flex;
                justify-content: space-between;
                align-items: flex-start;
            }

            .ui-message {
                background-color: rgba(15, 15, 20, 0.8);
                backdrop-filter: blur(10px);
                color: #fafafa;
                padding: 12px 20px;
                border-radius: 8px;
                font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif;
                font-size: 16px;
                border: 1px solid rgba(255, 255, 255, 0.1);
                display: flex;
                align-items: center;
                gap: 15px;
                transition: opacity 0.5s ease, transform 0.5s ease;
                opacity: 0;
            }
            
            .ui-message-left {
                transform: translateX(-20px);
                align-self: flex-start;
            }

            .ui-message-right {
                transform: translateX(20px);
                align-self: flex-start;
            }
            
            .ui-message.visible {
                opacity: 1;
                transform: translateX(0);
            }

            .message-content {
                overflow: hidden;
            }
            
            .message-content span {
                display: inline-block;
                opacity: 0;
                transform: translateY(15px);
                transition: opacity 0.4s ease, transform 0.4s ease;
            }

            .ui-message.visible .message-content span {
                opacity: 1;
                transform: translateY(0);
            }

            .close-button {
                font-size: 24px;
                line-height: 1;
                font-weight: 300;
                color: rgba(255, 255, 255, 0.5);
                cursor: pointer;
                pointer-events: all;
                transition: color 0.2s ease, transform 0.2s ease;
            }
            .close-button:hover {
                color: white;
                transform: scale(1.1);
            }
        `;
        document.head.appendChild(style);
    }
}

export const uiManager = new UIManager();
