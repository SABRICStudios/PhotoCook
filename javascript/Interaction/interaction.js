/* PhotoCook — Interaction & Layer Management Module */
window.PhotoCookInteraction = (() => {
    'use strict';

    let canvasElement = null;
    let imageLayers = []; // Stores layers: { img, x, y, width, height, isSelected, handleBounds }

    let isDraggingHandle = false;
    let isDraggingLayer = false;
    let activeLayerForHandle = null; // Track which layer's handle is being pulled
    let dragStartX = 0;
    let dragStartY = 0;

    /**
     * Redraws the canvas background, all image layers, clean selection boxes, and large professional handles
     */
    function redrawCanvas(isExporting = false, customOverlayCallback = null) {
        if (!canvasElement) return;

        const ctx = canvasElement.getContext('2d');
        const canvasWidth = canvasElement.width;
        const canvasHeight = canvasElement.height;

        // 1. Reset canvas with white background
        ctx.fillStyle = '#ffffff';
        ctx.fillRect(0, 0, canvasWidth, canvasHeight);

        // 2. Draw every image layer
        imageLayers.forEach((layer) => {
            ctx.drawImage(layer.img, layer.x, layer.y, layer.width, layer.height);

            // If selected AND we aren't exporting, draw professional scaled-up UI handles
            if (layer.isSelected && !isExporting) {
                // --- 5X SCALED PROFESSIONAL ACCENT BORDER ---
                ctx.strokeStyle = '#2563eb'; // Modern royal blue
                ctx.lineWidth = 10;          // Scaled to 10px (5x of 2px)
                ctx.strokeRect(layer.x, layer.y, layer.width, layer.height);

                // --- 5X SCALED PROFESSIONAL MOVE HANDLE ---
                const handleX = layer.x + layer.width / 2;
                const handleY = layer.y + layer.height + 215; // 5x offset below image (45px * 5)
                const handleRadius = 50;                     // 5x larger radius (22px * 5)

                layer.handleBounds = { x: handleX, y: handleY, radius: handleRadius };

                // Handle Drop Shadow for depth (scaled up shadow)
                ctx.save();
                ctx.shadowColor = 'rgba(0, 0, 0, 0.25)';
                ctx.shadowBlur = 20;
                ctx.shadowOffsetX = 0;
                ctx.shadowOffsetY = 8;

                // Handle Circle Background
                ctx.beginPath();
                ctx.arc(handleX, handleY, handleRadius, 0, Math.PI * 2);
                ctx.fillStyle = '#ffffff';
                ctx.fill();
                ctx.restore(); // Restore context to remove shadow for crisp drawing

                // Handle Ring Border
                ctx.beginPath();
                ctx.arc(handleX, handleY, handleRadius, 0, Math.PI * 2);
                ctx.strokeStyle = '#e2e8f0';
                ctx.lineWidth = 8;
                ctx.stroke();

                // --- 5X SCALED CLEAN VECTOR MOVE ICON ---
                ctx.strokeStyle = '#1e293b'; // Dark slate grey for icon
                ctx.lineWidth = 10;
                ctx.lineCap = 'round';
                ctx.lineJoin = 'round';

                const len = 35; // 5x arrow arm length (7 * 5)
                const tip = 12; // Proportionate arrowhead size

                // Vertical shaft
                ctx.beginPath();
                ctx.moveTo(handleX, handleY - len);
                ctx.lineTo(handleX, handleY + len);
                // Top arrowhead
                ctx.moveTo(handleX - tip, handleY - len + tip);
                ctx.lineTo(handleX, handleY - len);
                ctx.lineTo(handleX + tip, handleY - len + tip);
                // Bottom arrowhead
                ctx.moveTo(handleX - tip, handleY + len - tip);
                ctx.lineTo(handleX, handleY + len);
                ctx.lineTo(handleX + tip, handleY + len - tip);

                // Horizontal shaft
                ctx.moveTo(handleX - len, handleY);
                ctx.lineTo(handleX + len, handleY);
                // Left arrowhead
                ctx.moveTo(handleX - len + tip, handleY - tip);
                ctx.lineTo(handleX - len, handleY);
                ctx.lineTo(handleX - len + tip, handleY + tip);
                // Right arrowhead
                ctx.moveTo(handleX + len - tip, handleY - tip);
                ctx.lineTo(handleX + len, handleY);
                ctx.lineTo(handleX + len - tip, handleY + tip);

                ctx.stroke();
            } else {
                layer.handleBounds = null;
            }
        });

        // 3. Render custom active overlay if provided
        if (customOverlayCallback && !isExporting) {
            customOverlayCallback(ctx);
        }
    }

    function getCanvasMousePos(e, canvas) {
        const rect = canvas.getBoundingClientRect();
        const scaleX = canvas.width / rect.width;
        const scaleY = canvas.height / rect.height;
        return {
            x: (e.clientX - rect.left) * scaleX,
            y: (e.clientY - rect.top) * scaleY
        };
    }

    function handleMouseDown(e) {
        if (!canvasElement) return;
        const pos = getCanvasMousePos(e, canvasElement);

        // 1. Check if user clicked on any layer's handle
        const handleLayer = imageLayers.find(l => l.isSelected && l.handleBounds && Math.hypot(pos.x - l.handleBounds.x, pos.y - l.handleBounds.y) <= l.handleBounds.radius);
        if (handleLayer) {
            isDraggingHandle = true;
            activeLayerForHandle = handleLayer;
            dragStartX = pos.x;
            dragStartY = pos.y;
            return;
        }

        // 2. Check image selection & direct drag click (top layers checked first)
        let clickedLayer = null;
        for (let i = imageLayers.length - 1; i >= 0; i--) {
            const layer = imageLayers[i];
            if (pos.x >= layer.x && pos.x <= layer.x + layer.width && pos.y >= layer.y && pos.y <= layer.y + layer.height) {
                clickedLayer = layer;
                break;
            }
        }

        if (clickedLayer) {
            // If user clicked an image that was NOT part of current selection, select ONLY that image
            if (!clickedLayer.isSelected) {
                imageLayers.forEach(layer => {
                    layer.isSelected = (layer === clickedLayer);
                });
            }

            isDraggingLayer = true;
            dragStartX = pos.x;
            dragStartY = pos.y;
            redrawCanvas();
        }
    }

    /**
     * Deselects active layers if the user clicks anywhere outside the canvas element
     */
    function handleWindowMouseDown(e) {
        if (!canvasElement) return;
        
        if (!canvasElement.contains(e.target)) {
            let needsRedraw = false;
            imageLayers.forEach(layer => {
                if (layer.isSelected) {
                    layer.isSelected = false;
                    needsRedraw = true;
                }
            });
            if (needsRedraw) {
                redrawCanvas();
            }
        }
    }

    function handleMouseMove(e) {
        if ((!isDraggingHandle && !isDraggingLayer) || !canvasElement) return;
        const pos = getCanvasMousePos(e, canvasElement);

        // Calculate drag delta in canvas coordinates
        const dx = pos.x - dragStartX;
        const dy = pos.y - dragStartY;

        if (isDraggingHandle && activeLayerForHandle) {
            // Individual movement via move handle
            activeLayerForHandle.x += dx;
            activeLayerForHandle.y += dy;
        } else if (isDraggingLayer) {
            // Group movement: move ALL currently selected layers together
            imageLayers.forEach(layer => {
                if (layer.isSelected) {
                    layer.x += dx;
                    layer.y += dy;
                }
            });
        }

        dragStartX = pos.x;
        dragStartY = pos.y;

        redrawCanvas();
    }

    function handleMouseUp() {
        isDraggingHandle = false;
        isDraggingLayer = false;
        activeLayerForHandle = null;
    }

    /**
     * Adds a newly imported image as a layer onto the canvas
     */
    function addLayer(img) {
        if (!canvasElement) return;
        const canvasWidth = canvasElement.width;
        const canvasHeight = canvasElement.height;

        const scale = Math.min(canvasWidth / img.width, canvasHeight / img.height);
        const drawWidth = img.width * scale;
        const drawHeight = img.height * scale;
        const x = (canvasWidth - drawWidth) / 2;
        const y = (canvasHeight - drawHeight) / 2;

        imageLayers.forEach(l => l.isSelected = false);

        imageLayers.push({
            img: img,
            x: x,
            y: y,
            width: drawWidth,
            height: drawHeight,
            isSelected: true,
            handleBounds: null
        });

        redrawCanvas();
    }

    function getLayers() {
        return imageLayers;
    }

    function init(canvas) {
        canvasElement = canvas;
        imageLayers = [];
        isDraggingHandle = false;
        isDraggingLayer = false;

        canvasElement.addEventListener('mousedown', handleMouseDown);
        window.addEventListener('mousedown', handleWindowMouseDown);
        window.addEventListener('mousemove', handleMouseMove);
        window.addEventListener('mouseup', handleMouseUp);
    }

    return {
        init,
        addLayer,
        redrawCanvas,
        getLayers
    };
})();