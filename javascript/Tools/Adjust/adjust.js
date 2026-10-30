
/* PhotoCook — Adjust Tool | Stage 1: UI & Controls */

window.PhotoCookAdjust = (() => {
    'use strict';

    const GROUPS = {
        Light: ['Exposure', 'Brightness', 'Contrast', 'Highlights', 'Shadows', 'Whites', 'Blacks'],
        Color: ['Temperature', 'Tint', 'Saturation', 'Vibrance'],
        Details: ['Sharpening', 'Clarity', 'Texture'],
        Effects: ['Dehaze', 'Fade', 'Vignette', 'Grain']
    };

    const RANGES = {
        Exposure: { min: -5, max: 5, step: 0.1 },
        Brightness: { min: -100, max: 100, step: 1 },
        Contrast: { min: -100, max: 100, step: 1 },
        Highlights: { min: -100, max: 100, step: 1 },
        Shadows: { min: -100, max: 100, step: 1 },
        Whites: { min: -100, max: 100, step: 1 },
        Blacks: { min: -100, max: 100, step: 1 },
        Temperature: { min: -100, max: 100, step: 1 },
        Tint: { min: -100, max: 100, step: 1 },
        Saturation: { min: -100, max: 100, step: 1 },
        Vibrance: { min: -100, max: 100, step: 1 },
        Sharpening: { min: 0, max: 100, step: 1 },
        Clarity: { min: -100, max: 100, step: 1 },
        Texture: { min: -100, max: 100, step: 1 },
        Dehaze: { min: -100, max: 100, step: 1 },
        Fade: { min: 0, max: 100, step: 1 },
        Vignette: { min: -100, max: 100, step: 1 },
        Grain: { min: 0, max: 100, step: 1 }
    };

    const DEFAULTS = Object.fromEntries(
        Object.keys(RANGES).map(key => [key, 0])
    );

    let values = { ...DEFAULTS };
    let activeGroup = 'Light';
    let activeAdjustment = 'Exposure';
    let panel = null;
    let initialized = false;
    let onChangeCallback = null;
    let targetLayer = null;

    function init(buttonId = 'adjust', onChange = null) {
        if (initialized) return;

        const button = document.getElementById(buttonId);
        if (!button) {
            console.warn('PhotoCook Adjust: Button not found.');
            return;
        }

        onChangeCallback = typeof onChange === 'function' ? onChange : null;

        button.addEventListener('click', () => {
            if (panel) close();
            else open();
        });

        initialized = true;
    }

    function createPanel() {
        const element = document.createElement('div');
        element.id = 'adjust-sub-toolbar';

        element.innerHTML = `
            <div class="adjust-header">
                <span class="adjust-title">ADJUST</span>
                <button class="adjust-close-btn" type="button" aria-label="Close Adjust Tool">×</button>
            </div>

            <div class="adjust-tabs" role="tablist" aria-label="Adjustment sections"></div>

            <div class="adjust-slider-row">
                <label class="adjust-slider-label" for="adjust-active-slider">Exposure</label>
                <input id="adjust-active-slider" type="range" min="-5" max="5" step="0.1" value="0">
                <output class="adjust-slider-value" for="adjust-active-slider">0</output>
            </div>

            <div class="adjust-options" aria-label="Adjustment controls"></div>

            <div class="adjust-footer">
                <button class="adjust-reset-btn" type="button">↺ Reset</button>
                <button class="adjust-done-btn" type="button">Done</button>
            </div>
        `;

        document.body.appendChild(element);
        panel = element;

        panel.querySelector('.adjust-close-btn').addEventListener('click', close);
        panel.querySelector('.adjust-done-btn').addEventListener('click', close);
        panel.querySelector('.adjust-reset-btn').addEventListener('click', resetActive);

        const slider = panel.querySelector('#adjust-active-slider');

        slider.addEventListener('input', () => {
            values[activeAdjustment] = Number(slider.value);

            saveAdjustments({
                [activeAdjustment]: values[activeAdjustment]
            });

            updateSlider();
            notifyChange();
        });
        setupHorizontalDrag(panel.querySelector('.adjust-tabs'));
        setupHorizontalDrag(panel.querySelector('.adjust-options'));

        renderTabs();
        renderOptions();
        updateSlider();
    }

    function renderTabs() {
        if (!panel) return;

        const container = panel.querySelector('.adjust-tabs');
        container.replaceChildren();

        Object.keys(GROUPS).forEach(group => {
            const button = document.createElement('button');
            button.type = 'button';
            button.className = 'adjust-tab';
            button.textContent = group;
            button.setAttribute('role', 'tab');
            button.setAttribute('aria-selected', String(activeGroup === group));

            if (activeGroup === group) button.classList.add('active');

            button.addEventListener('click', () => {
                activeGroup = group;
                activeAdjustment = GROUPS[group][0];

                renderTabs();
                renderOptions();
                updateSlider();
            });

            container.appendChild(button);
        });
    }

    function renderOptions() {
        if (!panel) return;

        const container = panel.querySelector('.adjust-options');
        container.replaceChildren();

        GROUPS[activeGroup].forEach(name => {
            const button = document.createElement('button');
            button.type = 'button';
            button.className = 'adjust-option';
            button.textContent = name;

            if (activeAdjustment === name) button.classList.add('active');

            button.addEventListener('click', () => {
                activeAdjustment = name;
                renderOptions();
                updateSlider();
            });

            container.appendChild(button);
        });
    }

    function updateSlider() {
        if (!panel) return;

        const config = RANGES[activeAdjustment];
        const slider = panel.querySelector('#adjust-active-slider');
        const label = panel.querySelector('.adjust-slider-label');
        const output = panel.querySelector('.adjust-slider-value');

        slider.min = config.min;
        slider.max = config.max;
        slider.step = config.step;
        slider.value = values[activeAdjustment];

        label.textContent = activeAdjustment;
        output.textContent = formatValue(activeAdjustment, values[activeAdjustment]);

        const percent = ((values[activeAdjustment] - config.min) / (config.max - config.min)) * 100;
        slider.style.setProperty('--adjust-progress', `${percent}%`);
    }

    function formatValue(name, value) {
        if (name === 'Exposure') return Number(value).toFixed(1);
        return String(Math.round(value));
    }

    function saveAdjustments(changes) {
        if (!targetLayer || !targetLayer.img || targetLayer.type === 'text') return;

        targetLayer.adjustments = {
            ...(targetLayer.adjustments || {}),
            ...changes
        };
    }

    function resetActive() {
        values[activeAdjustment] = DEFAULTS[activeAdjustment];

        saveAdjustments({
            [activeAdjustment]: values[activeAdjustment]
        });

        updateSlider();
        notifyChange();
    }

    function resetAll() {
        values = { ...DEFAULTS };

        if (targetLayer) targetLayer.adjustments = {};

        updateSlider();
        notifyChange();
    }

    function getValues() {
        return { ...values };
    }

    function setValues(newValues = {}) {
        Object.entries(newValues).forEach(([name, value]) => {
            if (!Object.prototype.hasOwnProperty.call(RANGES, name)) return;

            const config = RANGES[name];
            const number = Number(value);
            if (!Number.isFinite(number)) return;

            values[name] = Math.max(config.min, Math.min(config.max, number));
        });

        saveAdjustments(values);

        updateSlider();
        notifyChange();
    }

    function notifyChange() {
        if (targetLayer) {
            window.PhotoCookAdjustProcessor?.invalidate(targetLayer);
        }

        window.PhotoCookInteraction?.redrawCanvas();

        if (onChangeCallback) onChangeCallback(getValues());
    }

    function setupHorizontalDrag(container) {
        let startX = 0;
        let startScroll = 0;
        let dragging = false;
        let moved = false;

        container.addEventListener('pointerdown', event => {
            if (event.pointerType === 'touch') return;
            if (event.button !== 0) return;

            dragging = true;
            moved = false;
            startX = event.clientX;
            startScroll = container.scrollLeft;
        });

        container.addEventListener('pointermove', event => {
            if (!dragging) return;

            const distance = event.clientX - startX;

            if (Math.abs(distance) > 5) moved = true;
            if (moved) container.scrollLeft = startScroll - distance;
        });

        const stopDragging = () => {
            dragging = false;
        };

        container.addEventListener('pointerup', stopDragging);
        container.addEventListener('pointercancel', stopDragging);
        container.addEventListener('pointerleave', stopDragging);

        container.addEventListener('click', event => {
            if (!moved) return;
            event.preventDefault();
            event.stopPropagation();
            moved = false;
        }, true);

        container.addEventListener('wheel', event => {
            if (container.scrollWidth <= container.clientWidth) return;

            if (Math.abs(event.deltaY) > Math.abs(event.deltaX)) {
                event.preventDefault();
                container.scrollLeft += event.deltaY;
            }
        }, { passive: false });
    }

    function open() {
        if (panel) return;

        const manager = window.PhotoCookLayerManager;
        const layer = manager?.getSelectedLayer();
        targetLayer = layer;

        if (!layer || !layer.img || layer.type === 'text') {
            console.warn('PhotoCook Adjust: Select an image layer first.');
            return;
        }

        values = {
            ...DEFAULTS,
            ...(manager.getSelectedLayerAdjustments() || {})
        };

        if (window.PhotoCookCrop?.close) window.PhotoCookCrop.close();
        if (window.PhotoCookText?.close) window.PhotoCookText.close();

        createPanel();

        window.PhotoCookToolState?.open('adjust');

        document.getElementById('adjust')?.classList.add('active');
    }

    function close() {
        if (!panel) return;

        panel.remove();
        panel = null;
        targetLayer = null;

        if (window.PhotoCookToolState?.activeTool === 'adjust') {
            window.PhotoCookToolState.close();
        }

        document.getElementById('adjust')?.classList.remove('active');
    }

    function isOpen() {
        return Boolean(panel);
    }

    return {
        init,
        open,
        close,
        isOpen,
        getValues,
        setValues,
        resetActive,
        resetAll
    };
})();
