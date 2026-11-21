
/* PhotoCook — Selection Engine */
(() => {
    'use strict';

    if (window.PhotoCookSelectionEngine) return;

    const masks = new Map();
    const baseMasks = new Map();
    const revisions = new WeakMap();
    const featherRadii = new WeakMap();

    const VALID_OPERATIONS = new Set([
        'new',
        'add',
        'subtract',
        'intersect'
    ]);

    function isValidLayer(layer) {
        return Boolean(
            layer &&
            typeof layer === 'object' &&
            layer.type !== 'text' &&
            layer.img
        );
    }

    function getDimensions(layer) {
        if (!isValidLayer(layer)) return null;

        const img = layer.img;

        const width = Math.floor(
            img.naturalWidth || img.videoWidth || img.width || 0
        );

        const height = Math.floor(
            img.naturalHeight || img.videoHeight || img.height || 0
        );

        if (
            !Number.isSafeInteger(width) ||
            !Number.isSafeInteger(height) ||
            width <= 0 ||
            height <= 0 ||
            !Number.isSafeInteger(width * height)
        ) {
            return null;
        }

        return { width, height };
    }

    function getRevision(layer) {
        return revisions.get(layer) || 0;
    }

    function updateRevision(layer) {
        if (!layer || typeof layer !== 'object') return 0;

        const revision = getRevision(layer) + 1;
        revisions.set(layer, revision);

        return revision;
    }

    function dispatchChange(layer, mask, operation) {
        window.dispatchEvent(new CustomEvent(
            'photocook:selection:changed',
            {
                detail: {
                    layer,
                    mask,
                    operation,
                    revision: getRevision(layer)
                }
            }
        ));
    }

    function getMask(layer) {
        const mask = masks.get(layer);
        return mask ? new Uint8Array(mask) : null;
    }

    // Always returns the original, unfeathered selection.
    function getBaseMask(layer) {
        const mask = baseMasks.get(layer);
        return mask ? new Uint8Array(mask) : null;
    }

    function getFeatherRadius(layer) {
        return featherRadii.get(layer) || 0;
    }

    function buildDisplayMask(layer, baseMask, radius) {
        if (!baseMask) return null;

        const amount = Math.max(
            0,
            Math.min(100, Number(radius) || 0)
        );

        if (amount === 0) {
            return new Uint8Array(baseMask);
        }

        const operations = window.PhotoCookSelectionOperations;

        if (typeof operations?.feather !== 'function') {
            console.error(
                'PhotoCook Selection: Feather operation unavailable.'
            );
            return null;
        }

        const dimensions = getDimensions(layer);
        if (!dimensions) return null;

        const result = operations.feather(
            baseMask,
            dimensions.width,
            dimensions.height,
            amount
        );

        if (
            !(result instanceof Uint8Array) ||
            result.length !== baseMask.length
        ) {
            console.error(
                'PhotoCook Selection: Feather operation returned an invalid mask.'
            );
            return null;
        }

        return result;
    }

    function updateDisplayMask(layer, operation) {
        const baseMask = baseMasks.get(layer);
        if (!baseMask) return false;

        const result = buildDisplayMask(
            layer,
            baseMask,
            getFeatherRadius(layer)
        );

        if (!result) return false;

        masks.set(layer, result);
        updateRevision(layer);
        dispatchChange(layer, result, operation);

        return true;
    }

    function createMask(layer, fill = 0) {
        const dimensions = getDimensions(layer);
        if (!dimensions) return null;

        const { width, height } = dimensions;
        const mask = new Uint8Array(width * height);

        const fillValue = Number.isFinite(fill)
            ? Math.max(0, Math.min(255, Math.round(fill)))
            : 0;

        if (fillValue > 0) {
            mask.fill(fillValue);
        }

        baseMasks.set(layer, new Uint8Array(mask));

        const result = buildDisplayMask(
            layer,
            mask,
            getFeatherRadius(layer)
        );

        if (!result) {
            baseMasks.delete(layer);
            return null;
        }

        masks.set(layer, result);
        updateRevision(layer);
        dispatchChange(layer, result, 'create');

        return new Uint8Array(result);
    }

    function setMask(layer, mask) {
        const dimensions = getDimensions(layer);

        if (
            !dimensions ||
            !(mask instanceof Uint8Array)
        ) {
            return false;
        }

        const { width, height } = dimensions;

        if (mask.length !== width * height) {
            console.warn(
                'PhotoCook Selection: Mask dimensions do not match the image.'
            );
            return false;
        }

        baseMasks.set(layer, new Uint8Array(mask));

        return updateDisplayMask(layer, 'set');
    }

    function applyMask(layer, incomingMask, operation = 'new') {
        const dimensions = getDimensions(layer);

        if (
            !dimensions ||
            !(incomingMask instanceof Uint8Array) ||
            !VALID_OPERATIONS.has(operation)
        ) {
            return false;
        }

        const { width, height } = dimensions;
        const total = width * height;

        if (incomingMask.length !== total) {
            console.warn(
                'PhotoCook Selection: Incoming mask dimensions do not match the image.'
            );
            return false;
        }

        // Selection operations always work from the sharp base mask.
        const currentMask = baseMasks.get(layer);
        const result = new Uint8Array(total);

        if (operation === 'new' || !currentMask) {
            result.set(incomingMask);
        } else {
            for (let i = 0; i < total; i++) {
                const current = currentMask[i];
                const incoming = incomingMask[i];

                switch (operation) {
                    case 'add':
                        result[i] = Math.round(
                            current + incoming -
                            (current * incoming / 255)
                        );
                        break;

                    case 'subtract':
                        result[i] = Math.round(
                            current * (255 - incoming) / 255
                        );
                        break;

                    case 'intersect':
                        result[i] = Math.round(
                            current * incoming / 255
                        );
                        break;
                }
            }
        }

        baseMasks.set(layer, result);

        return updateDisplayMask(layer, operation);
    }

    function featherSelection(layer, radius) {
        if (!getDimensions(layer)) return false;

        const baseMask = baseMasks.get(layer);
        if (!baseMask) return false;

        const amount = Math.max(
            0,
            Math.min(100, Number(radius) || 0)
        );

        featherRadii.set(layer, amount);

        return updateDisplayMask(layer, 'feather');
    }

    function hasSelection(layer) {
        const mask = getMask(layer);
        if (!mask) return false;

        for (let i = 0; i < mask.length; i++) {
            if (mask[i] > 0) return true;
        }

        return false;
    }

    function getSelectionBounds(layer) {
        const mask = getMask(layer);
        const dimensions = getDimensions(layer);

        if (!mask || !dimensions) return null;

        const { width, height } = dimensions;

        let minX = width;
        let minY = height;
        let maxX = -1;
        let maxY = -1;

        for (let y = 0; y < height; y++) {
            const rowOffset = y * width;

            for (let x = 0; x < width; x++) {
                if (mask[rowOffset + x] === 0) continue;

                if (x < minX) minX = x;
                if (x > maxX) maxX = x;
                if (y < minY) minY = y;
                if (y > maxY) maxY = y;
            }
        }

        if (maxX < 0) return null;

        return {
            x: minX,
            y: minY,
            width: maxX - minX + 1,
            height: maxY - minY + 1
        };
    }

    function getSelectionInfo(layer) {
        const dimensions = getDimensions(layer);
        const mask = getMask(layer);

        if (!dimensions || !mask || !hasSelection(layer)) {
            return null;
        }

        return {
            mask,
            width: dimensions.width,
            height: dimensions.height,
            bounds: getSelectionBounds(layer),
            revision: getRevision(layer)
        };
    }

    function invert(layer) {
        if (!getDimensions(layer)) return false;

        const currentMask = baseMasks.get(layer);

        if (!currentMask) {
            return Boolean(createMask(layer, 255));
        }

        const inverted = new Uint8Array(currentMask.length);

        for (let i = 0; i < currentMask.length; i++) {
            inverted[i] = 255 - currentMask[i];
        }

        baseMasks.set(layer, inverted);

        return updateDisplayMask(layer, 'invert');
    }

    function clear(layer) {
        if (!layer || typeof layer !== 'object') return false;

        const existed = masks.has(layer);

        if (!existed) return false;

        masks.delete(layer);
        baseMasks.delete(layer);
        featherRadii.delete(layer);

        updateRevision(layer);
        dispatchChange(layer, null, 'clear');

        return true;
    }

    function clearAll() {
        const affectedLayers = Array.from(masks.keys());

        affectedLayers.forEach(layer => {
            masks.delete(layer);
            baseMasks.delete(layer);
            featherRadii.delete(layer);

            updateRevision(layer);
            dispatchChange(layer, null, 'clear');
        });

        window.dispatchEvent(
            new CustomEvent('photocook:selection:cleared')
        );
    }

    function destroyLayer(layer) {
        return clear(layer);
    }

    // Blend Edge is handled centrally, regardless of selection method.
    document.addEventListener(
        'photocook:selection:blendchange',
        event => {
            const interaction = window.PhotoCookSelectionInteraction;
            const layer = interaction?.getSelectedLayer?.();

            if (!layer) return;

            const feather = Number(event.detail?.feather) || 0;

            if (featherSelection(layer, feather)) {
                interaction?.requestRedraw?.();
                window.PhotoCookInteraction?.redrawCanvas?.();
            }
        }
    );

    window.PhotoCookSelectionEngine = {
        getDimensions,
        getMask,
        getBaseMask,
        getRevision,
        getSelectionInfo,
        getFeatherRadius,
        createMask,
        setMask,
        applyMask,
        hasSelection,
        getSelectionBounds,
        featherSelection,
        invert,
        clear,
        clearAll,
        destroyLayer
    };
})();
