/* PhotoCook — Dedicated Layer Manager Module */
window.PhotoCookLayerManager = (() => {
    'use strict';

    let imageLayers = []; // Stores layers: { img, x, y, width, height, isSelected, handleBounds }

    function getLayers() {
        return imageLayers;
    }

    function addLayer(img, canvasWidth, canvasHeight) {
        const scale = Math.min(canvasWidth / img.width, canvasHeight / img.height);
        const drawWidth = img.width * scale;
        const drawHeight = img.height * scale;
        const x = (canvasWidth - drawWidth) / 2;
        const y = (canvasHeight - drawHeight) / 2;

        // Deselect existing layers
        imageLayers.forEach(l => l.isSelected = false);

        const newLayer = {
            img: img,
            x: x,
            y: y,
            width: drawWidth,
            height: drawHeight,
            isSelected: true,
            handleBounds: null
        };

        imageLayers.push(newLayer);
        return newLayer;
    }

    function getSelectedLayer() {
        return imageLayers.find(l => l.isSelected) || null;
    }

    function deselectAll() {
        imageLayers.forEach(l => l.isSelected = false);
    }

    function updateSelectedLayerImage(newImg, newWidth, newHeight) {
        const layer = getSelectedLayer();
        if (!layer) return;

        layer.img = newImg;
        layer.width = newWidth;
        layer.height = newHeight;
    }


    // Inside PhotoCookLayerManager return object, add support for text objects:
    function addTextLayer(textConfig, canvasWidth, canvasHeight) {
        imageLayers.forEach(l => l.isSelected = false);

        // Temp canvas context to measure accurate bounds
        const tempCanvas = document.createElement('canvas');
        const tempCtx = tempCanvas.getContext('2d');
        tempCtx.font = `${textConfig.fontSize || 48}px ${textConfig.fontFamily || 'Arial'}`;
        
        const textMetrics = tempCtx.measureText(textConfig.text || 'Your paragraph text');
        const textWidth = textMetrics.width;
        const textHeight = textConfig.fontSize || 48;

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
        if (index === -1 || targetLayer.type !== 'text') return false;

        imageLayers.splice(index, 1);
        return true;
    }

    function clearLayers() {
        imageLayers = [];
    }

    return {
        getLayers,
        addLayer,
        addTextLayer,
        getSelectedLayer,
        deselectAll,
        updateSelectedLayerImage,
        removeLayer,
        clearLayers
    };
})();