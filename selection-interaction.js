
/* PhotoCook — Selection Interaction Controller */
(() => {
    'use strict';

    if (window.PhotoCookSelectionInteraction) return;

    const Controller = {
        initialized: false,
        active: false,
        mode: 'rect',
        operation: 'new',
        layer: null,
        isDrawing: false,
        startPoint: null,
        currentPoint: null,
        points: [],
        previewMask: null,
        brushMask: null,
        brushAttached: false,
        subjectRequest: 0,
        polygonControls: null,

        init() {
            if (this.initialized) return;

            this.initialized = true;

            document.addEventListener(
                'photocook:selection:opened',
                () => {
                    this.active = true;
                    this.resetDrawing();
                }
            );

            document.addEventListener(
                'photocook:selection:closed',
                () => this.deactivate()
            );

            document.addEventListener(
                'photocook:selection:modechange',
                event => {
                    if (event.detail?.mode) {
                        this.setMode(event.detail.mode);
                    }
                }
            );

            document.addEventListener(
                'photocook:selection:operationchange',
                event => {
                    if (event.detail?.operation) {
                        this.setOperation(event.detail.operation);
                    }
                }
            );

            document.addEventListener(
                'photocook:selection:invert',
                () => this.invert()
            );

            document.addEventListener(
                'photocook:selection:deselect',
                () => this.deselect()
            );

            window.addEventListener(
                'photocook:selection:changed',
                () => {
                    if (!this.isDrawing) {
                        this.requestRedraw();
                    }
                }
            );
        },

        setMode(mode) {
            const modes = [
                'rect',
                'ellipse',
                'lasso',
                'polygon',
                'brush',
                'wand',
                'subject',
                'eyedropper'
            ];

            if (!modes.includes(mode)) return false;

            this.cancelDrawing();
            this.mode = mode;
            this.updatePolygonControls();

            return true;
        },

        setOperation(operation) {
            const operations = [
                'new',
                'add',
                'subtract',
                'intersect'
            ];

            if (!operations.includes(operation)) return false;

            this.operation = operation;
            return true;
        },

        getSelectedLayer() {
            const manager = window.PhotoCookLayerManager;
            if (!manager) return null;

            const layers = manager.getLayers?.() || [];

            let layer = manager.getSelectedLayer?.();

            if (!layer || !layers.includes(layer)) {
                layer = layers.find(item => item.isSelected);
            }

            if (
                !layer ||
                layer.type === 'text' ||
                !layer.img
            ) {
                return null;
            }

            return layer;
        },

        getLayerDimensions(layer) {
            return window.PhotoCookSelectionEngine
                ?.getDimensions(layer) || null;
        },

        getImagePoint(canvasPoint, layer) {
            if (!canvasPoint || !layer) return null;

            const width = Number(layer.width);
            const height = Number(layer.height);

            if (
                !Number.isFinite(width) ||
                !Number.isFinite(height) ||
                width <= 0 ||
                height <= 0
            ) {
                return null;
            }

            const centerX = layer.x + width / 2;
            const centerY = layer.y + height / 2;

            let dx = canvasPoint.x - centerX;
            let dy = canvasPoint.y - centerY;

            const rotation = Number(layer.rotation) || 0;

            if (rotation) {
                const angle = -rotation * Math.PI / 180;
                const cos = Math.cos(angle);
                const sin = Math.sin(angle);

                const rotatedX = dx * cos - dy * sin;
                const rotatedY = dx * sin + dy * cos;

                dx = rotatedX;
                dy = rotatedY;
            }

            const localX = dx + width / 2;
            const localY = dy + height / 2;

            // Reject points outside the actual image bounds.
            if (
                localX < 0 ||
                localY < 0 ||
                localX >= width ||
                localY >= height
            ) {
                return null;
            }

            const dimensions = this.getLayerDimensions(layer);
            if (!dimensions) return null;

            return {
                x: localX / width * dimensions.width,
                y: localY / height * dimensions.height,
                width: dimensions.width,
                height: dimensions.height
            };
        },

        createEmptyMask(layer) {
            const dimensions = this.getLayerDimensions(layer);
            if (!dimensions) return null;

            return new Uint8Array(
                dimensions.width * dimensions.height
            );
        },

        resetDrawing() {
            this.stopBrush();

            this.isDrawing = false;
            this.startPoint = null;
            this.currentPoint = null;
            this.points = [];
            this.previewMask = null;
            this.brushMask = null;
            this.layer = null;

            this.updatePolygonControls();
            this.requestRedraw();
        },

        deactivate() {
            this.active = false;
            this.subjectRequest++;
            this.cancelDrawing();
        },

        cancelDrawing() {
            this.stopBrush();

            this.isDrawing = false;
            this.startPoint = null;
            this.currentPoint = null;
            this.points = [];
            this.previewMask = null;
            this.brushMask = null;
            this.layer = null;

            this.updatePolygonControls();
            this.requestRedraw();
        },

        stopBrush() {
            const brush = window.PhotoCookSelectionBrush;

            if (!brush || !this.brushAttached) return;

            try {
                brush.end?.();
                brush.detach?.();
            } catch (error) {
                console.warn(
                    'PhotoCook Selection: Unable to detach brush.',
                    error
                );
            }

            this.brushAttached = false;
        },


        ensurePolygonControls() {
            const panel = document.getElementById('selection-sub-toolbar');
            const host = panel?.querySelector('.selection-main-page');

            if (!host) return null;

            let controls = host.querySelector('.selection-polygon-controls');

            if (!controls) {
                if (!document.getElementById('selection-polygon-controls-style')) {
                    const style = document.createElement('style');
                    style.id = 'selection-polygon-controls-style';
                    style.textContent = `
                        .selection-polygon-controls {
                            display: flex;
                            gap: 8px;
                            width: 100%;
                            margin-top: 12px;
                        }
                        .selection-polygon-controls[hidden],
                        .selection-polygon-controls button[hidden] {
                            display: none !important;
                        }
                        .selection-polygon-controls button {
                            flex: 1;
                            min-height: 42px;
                            border: 0;
                            border-radius: 8px;
                            font: inherit;
                            font-weight: 600;
                            cursor: pointer;
                            touch-action: manipulation;
                        }
                        .selection-polygon-finish {
                            color: #fff;
                            background: var(--accent-color, #278653);
                        }
                        .selection-polygon-cancel {
                            color: inherit;
                            background: var(--panel-secondary, #444);
                        }
                    `;
                    document.head.appendChild(style);
                }

                controls = document.createElement('div');
                controls.className = 'selection-polygon-controls';
                controls.innerHTML = `
                    <button type="button" class="selection-polygon-finish"
                        data-polygon-action="finish" hidden>Finish</button>
                    <button type="button" class="selection-polygon-cancel"
                        data-polygon-action="cancel" hidden>Cancel</button>
                `;

                controls.addEventListener('click', event => {
                    const button = event.target.closest('[data-polygon-action]');
                    if (!button) return;

                    event.preventDefault();
                    event.stopPropagation();

                    if (button.dataset.polygonAction === 'finish') {
                        if (this.points.length >= 3) this.finishPolygon();
                    } else if (button.dataset.polygonAction === 'cancel') {
                        this.cancelDrawing();
                    }
                });

                host.appendChild(controls);
            }

            this.polygonControls = controls;
            return controls;
        },

updatePolygonControls() {
    const controls = this.ensurePolygonControls();
    if (!controls) return;

    const visible =
        this.active &&
        this.mode === 'polygon' &&
        this.points.length > 0;

    controls.hidden = !visible;

    const finish = controls.querySelector('[data-polygon-action="finish"]');
    const cancel = controls.querySelector('[data-polygon-action="cancel"]');

    if (finish) finish.hidden = !visible || this.points.length < 3;
    if (cancel) cancel.hidden = !visible;
},



        handleStart(event, canvasPoint) {
            if (
                !this.active ||
                !canvasPoint ||
                window.PhotoCookInteraction?.isPanEnabled?.() ||
                window.PhotoCookInteraction?.isBGBrushEditing?.()
            ) {
                return false;
            }

            const layer = this.getSelectedLayer();
            if (!layer) return false;

            const point = this.getImagePoint(canvasPoint, layer);
            if (!point) return false;

            if (this.mode === 'subject') {
                this.selectSubject(layer);
                return true;
            }

            if (this.mode === 'eyedropper') {
                this.sampleColor(layer, point);
                return true;
            }

            if (this.mode === 'wand') {
                this.selectMagicWand(layer, point);
                return true;
            }

            if (this.mode === 'polygon') {
                this.addPolygonPoint(layer, point);
                return true;
            }

            if (this.mode === 'brush') {
                return this.startBrush(layer, point);
            }

            this.layer = layer;
            this.isDrawing = true;
            this.startPoint = point;
            this.currentPoint = point;
            this.points = [point];

            this.previewMask = this.createEmptyMask(layer);

            if (!this.previewMask) {
                this.cancelDrawing();
                return false;
            }

            this.requestRedraw();
            return true;
        },

        handleMove(event, canvasPoint) {
            if (
                !this.active ||
                !this.isDrawing ||
                !canvasPoint
            ) {
                return false;
            }

            const point = this.getImagePoint(
                canvasPoint,
                this.layer
            );

            if (!point) return false;

            this.currentPoint = point;

            if (this.mode === 'brush') {
                window.PhotoCookSelectionBrush?.move(
                    point.x,
                    point.y
                );
            } else if (this.mode === 'lasso') {
                const previous = this.points[this.points.length - 1];

                if (
                    !previous ||
                    Math.hypot(
                        point.x - previous.x,
                        point.y - previous.y
                    ) >= 1
                ) {
                    this.points.push(point);
                }
            }

            this.updatePreview();
            this.requestRedraw();

            return true;
        },

        handleEnd() {
            if (!this.active || !this.isDrawing) return false;

            if (this.mode === 'polygon') {
                return true;
            }

            if (this.mode === 'brush') {
                this.finishBrush();
                return true;
            }

            if (this.mode === 'rect' || this.mode === 'ellipse') {
                this.updatePreview();
            }

            if (this.mode === 'lasso') {
                this.updatePreview();
            }

            this.commitPreview();
            return true;
        },

        handleDoubleClick(event, canvasPoint) {
            if (
                !this.active ||
                this.mode !== 'polygon' ||
                !this.isDrawing
            ) {
                return false;
            }

            if (canvasPoint) {
                const point = this.getImagePoint(
                    canvasPoint,
                    this.layer
                );

                if (point) {
                    const previous = this.points[this.points.length - 1];

                    if (
                        !previous ||
                        Math.hypot(
                            point.x - previous.x,
                            point.y - previous.y
                        ) > 1
                    ) {
                        this.points.push(point);
                    }
                }
            }

            this.finishPolygon();
            return true;
        },

        updatePreview() {
            if (!this.layer || !this.previewMask) return;

            const dimensions = this.getLayerDimensions(this.layer);
            if (!dimensions) return;

            const { width, height } = dimensions;

            if (this.mode === 'rect') {
                this.createRectangleMask(width, height);
            } else if (this.mode === 'ellipse') {
                this.createEllipseMask(width, height);
            } else if (this.mode === 'lasso') {
                this.createPolygonMask(width, height, this.points);
            }
        },

        createRectangleMask(width, height) {
            const mask = this.previewMask;
            const a = this.startPoint;
            const b = this.currentPoint;

            if (!a || !b) return;

            const minX = Math.max(0, Math.floor(Math.min(a.x, b.x)));
            const minY = Math.max(0, Math.floor(Math.min(a.y, b.y)));
            const maxX = Math.min(width, Math.ceil(Math.max(a.x, b.x)));
            const maxY = Math.min(height, Math.ceil(Math.max(a.y, b.y)));

            mask.fill(0);

            for (let y = minY; y < maxY; y++) {
                const offset = y * width;

                for (let x = minX; x < maxX; x++) {
                    mask[offset + x] = 255;
                }
            }
        },

        createEllipseMask(width, height) {
            const mask = this.previewMask;
            const a = this.startPoint;
            const b = this.currentPoint;

            if (!a || !b) return;

            mask.fill(0);

            const left = Math.min(a.x, b.x);
            const right = Math.max(a.x, b.x);
            const top = Math.min(a.y, b.y);
            const bottom = Math.max(a.y, b.y);

            const rx = (right - left) / 2;
            const ry = (bottom - top) / 2;

            if (rx <= 0 || ry <= 0) return;

            const cx = (left + right) / 2;
            const cy = (top + bottom) / 2;

            const minX = Math.max(0, Math.floor(left));
            const maxX = Math.min(width, Math.ceil(right));
            const minY = Math.max(0, Math.floor(top));
            const maxY = Math.min(height, Math.ceil(bottom));

            for (let y = minY; y < maxY; y++) {
                for (let x = minX; x < maxX; x++) {
                    const dx = (x + 0.5 - cx) / rx;
                    const dy = (y + 0.5 - cy) / ry;

                    if (dx * dx + dy * dy <= 1) {
                        mask[y * width + x] = 255;
                    }
                }
            }
        },



        createPolygonMask(width, height, points) {
            if (!this.previewMask || !points || points.length < 3) return;

            const mask = this.previewMask;
            mask.fill(0);

            let minY = height;
            let maxY = 0;

            for (const point of points) {
                minY = Math.min(minY, point.y);
                maxY = Math.max(maxY, point.y);
            }

            minY = Math.max(0, Math.floor(minY));
            maxY = Math.min(height, Math.ceil(maxY));

            const intersections = [];
            const count = points.length;

            for (let y = minY; y < maxY; y++) {
                const scanY = y + 0.5;
                intersections.length = 0;

                for (let i = 0; i < count; i++) {
                    const a = points[i];
                    const b = points[(i + 1) % count];

                    if (
                        (a.y <= scanY && b.y > scanY) ||
                        (b.y <= scanY && a.y > scanY)
                    ) {
                        intersections.push(
                            a.x + ((scanY - a.y) / (b.y - a.y)) * (b.x - a.x)
                        );
                    }
                }

                intersections.sort((a, b) => a - b);

                const rowOffset = y * width;

                for (let i = 0; i + 1 < intersections.length; i += 2) {
                    const start = Math.max(0, Math.ceil(intersections[i] - 0.5));
                    const end = Math.min(width, Math.ceil(intersections[i + 1] - 0.5));

                    if (end > start) {
                        mask.fill(255, rowOffset + start, rowOffset + end);
                    }
                }
            }
        },



        isPointInPolygon(x, y, points) {
            let inside = false;

            for (
                let i = 0, j = points.length - 1;
                i < points.length;
                j = i++
            ) {
                const a = points[i];
                const b = points[j];

                const intersects =
                    (a.y > y) !== (b.y > y) &&
                    x < (
                        (b.x - a.x) * (y - a.y) /
                        (b.y - a.y) + a.x
                    );

                if (intersects) inside = !inside;
            }

            return inside;
        },



        addPolygonPoint(layer, point) {
            if (!this.isDrawing) {
                this.layer = layer;
                this.isDrawing = true;
                this.points = [point];
                this.currentPoint = point;
                this.previewMask = null;

                this.updatePolygonControls();
                this.requestRedraw();
                return;
            }

            if (this.layer !== layer) {
                this.cancelDrawing();
                return;
            }

            const previous = this.points[this.points.length - 1];

            if (
                previous &&
                Math.hypot(point.x - previous.x, point.y - previous.y) < 1
            ) {
                return;
            }

            this.points.push(point);
            this.currentPoint = point;

            this.updatePolygonControls();
            this.requestRedraw();
        },





        finishPolygon() {
            if (!this.layer || this.points.length < 3) return false;

            const dimensions = this.getLayerDimensions(this.layer);

            if (!dimensions) {
                this.cancelDrawing();
                return false;
            }

            this.previewMask = this.createEmptyMask(this.layer);

            if (!this.previewMask) {
                this.cancelDrawing();
                return false;
            }

            this.createPolygonMask(
                dimensions.width,
                dimensions.height,
                this.points
            );

            this.commitPreview();
            return true;
        },



        startBrush(layer, point) {
            const brush = window.PhotoCookSelectionBrush;
            const engine = window.PhotoCookSelectionEngine;

            if (!brush || !engine) return false;

            const dimensions = this.getLayerDimensions(layer);
            if (!dimensions) return false;

            const existingMask = engine.getBaseMask?.(layer);

            const mask = existingMask
                ? new Uint8Array(existingMask)
                : this.createEmptyMask(layer);

            if (
                !mask ||
                mask.length !== dimensions.width * dimensions.height
            ) {
                return false;
            }

            this.layer = layer;
            this.brushMask = mask;

            try {
                // Preserve the selected Add / Erase mode and settings.
                const settings = window.PhotoCookSelection?.getBrushSettings?.();

                if (settings) {
                    brush.configure(settings);
                }

                const attached = brush.attach(
                    mask,
                    dimensions.width,
                    dimensions.height
                );

                if (!attached) {
                    this.brushMask = null;
                    this.layer = null;
                    return false;
                }

                this.brushAttached = true;

                this.isDrawing = true;

                if (!brush.begin(point.x, point.y)) {
                    this.stopBrush();
                    this.isDrawing = false;
                    this.brushMask = null;
                    this.layer = null;
                    return false;
                }

                this.requestRedraw();
                return true;

            } catch (error) {
                console.error(
                    'PhotoCook Selection: Brush initialization failed.',
                    error
                );

                this.stopBrush();
                this.isDrawing = false;
                this.brushMask = null;
                this.layer = null;

                return false;
            }
        },

        finishBrush() {
            const brush = window.PhotoCookSelectionBrush;
            const engine = window.PhotoCookSelectionEngine;

            if (!this.layer || !brush || !engine) {
                this.cancelDrawing();
                return;
            }

            try {
                brush.end();

                const mask = brush.getMask?.() || this.brushMask;

                if (mask) {
                    // The mask already contains the previous selection
                    // plus the changes made by this brush stroke.
                    // Commit it as the complete new selection.
                    engine.applyMask(
                        this.layer,
                        mask,
                        'new'
                    );
                }

            } catch (error) {
                console.error(
                    'PhotoCook Selection: Brush commit failed.',
                    error
                );

            } finally {
                this.stopBrush();

                this.isDrawing = false;
                this.brushMask = null;
                this.previewMask = null;
                this.layer = null;

                this.requestRedraw();
            }
        },

        commitPreview() {
            if (!this.layer || !this.previewMask) {
                this.cancelDrawing();
                return;
            }

            const engine = window.PhotoCookSelectionEngine;

            if (engine) {
                engine.applyMask(
                    this.layer,
                    this.previewMask,
                    this.operation
                );
            }

            this.isDrawing = false;
            this.startPoint = null;
            this.currentPoint = null;
            this.points = [];
            this.previewMask = null;
            this.layer = null;

            this.updatePolygonControls();
            this.requestRedraw();
        },

        selectMagicWand(layer, point) {
            const wand = window.PhotoCookSelectionMagicWand;
            const dimensions = this.getLayerDimensions(layer);

            if (!wand || !dimensions) return false;

            const canvas = document.createElement('canvas');
            canvas.width = dimensions.width;
            canvas.height = dimensions.height;

            const context = canvas.getContext('2d', {
                willReadFrequently: true
            });

            if (!context) return false;

            try {
                context.drawImage(
                    layer.img,
                    0,
                    0,
                    dimensions.width,
                    dimensions.height
                );

                const imageData = context.getImageData(
                    0,
                    0,
                    dimensions.width,
                    dimensions.height
                );

                const x = Math.min(
                    dimensions.width - 1,
                    Math.max(0, Math.floor(point.x))
                );

                const y = Math.min(
                    dimensions.height - 1,
                    Math.max(0, Math.floor(point.y))
                );

                const result = wand.select(imageData, x, y);
                const mask = result?.mask || result;

                if (!(mask instanceof Uint8Array)) {
                    console.warn(
                        'PhotoCook Selection: Magic Wand returned an invalid mask.'
                    );
                    return false;
                }

                window.PhotoCookSelectionEngine?.applyMask(
                    layer,
                    mask,
                    this.operation
                );

                return true;
            } catch (error) {
                console.error(
                    'PhotoCook Selection: Magic Wand failed.',
                    error
                );
                return false;
            }
        },

        async selectSubject(layer) {
            const subject = window.PhotoCookSelectionSubject;
            if (!subject) return false;

            const requestId = ++this.subjectRequest;

            try {
                const result = await subject.select(layer.img);

                if (
                    requestId !== this.subjectRequest ||
                    !this.active
                ) {
                    return false;
                }

                if (
                    !result?.mask ||
                    !(result.mask instanceof Uint8Array)
                ) {
                    console.warn(
                        'PhotoCook Selection: Subject selection returned an invalid mask.'
                    );
                    return false;
                }

                window.PhotoCookSelectionEngine?.applyMask(
                    layer,
                    result.mask,
                    this.operation
                );

                return true;
            } catch (error) {
                console.error(
                    'PhotoCook Selection: Subject selection failed.',
                    error
                );
                return false;
            }
        },

        sampleColor(layer, point) {
            const dimensions = this.getLayerDimensions(layer);
            if (!dimensions) return false;

            const canvas = document.createElement('canvas');
            canvas.width = 1;
            canvas.height = 1;

            const context = canvas.getContext('2d', {
                willReadFrequently: true
            });

            if (!context) return false;

            try {
                const x = Math.min(
                    dimensions.width - 1,
                    Math.max(0, Math.floor(point.x))
                );

                const y = Math.min(
                    dimensions.height - 1,
                    Math.max(0, Math.floor(point.y))
                );

                context.drawImage(
                    layer.img,
                    x, y, 1, 1,
                    0, 0, 1, 1
                );

                const pixel = context.getImageData(0, 0, 1, 1).data;

                const color = {
                    r: pixel[0],
                    g: pixel[1],
                    b: pixel[2],
                    a: pixel[3],
                    hex: '#' + Array.from(pixel)
                        .slice(0, 3)
                        .map(value => value.toString(16).padStart(2, '0'))
                        .join('')
                };

                window.dispatchEvent(
                    new CustomEvent('photocook:selection:colorpicked', {
                        detail: { layer, color, point }
                    })
                );

                return color;
            } catch (error) {
                console.error(
                    'PhotoCook Selection: Eyedropper failed.',
                    error
                );
                return false;
            }
        },

        invert() {
            const layer = this.getSelectedLayer();
            if (!layer) return false;

            return Boolean(
                window.PhotoCookSelectionEngine?.invert(layer)
            );
        },

        deselect() {
            const layer = this.getSelectedLayer();
            if (!layer) return false;

            return Boolean(
                window.PhotoCookSelectionEngine?.clear(layer)
            );
        },

        renderPolygonPreview(ctx) {
            if (!ctx || !this.layer || !this.points.length) return;

            const layer = this.layer;
            const dimensions = this.getLayerDimensions(layer);

            if (!dimensions) return;

            const width = Number(layer.width);
            const height = Number(layer.height);

            if (!width || !height) return;

            ctx.save();

            ctx.translate(layer.x + width / 2, layer.y + height / 2);
            ctx.rotate((Number(layer.rotation) || 0) * Math.PI / 180);
            ctx.scale(width / dimensions.width, height / dimensions.height);
            ctx.translate(-dimensions.width / 2, -dimensions.height / 2);

            ctx.beginPath();
            ctx.moveTo(this.points[0].x, this.points[0].y);

            for (let i = 1; i < this.points.length; i++) {
                ctx.lineTo(this.points[i].x, this.points[i].y);
            }

            if (this.currentPoint) {
                ctx.lineTo(this.currentPoint.x, this.currentPoint.y);
            }

            if (this.points.length >= 3) {
                ctx.lineTo(this.points[0].x, this.points[0].y);
            }

            ctx.strokeStyle = '#ffffff';
            ctx.lineWidth = 2 * dimensions.width / width;
            ctx.setLineDash([
                6 * dimensions.width / width,
                4 * dimensions.width / width
            ]);
            ctx.stroke();

            ctx.restore();
        },

        renderOverlay(ctx) {
            if (!ctx || !this.active) return;

            const renderer = window.PhotoCookSelectionRenderer;
            const engine = window.PhotoCookSelectionEngine;

            if (!renderer || !engine) return;

            if (this.isDrawing && this.layer) {
                const dimensions = this.getLayerDimensions(this.layer);

                if (this.mode === 'polygon') {
                    this.renderPolygonPreview(ctx);
                    return;
                }

                if (!dimensions) return;

                const mask = this.mode === 'brush'
                    ? window.PhotoCookSelectionBrush?.getMask?.() || this.brushMask
                    : this.previewMask;

                if (!mask) return;

                renderer.render(ctx, {
                    layer: this.layer,
                    mask,
                    width: dimensions.width,
                    height: dimensions.height,
                    preview: true
                });

                return;
            }

            const layer = this.getSelectedLayer();
            if (!layer) return;

            const dimensions = this.getLayerDimensions(layer);
            if (!dimensions) return;

            const mask = engine.getMask(layer);
            if (!mask) return;

            renderer.render(ctx, {
                layer,
                mask,
                width: dimensions.width,
                height: dimensions.height,
                revision: engine.getRevision(layer)
            });
        },


        requestRedraw() {
            window.PhotoCookInteraction?.redrawCanvas?.();
        }
    };

    Controller.init();

    window.PhotoCookSelectionInteraction = Controller;

})();
