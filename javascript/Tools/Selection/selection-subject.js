/* PhotoCook — Interactive MobileSAM Subject Selection */
(() => {
    'use strict';

    if (window.PhotoCookSelectionSubject) return;

    const CONFIG = {
        encoderPath: './Models/mobile_sam_image_encoder.onnx',
        decoderPath: './Models/sam_mask_decoder_single.onnx',
        runtimeVersion: '1.22.0',
        inputLongSide: 1024,
        maskSize: 256
    };

    let ort = null;
    let encoder = null;
    let decoder = null;
    let loadingPromise = null;
    let imageSource = null;
    let imageEmbedding = null;
    let imageWidth = 0;
    let imageHeight = 0;
    let resizedWidth = 0;
    let resizedHeight = 0;
    let points = [];
    let previousLowResMask = null;
    let busy = false;
    let requestId = 0;

    function getModelUrl(path) {
        return new URL(path, document.baseURI).href;
    }

    async function loadRuntime() {
        if (ort) return ort;

        const module = await import(
            `https://esm.sh/onnxruntime-web@${CONFIG.runtimeVersion}?bundle`
        );

        ort = module.default || module;

        ort.env.wasm.wasmPaths =
            `https://cdn.jsdelivr.net/npm/onnxruntime-web@${CONFIG.runtimeVersion}/dist/`;

        ort.env.wasm.numThreads = 1;
        ort.env.wasm.proxy = false;

        return ort;
    }

    async function load() {
        if (encoder && decoder) return true;
        if (loadingPromise) return loadingPromise;

        loadingPromise = (async () => {
            const runtime = await loadRuntime();

            const sessionOptions = {
                executionProviders: ['wasm'],
                graphOptimizationLevel: 'all'
            };

            const [encoderSession, decoderSession] = await Promise.all([
                runtime.InferenceSession.create(
                    getModelUrl(CONFIG.encoderPath),
                    sessionOptions
                ),
                runtime.InferenceSession.create(
                    getModelUrl(CONFIG.decoderPath),
                    sessionOptions
                )
            ]);

            encoder = encoderSession;
            decoder = decoderSession;

            console.info('[PhotoCook MobileSAM] Models loaded.');
            return true;
        })();

        try {
            return await loadingPromise;
        } catch (error) {
            loadingPromise = null;
            encoder = null;
            decoder = null;
            console.error('[PhotoCook MobileSAM] Model loading failed:', error);
            throw error;
        }
    }

    function getSourceSize(source) {
        const width = source.naturalWidth || source.videoWidth || source.width;
        const height = source.naturalHeight || source.videoHeight || source.height;

        if (!width || !height) {
            throw new Error('The selected image has invalid dimensions.');
        }

        return { width, height };
    }

    function createEncoderInput(source) {
        const size = getSourceSize(source);
        const scale = CONFIG.inputLongSide / Math.max(size.width, size.height);

        resizedWidth = Math.max(1, Math.round(size.width * scale));
        resizedHeight = Math.max(1, Math.round(size.height * scale));

        const canvas = document.createElement('canvas');
        canvas.width = resizedWidth;
        canvas.height = resizedHeight;

        const context = canvas.getContext('2d', {
            willReadFrequently: true
        });

        if (!context) {
            throw new Error('Could not create the image processing canvas.');
        }

        context.imageSmoothingEnabled = true;
        context.imageSmoothingQuality = 'high';
        context.drawImage(source, 0, 0, resizedWidth, resizedHeight);

        const pixels = context.getImageData(
            0, 0, resizedWidth, resizedHeight
        ).data;

        const rgb = new Float32Array(resizedWidth * resizedHeight * 3);

        for (let src = 0, dst = 0; src < pixels.length; src += 4) {
            rgb[dst++] = pixels[src];
            rgb[dst++] = pixels[src + 1];
            rgb[dst++] = pixels[src + 2];
        }

        imageWidth = size.width;
        imageHeight = size.height;

        return new ort.Tensor(
            'float32',
            rgb,
            [resizedHeight, resizedWidth, 3]
        );
    }

    function disposeTensor(tensor) {
        try {
            tensor?.dispose?.();
        } catch (_) {}
    }

    function clearImage() {
        requestId++;

        disposeTensor(imageEmbedding);

        imageSource = null;
        imageEmbedding = null;
        imageWidth = 0;
        imageHeight = 0;
        resizedWidth = 0;
        resizedHeight = 0;
        points = [];
        previousLowResMask = null;
    }

    async function prepare(source) {
        if (!source) throw new Error('No image was provided.');
        if (busy) throw new Error('PhotoCook is already processing a selection.');

        if (source === imageSource && imageEmbedding) {
            return {
                width: imageWidth,
                height: imageHeight
            };
        }

        clearImage();
        const currentRequest = requestId;

        await load();

        if (currentRequest !== requestId) return null;

        const inputTensor = createEncoderInput(source);

        try {
            const inputName = encoder.inputNames[0];
            const outputName = encoder.outputNames[0];

            const result = await encoder.run({
                [inputName]: inputTensor
            });

            if (currentRequest !== requestId) {
                Object.values(result).forEach(disposeTensor);
                return null;
            }

            imageEmbedding = result[outputName];
            imageSource = source;

            console.info(
                `[PhotoCook MobileSAM] Image encoded: ${imageWidth}×${imageHeight}`
            );

            return {
                width: imageWidth,
                height: imageHeight
            };
        } finally {
            disposeTensor(inputTensor);
        }
    }

    async function addPoint(x, y, label = 1) {
        if (!imageEmbedding) {
            throw new Error('Prepare an image before adding selection points.');
        }

        if (busy) {
            throw new Error('Wait for the current selection to finish.');
        }

        if (!Number.isFinite(x) || !Number.isFinite(y)) {
            throw new Error('Invalid selection coordinates.');
        }

        if (label !== 0 && label !== 1) {
            throw new Error('Point label must be 1 (include) or 0 (exclude).');
        }

        x = Math.max(0, Math.min(imageWidth - 1, x));
        y = Math.max(0, Math.min(imageHeight - 1, y));

        points.push({ x, y, label });

        const currentRequest = requestId;
        busy = true;

        try {
            const scale = CONFIG.inputLongSide /
                Math.max(imageWidth, imageHeight);

            const coordinates = new Float32Array(points.length * 2);
            const labels = new Float32Array(points.length);

            points.forEach((point, index) => {
                coordinates[index * 2] = point.x * scale;
                coordinates[index * 2 + 1] = point.y * scale;
                labels[index] = point.label;
            });

            const maskInput = previousLowResMask
                ? new Float32Array(previousLowResMask)
                : new Float32Array(
                    CONFIG.maskSize * CONFIG.maskSize
                );

            const feeds = {
                image_embeddings: imageEmbedding,
                point_coords: new ort.Tensor(
                    'float32',
                    coordinates,
                    [1, points.length, 2]
                ),
                point_labels: new ort.Tensor(
                    'float32',
                    labels,
                    [1, points.length]
                ),
                mask_input: new ort.Tensor(
                    'float32',
                    maskInput,
                    [1, 1, CONFIG.maskSize, CONFIG.maskSize]
                ),
                has_mask_input: new ort.Tensor(
                    'float32',
                    new Float32Array([previousLowResMask ? 1 : 0]),
                    [1]
                ),
                orig_im_size: new ort.Tensor(
                    'float32',
                    new Float32Array([imageHeight, imageWidth]),
                    [2]
                )
            };

            let result;

            try {
                result = await decoder.run(feeds);
            } finally {
                Object.values(feeds).forEach(tensor => {
                    if (tensor !== imageEmbedding) disposeTensor(tensor);
                });
            }

            if (currentRequest !== requestId) {
                Object.values(result).forEach(disposeTensor);
                return null;
            }

            const maskTensor = result.masks;
            const lowResTensor = result.low_res_masks;
            const scoreTensor = result.iou_predictions;

            if (!maskTensor || !lowResTensor) {
                Object.values(result).forEach(disposeTensor);
                throw new Error('The MobileSAM decoder returned an unexpected output.');
            }

            const maskData = maskTensor.data;
            const expectedSize = imageWidth * imageHeight;

            if (maskData.length !== expectedSize) {
                Object.values(result).forEach(disposeTensor);
                throw new Error(
                    `Unexpected mask dimensions: received ${maskData.length} pixels, expected ${expectedSize}.`
                );
            }

            const mask = new Uint8Array(expectedSize);

            for (let i = 0; i < expectedSize; i++) {
                mask[i] = maskData[i] > 0 ? 255 : 0;
            }

            previousLowResMask = new Float32Array(lowResTensor.data);

            const score = scoreTensor?.data?.[0] ?? null;

            Object.values(result).forEach(disposeTensor);

            return {
                mask,
                width: imageWidth,
                height: imageHeight,
                score,
                pointCount: points.length
            };
        } finally {
            busy = false;
        }
    }

    function resetPrompts() {
        points = [];
        previousLowResMask = null;
    }

    function cancel() {
        requestId++;
        resetPrompts();
    }

    window.PhotoCookSelectionSubject = {
        load,
        prepare,
        addPoint,
        resetPrompts,
        clear: clearImage,
        cancel,

        isLoaded: () => Boolean(encoder && decoder),
        isBusy: () => busy,
        getPointCount: () => points.length,
        getImageSize: () => ({
            width: imageWidth,
            height: imageHeight
        })
    };
})();