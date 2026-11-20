
/* PhotoCook — AI Subject Selection */
(() => {
    'use strict';

    if (window.PhotoCookSelectionSubject) return;

    const Subject = {
        isProcessing: false,
        model: null,
        modelPromise: null,

        settings: {
            threshold: 0.5,
            feather: 0
        },

        configure(options = {}) {
            if (Number.isFinite(options.threshold)) {
                this.settings.threshold = Math.max(
                    0,
                    Math.min(1, options.threshold)
                );
            }

            if (Number.isFinite(options.feather)) {
                this.settings.feather = Math.max(
                    0,
                    Math.min(100, options.feather)
                );
            }
        },

        async loadModel() {
            if (this.model) return this.model;
            if (this.modelPromise) return this.modelPromise;

            this.modelPromise = (async () => {
                if (!window.PhotoCookSubjectModel) {
                    throw new Error(
                        'Subject selection model adapter is not installed.'
                    );
                }

                this.model = await window.PhotoCookSubjectModel.load();
                return this.model;
            })();

            try {
                return await this.modelPromise;
            } catch (error) {
                this.modelPromise = null;
                throw error;
            }
        },

        async select(imageSource) {
            if (this.isProcessing) {
                throw new Error('Subject selection is already processing.');
            }

            if (!imageSource) {
                throw new Error('No image supplied for subject selection.');
            }

            this.isProcessing = true;

            try {
                const model = await this.loadModel();

                if (!model || typeof model.segment !== 'function') {
                    throw new Error('Invalid subject selection model.');
                }

                const segmentation = await model.segment(imageSource);

                if (!segmentation) {
                    throw new Error('No subject was detected.');
                }

                const mask = this.normalizeMask(segmentation);

                if (!mask) {
                    throw new Error('Could not generate the subject mask.');
                }

                return {
                    mask: mask.data,
                    width: mask.width,
                    height: mask.height
                };
            } finally {
                this.isProcessing = false;
            }
        },

        normalizeMask(segmentation) {
            const width = segmentation.width;
            const height = segmentation.height;
            const source = segmentation.mask || segmentation.data;

            if (
                !Number.isInteger(width) ||
                !Number.isInteger(height) ||
                width <= 0 ||
                height <= 0 ||
                !source ||
                source.length !== width * height
            ) {
                return null;
            }

            const result = new Uint8Array(width * height);

            for (let i = 0; i < result.length; i++) {
                const value = Number(source[i]);

                const normalized = value > 1
                    ? value / 255
                    : value;

                result[i] = normalized >= this.settings.threshold
                    ? 255
                    : 0;
            }

            return {
                data: result,
                width,
                height
            };
        },

        cancel() {
            if (this.model && typeof this.model.cancel === 'function') {
                this.model.cancel();
            }

            this.isProcessing = false;
        }
    };

    window.PhotoCookSelectionSubject = Subject;

})();
