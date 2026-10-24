/* PhotoCook — Object / Marquee Box Selection Module */
window.PhotoCookMarquee = (() => {
    'use strict';

    let canvasElement = null;
    let selectionBoxEl = null;

    let getLayersCallback = null;
    let redrawCallback = null;

    let isMarqueeActive = false;
    let startPageX = 0;
    let startPageY = 0;
    let currentPageX = 0;
    let currentPageY = 0;

    function createSelectionBoxElement() {
        if (selectionBoxEl) return;
        selectionBoxEl = document.createElement('div');
        selectionBoxEl.style.position = 'fixed';
        selectionBoxEl.style.border = '2px dashed #2563eb';
        selectionBoxEl.style.backgroundColor = 'rgba(37, 99, 235, 0.15)';
        selectionBoxEl.style.pointerEvents = 'none';
        selectionBoxEl.style.zIndex = '99999';
        selectionBoxEl.style.display = 'none';
        document.body.appendChild(selectionBoxEl);
    }

    function getClientCoords(e) {
        if (e.touches && e.touches.length > 0) {
            return { clientX: e.touches[0].clientX, clientY: e.touches[0].clientY };
        } else if (e.changedTouches && e.changedTouches.length > 0) {
            return { clientX: e.changedTouches[0].clientX, clientY: e.changedTouches[0].clientY };
        }
        return { clientX: e.clientX, clientY: e.clientY };
    }

    function pageToCanvasPos(px, py) {
        const rect = canvasElement.getBoundingClientRect();
        const scaleX = canvasElement.width / rect.width;
        const scaleY = canvasElement.height / rect.height;
        return {
            x: (px - rect.left) * scaleX,
            y: (py - rect.top) * scaleY
        };
    }

    function handleStart(e) {
        if (!canvasElement) return;

        const coords = getClientCoords(e);
        const canvasPos = pageToCanvasPos(coords.clientX, coords.clientY);
        const layers = getLayersCallback ? getLayersCallback() : [];

        // Check if user touched an image or handle inside the main canvas
        let clickedOnItem = false;
        for (let i = layers.length - 1; i >= 0; i--) {
            const layer = layers[i];
            if (canvasPos.x >= layer.x && canvasPos.x <= layer.x + layer.width && canvasPos.y >= layer.y && canvasPos.y <= layer.y + layer.height) {
                clickedOnItem = true;
                break;
            }
            if (layer.isSelected && layer.handleBounds) {
                const h = layer.handleBounds;
                if (Math.hypot(canvasPos.x - h.x, canvasPos.y - h.y) <= h.radius) {
                    clickedOnItem = true;
                    break;
                }
            }
        }

        const target = document.elementFromPoint(coords.clientX, coords.clientY);

        // If touched directly on an item inside the canvas, let interaction.js handle it
        if (clickedOnItem && canvasElement.contains(target)) {
            return;
        }

        if (e.type === 'touchstart') {
            e.preventDefault();
        }

        // Initialize full-screen marquee drag
        isMarqueeActive = true;
        startPageX = coords.clientX;
        startPageY = coords.clientY;
        currentPageX = coords.clientX;
        currentPageY = coords.clientY;

        createSelectionBoxElement();
        updateSelectionBoxUI();
        selectionBoxEl.style.display = 'block';

        window.addEventListener('mousemove', handleMove);
        window.addEventListener('touchmove', handleMove, { passive: false });

        window.addEventListener('mouseup', handleEnd);
        window.addEventListener('touchend', handleEnd);
        window.addEventListener('touchcancel', handleEnd);
    }

    function handleMove(e) {
        if (!isMarqueeActive) return;
        if (e.type === 'touchmove') {
            e.preventDefault();
        }
        const coords = getClientCoords(e);
        currentPageX = coords.clientX;
        currentPageY = coords.clientY;

        updateSelectionBoxUI();
    }

    function handleEnd() {
        if (!isMarqueeActive) return;
        isMarqueeActive = false;

        window.removeEventListener('mousemove', handleMove);
        window.removeEventListener('touchmove', handleMove);

        window.removeEventListener('mouseup', handleEnd);
        window.removeEventListener('touchend', handleEnd);
        window.removeEventListener('touchcancel', handleEnd);

        // Hide and clean up the selection box element
        if (selectionBoxEl) {
            selectionBoxEl.style.display = 'none';
        }

        // Convert page coordinates to canvas space for layer intersection testing
        const startCanvas = pageToCanvasPos(startPageX, startPageY);
        const currentCanvas = pageToCanvasPos(currentPageX, currentPageY);

        const minX = Math.min(startCanvas.x, currentCanvas.x);
        const maxX = Math.max(startCanvas.x, currentCanvas.x);
        const minY = Math.min(startCanvas.y, currentCanvas.y);
        const maxY = Math.max(startCanvas.y, currentCanvas.y);

        const isClick = (Math.abs(currentPageX - startPageX) < 5 && Math.abs(currentPageY - startPageY) < 5);
        const layers = getLayersCallback ? getLayersCallback() : [];

        layers.forEach(layer => {
            if (isClick) {
                layer.isSelected = false;
            } else {
                // Select images that overlap with the marquee box
                const overlaps = !(
                    layer.x > maxX ||
                    layer.x + layer.width < minX ||
                    layer.y > maxY ||
                    layer.y + layer.height < minY
                );
                layer.isSelected = overlaps;
            }
        });

        if (redrawCallback) {
            redrawCallback();
        }
    }

    function updateSelectionBoxUI() {
        if (!selectionBoxEl) return;

        const x = Math.min(startPageX, currentPageX);
        const y = Math.min(startPageY, currentPageY);
        const w = Math.abs(currentPageX - startPageX);
        const h = Math.abs(currentPageY - startPageY);

        selectionBoxEl.style.left = `${x}px`;
        selectionBoxEl.style.top = `${y}px`;
        selectionBoxEl.style.width = `${w}px`;
        selectionBoxEl.style.height = `${h}px`;
    }

    function init(canvas, getLayersFn, redrawFn) {
        canvasElement = canvas;
        getLayersCallback = getLayersFn;
        redrawCallback = redrawFn;

        canvasElement.addEventListener('mousedown', handleStart);
        canvasElement.addEventListener('touchstart', handleStart, { passive: false });

        window.addEventListener('mousedown', (e) => {
            if (!canvasElement.contains(e.target)) {
                handleStart(e);
            }
        });
        window.addEventListener('touchstart', (e) => {
            const coords = getClientCoords(e);
            const target = document.elementFromPoint(coords.clientX, coords.clientY);
            if (!canvasElement.contains(target)) {
                handleStart(e);
            }
        }, { passive: false });
    }

    return {
        init
    };
})();