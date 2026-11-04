
window.PhotoCookBGMask = (() => {
    "use strict";

    const MAX_PIXELS = 100_000_000;

    const validateSize = (width, height) => {
        if (!Number.isSafeInteger(width) || !Number.isSafeInteger(height) ||
            width <= 0 || height <= 0 || width * height > MAX_PIXELS) {
            throw new Error("Invalid or unsupported mask dimensions.");
        }
    };

    const validateMask = (mask, width, height) => {
        validateSize(width, height);

        if (!(mask instanceof Uint8Array) ||
            mask.length !== width * height) {
            throw new Error("Invalid background mask data.");
        }
    };

    const createCanvas = (width, height) => {
        validateSize(width, height);

        const canvas = typeof OffscreenCanvas !== "undefined"
            ? new OffscreenCanvas(width, height)
            : document.createElement("canvas");

        canvas.width = width;
        canvas.height = height;
        return canvas;
    };

    const getContext = canvas => {
        const ctx = canvas.getContext("2d", {
            willReadFrequently: true
        });

        if (!ctx) throw new Error("Unable to create canvas context.");
        return ctx;
    };

    const createMask = (width, height, fill = 255) => {
        validateSize(width, height);

        const value = Math.max(0, Math.min(255, Math.round(fill)));
        const mask = new Uint8Array(width * height);
        mask.fill(value);

        return { mask, width, height };
    };

    const resize = (mask, width, height, targetWidth, targetHeight) => {
        validateMask(mask, width, height);
        validateSize(targetWidth, targetHeight);

        if (width === targetWidth && height === targetHeight) {
            return new Uint8Array(mask);
        }

        const result = new Uint8Array(targetWidth * targetHeight);
        const scaleX = width / targetWidth;
        const scaleY = height / targetHeight;

        for (let y = 0; y < targetHeight; y++) {
            const sy = Math.max(0, Math.min(height - 1, (y + 0.5) * scaleY - 0.5));
            const y0 = Math.floor(sy);
            const y1 = Math.min(height - 1, y0 + 1);
            const fy = sy - y0;

            for (let x = 0; x < targetWidth; x++) {
                const sx = Math.max(0, Math.min(width - 1, (x + 0.5) * scaleX - 0.5));
                const x0 = Math.floor(sx);
                const x1 = Math.min(width - 1, x0 + 1);
                const fx = sx - x0;

                const a = mask[y0 * width + x0];
                const b = mask[y0 * width + x1];
                const c = mask[y1 * width + x0];
                const d = mask[y1 * width + x1];

                const top = a + (b - a) * fx;
                const bottom = c + (d - c) * fx;

                result[y * targetWidth + x] =
                    Math.round(top + (bottom - top) * fy);
            }
        }

        return result;
    };

    const adjustLevels = (mask, width, height, options = {}) => {
        validateMask(mask, width, height);

        const black = options.black ?? 0;
        const white = options.white ?? 255;
        const gamma = options.gamma ?? 1;

        if (!Number.isFinite(black) || !Number.isFinite(white) ||
            !Number.isFinite(gamma) || black < 0 || white > 255 ||
            black >= white || gamma <= 0) {
            throw new Error("Invalid mask level settings.");
        }

        const result = new Uint8Array(mask.length);
        const lut = new Uint8Array(256);

        for (let i = 0; i < 256; i++) {
            const normalized = Math.max(
                0, Math.min(1, (i - black) / (white - black))
            );

            lut[i] = Math.round(255 * Math.pow(normalized, 1 / gamma));
        }

        for (let i = 0; i < mask.length; i++) {
            result[i] = lut[mask[i]];
        }

        return result;
    };

    const feather = (mask, width, height, radius = 0) => {
        validateMask(mask, width, height);

        radius = Math.round(radius);

        if (!Number.isFinite(radius) || radius < 0 || radius > 100) {
            throw new Error("Invalid feather radius.");
        }

        if (radius === 0) return new Uint8Array(mask);

        const temp = new Float32Array(mask.length);
        const output = new Uint8Array(mask.length);
        const kernel = radius * 2 + 1;

        for (let y = 0; y < height; y++) {
            let sum = 0;

            for (let k = -radius; k <= radius; k++) {
                const x = Math.max(0, Math.min(width - 1, k));
                sum += mask[y * width + x];
            }

            for (let x = 0; x < width; x++) {
                temp[y * width + x] = sum / kernel;

                const removeX = Math.max(0, x - radius);
                const addX = Math.min(width - 1, x + radius + 1);

                sum += mask[y * width + addX] -
                    mask[y * width + removeX];
            }
        }

        for (let x = 0; x < width; x++) {
            let sum = 0;

            for (let k = -radius; k <= radius; k++) {
                const y = Math.max(0, Math.min(height - 1, k));
                sum += temp[y * width + x];
            }

            for (let y = 0; y < height; y++) {
                output[y * width + x] = Math.round(sum / kernel);

                const removeY = Math.max(0, y - radius);
                const addY = Math.min(height - 1, y + radius + 1);

                sum += temp[addY * width + x] -
                    temp[removeY * width + x];
            }
        }

        return output;
    };

        // Positive radius expands foreground; negative radius contracts it.
    const shiftEdge = (mask, width, height, radius = 0) => {
        validateMask(mask, width, height);

        if (!Number.isInteger(radius) || Math.abs(radius) > 30) {
            throw new Error("Edge shift must be an integer from -30 to 30.");
        }

        if (radius === 0) return new Uint8Array(mask);

        const r = Math.abs(radius);
        const dilate = radius > 0;
        const temp = new Uint8Array(mask.length);
        const output = new Uint8Array(mask.length);

        function scan(length, get, put) {
            const indices = new Int32Array(length);
            let head = 0, tail = 0, next = 0;

            for (let pos = 0; pos < length; pos++) {
                const right = Math.min(length - 1, pos + r);

                while (next <= right) {
                    const value = get(next);

                    while (tail > head &&
                        (dilate ? get(indices[tail - 1]) <= value :
                                get(indices[tail - 1]) >= value)) {
                        tail--;
                    }

                    indices[tail++] = next++;
                }

                const left = Math.max(0, pos - r);

                while (tail > head && indices[head] < left) head++;

                put(pos, get(indices[head]));
            }
        }

        for (let y = 0; y < height; y++) {
            const offset = y * width;

            scan(
                width,
                x => mask[offset + x],
                (x, value) => { temp[offset + x] = value; }
            );
        }

        for (let x = 0; x < width; x++) {
            scan(
                height,
                y => temp[y * width + x],
                (y, value) => { output[y * width + x] = value; }
            );
        }

        return output;
    };

    // Remove small disconnected foreground regions.
    const removeIslands = (mask, width, height, minArea = 0, threshold = 128) => {
        validateMask(mask, width, height);

        if (!Number.isInteger(minArea) || minArea < 0 ||
            minArea > width * height || !Number.isInteger(threshold) ||
            threshold < 0 || threshold > 255) {
            throw new Error("Invalid island cleanup settings.");
        }

        const output = new Uint8Array(mask);
        if (minArea <= 1) return output;

        const visited = new Uint8Array(mask.length);
        const queue = new Int32Array(mask.length);

        for (let seed = 0; seed < mask.length; seed++) {
            if (visited[seed] || mask[seed] < threshold) continue;

            let head = 0, tail = 1;
            queue[0] = seed;
            visited[seed] = 1;

            while (head < tail) {
                const i = queue[head++];
                const x = i % width;
                const y = (i / width) | 0;

                const neighbors = [
                    x > 0 ? i - 1 : -1,
                    x + 1 < width ? i + 1 : -1,
                    y > 0 ? i - width : -1,
                    y + 1 < height ? i + width : -1
                ];

                for (const n of neighbors) {
                    if (n >= 0 && !visited[n] && mask[n] >= threshold) {
                        visited[n] = 1;
                        queue[tail++] = n;
                    }
                }
            }

            if (tail < minArea) {
                for (let j = 0; j < tail; j++) {
                    output[queue[j]] = 0;
                }
            }
        }

        return output;
    };

    const refine = (mask, width, height, options = {}) => {
        validateMask(mask, width, height);

        let result = adjustLevels(mask, width, height, {
            black: options.black ?? 0,
            white: options.white ?? 255,
            gamma: options.gamma ?? 1
        });

        if (options.edgeShift) {
            result = shiftEdge(result, width, height, options.edgeShift);
        }

        if (options.minIslandArea) {
            result = removeIslands(
                result,
                width,
                height,
                options.minIslandArea,
                options.islandThreshold ?? 128
            );
        }

        if (options.feather > 0) {
            result = feather(result, width, height, options.feather);
        }

        return result;
    };

    const toImageData = (mask, width, height) => {
        validateMask(mask, width, height);

        const pixels = new Uint8ClampedArray(width * height * 4);

        for (let i = 0, j = 0; i < mask.length; i++, j += 4) {
            const value = mask[i];

            pixels[j] = value;
            pixels[j + 1] = value;
            pixels[j + 2] = value;
            pixels[j + 3] = 255;
        }

        return new ImageData(pixels, width, height);
    };

    const getImageSize = image => {
        const width = image.naturalWidth || image.width;
        const height = image.naturalHeight || image.height;

        validateSize(width, height);
        return { width, height };
    };

    const apply = (image, mask, maskWidth, maskHeight) => {
        validateMask(mask, maskWidth, maskHeight);

        const { width, height } = getImageSize(image);
        const scaledMask = resize(
            mask, maskWidth, maskHeight, width, height
        );

        const canvas = createCanvas(width, height);
        const ctx = getContext(canvas);

        ctx.clearRect(0, 0, width, height);
        ctx.drawImage(image, 0, 0, width, height);

        const imageData = ctx.getImageData(0, 0, width, height);
        const pixels = imageData.data;

        for (let i = 0; i < scaledMask.length; i++) {
            const alphaIndex = i * 4 + 3;
            pixels[alphaIndex] = Math.round(
                pixels[alphaIndex] * scaledMask[i] / 255
            );
        }

        ctx.putImageData(imageData, 0, 0);
        return canvas;
    };

    const preview = (mask, width, height) => {
        const canvas = createCanvas(width, height);
        getContext(canvas).putImageData(
            toImageData(mask, width, height), 0, 0
        );
        return canvas;
    };

    return Object.freeze({
        createMask,
        resize,
        adjustLevels,
        feather,
        shiftEdge,
        removeIslands,
        refine,
        toImageData,
        apply,
        preview,
        validateMask
    });
})();
