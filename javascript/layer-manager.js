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

    function clearLayers() {
        imageLayers = [];
    }

    return {
        getLayers,
        addLayer,
        getSelectedLayer,
        deselectAll,
        updateSelectedLayerImage,
        clearLayers
    };
})();