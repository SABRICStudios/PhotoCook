
import { pipeline, RawImage } from "https://esm.sh/@huggingface/transformers@4.3.2";

const PhotoCookBGProcessor = (() => {
    const MODEL = "onnx-community/ormbg-ONNX";

    const CONFIG = {
        maxInputSize: 1024,
        dtype: "q8"
    };

    let segmenter = null;
    let loadingPromise = null;
    let backend = null;
    let busy = false;

    const emit = (callback, stage, message, progress = null) => {
        if (typeof callback === "function") {
            callback({ stage, message, progress });
        }
    };

    const getCanvas = (width, height) => {
        if (typeof OffscreenCanvas !== "undefined") {
            return new OffscreenCanvas(width, height);
        }

        const canvas = document.createElement("canvas");
        canvas.width = width;
        canvas.height = height;
        return canvas;
    };

    const getDimensions = source => {
        if (source instanceof ImageBitmap) {
            return { width: source.width, height: source.height };
        }

        if (source instanceof HTMLImageElement) {
            return {
                width: source.naturalWidth,
                height: source.naturalHeight
            };
        }

        if (source instanceof HTMLCanvasElement ||
            (typeof OffscreenCanvas !== "undefined" &&
             source instanceof OffscreenCanvas)) {
            return { width: source.width, height: source.height };
        }

        throw new Error("Unsupported image source.");
    };

    const prepareImage = async (source, maxSize) => {
        let bitmap = null;
        let ownsBitmap = false;

        try {
            if (source instanceof Blob) {
                bitmap = await createImageBitmap(source, {
                    imageOrientation: "from-image"
                });
                ownsBitmap = true;
            } else if (source instanceof ImageBitmap) {
                bitmap = source;
            } else {
                const dimensions = getDimensions(source);

                if (!dimensions.width || !dimensions.height) {
                    throw new Error("Image has invalid dimensions.");
                }

                bitmap = await createImageBitmap(source);
                ownsBitmap = true;
            }

            const originalWidth = bitmap.width;
            const originalHeight = bitmap.height;

            const scale = Math.min(
                1,
                maxSize / Math.max(originalWidth, originalHeight)
            );

            const width = Math.max(1, Math.round(originalWidth * scale));
            const height = Math.max(1, Math.round(originalHeight * scale));

            const canvas = getCanvas(width, height);
            const ctx = canvas.getContext("2d", {
                willReadFrequently: true
            });

            if (!ctx) {
                throw new Error("Unable to create image context.");
            }

            ctx.imageSmoothingEnabled = true;
            ctx.imageSmoothingQuality = "high";
            ctx.drawImage(bitmap, 0, 0, width, height);

            const pixels = ctx.getImageData(0, 0, width, height);

            return {
                image: new RawImage(pixels.data, width, height, 4),
                width,
                height,
                originalWidth,
                originalHeight
            };
        } finally {
            if (ownsBitmap && bitmap) bitmap.close();
        }
    };

    const createMask = image => {
        const { data, width, height, channels } = image;

        if (!data || !width || !height) {
            throw new Error("AI returned an invalid image.");
        }

        const mask = new Uint8Array(width * height);

        if (channels === 1) {
            mask.set(data);
        } else if (channels === 4) {
            for (let i = 0; i < mask.length; i++) {
                mask[i] = data[i * 4 + 3];
            }
        } else {
            throw new Error(
                `Unsupported AI output format: ${channels} channels.`
            );
        }

        return { mask, width, height };
    };

    const createPipeline = async (device, onProgress) => {
        return pipeline("background-removal", MODEL, {
            device,
            dtype: CONFIG.dtype,
            progress_callback: event => {
                if (event.status === "progress") {
                    emit(
                        onProgress,
                        "loading",
                        "Downloading AI model...",
                        event.progress ?? null
                    );
                }
            }
        });
    };

    const load = async (onProgress = null) => {
        if (segmenter) return segmenter;
        if (loadingPromise) return loadingPromise;

        loadingPromise = (async () => {
            emit(onProgress, "loading", "Initializing AI model...");

            if (!segmenter) {
                emit(
                    onProgress,
                    "loading",
                    "Initializing WebAssembly fallback..."
                );

                segmenter = await createPipeline("wasm", onProgress);
                backend = "wasm";
            }

            emit(onProgress, "ready", "AI model ready.", 100);
            return segmenter;
        })();

        try {
            return await loadingPromise;
        } finally {
            loadingPromise = null;
        }
    };

    const process = async (source, options = {}) => {
        if (busy) {
            throw new Error("Background removal is already running.");
        }

        busy = true;

        const onProgress = options.onProgress ?? null;
        const maxInputSize = options.maxInputSize ?? CONFIG.maxInputSize;

        try {
            if (!Number.isInteger(maxInputSize) ||
                maxInputSize < 128 ||
                maxInputSize > 2048) {
                throw new Error("Invalid inference resolution.");
            }

            const model = await load(onProgress);

            emit(onProgress, "preparing", "Preparing image...");

            const prepared = await prepareImage(source, maxInputSize);

            emit(onProgress, "processing", "Removing background...");

            const output = await model(prepared.image);
            const result = Array.isArray(output) ? output[0] : output;

            if (!result) {
                throw new Error("AI returned no segmentation result.");
            }

            console.log("[PhotoCook BG] Raw AI output:", {
                width: result.width,
                height: result.height,
                channels: result.channels,
                dataType: result.data?.constructor?.name,
                dataLength: result.data?.length,
                firstPixels: Array.from(result.data?.slice(0, 24) || [])
            });

            const maskResult = createMask(result);

            let min = 255;
            let max = 0;
            let sum = 0; 

            for (const value of maskResult.mask) {
                if (value < min) min = value;
                if (value > max) max = value;
                sum += value;
            }

            console.log("[PhotoCook BG] Extracted mask:", {
                width: maskResult.width,
                height: maskResult.height,
                min,
                max,
                average: sum / maskResult.mask.length,
                corners: [
                    maskResult.mask[0],
                    maskResult.mask[maskResult.width - 1],
                    maskResult.mask[(maskResult.height - 1) * maskResult.width],
                    maskResult.mask[maskResult.mask.length - 1]
                ]
            });

            emit(onProgress, "complete", "Background mask ready.", 100);

            return {
                mask: maskResult.mask,
                width: maskResult.width,
                height: maskResult.height,
                originalWidth: prepared.originalWidth,
                originalHeight: prepared.originalHeight,
                backend,
                model: MODEL
            };
        } catch (error) {
            emit(
                onProgress,
                "error",
                error.message || "Background removal failed."
            );

            throw error;
        } finally {
            busy = false;
        }
    };

    const dispose = async () => {
        if (busy || loadingPromise) {
            throw new Error("Cannot dispose while processing.");
        }

        if (segmenter) {
            await segmenter.dispose();
            segmenter = null;
        }

        backend = null;
    };

    const getStatus = () => ({
        loaded: !!segmenter,
        loading: !!loadingPromise,
        busy,
        backend,
        model: MODEL
    });

    return {
        load,
        process,
        dispose,
        getStatus
    };
})();

window.PhotoCookBGProcessor = PhotoCookBGProcessor;
