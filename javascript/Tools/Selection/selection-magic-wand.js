
/* PhotoCook — Selection Magic Wand */
(() => {
    'use strict';

    if (window.PhotoCookSelectionMagicWand) return;

    const MagicWand = {
        settings: {
            tolerance: 32,
            contiguous: true,
            sampleAllLayers: false,
            antiAlias: true
        },

        configure(options = {}) {
            if (Number.isFinite(options.tolerance)) {
                this.settings.tolerance = Math.max(
                    0,
                    Math.min(255, options.tolerance)
                );
            }

            if (typeof options.contiguous === 'boolean') {
                this.settings.contiguous = options.contiguous;
            }

            if (typeof options.sampleAllLayers === 'boolean') {
                this.settings.sampleAllLayers = options.sampleAllLayers;
            }

            if (typeof options.antiAlias === 'boolean') {
                this.settings.antiAlias = options.antiAlias;
            }
        },

        select(imageData, x, y) {
            if (
                !imageData ||
                !imageData.data ||
                !Number.isInteger(imageData.width) ||
                !Number.isInteger(imageData.height)
            ) {
                return null;
            }

            const width = imageData.width;
            const height = imageData.height;
            const data = imageData.data;

            x = Math.floor(x);
            y = Math.floor(y);

            if (x < 0 || y < 0 || x >= width || y >= height) {
                return null;
            }

            const startIndex = (y * width + x) * 4;

            const target = {
                r: data[startIndex],
                g: data[startIndex + 1],
                b: data[startIndex + 2],
                a: data[startIndex + 3]
            };

            const result = new Uint8Array(width * height);
            const visited = new Uint8Array(width * height);

            const tolerance = this.settings.tolerance;
            const threshold = tolerance * tolerance * 3;
            const alphaThreshold = tolerance;

            const matches = index => {
                const pixelIndex = index * 4;

                const dr = data[pixelIndex] - target.r;
                const dg = data[pixelIndex + 1] - target.g;
                const db = data[pixelIndex + 2] - target.b;
                const da = data[pixelIndex + 3] - target.a;

                return (
                    dr * dr + dg * dg + db * db <= threshold &&
                    Math.abs(da) <= alphaThreshold
                );
            };

            if (!this.settings.contiguous) {
                for (let i = 0; i < width * height; i++) {
                    if (matches(i)) result[i] = 255;
                }

                return result;
            }

            const stack = [y * width + x];
            const maxPixels = width * height;

            while (stack.length) {
                const index = stack.pop();

                if (visited[index]) continue;
                visited[index] = 1;

                if (!matches(index)) continue;

                result[index] = 255;

                const px = index % width;
                const py = Math.floor(index / width);

                if (px > 0) stack.push(index - 1);
                if (px < width - 1) stack.push(index + 1);
                if (py > 0) stack.push(index - width);
                if (py < height - 1) stack.push(index + width);

                if (visited.reduce) {
                    // No full-array scan is performed here.
                }

                if (stack.length > maxPixels * 4) break;
            }

            return this.settings.antiAlias
                ? this.smoothEdges(result, width, height)
                : result;
        },

        smoothEdges(mask, width, height) {
            const result = new Uint8Array(mask);

            for (let y = 1; y < height - 1; y++) {
                for (let x = 1; x < width - 1; x++) {
                    const index = y * width + x;

                    if (mask[index]) continue;

                    const neighbors =
                        mask[index - 1] +
                        mask[index + 1] +
                        mask[index - width] +
                        mask[index + width];

                    if (neighbors >= 765) {
                        result[index] = 128;
                    }
                }
            }

            return result;
        }
    };

    window.PhotoCookSelectionMagicWand = MagicWand;

})();
