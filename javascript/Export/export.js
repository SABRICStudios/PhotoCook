
/* PhotoCook — Export Module */
(() => {
    'use strict';

    let isExporting = false;
    let exportDialog = null;
    let selectedImageLayer = null;

    const FORMATS = {
        png: { mime: 'image/png', extension: 'png' },
        jpeg: { mime: 'image/jpeg', extension: 'jpg' },
        webp: { mime: 'image/webp', extension: 'webp' }
    };

    function createDialog() {
        if (exportDialog) return exportDialog;

        const style = document.createElement('style');
        style.textContent = `
            #pc-export-dialog {
                position: fixed;
                inset: 0;
                z-index: 99999;
                display: none;
                align-items: center;
                justify-content: center;
                padding: 18px;
                background: rgba(0,0,0,.65);
                font-family: inherit;
            }
            #pc-export-dialog.open { display: flex; }
            #pc-export-dialog .pc-export-box {
                width: 100%;
                max-width: 390px;
                padding: 22px;
                border-radius: 12px;
                background: var(--panel-bg, #202020);
                color: var(--text-color, #fff);
                border: 1px solid var(--border-color, #383838);
                box-shadow: 0 15px 50px rgba(0,0,0,.35);
            }
            #pc-export-dialog h3 {
                margin: 0 0 18px;
                font-size: 19px;
            }
            #pc-export-dialog .pc-export-label {
                display: block;
                margin: 15px 0 8px;
                font-size: 13px;
                opacity: .75;
            }
            #pc-export-dialog select {
                width: 100%;
                padding: 11px;
                border-radius: 7px;
                border: 1px solid var(--border-color, #444);
                background: var(--input-bg, #292929);
                color: inherit;
                font: inherit;
            }
            #pc-export-dialog .pc-export-actions {
                display: flex;
                gap: 10px;
                margin-top: 22px;
            }
            #pc-export-dialog button {
                flex: 1;
                padding: 11px;
                border: 0;
                border-radius: 7px;
                cursor: pointer;
                font: inherit;
                font-weight: 600;
            }
            #pc-export-dialog .pc-export-cancel {
                background: var(--input-bg, #333);
                color: inherit;
            }
            #pc-export-dialog .pc-export-start {
                background: var(--accent-color, #e0e0e0);
                color: var(--accent-text, #111);
            }
            #pc-export-dialog button:disabled {
                opacity: .55;
                cursor: not-allowed;
            }
            #pc-export-dialog .pc-export-note {
                margin: 10px 0 0;
                font-size: 12px;
                line-height: 1.5;
                opacity: .65;
            }
        `;
        document.head.appendChild(style);

        const overlay = document.createElement('div');
        overlay.id = 'pc-export-dialog';

        overlay.innerHTML = `
            <div class="pc-export-box">
                <h3>Export Image</h3>

                <label class="pc-export-label" for="pc-export-mode">
                    Export type
                </label>
                <select id="pc-export-mode">
                    <option value="design">Full Design</option>
                    <option value="image">Edited Image</option>
                </select>

                <label class="pc-export-label" for="pc-export-format">
                    File format
                </label>
                <select id="pc-export-format">
                    <option value="png">PNG</option>
                    <option value="jpeg">JPEG</option>
                    <option value="webp">WebP</option>
                </select>

                <p class="pc-export-note" id="pc-export-note">
                    Exports the complete design with all layers.
                </p>

                <div class="pc-export-actions">
                    <button type="button" class="pc-export-cancel">
                        Cancel
                    </button>
                    <button type="button" class="pc-export-start">
                        Export
                    </button>
                </div>
            </div>
        `;

        document.body.appendChild(overlay);

        const mode = overlay.querySelector('#pc-export-mode');
        const format = overlay.querySelector('#pc-export-format');
        const note = overlay.querySelector('#pc-export-note');
        const start = overlay.querySelector('.pc-export-start');

        function updateNote() {
            const isImage = mode.value === 'image';

            note.textContent = isImage
                ? 'Exports only the selected image with its edits and transparent background. JPEG will use a white background.'
                : 'Exports the complete design with all image and text layers.';
        }

        mode.addEventListener('change', updateNote);
        format.addEventListener('change', updateNote);

        overlay.querySelector('.pc-export-cancel').addEventListener('click', closeDialog);

        overlay.addEventListener('click', event => {
            if (event.target === overlay) closeDialog();
        });

        start.addEventListener('click', () => {
            if (isExporting) return;

            const settings = {
                mode: mode.value,
                format: format.value
            };

            closeDialog();
            exportFile(settings);
        });

        exportDialog = overlay;
        return overlay;
    }

    function openDialog() {
        const currentLayer = window.PhotoCookLayerManager?.getSelectedLayer();

        const layer = currentLayer && currentLayer.type !== 'text'
            ? currentLayer
            : selectedImageLayer;

        if (layer && layer.type !== 'text' && layer.img) {
            selectedImageLayer = layer;
        }

        createDialog().classList.add('open');
    }

    function closeDialog() {
        exportDialog?.classList.remove('open');
    }

    function canvasToBlob(canvas, mime, quality = 0.92) {
        return new Promise((resolve, reject) => {
            if (!canvas || !canvas.width || !canvas.height) {
                reject(new Error('Export canvas has invalid dimensions.'));
                return;
            }

            canvas.toBlob(blob => {
                if (!blob || !blob.size) {
                    reject(new Error('Could not generate the exported image.'));
                    return;
                }

                resolve(blob);
            }, mime, quality);
        });
    }

    function prepareJPEG(sourceCanvas) {
        const canvas = document.createElement('canvas');
        canvas.width = sourceCanvas.width;
        canvas.height = sourceCanvas.height;

        const ctx = canvas.getContext('2d');
        if (!ctx) throw new Error('Could not create export context.');

        ctx.fillStyle = '#ffffff';
        ctx.fillRect(0, 0, canvas.width, canvas.height);
        ctx.drawImage(sourceCanvas, 0, 0);

        return canvas;
    }

    function downloadBlob(blob, fileName) {
        const url = URL.createObjectURL(blob);
        const link = document.createElement('a');

        link.href = url;
        link.download = fileName;
        link.style.display = 'none';

        document.body.appendChild(link);
        link.click();
        link.remove();

        setTimeout(() => URL.revokeObjectURL(url), 3000);
    }

    async function exportFile(settings) {
        if (isExporting) return;

        isExporting = true;

        try {
            const format = FORMATS[settings.format];
            if (!format) throw new Error('Unsupported export format.');

            let exportCanvas;

        if (settings.mode === 'image') {
            const layer = selectedImageLayer;
            const layers = window.PhotoCookLayerManager?.getLayers?.();

            if (
                !layer ||
                layer.type === 'text' ||
                !layer.img ||
                (Array.isArray(layers) && !layers.includes(layer))
            ) {
                throw new Error('Select an image layer before exporting Edited Image.');
            }

            exportCanvas = window.PhotoCookEngine?.renderImageLayer(layer);

            if (!exportCanvas) {
                throw new Error('Could not render the selected image layer.');
            }
        } else {
                const canvas = document.getElementById('canvas');

                if (!canvas) throw new Error('Editor canvas not found.');

                window.PhotoCookInteraction?.redrawCanvas?.(true);
                exportCanvas = canvas;
            }

            if (settings.format === 'jpeg') {
                exportCanvas = prepareJPEG(exportCanvas);
            }

            const blob = await canvasToBlob(exportCanvas, format.mime);

            const width = exportCanvas.width;
            const height = exportCanvas.height;
            const prefix = settings.mode === 'image'
                ? 'photocook-edited-image'
                : 'photocook-design';

            const fileName = `${prefix}-${width}x${height}.${format.extension}`;

            downloadBlob(blob, fileName);

        } catch (error) {
            console.error('[PhotoCook Export] Export failed:', error);
            alert(error.message || 'Export failed. Please try again.');
        } finally {
            isExporting = false;
            window.PhotoCookInteraction?.redrawCanvas?.(false);
        }
    }

    window.PhotoCookExport = {
        init(canvas, actualWidth, actualHeight) {
            const exportBtn = document.getElementById('export-btn');
            if (!exportBtn || !canvas) return;

            exportBtn.addEventListener('pointerdown', () => {
                const layer = window.PhotoCookLayerManager?.getSelectedLayer();

                if (layer && layer.type !== 'text' && layer.img) {
                    selectedImageLayer = layer;
                }
            }, true);

            if (exportBtn.dataset.listenerAttached === 'true') return;
            exportBtn.dataset.listenerAttached = 'true';

            exportBtn.addEventListener('click', event => {
                event.preventDefault();
                event.stopPropagation();

                if (!isExporting) openDialog();
            });
        },

        open: openDialog
    };
})();
