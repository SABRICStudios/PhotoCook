
/* PhotoCook — Selection Operations */
(() => {
    'use strict';

    if (window.PhotoCookSelectionOperations) return;

    const Operations = {
        validate(mask, width, height) {
            return (
                mask &&
                Number.isInteger(width) &&
                Number.isInteger(height) &&
                width > 0 &&
                height > 0 &&
                mask.length === width * height
            );
        },

        combine(current, incoming, width, height, operation = 'new') {
            if (!this.validate(incoming, width, height)) return null;

            if (
                operation !== 'new' &&
                !this.validate(current, width, height)
            ) {
                operation = 'new';
            }

            const result = new Uint8Array(width * height);

            for (let i = 0; i < result.length; i++) {
                const a = current ? current[i] : 0;
                const b = incoming[i];

                switch (operation) {
                    case 'add':
                        result[i] = Math.max(a, b);
                        break;

                    case 'subtract':
                        result[i] = Math.max(0, a - b);
                        break;

                    case 'intersect':
                        result[i] = Math.min(a, b);
                        break;

                    case 'new':
                    default:
                        result[i] = b;
                        break;
                }
            }

            return result;
        },

        invert(mask, width, height) {
            if (!this.validate(mask, width, height)) return null;

            const result = new Uint8Array(mask.length);

            for (let i = 0; i < mask.length; i++) {
                result[i] = 255 - mask[i];
            }

            return result;
        },

        deselect(width, height) {
            if (
                !Number.isInteger(width) ||
                !Number.isInteger(height) ||
                width <= 0 ||
                height <= 0
            ) {
                return null;
            }

            return new Uint8Array(width * height);
        },


        feather(mask, width, height, radius) {
            if (!this.validate(mask, width, height)) return null;

            radius = Math.max(0, Math.min(100, Number(radius) || 0));

            if (radius === 0) return new Uint8Array(mask);

            const extent = Math.max(1, Math.ceil(radius));
            const sigma = Math.max(radius / 2, 0.5);
            const padding = extent * 2;

            // Find the selection bounds.
            let minX = width;
            let minY = height;
            let maxX = -1;
            let maxY = -1;

            for (let y = 0; y < height; y++) {
                const row = y * width;

                for (let x = 0; x < width; x++) {
                    if (mask[row + x] === 0) continue;

                    if (x < minX) minX = x;
                    if (x > maxX) maxX = x;
                    if (y < minY) minY = y;
                    if (y > maxY) maxY = y;
                }
            }

            if (maxX < 0) return new Uint8Array(mask);

            // Expand bounds to include the feathering area.
            const left = Math.max(0, minX - padding);
            const top = Math.max(0, minY - padding);
            const right = Math.min(width - 1, maxX + padding);
            const bottom = Math.min(height - 1, maxY + padding);

            const regionWidth = right - left + 1;
            const regionHeight = bottom - top + 1;

            const kernel = new Float32Array(extent * 2 + 1);
            let kernelTotal = 0;

            for (let i = -extent; i <= extent; i++) {
                const weight = Math.exp(
                    -(i * i) / (2 * sigma * sigma)
                );

                kernel[i + extent] = weight;
                kernelTotal += weight;
            }

            for (let i = 0; i < kernel.length; i++) {
                kernel[i] /= kernelTotal;
            }

            const horizontal = new Float32Array(
                regionWidth * regionHeight
            );

            const result = new Uint8Array(mask);

            // Horizontal pass.
            for (let y = 0; y < regionHeight; y++) {
                const sourceRow = (top + y) * width;
                const targetRow = y * regionWidth;

                for (let x = 0; x < regionWidth; x++) {
                    const sourceX = left + x;
                    let total = 0;

                    for (let k = -extent; k <= extent; k++) {
                        const sampleX = sourceX + k;

                        if (sampleX < 0 || sampleX >= width) continue;

                        total +=
                            mask[sourceRow + x + k] *
                            kernel[k + extent];
                    }

                    horizontal[targetRow + x] = total;
                }
            }

            // Vertical pass.
            for (let y = 0; y < regionHeight; y++) {
                for (let x = 0; x < regionWidth; x++) {
                    let total = 0;

                    for (let k = -extent; k <= extent; k++) {
                        const sampleY = y + k;

                        if (sampleY < 0 || sampleY >= regionHeight) continue;

                        total +=
                            horizontal[sampleY * regionWidth + x] *
                            kernel[k + extent];
                    }

                    result[(top + y) * width + left + x] = Math.round(
                        Math.max(0, Math.min(255, total))
                    );
                }
            }

            return result;
        },

        expand(mask, width, height, radius) {
            return this.morph(mask, width, height, radius, 'expand');
        },

        contract(mask, width, height, radius) {
            return this.morph(mask, width, height, radius, 'contract');
        },

        morph(mask, width, height, radius, mode) {
            if (!this.validate(mask, width, height)) return null;

            radius = Math.max(0, Math.min(100, Math.floor(Number(radius) || 0)));

            if (radius === 0) return new Uint8Array(mask);

            const result = new Uint8Array(mask.length);

            for (let y = 0; y < height; y++) {
                for (let x = 0; x < width; x++) {
                    let value = mode === 'expand' ? 0 : 255;

                    for (let dy = -radius; dy <= radius; dy++) {
                        for (let dx = -radius; dx <= radius; dx++) {
                            if (dx * dx + dy * dy > radius * radius) continue;

                            const sampleX = x + dx;
                            const sampleY = y + dy;

                            const sample =
                                sampleX < 0 || sampleY < 0 ||
                                sampleX >= width || sampleY >= height
                                    ? 0
                                    : mask[sampleY * width + sampleX];

                            if (mode === 'expand') {
                                value = Math.max(value, sample);
                            } else {
                                value = Math.min(value, sample);
                            }
                        }
                    }

                    result[y * width + x] = value;
                }
            }

            return result;
        },

        hasSelection(mask) {
            if (!mask) return false;

            for (let i = 0; i < mask.length; i++) {
                if (mask[i] > 0) return true;
            }

            return false;
        }
    };

    window.PhotoCookSelectionOperations = Operations;

})();
