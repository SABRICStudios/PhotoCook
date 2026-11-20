
/* PhotoCook — Optimized Selection Renderer */
(() => {
    'use strict';

    if (window.PhotoCookSelectionRenderer) return;

    const Renderer = {
        enabled: true,
        dashOffset: 0,

        boundaryCache: new WeakMap(),
        previewCache: new WeakMap(),

        createCanvas(width, height) {
            const canvas = document.createElement('canvas');
            canvas.width = width;
            canvas.height = height;
            return canvas;
        },

        render(ctx, selection) {
            if (!this.enabled || !ctx || !selection) return;

            const {
                mask,
                width,
                height,
                layer,
                preview = false,
                revision
            } = selection;

            if (
                !mask ||
                !Number.isInteger(width) ||
                !Number.isInteger(height) ||
                width <= 0 ||
                height <= 0 ||
                !layer
            ) {
                return;
            }

            const edgeCanvas = preview
                ? this.getPreviewBoundary(mask, width, height)
                : this.getCachedBoundary(
                    layer,
                    mask,
                    width,
                    height,
                    revision
                );

            if (!edgeCanvas) return;

            const x = selection.x ?? layer.x ?? 0;
            const y = selection.y ?? layer.y ?? 0;
            const displayWidth =
                selection.displayWidth ?? layer.width ?? width;
            const displayHeight =
                selection.displayHeight ?? layer.height ?? height;
            const rotation = selection.rotation ?? layer.rotation ?? 0;

            if (
                !Number.isFinite(x) ||
                !Number.isFinite(y) ||
                !Number.isFinite(displayWidth) ||
                !Number.isFinite(displayHeight) ||
                !Number.isFinite(rotation) ||
                displayWidth <= 0 ||
                displayHeight <= 0
            ) {
                return;
            }

            ctx.save();

            ctx.translate(
                x + displayWidth / 2,
                y + displayHeight / 2
            );

            if (rotation) {
                ctx.rotate(rotation * Math.PI / 180);
            }

            ctx.drawImage(
                edgeCanvas,
                -displayWidth / 2,
                -displayHeight / 2,
                displayWidth,
                displayHeight
            );

            ctx.restore();
        },

        getCachedBoundary(layer, mask, width, height, revision) {
            const engine = window.PhotoCookSelectionEngine;

            const currentRevision = Number.isFinite(revision)
                ? revision
                : engine?.getRevision?.(layer) ?? 0;

            const cached = this.boundaryCache.get(layer);

            if (
                cached &&
                cached.revision === currentRevision &&
                cached.width === width &&
                cached.height === height
            ) {
                return cached.canvas;
            }

            const canvas = this.createBoundary(mask, width, height);
            if (!canvas) return null;

            this.boundaryCache.set(layer, {
                revision: currentRevision,
                width,
                height,
                canvas
            });

            return canvas;
        },

        getPreviewBoundary(mask, width, height) {
            if (
                !mask ||
                typeof mask !== 'object'
            ) {
                return this.createBoundary(mask, width, height);
            }

            const cached = this.previewCache.get(mask);

            if (
                cached &&
                cached.width === width &&
                cached.height === height
            ) {
                return cached.canvas;
            }

            const canvas = this.createBoundary(mask, width, height);
            if (!canvas) return null;

            this.previewCache.set(mask, {
                width,
                height,
                canvas
            });

            return canvas;
        },

        getMaskPixels(mask, width, height) {
            const total = width * height;

            if (mask instanceof Uint8Array) {
                return mask.length === total ? mask : null;
            }

            if (mask instanceof Uint8ClampedArray) {
                if (mask.length === total) return mask;

                if (mask.length === total * 4) {
                    return this.extractAlpha(mask, total);
                }

                return null;
            }

            if (typeof ImageData !== 'undefined' &&
                mask instanceof ImageData) {
                if (
                    mask.width !== width ||
                    mask.height !== height
                ) {
                    return null;
                }

                return this.extractAlpha(mask.data, total);
            }

            if (
                typeof HTMLCanvasElement !== 'undefined' &&
                mask instanceof HTMLCanvasElement
            ) {
                if (
                    mask.width !== width ||
                    mask.height !== height
                ) {
                    return null;
                }

                const context = mask.getContext('2d', {
                    willReadFrequently: true
                });

                if (!context) return null;

                try {
                    const data = context.getImageData(
                        0, 0, width, height
                    ).data;

                    return this.extractAlpha(data, total);
                } catch (error) {
                    console.warn(
                        'PhotoCook Selection: Unable to read mask canvas.',
                        error
                    );
                    return null;
                }
            }

            return null;
        },

        extractAlpha(rgba, total) {
            const alpha = new Uint8Array(total);

            for (let i = 0; i < total; i++) {
                alpha[i] = rgba[i * 4 + 3];
            }

            return alpha;
        },

        createBoundary(mask, width, height) {
            if (
                !Number.isInteger(width) ||
                !Number.isInteger(height) ||
                width <= 0 ||
                height <= 0
            ) {
                return null;
            }

            const maskPixels = this.getMaskPixels(
                mask,
                width,
                height
            );

            if (!maskPixels) return null;

            const canvas = this.createCanvas(width, height);
            const context = canvas.getContext('2d');

            if (!context) return null;

            const imageData = context.createImageData(
                width,
                height
            );

            const pixels = imageData.data;
            const total = width * height;

            for (let y = 0; y < height; y++) {
                const rowOffset = y * width;

                for (let x = 0; x < width; x++) {
                    const index = rowOffset + x;

                    if (maskPixels[index] <= 127) continue;

                    const boundary =
                        x === 0 ||
                        x === width - 1 ||
                        y === 0 ||
                        y === height - 1 ||
                        maskPixels[index - 1] <= 127 ||
                        maskPixels[index + 1] <= 127 ||
                        maskPixels[index - width] <= 127 ||
                        maskPixels[index + width] <= 127;

                    if (!boundary) continue;

                    const pixelIndex = index * 4;

                    const isWhite =
                        (x + y + this.dashOffset) % 8 < 4;

                    const color = isWhite ? 255 : 0;

                    pixels[pixelIndex] = color;
                    pixels[pixelIndex + 1] = color;
                    pixels[pixelIndex + 2] = color;
                    pixels[pixelIndex + 3] = 255;
                }
            }

            context.putImageData(imageData, 0, 0);

            return canvas;
        },

        setDashOffset(offset) {
            const nextOffset = Number(offset);

            if (Number.isFinite(nextOffset)) {
                this.dashOffset = nextOffset;
            }
        },

        invalidate(layer) {
            if (!layer) return;

            this.boundaryCache.delete(layer);
        },

        clear(ctx) {
            if (!ctx) return;

            ctx.save();
            ctx.restore();
        },

        setEnabled(enabled) {
            this.enabled = Boolean(enabled);
        }
    };

    window.PhotoCookSelectionRenderer = Renderer;
})();
