
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

            const result = new Uint8Array(mask.length);
            const diameter = Math.ceil(radius * 2 + 1);
            const sigma = Math.max(radius / 2, 0.5);
            const kernel = [];
            let kernelTotal = 0;

            for (let y = -Math.floor(diameter / 2); y <= Math.floor(diameter / 2); y++) {
                for (let x = -Math.floor(diameter / 2); x <= Math.floor(diameter / 2); x++) {
                    const weight = Math.exp(
                        -(x * x + y * y) / (2 * sigma * sigma)
                    );

                    kernel.push({ x, y, weight });
                    kernelTotal += weight;
                }
            }

            for (let y = 0; y < height; y++) {
                for (let x = 0; x < width; x++) {
                    let total = 0;

                    for (const point of kernel) {
                        const sampleX = x + point.x;
                        const sampleY = y + point.y;

                        if (
                            sampleX < 0 || sampleY < 0 ||
                            sampleX >= width || sampleY >= height
                        ) continue;

                        total +=
                            mask[sampleY * width + sampleX] *
                            point.weight;
                    }

                    result[y * width + x] = Math.round(total / kernelTotal);
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
