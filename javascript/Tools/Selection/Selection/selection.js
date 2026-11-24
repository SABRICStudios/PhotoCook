
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
        activePage: 'main',

        brushSettings: {
            size: 30,
            hardness: 80,
            opacity: 100,
            mode: 'add'
        },

        blendEdge: 0,
        blendEdgeTimer: null,

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
            this.updateBrushUI();
            this.updateBlendUI();

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
                            <small class="selection-header-subtitle">Selection Tools</small>
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

                    <div class="selection-main-page">

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
                                    aria-pressed="true">New</button>
                                <button type="button" data-operation="add"
                                    aria-pressed="false">Add</button>
                                <button type="button" data-operation="subtract"
                                    aria-pressed="false">Subtract</button>
                                <button type="button" data-operation="intersect"
                                    aria-pressed="false">Intersect</button>
                            </div>
                        </div>

                        <div class="selection-section selection-blend-section">
                            <div class="selection-section-heading">
                                <span>BLEND EDGE</span>
                                <span class="selection-blend-value">0 px</span>
                            </div>

                            <input type="range"
                                class="selection-blend-slider"
                                data-setting="blend"
                                min="0"
                                max="100"
                                step="1"
                                value="0"
                                aria-label="Blend Edge">


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
                    <div class="selection-brush-page" hidden>

                        <div class="selection-brush-toolbar">
                            <button type="button"
                                class="selection-back-btn"
                                data-action="brush-back"
                                aria-label="Back">←</button>

                            <div class="selection-brush-mode-list">
                                <button type="button"
                                    data-brush-mode="add"
                                    aria-pressed="true">Add</button>

                                <button type="button"
                                    data-brush-mode="subtract"
                                    aria-pressed="false">Erase</button>
                            </div>
                        </div>

                        <div class="selection-section">
                            <div class="selection-section-heading">
                                <span>SIZE</span>
                                <span class="selection-brush-size-value">30 px</span>
                            </div>

                            <input type="range"
                                data-brush-setting="size"
                                min="1"
                                max="500"
                                step="1"
                                value="30"
                                aria-label="Brush size">
                        </div>

                        <div class="selection-section">
                            <div class="selection-section-heading">
                                <span>HARDNESS</span>
                                <span class="selection-brush-hardness-value">80%</span>
                            </div>

                            <input type="range"
                                data-brush-setting="hardness"
                                min="0"
                                max="100"
                                step="1"
                                value="80"
                                aria-label="Brush hardness">
                        </div>

                        <div class="selection-section">
                            <div class="selection-section-heading">
                                <span>OPACITY</span>
                                <span class="selection-brush-opacity-value">100%</span>
                            </div>

                            <input type="range"
                                data-brush-setting="opacity"
                                min="0"
                                max="100"
                                step="1"
                                value="100"
                                aria-label="Brush opacity">
                        </div>

                    </div>

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
                const brushModeButton = event.target.closest('[data-brush-mode]');

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

                if (brushModeButton) {
                    this.setBrushMode(brushModeButton.dataset.brushMode);
                    return;
                }

                if (actionButton) {
                    this.runAction(actionButton.dataset.action);
                }
            });

            this.panel.addEventListener('input', event => {
                const brushSetting = event.target.dataset.brushSetting;

                if (brushSetting) {
                    this.setBrushSetting(
                        brushSetting,
                        Number(event.target.value)
                    );
                    return;
                }

                if (event.target.dataset.setting === 'blend') {
                    this.setBlendEdge(Number(event.target.value));
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
                    Math.min(
                        event.clientX - this.drag.offsetX,
                        window.innerWidth - width
                    )
                );

                const top = Math.max(
                    0,
                    Math.min(
                        event.clientY - this.drag.offsetY,
                        window.innerHeight - height
                    )
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

        setPage(page) {
            if (page !== 'main' && page !== 'brush') return;

            this.activePage = page;

            const mainPage = this.panel.querySelector('.selection-main-page');
            const brushPage = this.panel.querySelector('.selection-brush-page');
            const subtitle = this.panel.querySelector('.selection-header-subtitle');

            mainPage.hidden = page !== 'main';
            brushPage.hidden = page !== 'brush';

            subtitle.textContent = page === 'brush'
                ? 'Brush Settings'
                : 'Selection Tools';
        },

        openBrushPage() {
            this.setPage('brush');
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

            if (mode === 'brush') {
                this.openBrushPage();
            } else {
                this.setPage('main');
            }

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

        setBrushMode(mode) {
            if (mode !== 'add' && mode !== 'subtract') return;

            this.brushSettings.mode = mode;

            this.panel.querySelectorAll('[data-brush-mode]').forEach(button => {
                const active = button.dataset.brushMode === mode;

                button.classList.toggle('active', active);
                button.setAttribute('aria-pressed', String(active));
            });

            this.syncBrushSettings();
        },

        setBrushSetting(setting, value) {
            if (!Number.isFinite(value)) return;

            const limits = {
                size: [1, 500],
                hardness: [0, 100],
                opacity: [0, 100]
            };

            if (!limits[setting]) return;

            const [min, max] = limits[setting];

            this.brushSettings[setting] = Math.max(
                min,
                Math.min(max, value)
            );

            this.updateBrushUI();
            this.syncBrushSettings();
        },

        updateBrushUI() {
            const values = this.brushSettings;

            const size = this.panel.querySelector('[data-brush-setting="size"]');
            const hardness = this.panel.querySelector('[data-brush-setting="hardness"]');
            const opacity = this.panel.querySelector('[data-brush-setting="opacity"]');

            if (!size || !hardness || !opacity) return;

            size.value = values.size;
            hardness.value = values.hardness;
            opacity.value = values.opacity;

            this.panel.querySelector('.selection-brush-size-value').textContent =
                `${values.size} px`;

            this.panel.querySelector('.selection-brush-hardness-value').textContent =
                `${values.hardness}%`;

            this.panel.querySelector('.selection-brush-opacity-value').textContent =
                `${values.opacity}%`;

            this.panel.querySelectorAll('[data-brush-mode]').forEach(button => {
                const active = button.dataset.brushMode === values.mode;

                button.classList.toggle('active', active);
                button.setAttribute('aria-pressed', String(active));
            });
        },

        syncBrushSettings() {
            window.PhotoCookSelectionBrush?.configure?.(
                this.brushSettings
            );

            this.emit('brushsettings', {
                settings: { ...this.brushSettings }
            });
        },

        setBlendEdge(value) {
            if (!Number.isFinite(value)) return;

            const nextValue = Math.max(0, Math.min(100, value));

            if (nextValue === this.blendEdge) return;

            this.blendEdge = nextValue;
            this.updateBlendUI();

            clearTimeout(this.blendEdgeTimer);

            this.blendEdgeTimer = setTimeout(() => {
                this.emit('blendchange', {
                    feather: this.blendEdge
                });
            }, 150);
        },

        updateBlendUI() {
            const slider = this.panel.querySelector('[data-setting="blend"]');
            const label = this.panel.querySelector('.selection-blend-value');

            if (!slider || !label) return;

            slider.value = this.blendEdge;
            label.textContent = `${this.blendEdge} px`;
        },

        runAction(action) {
            if (action === 'brush-back') {
                this.setPage('main');
                return;
            }

            if (action === 'deselect' || action === 'invert') {
                this.emit(action);
            }
        },

        shouldApplySelection(toolName) {
            if (!toolName) return false;

            return this.selectionAwareTools.has(
                String(toolName).toLowerCase()
            );
        },

        getSelectionAwareTools() {
            return [...this.selectionAwareTools];
        },

        getBlendEdge() {
            return this.blendEdge;
        },

        getBrushSettings() {
            return { ...this.brushSettings };
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
