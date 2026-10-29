
/* PhotoCook — Text Tool */
window.PhotoCookText = (() => {
    'use strict';

    let textToolbarEl = null;
    let onTextAddCallback = null;
    let editingLayer = null;
    let activeTab = 'basic';
    let draft = {};

    const FONTS = [
        'Arial', 'Inter', 'Roboto', 'Montserrat',
        'Playfair Display', 'Oswald', 'Courier New', 'Georgia'
    ];

    const DEFAULTS = {
        type: 'text',
        text: 'Your paragraph text',
        fontFamily: 'Arial',
        fontSize: 48,
        isBold: false,
        isItalic: false,
        isUnderline: false,
        fill: '#000000',
        strokeColor: '#000000',
        strokeWidth: 0,
        shadowEnabled: false,
        shadowColor: '#000000',
        shadowOffsetX: 0,
        shadowOffsetY: 0,
        shadowBlur: 0,
        shadowOpacity: 50,
        glowEnabled: false,
        glowColor: '#8b5cf6',
        glowIntensity: 50,
        glowType: 'soft',
        labelEnabled: false,
        labelPreset: 'rectangle',
        labelColor: '#ffff00',
        labelColor2: '#8b5cf6',
        labelPadding: 12,
        labelRadius: 12,
        labelOpacity: 100,
        opacity: 100,
        letterSpacing: 0,
        lineSpacing: 0,
        align: 'left',
        rotation: 0
    };

        const LABEL_PRESETS = [
        { id: 'rectangle', name: 'Rectangle' },
        { id: 'rounded', name: 'Rounded' },
        { id: 'pill', name: 'Pill' },
        { id: 'outline', name: 'Outline' },
        { id: 'underline', name: 'Underline Bar' },
        { id: 'highlight', name: 'Highlight' },
        { id: 'side-accent', name: 'Side Accent' },
        { id: 'ribbon', name: 'Ribbon' },
        { id: 'gradient', name: 'Gradient' },
        { id: 'speech', name: 'Speech Bubble' },
        { id: 'sticker', name: 'Sticker' },
        { id: 'double-border', name: 'Double Border' },
        { id: 'neon', name: 'Neon Frame' },
        { id: 'glass', name: 'Glass' },
        { id: 'marker', name: 'Marker Stroke' },
        { id: 'slanted', name: 'Slanted' },
        { id: 'cut-corners', name: 'Cut Corners' },
        { id: 'bracket', name: 'Bracket' },
        { id: 'top-bottom', name: 'Top & Bottom' },
        { id: 'banner', name: 'Banner' }
    ];

    function renderLabelPresets(selected) {
        return LABEL_PRESETS.map(preset => `
            <button type="button"
                class="text-tb-label-preset ${selected === preset.id ? 'active' : ''}"
                data-label-preset="${preset.id}"
                title="${preset.name}">
                <span class="text-tb-label-preview label-preview-${preset.id}">Aa</span>
                <span class="text-tb-label-name">${preset.name}</span>
            </button>
        `).join('');
    }

    function init(buttonId, callback) {
        onTextAddCallback = callback;
        document.getElementById(buttonId)?.addEventListener('click', toggleTextToolbar);
    }

    function getSelectedTextLayer() {
        const layer = window.PhotoCookLayerManager?.getSelectedLayer();
        return layer?.type === 'text' ? layer : null;
    }

    function toggleTextToolbar() {
        if (textToolbarEl) closeTextToolbar();
        else openTextToolbar();
    }

    function selectTextLayer(layer) {
        if (!layer || layer.type !== 'text') return;

        if (!textToolbarEl) {
            openTextToolbar(layer);
            return;
        }

        if (editingLayer === layer) return;

        editingLayer = layer;
        draft = { ...DEFAULTS, ...layer };

        const currentTab = activeTab;
        renderToolbarUI();
        bindToolbarEvents();

        ['basic', 'style', 'adjust'].forEach(tab => {
            document.getElementById(`tab-${tab}-btn`).classList.toggle('active', tab === currentTab);
            document.getElementById(`section-${tab}`).classList.toggle('active', tab === currentTab);
        });
    }

    function openTextToolbar(layer = null) {
        if (textToolbarEl) closeTextToolbar();

        editingLayer = layer || getSelectedTextLayer();
        draft = { ...DEFAULTS, ...(editingLayer || {}) };
        activeTab = 'basic';

        window.PhotoCookToolState?.open('text');

        const mainToolbar = document.getElementById('toolbar');
        if (mainToolbar) mainToolbar.style.display = 'none';

        textToolbarEl = document.createElement('div');
        textToolbarEl.id = 'text-sub-toolbar';
        document.body.appendChild(textToolbarEl);

        renderToolbarUI();
        bindToolbarEvents();
        document.getElementById('text-tb-content-input')?.focus();
    }

    function escapeHTML(value) {
        return String(value ?? '').replace(/&/g, '&amp;').replace(/</g, '&lt;')
            .replace(/>/g, '&gt;').replace(/"/g, '&quot;').replace(/'/g, '&#39;');
    }

    function slider(id, label, min, max, value, unit = '') {
        return `
            <div class="text-tb-field">
                <label for="${id}">${label} (<span id="${id}-val">${value}</span>${unit})</label>
                <input type="range" id="${id}" min="${min}" max="${max}" value="${value}">
            </div>
        `;
    }

    function colorField(id, label, value) {
        return `
            <div class="text-tb-field">
                <label for="${id}">${label}</label>
                <input type="color" id="${id}" value="${value}">
            </div>
        `;
    }

    function styleGroup(title, content, open = false) {
     const id = title.toLowerCase().replace(/\s+/g, '-');
     return `<div class="text-tb-style-panel ${open ? 'active' : ''}" data-style-panel="${id}"><div class="text-tb-style-group-content">${content}</div></div>`;
    }
    function renderToolbarUI() {
        const d = draft;

        textToolbarEl.innerHTML = `
            <div class="text-tb-top-bar">
                <div class="text-tb-tabs">
                    <button type="button" id="tab-basic-btn" class="text-tb-tab active">BASIC</button>
                    <button type="button" id="tab-style-btn" class="text-tb-tab">STYLE</button>
                    <button type="button" id="tab-adjust-btn" class="text-tb-tab">ADJUST</button>
                </div>
                <div class="text-tb-actions">
                    <button type="button" id="text-tb-add-btn">+ Add Text</button>
                    <button type="button" id="text-tb-close-btn" class="text-tb-icon-btn" title="Close">✕</button>
                </div>
            </div>

            <div class="text-tb-content">

                <!-- BASIC -->
                <div id="section-basic" class="text-tb-section active">
                    <div class="text-tb-field">
                        <label for="text-tb-input">Text Content</label>
                        <textarea id="text-tb-content-input" rows="3" placeholder="Type your text here...">${escapeHTML(d.text)}</textarea>
                    </div>

                    <div class="text-tb-field">
                        <label for="text-tb-font">Font Family</label>
                        <select id="text-tb-font">
                            ${FONTS.map(font => `<option value="${font}" style="font-family:'${font}'" ${font === d.fontFamily ? 'selected' : ''}>${font}</option>`).join('')}
                        </select>
                    </div>

                    <div class="text-tb-field">
                        <label>Font Style</label>
                        <div class="text-tb-btn-group">
                            <button type="button" id="text-tb-btn-bold" class="text-tb-toggle-btn ${d.isBold ? 'active' : ''}"><b>B</b></button>
                            <button type="button" id="text-tb-btn-italic" class="text-tb-toggle-btn ${d.isItalic ? 'active' : ''}"><i>I</i></button>
                            <button type="button" id="text-tb-btn-underline" class="text-tb-toggle-btn ${d.isUnderline ? 'active' : ''}"><u>U</u></button>
                        </div>
                    </div>
                </div>

                <!-- STYLE -->
                <!-- STYLE -->
                <div id="section-style" class="text-tb-section">
                    <div class="text-tb-style-tabs">
                        <button type="button" class="text-tb-style-tab active" data-style-tab="text-color">Text Color</button>
                        <button type="button" class="text-tb-style-tab" data-style-tab="border">Border</button>
                        <button type="button" class="text-tb-style-tab" data-style-tab="shadow">Shadow</button>
                        <button type="button" class="text-tb-style-tab" data-style-tab="glow">Glow</button>
                        <button type="button" class="text-tb-style-tab" data-style-tab="label">Label</button>
                        <button type="button" class="text-tb-style-tab" data-style-tab="layer-opacity">Opacity</button>
                    </div>

                    ${styleGroup('Text Color', colorField('text-tb-color', 'Color', d.fill), true)}
                    ${styleGroup('Border', `
                        ${colorField('text-tb-stroke-color', 'Border Color', d.strokeColor)}
                        ${slider('text-tb-stroke-width', 'Border Width', 0, 30, d.strokeWidth, 'px')}
                    `)}

                    ${styleGroup('Shadow', `
                        <div class="text-tb-field">
                            <label class="text-tb-checkbox-label">
                                <input type="checkbox" id="text-tb-shadow-enabled" ${d.shadowEnabled ? 'checked' : ''}>
                                Enable Shadow
                            </label>
                        </div>
                        ${colorField('text-tb-shadow-color', 'Shadow Color', d.shadowColor)}
                        ${slider('text-tb-shadow-x', 'X Axis', -100, 100, d.shadowOffsetX, 'px')}
                        ${slider('text-tb-shadow-y', 'Y Axis', -100, 100, d.shadowOffsetY, 'px')}
                        ${slider('text-tb-shadow-blur', 'Shadow Blur', 0, 100, d.shadowBlur, 'px')}
                        ${slider('text-tb-shadow-opacity', 'Shadow Opacity', 0, 100, d.shadowOpacity, '%')}
                    `)}

                    ${styleGroup('Glow', `
                            <div class="text-tb-field">
                                <label class="text-tb-checkbox-label">
                                    <input type="checkbox" id="text-tb-glow-enabled" ${d.glowEnabled ? 'checked' : ''}>
                                    Enable Glow
                                </label>
                            </div>
                            ${colorField('text-tb-glow-color', 'Glow Color', d.glowColor)}
                            ${slider('text-tb-glow-intensity', 'Glow Intensity', 0, 100, d.glowIntensity, '%')}
                            <div class="text-tb-field">
                                <label for="text-tb-glow-type">Glow Type</label>
                                <select id="text-tb-glow-type">
                                    <option value="soft" ${d.glowType === 'soft' ? 'selected' : ''}>Soft Glow</option>
                                    <option value="strong" ${d.glowType === 'strong' ? 'selected' : ''}>Strong Glow</option>
                                    <option value="outline" ${d.glowType === 'outline' ? 'selected' : ''}>Outline Glow</option>
                                </select>
                            </div>
                        `)}

                    ${styleGroup('Label', `
                        <div class="text-tb-field">
                            <label class="text-tb-checkbox-label">
                                <input type="checkbox" id="text-tb-label-enabled" ${d.labelEnabled ? 'checked' : ''}>
                                Enable Label
                            </label>
                        </div>

                        <div class="text-tb-label-presets-container">
                            <label class="text-tb-label-heading">Label Presets</label>
                            <div class="text-tb-label-presets">
                                ${renderLabelPresets(d.labelPreset)}
                            </div>
                        </div>

                        <div class="text-tb-label-controls">
                            ${colorField('text-tb-label-color', 'Label Color', d.labelColor)}
                            ${colorField('text-tb-label-color2', 'Secondary Color', d.labelColor2)}
                            ${slider('text-tb-label-padding', 'Label Padding', 0, 100, d.labelPadding, 'px')}
                            ${slider('text-tb-label-radius', 'Corner Radius', 0, 100, d.labelRadius, 'px')}
                            ${slider('text-tb-label-opacity', 'Label Opacity', 0, 100, d.labelOpacity, '%')}
                        </div>
                    `)}
                    ${styleGroup('Layer Opacity', slider('text-tb-opacity', 'Text Layer Opacity', 0, 100, d.opacity, '%'))}
                </div>

                <!-- ADJUST -->
                <div id="section-adjust" class="text-tb-section">
                    <div class="text-tb-grid">
                        ${slider('text-tb-size', 'Text Size', 12, 300, d.fontSize, 'px')}
                        ${slider('text-tb-spacing', 'Letter Spacing', -10, 50, d.letterSpacing, 'px')}
                        ${slider('text-tb-line-spacing', 'Vertical Spacing', -20, 100, d.lineSpacing, 'px')}
                    </div>

                    <div class="text-tb-field">
                        <label>Text Alignment</label>
                        <div class="text-tb-btn-group">
                            <button type="button" id="text-tb-align-left" class="text-tb-toggle-btn ${d.align === 'left' ? 'active' : ''}">Left</button>
                            <button type="button" id="text-tb-align-center" class="text-tb-toggle-btn ${d.align === 'center' ? 'active' : ''}">Center</button>
                            <button type="button" id="text-tb-align-right" class="text-tb-toggle-btn ${d.align === 'right' ? 'active' : ''}">Right</button>
                        </div>
                    </div>
                </div>
            </div>
        `;
    }

    

    function redraw() {
        if (window.PhotoCookInteraction?.redrawCanvas) window.PhotoCookInteraction.redrawCanvas();
        else window.PhotoCookEngine?.render();
    }

    function updateLive() {
    if (!editingLayer || !editingLayer.isSelected) return;

        const properties = [
            'text', 'fontFamily', 'fontSize', 'isBold', 'isItalic', 'isUnderline',
            'fill', 'strokeColor', 'strokeWidth', 'shadowEnabled', 'shadowColor', 'shadowOffsetX',
            'shadowOffsetY', 'shadowBlur', 'shadowOpacity', 'glowEnabled',
            'glowColor', 'glowIntensity', 'glowType','labelEnabled', 'labelPreset', 
            'labelColor', 'labelColor2','labelPadding', 'labelRadius', 'labelOpacity',
            'opacity','letterSpacing', 'lineSpacing', 'align'
        ];

        properties.forEach(key => editingLayer[key] = draft[key]);
        redraw();
    }

    function bindToolbarEvents() {
        const $ = id => document.getElementById(id);
        const tabs = ['basic', 'style', 'adjust'];

        // Tabs
        tabs.forEach(tab => {
            $(`tab-${tab}-btn`).addEventListener('click', () => {
                activeTab = tab;
                tabs.forEach(name => {
                    $(`tab-${name}-btn`).classList.toggle('active', name === tab);
                    $(`section-${name}`).classList.toggle('active', name === tab);
                });
            });
        });



        // Style subsection navigation
        const styleTabs = textToolbarEl.querySelectorAll('.text-tb-style-tab');
        const stylePanels = textToolbarEl.querySelectorAll('.text-tb-style-panel');

        styleTabs.forEach(tab => {
            tab.addEventListener('click', () => {
                const selected = tab.dataset.styleTab;
                styleTabs.forEach(item => item.classList.toggle('active', item === tab));
                stylePanels.forEach(panel => panel.classList.toggle('active', panel.dataset.stylePanel === selected));
            });
        });

        // Mouse grab-and-drag scrolling for Style tabs
        const styleTabBar = textToolbarEl.querySelector('.text-tb-style-tabs');
        let isDragging = false, dragStartX = 0, dragStartScroll = 0, didDrag = false;

        styleTabBar.addEventListener('pointerdown', e => {
            if (e.pointerType !== 'mouse' || e.button !== 0) return;
            isDragging = true;
            didDrag = false;
            dragStartX = e.clientX;
            dragStartScroll = styleTabBar.scrollLeft;
        });

        styleTabBar.addEventListener('pointermove', e => {
            if (!isDragging) return;
            const distance = e.clientX - dragStartX;
            if (Math.abs(distance) > 5) {
                didDrag = true;
                styleTabBar.classList.add('is-dragging');
                styleTabBar.setPointerCapture(e.pointerId);
            }
            if (didDrag) styleTabBar.scrollLeft = dragStartScroll - distance;
        });

        function stopStyleDrag() {
            isDragging = false;
            styleTabBar.classList.remove('is-dragging');
        }

        styleTabBar.addEventListener('pointerup', stopStyleDrag);
        styleTabBar.addEventListener('pointercancel', stopStyleDrag);

        styleTabBar.addEventListener('click', e => {
            if (!didDrag) return;
            e.preventDefault();
            e.stopPropagation();
            didDrag = false;
        }, true);

                // Label preset gallery — mouse grab scrolling
        const labelGallery = textToolbarEl.querySelector('.text-tb-label-presets');

        if (labelGallery) {
            let dragging = false, startX = 0, startScroll = 0, moved = false;

            labelGallery.addEventListener('pointerdown', e => {
                if (e.pointerType !== 'mouse' || e.button !== 0) return;
                dragging = true;
                moved = false;
                startX = e.clientX;
                startScroll = labelGallery.scrollLeft;
            });

            labelGallery.addEventListener('pointermove', e => {
                if (!dragging) return;
                const distance = e.clientX - startX;

                if (Math.abs(distance) > 5) {
                    moved = true;
                    labelGallery.classList.add('is-dragging');
                    if (!labelGallery.hasPointerCapture(e.pointerId)) labelGallery.setPointerCapture(e.pointerId);
                }

                if (moved) labelGallery.scrollLeft = startScroll - distance;
            });

            const stopLabelDrag = () => {
                dragging = false;
                labelGallery.classList.remove('is-dragging');
            };

            labelGallery.addEventListener('pointerup', stopLabelDrag);
            labelGallery.addEventListener('pointercancel', stopLabelDrag);

            labelGallery.addEventListener('click', e => {
                if (!moved) return;
                e.preventDefault();
                e.stopPropagation();
                moved = false;
            }, true);
        }

        // Text and font
        $('text-tb-content-input').addEventListener('input', e => {
            draft.text = e.target.value;
            updateLive();
        });

        $('text-tb-font').addEventListener('change', async e => {
            draft.fontFamily = e.target.value;
            updateLive();

            try {
                const style = `${draft.isItalic ? 'italic ' : ''}${draft.isBold ? '700 ' : '400 '}`;
                await document.fonts.load(`${style}48px "${draft.fontFamily}"`);
                updateLive();
                redraw();
            } catch (error) {
                console.warn('Font loading failed:', draft.fontFamily, error);
            }
        });

        // Formatting toggles
        function bindToggle(id, property) {
            $(id).addEventListener('click', e => {
                draft[property] = !draft[property];
                e.currentTarget.classList.toggle('active', draft[property]);
                updateLive();
            });
        }

        bindToggle('text-tb-btn-bold', 'isBold');
        bindToggle('text-tb-btn-italic', 'isItalic');
        bindToggle('text-tb-btn-underline', 'isUnderline');

        // Color pickers
        function bindColor(id, property) {
            $(id).addEventListener('input', e => {
                draft[property] = e.target.value;
                updateLive();
            });
        }

        bindColor('text-tb-color', 'fill');
        bindColor('text-tb-stroke-color', 'strokeColor');
        bindColor('text-tb-shadow-color', 'shadowColor');
        bindColor('text-tb-glow-color', 'glowColor');
        bindColor('text-tb-label-color', 'labelColor');
        bindColor('text-tb-label-color2', 'labelColor2');

        // Sliders
        function bindSlider(id, property) {
            $(id).addEventListener('input', e => {
                draft[property] = Number(e.target.value);
                $(`${id}-val`).textContent = e.target.value;
                updateLive();
            });
        }

        bindSlider('text-tb-size', 'fontSize');
        bindSlider('text-tb-spacing', 'letterSpacing');
        bindSlider('text-tb-line-spacing', 'lineSpacing');
        bindSlider('text-tb-stroke-width', 'strokeWidth');
        bindSlider('text-tb-shadow-x', 'shadowOffsetX');
        bindSlider('text-tb-shadow-y', 'shadowOffsetY');
        bindSlider('text-tb-shadow-blur', 'shadowBlur');
        bindSlider('text-tb-shadow-opacity', 'shadowOpacity');
        bindSlider('text-tb-glow-intensity', 'glowIntensity');
        bindSlider('text-tb-label-padding', 'labelPadding');
        bindSlider('text-tb-label-radius', 'labelRadius');
        bindSlider('text-tb-label-opacity', 'labelOpacity');
        bindSlider('text-tb-opacity', 'opacity');




        // Shadow enable / disable
        $('text-tb-shadow-enabled').addEventListener('change', e => {
            draft.shadowEnabled = e.target.checked;
            updateLive();
        });


        // Glow and label
        $('text-tb-glow-type').addEventListener('change', e => {
            draft.glowType = e.target.value;
            updateLive();
        });

        $('text-tb-glow-enabled').addEventListener('change', e => {
            draft.glowEnabled = e.target.checked;
            updateLive();
        });

        $('text-tb-label-enabled').addEventListener('change', e => {
            draft.labelEnabled = e.target.checked;
            updateLive();
        });

        textToolbarEl.querySelectorAll('.text-tb-label-preset').forEach(button => {
            button.addEventListener('click', () => {
                draft.labelPreset = button.dataset.labelPreset;
                draft.labelEnabled = true;

                $('text-tb-label-enabled').checked = true;

                textToolbarEl.querySelectorAll('.text-tb-label-preset').forEach(item => {
                    item.classList.toggle('active', item === button);
                });

                updateLive();
            });
        });

        // Alignment
        ['left', 'center', 'right'].forEach(align => {
            $(`text-tb-align-${align}`).addEventListener('click', () => {
                draft.align = align;
                ['left', 'center', 'right'].forEach(name => {
                    $(`text-tb-align-${name}`).classList.toggle('active', name === align);
                });
                updateLive();
            });
        });

        // Add a new text layer
        $('text-tb-add-btn').addEventListener('click', () => {
            const textConfig = { ...draft, type: 'text', rotation: 0 };

            [
                'x', 'y', 'width', 'height', 'isSelected', 'handleBounds',
                'img', 'textPaddingX', 'textPaddingY'
            ].forEach(key => delete textConfig[key]);

            onTextAddCallback?.(textConfig);
            editingLayer = getSelectedTextLayer();
        });

        $('text-tb-close-btn').addEventListener('click', closeTextToolbar);
    }

        function onLayerDeleted(layer) {
        if (editingLayer !== layer) return;

        editingLayer = null;
        draft = { ...DEFAULTS };

        if (textToolbarEl) {
            renderToolbarUI();
            bindToolbarEvents();

            ['basic', 'style', 'adjust'].forEach(tab => {
                document.getElementById(`tab-${tab}-btn`).classList.toggle('active', tab === activeTab);
                document.getElementById(`section-${tab}`).classList.toggle('active', tab === activeTab);
            });
        }
    }

    function closeTextToolbar() {
        textToolbarEl?.remove();
        textToolbarEl = null;
        editingLayer = null;

        window.PhotoCookToolState?.close();

        const mainToolbar = document.getElementById('toolbar');
        if (mainToolbar) mainToolbar.style.display = 'flex';

        redraw();
    }

    return { init, toggleTextToolbar, openTextToolbar, closeTextToolbar, selectTextLayer, onLayerDeleted };
})();
