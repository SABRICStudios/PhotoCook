
/* PhotoCook — Selection Engine */
(() => {
    'use strict';

    if (window.PhotoCookSelectionEngine) return;

    const masks = new Map();
    const revisions = new WeakMap();

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

        masks.set(layer, mask);
        updateRevision(layer);
        dispatchChange(layer, mask, 'create');

        return mask;
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

        const updatedMask = new Uint8Array(mask);

        masks.set(layer, updatedMask);
        updateRevision(layer);
        dispatchChange(layer, updatedMask, 'set');

        return true;
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

        const currentMask = masks.get(layer);
        const result = new Uint8Array(total);

        if (operation === 'new' || !currentMask) {
            result.set(incomingMask);
        } else {
            for (let i = 0; i < total; i++) {
                const current = currentMask[i];
                const incoming = incomingMask[i];

                switch (operation) {
                    case 'add':
                        // Alpha union: preserve partially selected edges.
                        result[i] = Math.round(
                            current + incoming -
                            (current * incoming / 255)
                        );
                        break;

                    case 'subtract':
                        // Remove the incoming selection proportionally.
                        result[i] = Math.round(
                            current * (255 - incoming) / 255
                        );
                        break;

                    case 'intersect':
                        // Keep only the overlapping selection strength.
                        result[i] = Math.round(
                            current * incoming / 255
                        );
                        break;
                }
            }
        }

        masks.set(layer, result);
        updateRevision(layer);
        dispatchChange(layer, result, operation);

        return true;
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

        if (mask.length !== width * height) return null;

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
        const dimensions = getDimensions(layer);
        if (!dimensions) return false;

        const currentMask = getMask(layer);

        if (!currentMask) {
            return Boolean(createMask(layer, 255));
        }

        const inverted = new Uint8Array(currentMask.length);

        for (let i = 0; i < currentMask.length; i++) {
            inverted[i] = 255 - currentMask[i];
        }

        masks.set(layer, inverted);
        updateRevision(layer);
        dispatchChange(layer, inverted, 'invert');

        return true;
    }

    function clear(layer) {
        if (!layer || typeof layer !== 'object') return false;

        const existed = masks.has(layer);

        if (!existed) return false;

        masks.delete(layer);

        // Keep the revision increasing even after clearing.
        updateRevision(layer);

        dispatchChange(layer, null, 'clear');

        return true;
    }

    function clearAll() {
        const affectedLayers = Array.from(masks.keys());

        affectedLayers.forEach(layer => {
            masks.delete(layer);
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

    window.PhotoCookSelectionEngine = {
        getDimensions,
        getMask,
        getRevision,
        getSelectionInfo,
        createMask,
        setMask,
        applyMask,
        hasSelection,
        getSelectionBounds,
        invert,
        clear,
        clearAll,
        destroyLayer
    };
})();