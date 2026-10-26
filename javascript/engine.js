/* PhotoCook — Core Processing & Rendering Engine */
window.PhotoCookEngine = (() => {
    'use strict';

    let canvasRef = null;
    let ctxRef = null;

    /**
     * Initialize engine with the active workspace canvas
     */
    function init(canvas) {
        canvasRef = canvas;
        ctxRef = canvas.getContext('2d');
    }

    /**
     * Central Render Loop
     * Clears canvas and draws background + all layers in stack order
     */
    function render(isExporting = false, overlayCallback = null) {
        if (!canvasRef || !ctxRef) return;

        // 1. Clear & Background
        ctxRef.clearRect(0, 0, canvasRef.width, canvasRef.height);
        ctxRef.fillStyle = '#ffffff';
        ctxRef.fillRect(0, 0, canvasRef.width, canvasRef.height);

        // 2. Draw Layers
        if (window.PhotoCookLayerManager) {
            const layers = window.PhotoCookLayerManager.getLayers();
            layers.forEach(layer => drawLayer(ctxRef, layer));
        }

        // 3. Render UI Overlays (Selection Marquee, Handles) when not exporting
        if (!isExporting && overlayCallback && typeof overlayCallback === 'function') {
            overlayCallback(ctxRef);
        }
    }

    /**
     * Draw an individual layer with transforms & adjustments applied
     */
    function drawLayer(ctx, layer) {
        ctx.save();

        // Position & Transformation
        ctx.translate(layer.x + layer.width / 2, layer.y + layer.height / 2);
        if (layer.rotation) ctx.rotate((layer.rotation * Math.PI) / 180);
        
        // CSS Canvas Filters (Brightness, Contrast, Blur, etc.)
        ctx.filter = layer.filterString || 'none';

        ctx.drawImage(
            layer.img,
            -layer.width / 2,
            -layer.height / 2,
            layer.width,
            layer.height
        );

        ctx.restore();
    }

    /**
     * Tool Action: Apply Cropped Image to Active Layer
     */
    function applyCrop(newImg, newWidth, newHeight, targetLayer = null) {
        if (!window.PhotoCookLayerManager) return;

        const layer = targetLayer || window.PhotoCookLayerManager.getSelectedLayer();
        if (!layer || !newImg || newWidth <= 0 || newHeight <= 0) return;

        const oldWidth = layer.width;
        const oldHeight = layer.height;

        const scaleX = newWidth / (layer.img.naturalWidth || layer.img.width);
        const scaleY = newHeight / (layer.img.naturalHeight || layer.img.height);

        layer.img = newImg;
        layer.width = oldWidth * scaleX;
        layer.height = oldHeight * scaleY;

        layer.x += (oldWidth - layer.width) / 2;
        layer.y += (oldHeight - layer.height) / 2;

        layer.handleBounds = null;

        if (window.PhotoCookInteraction?.redrawCanvas) {
            window.PhotoCookInteraction.redrawCanvas();
        } else {
            render();
        }
    }

    /**
     * Tool Action: Apply CSS / Canvas Filter adjustments to Active Layer
     * Example usage: applyFilterToSelectedLayer({ brightness: 120, contrast: 110, blur: 2 });
     */
    function applyFilterToSelectedLayer(filters = {}) {
        if (!window.PhotoCookLayerManager) return;

        const selectedLayer = window.PhotoCookLayerManager.getSelectedLayer();
        if (!selectedLayer) return;

        const { brightness = 100, contrast = 100, blur = 0, saturate = 100 } = filters;
        
        selectedLayer.filterString = `brightness(${brightness}%) contrast(${contrast}%) blur(${blur}px) saturate(${saturate}%)`;
        render();
    }

    /**
     * Tool Action: Rotate Active Layer by degrees
     */
    function rotateSelectedLayer(deg = 90) {
        if (!window.PhotoCookLayerManager) return;

        const selectedLayer = window.PhotoCookLayerManager.getSelectedLayer();
        if (!selectedLayer) return;

        selectedLayer.rotation = ((selectedLayer.rotation || 0) + deg) % 360;
        render();
    }

    return {
        init,
        render,
        applyCrop,
        applyFilterToSelectedLayer,
        rotateSelectedLayer
    };
})();