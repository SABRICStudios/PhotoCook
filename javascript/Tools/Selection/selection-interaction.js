
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
            if (!points || points.length < 3) {
                this.previewMask.fill(0);
                return;
            }

            const mask = this.previewMask;
            mask.fill(0);

            const minX = Math.max(
                0,
                Math.floor(Math.min(...points.map(p => p.x)))
            );

            const maxX = Math.min(
                width,
                Math.ceil(Math.max(...points.map(p => p.x)))
            );

            const minY = Math.max(
                0,
                Math.floor(Math.min(...points.map(p => p.y)))
            );

            const maxY = Math.min(
                height,
                Math.ceil(Math.max(...points.map(p => p.y)))
            );

            for (let y = minY; y < maxY; y++) {
                for (let x = minX; x < maxX; x++) {
                    if (this.isPointInPolygon(
                        x + 0.5,
                        y + 0.5,
                        points
                    )) {
                        mask[y * width + x] = 255;
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
                this.previewMask = this.createEmptyMask(layer);

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
                Math.hypot(
                    point.x - previous.x,
                    point.y - previous.y
                ) < 1
            ) {
                return;
            }

            this.points.push(point);
            this.currentPoint = point;

            this.updatePreview();
            this.requestRedraw();
        },

        finishPolygon() {
            if (!this.layer || this.points.length < 3) {
                this.cancelDrawing();
                return;
            }

            const dimensions = this.getLayerDimensions(this.layer);

            if (!dimensions) {
                this.cancelDrawing();
                return;
            }

            this.createPolygonMask(
                dimensions.width,
                dimensions.height,
                this.points
            );

            this.commitPreview();
        },

        startBrush(layer, point) {
            const brush = window.PhotoCookSelectionBrush;
            if (!brush) return false;

            const dimensions = this.getLayerDimensions(layer);
            if (!dimensions) return false;

            const mask = this.createEmptyMask(layer);
            if (!mask) return false;

            this.layer = layer;
            this.brushMask = mask;

            try {
                brush.settings.mode = 'add';
                brush.attach(mask, dimensions.width, dimensions.height);
                this.brushAttached = true;

                brush.begin(point.x, point.y);

                this.isDrawing = true;
                this.requestRedraw();

                return true;
            } catch (error) {
                console.error(
                    'PhotoCook Selection: Brush initialization failed.',
                    error
                );

                this.stopBrush();
                this.cancelDrawing();
                return false;
            }
        },

        finishBrush() {
            const brush = window.PhotoCookSelectionBrush;

            if (!this.layer || !brush) {
                this.cancelDrawing();
                return;
            }

            try {
                brush.end();

                const mask = brush.getMask?.() ||
                    this.brushMask;

                if (mask) {
                    window.PhotoCookSelectionEngine?.applyMask(
                        this.layer,
                        mask,
                        this.operation
                    );
                }
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

        renderOverlay(ctx) {
            if (!ctx || !this.active) return;

            const renderer = window.PhotoCookSelectionRenderer;
            const engine = window.PhotoCookSelectionEngine;

            if (!renderer || !engine) return;

            if (this.isDrawing && this.layer) {
                const mask = this.mode === 'brush'
                    ? window.PhotoCookSelectionBrush?.getMask?.() || this.brushMask
                    : this.previewMask;

                if (mask) {
                    const dimensions = this.getLayerDimensions(this.layer);
       
                    renderer.render(ctx, {
                        layer,
                        mask,
                        width: dimensions.width,
                        height: dimensions.height,
                        revision: engine.getRevision(layer)
                    });
                }

                return;
            }

            const layer = this.getSelectedLayer();
            if (!layer) return;

            const mask = engine.getMask(layer);
            const dimensions = this.getLayerDimensions(layer);

            if (!mask || !dimensions) return;

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
