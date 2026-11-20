
/* PhotoCook — Selection Renderer */
(() => {
    'use strict';

    if (window.PhotoCookSelectionRenderer) return;

    const Renderer = {
        enabled: true,
        dashOffset: 0,
        boundaryCache: new WeakMap(),

        render(ctx, selection) {
            if (!this.enabled || !ctx || !selection) return;

            const {
                mask,
                width: maskWidth,
                height: maskHeight
            } = selection;

            if (
                !mask ||
                !Number.isInteger(maskWidth) ||
                !Number.isInteger(maskHeight) ||
                maskWidth <= 0 ||
                maskHeight <= 0
            ) {
                return;
            }

            const edgeCanvas = this.createBoundary(
                mask,
                maskWidth,
                maskHeight
            );

            if (!edgeCanvas) return;

            const layer = selection.layer || {};

            const x = selection.x ?? layer.x ?? 0;
            const y = selection.y ?? layer.y ?? 0;
            const displayWidth =
                selection.displayWidth ?? layer.width ?? maskWidth;
            const displayHeight =
                selection.displayHeight ?? layer.height ?? maskHeight;
            const rotation = selection.rotation ?? layer.rotation ?? 0;

            if (
                !Number.isFinite(x) ||
                !Number.isFinite(y) ||
                !Number.isFinite(displayWidth) ||
                !Number.isFinite(displayHeight) ||
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

            if (mask instanceof ImageData) {
                if (
                    mask.width !== width ||
                    mask.height !== height
                ) {
                    return null;
                }

                return this.extractAlpha(mask.data, total);
            }

            if (typeof HTMLCanvasElement !== 'undefined' &&
                mask instanceof HTMLCanvasElement) {

                if (
                    mask.width !== width ||
                    mask.height !== height
                ) {
                    return null;
                }

                const maskContext = mask.getContext('2d', {
                    willReadFrequently: true
                });

                if (!maskContext) return null;

                try {
                    const data = maskContext.getImageData(
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

            const total = width * height;

            const canvas = document.createElement('canvas');
            canvas.width = width;
            canvas.height = height;

            const context = canvas.getContext('2d');

            if (!context) return null;

            const imageData = context.createImageData(
                width,
                height
            );

            const pixels = imageData.data;

            const isSelected = (index) =>
                index >= 0 &&
                index < total &&
                maskPixels[index] > 127;

            for (let y = 0; y < height; y++) {
                const rowOffset = y * width;

                for (let x = 0; x < width; x++) {
                    const index = rowOffset + x;

                    if (!isSelected(index)) continue;

                    const boundary =
                        x === 0 ||
                        x === width - 1 ||
                        y === 0 ||
                        y === height - 1 ||
                        !isSelected(index - 1) ||
                        !isSelected(index + 1) ||
                        !isSelected(index - width) ||
                        !isSelected(index + width);

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
            this.dashOffset = Number.isFinite(Number(offset))
                ? Number(offset)
                : 0;
        },

        clear(ctx) {
            // The main editor renderer owns canvas clearing.
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
