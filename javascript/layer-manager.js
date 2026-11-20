
/* PhotoCook — Dedicated Layer Manager Module */
window.PhotoCookLayerManager = (() => {
    'use strict';

    let imageLayers = [];

    function clearLayerSelection(layer) {
        if (window.PhotoCookSelectionEngine) {
            window.PhotoCookSelectionEngine.destroyLayer(layer);
        }
    }

    function getLayers() {
        return imageLayers;
    }

    function addLayer(img, canvasWidth, canvasHeight) {
        if (!img) return null;

        const scale = Math.min(canvasWidth / img.width, canvasHeight / img.height);
        const drawWidth = img.width * scale;
        const drawHeight = img.height * scale;
        const x = (canvasWidth - drawWidth) / 2;
        const y = (canvasHeight - drawHeight) / 2;

        imageLayers.forEach(layer => layer.isSelected = false);

        const newLayer = {
            img,
            x,
            y,
            width: drawWidth,
            height: drawHeight,
            isSelected: true,
            handleBounds: null,
            adjustments: {}
        };

        imageLayers.push(newLayer);
        return newLayer;
    }

    function getSelectedLayer() {
        return imageLayers.find(layer => layer.isSelected) || null;
    }

    function deselectAll() {
        imageLayers.forEach(layer => layer.isSelected = false);
    }

    function updateSelectedLayerImage(newImg, newWidth, newHeight) {
        const layer = getSelectedLayer();
        if (!layer || !newImg) return false;

        const oldWidth = layer.img?.naturalWidth || layer.img?.width;
        const oldHeight = layer.img?.naturalHeight || layer.img?.height;
        const newImageWidth = newImg.naturalWidth || newImg.width;
        const newImageHeight = newImg.naturalHeight || newImg.height;

        // Clear selection only if the underlying image dimensions change.
        if (oldWidth !== newImageWidth || oldHeight !== newImageHeight) {
            clearLayerSelection(layer);
        }

        layer.img = newImg;

        if (Number.isFinite(newWidth) && newWidth > 0) {
            layer.width = newWidth;
        }

        if (Number.isFinite(newHeight) && newHeight > 0) {
            layer.height = newHeight;
        }

        return true;
    }

    function addTextLayer(textConfig, canvasWidth, canvasHeight) {
        if (!textConfig) return null;

        imageLayers.forEach(layer => layer.isSelected = false);

        const tempCanvas = document.createElement('canvas');
        const tempCtx = tempCanvas.getContext('2d');

        const fontSize = textConfig.fontSize || 48;
        const fontFamily = textConfig.fontFamily || 'Arial';

        tempCtx.font = `${fontSize}px ${fontFamily}`;

        const textMetrics = tempCtx.measureText(
            textConfig.text || 'Your paragraph text'
        );

        const textWidth = textMetrics.width;
        const textHeight = fontSize;

        textConfig.x = (canvasWidth / 2) - (textWidth / 2);
        textConfig.y = (canvasHeight / 2) - (textHeight / 2);
        textConfig.width = textWidth;
        textConfig.height = textHeight;
        textConfig.isSelected = true;

        imageLayers.push(textConfig);
        return textConfig;
    }

    function removeLayer(targetLayer) {
        const index = imageLayers.indexOf(targetLayer);
        if (index === -1) return false;

        clearLayerSelection(targetLayer);

        imageLayers.splice(index, 1);
        return true;
    }

    function getSelectedLayerAdjustments() {
        const layer = getSelectedLayer();
        if (!layer || !layer.img) return null;

        return { ...(layer.adjustments || {}) };
    }

    function updateSelectedLayerAdjustments(newAdjustments) {
        const layer = getSelectedLayer();

        if (!layer || !layer.img ||
            !newAdjustments ||
            typeof newAdjustments !== 'object') {
            return false;
        }

        layer.adjustments = {
            ...(layer.adjustments || {}),
            ...newAdjustments
        };

        return true;
    }

    function resetSelectedLayerAdjustments() {
        const layer = getSelectedLayer();
        if (!layer || !layer.img) return false;

        layer.adjustments = {};
        return true;
    }

    function clearLayers() {
        imageLayers.forEach(clearLayerSelection);
        imageLayers = [];
    }

    return {
        getLayers,
        addLayer,
        addTextLayer,
        getSelectedLayer,
        deselectAll,
        updateSelectedLayerImage,
        getSelectedLayerAdjustments,
        updateSelectedLayerAdjustments,
        resetSelectedLayerAdjustments,
        removeLayer,
        clearLayers
    };
})();
