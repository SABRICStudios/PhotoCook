
/* PhotoCook — Selection Processor */
(() => {
    'use strict';

    if (window.PhotoCookSelectionProcessor) return;

    const Processor = {
        canvas: null,
        context: null,

        createCanvas(width, height) {
            if (
                !Number.isInteger(width) ||
                !Number.isInteger(height) ||
                width <= 0 ||
                height <= 0
            ) {
                throw new Error('Invalid image dimensions.');
            }

            const canvas = document.createElement('canvas');
            canvas.width = width;
            canvas.height = height;

            return canvas;
        },

        apply(originalImageData, editedImageData, mask) {
            if (
                !originalImageData ||
                !editedImageData ||
                !mask ||
                !originalImageData.data ||
                !editedImageData.data
            ) {
                throw new Error('Missing image or selection data.');
            }

            const width = originalImageData.width;
            const height = originalImageData.height;
            const pixelCount = width * height;

            if (
                editedImageData.width !== width ||
                editedImageData.height !== height ||
                originalImageData.data.length !== pixelCount * 4 ||
                editedImageData.data.length !== pixelCount * 4 ||
                mask.length !== pixelCount
            ) {
                throw new Error('Image and selection dimensions do not match.');
            }

            const result = new ImageData(width, height);
            const original = originalImageData.data;
            const edited = editedImageData.data;
            const output = result.data;

            for (let i = 0; i < pixelCount; i++) {
                const pixel = i * 4;
                const amount = mask[i] / 255;
                const inverse = 1 - amount;

                output[pixel] =
                    original[pixel] * inverse + edited[pixel] * amount;

                output[pixel + 1] =
                    original[pixel + 1] * inverse + edited[pixel + 1] * amount;

                output[pixel + 2] =
                    original[pixel + 2] * inverse + edited[pixel + 2] * amount;

                output[pixel + 3] =
                    original[pixel + 3] * inverse + edited[pixel + 3] * amount;
            }

            return result;
        },

        applyToCanvas(originalCanvas, editedCanvas, mask) {
            if (!originalCanvas || !editedCanvas) {
                throw new Error('Original or edited canvas is missing.');
            }

            const width = originalCanvas.width;
            const height = originalCanvas.height;

            if (
                editedCanvas.width !== width ||
                editedCanvas.height !== height
            ) {
                throw new Error('Canvas dimensions do not match.');
            }

            const originalContext = originalCanvas.getContext('2d', {
                willReadFrequently: true
            });

            const editedContext = editedCanvas.getContext('2d', {
                willReadFrequently: true
            });

            const originalData = originalContext.getImageData(
                0, 0, width, height
            );

            const editedData = editedContext.getImageData(
                0, 0, width, height
            );

            const result = this.apply(originalData, editedData, mask);

            const outputCanvas = this.createCanvas(width, height);
            outputCanvas.getContext('2d').putImageData(result, 0, 0);

            return outputCanvas;
        },

        async applyToLayer(layer, editedCanvas, mask) {
            if (!layer || !layer.img) {
                throw new Error('A valid image layer is required.');
            }

            const width = layer.img.naturalWidth || layer.img.width;
            const height = layer.img.naturalHeight || layer.img.height;

            if (
                !width ||
                !height ||
                editedCanvas.width !== width ||
                editedCanvas.height !== height
            ) {
                throw new Error('Edited image dimensions do not match the layer.');
            }

            const originalCanvas = this.createCanvas(width, height);
            const context = originalCanvas.getContext('2d', {
                willReadFrequently: true
            });

            context.drawImage(layer.img, 0, 0, width, height);

            return this.applyToCanvas(
                originalCanvas,
                editedCanvas,
                mask
            );
        }
    };

    window.PhotoCookSelectionProcessor = Processor;

})();
