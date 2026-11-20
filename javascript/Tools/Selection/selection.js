
/* PhotoCook — Floating Selection Tool Controller */
(() => {
    'use strict';

    if (window.PhotoCookSelection) return;

    const Selection = {
        initialized: false,
        isOpen: false,
        isMinimized: false,
        activeMode: 'rect',
        operation: 'new',

        selectionAwareTools: new Set([
            'adjust',
            'filter'
        ]),

        canvas: null,
        panel: null,
        toolbarButton: null,

        drag: {
            active: false,
            offsetX: 0,
            offsetY: 0
        },

        modes: [
            { id: 'rect', label: 'Rectangle', icon: '▭' },
            { id: 'ellipse', label: 'Ellipse', icon: '◯' },
            { id: 'lasso', label: 'Lasso', icon: '〰' },
            { id: 'polygon', label: 'Polygon', icon: '⬡' },
            { id: 'brush', label: 'Brush', icon: '✎' },
            { id: 'wand', label: 'Magic Wand', icon: '✧' },
            { id: 'subject', label: 'Select Subject', icon: '♙' },
            { id: 'eyedropper', label: 'Eyedropper', icon: '⌁' }
        ],

        init() {
            if (this.initialized) return;

            this.canvas = document.getElementById('canvas');
            this.toolbarButton = document.getElementById('selection');

            if (!this.canvas || !this.toolbarButton) {
                console.error('PhotoCook Selection: Canvas or Selection button not found.');
                return;
            }

            this.createPanel();
            this.bindEvents();
            this.setMode(this.activeMode);
            this.setOperation(this.operation);

            this.initialized = true;
        },

        createPanel() {
            this.panel = document.getElementById('selection-sub-toolbar');

            if (!this.panel) {
                this.panel = document.createElement('div');
                this.panel.id = 'selection-sub-toolbar';
                this.panel.className = 'selection-floating-panel';
                document.body.appendChild(this.panel);
            }

            this.panel.innerHTML = `
                <div class="selection-header">
                    <div class="selection-heading">
                        <span class="selection-heading-icon">⌖</span>
                        <div class="selection-heading-text">
                            <strong>Selection</strong>
                            <small>Selection Tools</small>
                        </div>
                    </div>

                    <div class="selection-window-actions">
                        <button type="button"
                            class="selection-minimize"
                            aria-label="Minimize panel"
                            title="Minimize">−</button>

                        <button type="button"
                            class="selection-close"
                            aria-label="Close panel"
                            title="Close">×</button>
                    </div>
                </div>

                <div class="selection-panel-content">

                    <div class="selection-section">
                        <div class="selection-section-heading">
                            <span>TOOLS</span>
                            <span class="selection-tool-count">08</span>
                        </div>

                        <div class="selection-mode-grid">
                            ${this.modes.map(mode => `
                                <button type="button"
                                    class="selection-mode-btn"
                                    data-mode="${mode.id}"
                                    title="${mode.label}"
                                    aria-label="${mode.label}"
                                    aria-pressed="false">
                                    <span class="selection-tool-icon">${mode.icon}</span>
                                    <span class="selection-tool-label">${mode.label}</span>
                                </button>
                            `).join('')}
                        </div>
                    </div>

                    <div class="selection-section">
                        <div class="selection-section-heading">
                            <span>SELECTION OPERATION</span>
                        </div>

                        <div class="selection-operation-list">
                            <button type="button" data-operation="new"
                                aria-pressed="true">
                                New
                            </button>
                            <button type="button" data-operation="add"
                                aria-pressed="false">
                                Add
                            </button>
                            <button type="button" data-operation="subtract"
                                aria-pressed="false">
                                Subtract
                            </button>
                            <button type="button" data-operation="intersect"
                                aria-pressed="false">
                                Intersect
                            </button>
                        </div>
                    </div>

                    <div class="selection-footer">
                        <button type="button" data-action="invert">
                            <span>⇄</span> Invert
                        </button>

                        <button type="button" data-action="deselect">
                            <span>⊘</span> Deselect
                        </button>
                    </div>
                </div>
            `;

            this.panel.setAttribute('role', 'dialog');
            this.panel.setAttribute('aria-label', 'Selection tools');
        },

        bindEvents() {
            this.toolbarButton.addEventListener('click', () => {
                this.toggle();
            });

            this.panel.addEventListener('click', event => {
                const modeButton = event.target.closest('[data-mode]');
                const operationButton = event.target.closest('[data-operation]');
                const actionButton = event.target.closest('[data-action]');

                if (event.target.closest('.selection-close')) {
                    this.close();
                    return;
                }

                if (event.target.closest('.selection-minimize')) {
                    this.toggleMinimize();
                    return;
                }

                if (modeButton) {
                    this.setMode(modeButton.dataset.mode);
                    return;
                }

                if (operationButton) {
                    this.setOperation(operationButton.dataset.operation);
                    return;
                }

                if (actionButton) {
                    this.runAction(actionButton.dataset.action);
                }
            });

            this.bindDragging();
        },

        bindDragging() {
            const header = this.panel.querySelector('.selection-header');

            header.addEventListener('pointerdown', event => {
                if (event.button !== 0) return;
                if (event.target.closest('button')) return;

                const rect = this.panel.getBoundingClientRect();

                this.drag.active = true;
                this.drag.offsetX = event.clientX - rect.left;
                this.drag.offsetY = event.clientY - rect.top;

                this.panel.classList.add('dragging');
                header.setPointerCapture(event.pointerId);
            });

            header.addEventListener('pointermove', event => {
                if (!this.drag.active) return;

                const width = this.panel.offsetWidth;
                const height = this.panel.offsetHeight;

                const left = Math.max(
                    0,
                    Math.min(event.clientX - this.drag.offsetX,
                        window.innerWidth - width)
                );

                const top = Math.max(
                    0,
                    Math.min(event.clientY - this.drag.offsetY,
                        window.innerHeight - height)
                );

                this.panel.style.left = `${left}px`;
                this.panel.style.top = `${top}px`;
                this.panel.style.right = 'auto';
                this.panel.style.bottom = 'auto';
            });

            const stopDragging = () => {
                this.drag.active = false;
                this.panel.classList.remove('dragging');
            };

            header.addEventListener('pointerup', stopDragging);
            header.addEventListener('pointercancel', stopDragging);
            window.addEventListener('blur', stopDragging);

            window.addEventListener('resize', () => {
                if (!this.isOpen) return;

                const rect = this.panel.getBoundingClientRect();

                this.panel.style.left = `${Math.max(
                    0, Math.min(rect.left, window.innerWidth - rect.width)
                )}px`;

                this.panel.style.top = `${Math.max(
                    0, Math.min(rect.top, window.innerHeight - rect.height)
                )}px`;
            });
        },

        open() {
            if (this.isOpen) return;

            this.isOpen = true;
            this.isMinimized = false;

            this.panel.classList.add('open');
            this.panel.classList.remove('minimized');
            this.toolbarButton.classList.add('active');

            this.emit('opened');
        },

        close() {
            if (!this.isOpen) return;

            this.isOpen = false;
            this.panel.classList.remove('open');
            this.toolbarButton.classList.remove('active');

            this.emit('closed');
        },

        toggle() {
            if (!this.isOpen) {
                this.open();
            } else if (this.isMinimized) {
                this.toggleMinimize(); 
            } else {
                this.close();
            }
        },

        toggleMinimize() {
            if (!this.isOpen) return;

            this.isMinimized = !this.isMinimized;

            this.panel.classList.toggle('minimized', this.isMinimized);

            const button = this.panel.querySelector('.selection-minimize');

            button.textContent = this.isMinimized ? '+' : '−';
            button.title = this.isMinimized ? 'Expand' : 'Minimize';
            button.setAttribute(
                'aria-label',
                this.isMinimized ? 'Expand panel' : 'Minimize panel'
            );

            this.emit(this.isMinimized ? 'minimized' : 'expanded');
        },

        setMode(mode) {
            if (!this.modes.some(item => item.id === mode)) return;

            this.activeMode = mode;

            this.panel.querySelectorAll('[data-mode]').forEach(button => {
                const active = button.dataset.mode === mode;

                button.classList.toggle('active', active);
                button.setAttribute('aria-pressed', String(active));
            });

            this.emit('modechange', { mode });
        },

        setOperation(operation) {
            const valid = ['new', 'add', 'subtract', 'intersect'];

            if (!valid.includes(operation)) return;

            this.operation = operation;

            this.panel.querySelectorAll('[data-operation]').forEach(button => {
                const active = button.dataset.operation === operation;

                button.classList.toggle('active', active);
                button.setAttribute('aria-pressed', String(active));
            });

            this.emit('operationchange', { operation });
        },

        runAction(action) {
            if (action === 'deselect' || action === 'invert') {
                this.emit(action);
            }
        },

        // Check whether a tool is allowed to use the active selection
        shouldApplySelection(toolName) {
            if (!toolName) return false;

            return this.selectionAwareTools.has(
                String(toolName).toLowerCase()
            );
        },

        // Return the currently approved tools
        getSelectionAwareTools() {
            return [...this.selectionAwareTools];
        },

        emit(name, detail = {}) {
            document.dispatchEvent(new CustomEvent(
                `photocook:selection:${name}`,
                {
                    detail: {
                        ...detail,
                        mode: this.activeMode,
                        operation: this.operation
                    }
                }
            ));
        }
    };

    window.PhotoCookSelection = Selection;

    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', () => Selection.init(), {
            once: true
        });
    } else {
        Selection.init();
    }
})();
