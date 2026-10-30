/* PhotoCook — Interaction Module (Using Layer Manager) */
window.PhotoCookInteraction = (() => {
    'use strict';

    let canvasElement = null;

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

        const imageLayers = window.PhotoCookLayerManager?.getLayers() || [];

// Render image and text layers through the central engine.

        // 2. Draw every image layer
// 2. Let PhotoCookEngine render all layers (both images and text safely)
        if (window.PhotoCookEngine) {
            window.PhotoCookEngine.render(isExporting, (targetCtx) => {
                // 3. Draw selection borders & handles for selected layers over the engine render
                imageLayers.forEach((layer) => {
                    if (layer.isSelected && !isExporting) {
                        // --- 5X SCALED PROFESSIONAL ACCENT BORDER ---
                        targetCtx.strokeStyle = '#2563eb'; 
                        targetCtx.lineWidth = 10;          
                        targetCtx.strokeRect(layer.x, layer.y, layer.width, layer.height);

                        // --- 5X SCALED PROFESSIONAL MOVE HANDLE ---
                        const handleX = layer.x + layer.width / 2;
                        const handleY = layer.y + layer.height + 215; 
                        const handleRadius = 50;                     

                        layer.handleBounds = { x: handleX, y: handleY, radius: handleRadius };

                        targetCtx.save();
                        targetCtx.shadowColor = 'rgba(0, 0, 0, 0.25)';
                        targetCtx.shadowBlur = 20;
                        targetCtx.shadowOffsetX = 0;
                        targetCtx.shadowOffsetY = 8;

                        targetCtx.beginPath();
                        targetCtx.arc(handleX, handleY, handleRadius, 0, Math.PI * 2);
                        targetCtx.fillStyle = '#ffffff';
                        targetCtx.fill();
                        targetCtx.restore(); 

                        targetCtx.beginPath();
                        targetCtx.arc(handleX, handleY, handleRadius, 0, Math.PI * 2);
                        targetCtx.strokeStyle = '#e2e8f0';
                        targetCtx.lineWidth = 8;
                        targetCtx.stroke();

                        // --- 5X SCALED CLEAN VECTOR MOVE ICON ---
                        targetCtx.strokeStyle = '#1e293b'; 
                        targetCtx.lineWidth = 10;
                        targetCtx.lineCap = 'round';
                        targetCtx.lineJoin = 'round';

                        const len = 35; 
                        const tip = 12; 

                        targetCtx.beginPath();
                        targetCtx.moveTo(handleX, handleY - len);
                        targetCtx.lineTo(handleX, handleY + len);
                        targetCtx.moveTo(handleX - tip, handleY - len + tip);
                        targetCtx.lineTo(handleX, handleY - len);
                        targetCtx.lineTo(handleX + tip, handleY - len + tip);
                        targetCtx.moveTo(handleX - tip, handleY + len - tip);
                        targetCtx.lineTo(handleX, handleY + len);
                        targetCtx.lineTo(handleX + tip, handleY + len - tip);

                        targetCtx.moveTo(handleX - len, handleY);
                        targetCtx.lineTo(handleX + len, handleY);
                        targetCtx.moveTo(handleX - len + tip, handleY - tip);
                        targetCtx.lineTo(handleX - len, handleY);
                        targetCtx.lineTo(handleX - len + tip, handleY + tip);
                        targetCtx.moveTo(handleX + len - tip, handleY - tip);
                        targetCtx.lineTo(handleX + len, handleY);
                        targetCtx.lineTo(handleX + len - tip, handleY + tip);

                    targetCtx.stroke();

                        // Delete button — text layers only
                        if (layer.type === 'text') {
                            // Edit button — top-left corner of selected text layer
                            const editX = layer.x;
                            const editY = layer.y;
                            const editRadius = 45;

                            layer.editBounds = { x: editX, y: editY, radius: editRadius };

                            targetCtx.save();
                            targetCtx.beginPath();
                            targetCtx.arc(editX, editY, editRadius, 0, Math.PI * 2);
                            targetCtx.fillStyle = '#8b5cf6';
                            targetCtx.fill();

                            targetCtx.strokeStyle = '#ffffff';
                            targetCtx.lineWidth = 4;
                            targetCtx.lineCap = 'round';
                            targetCtx.lineJoin = 'round';

                            // Pencil icon
                            targetCtx.beginPath();
                            targetCtx.moveTo(editX - 17, editY + 10);
                            targetCtx.lineTo(editX + 10, editY - 17);
                            targetCtx.lineTo(editX + 17, editY - 10);
                            targetCtx.lineTo(editX - 10, editY + 17);
                            targetCtx.closePath();
                            targetCtx.stroke();

                            targetCtx.restore();
                            const deleteX = layer.x + layer.width;
                            const deleteY = layer.y;
                            const deleteRadius = 45;

                            layer.deleteBounds = { x: deleteX, y: deleteY, radius: deleteRadius };

                            targetCtx.save();
                            targetCtx.beginPath();
                            targetCtx.arc(deleteX, deleteY, deleteRadius, 0, Math.PI * 2);
                            targetCtx.fillStyle = '#ef4444';
                            targetCtx.fill();

                            targetCtx.strokeStyle = '#ffffff';
                            targetCtx.lineWidth = 5;
                            targetCtx.lineCap = 'round';
                            targetCtx.beginPath();
                            targetCtx.moveTo(deleteX - 15, deleteY - 15);
                            targetCtx.lineTo(deleteX + 15, deleteY + 15);
                            targetCtx.moveTo(deleteX + 15, deleteY - 15);
                            targetCtx.lineTo(deleteX - 15, deleteY + 15);
                            targetCtx.stroke();
                            targetCtx.restore();
                        } else {
                                layer.deleteBounds = null;
                                layer.editBounds = null;
                            }
                    } else {
                            layer.handleBounds = null;
                            layer.deleteBounds = null;
                            layer.editBounds = null;
                        }
                });

                // 4. Render custom active overlay if provided
                if (customOverlayCallback) {
                    customOverlayCallback(targetCtx);
                }
            });
        }
    }


    function getClientCoords(e) {
        if (e.touches && e.touches.length > 0) {
            return { clientX: e.touches[0].clientX, clientY: e.touches[0].clientY };
        } else if (e.changedTouches && e.changedTouches.length > 0) {
            return { clientX: e.changedTouches[0].clientX, clientY: e.changedTouches[0].clientY };
        }
        return { clientX: e.clientX, clientY: e.clientY };
    }

    function isEventOnHeaderOrToolbar(target) {
        if (!target) return false;
        const header = document.querySelector('header');
        const toolbar = document.getElementById('toolbar');
        const textToolbar = document.getElementById('text-sub-toolbar');
        return (header && (header === target || header.contains(target))) ||
            (toolbar && (toolbar === target || toolbar.contains(target))) ||
            (textToolbar && (textToolbar === target || textToolbar.contains(target)));
    }

    function getCanvasMousePos(e, canvas) {
        const coords = getClientCoords(e);
        const rect = canvas.getBoundingClientRect();
        const scaleX = canvas.width / rect.width;
        const scaleY = canvas.height / rect.height;
        return {
            x: (coords.clientX - rect.left) * scaleX,
            y: (coords.clientY - rect.top) * scaleY
        };
    }

    function handleStart(e) {
        if (!canvasElement || !window.PhotoCookLayerManager) return;
        const coords = getClientCoords(e);
        const target = document.elementFromPoint(coords.clientX, coords.clientY) || e.target;

        if (isEventOnHeaderOrToolbar(target)) return;

        if (e.type === 'touchstart') {
            e.preventDefault(); // Prevent default mobile scrolling/zooming
        }
        const pos = getCanvasMousePos(e, canvasElement);
        const imageLayers = window.PhotoCookLayerManager.getLayers();




        // Open Text Tool only when the edit icon is clicked

        // Check text action buttons — Delete takes priority
        const selectedTextLayers = [...imageLayers].reverse().filter(layer =>
            layer.type === 'text' && layer.isSelected
        );

        // Delete button
        const deleteLayer = selectedTextLayers.find(layer =>
            layer.deleteBounds &&
            Math.hypot(
                pos.x - layer.deleteBounds.x,
                pos.y - layer.deleteBounds.y
            ) <= layer.deleteBounds.radius
        );

        if (deleteLayer) {
            e.preventDefault();
            e.stopPropagation();

            window.PhotoCookLayerManager.removeLayer(deleteLayer);
            window.PhotoCookText?.onLayerDeleted?.(deleteLayer);

            isDraggingHandle = false;
            isDraggingLayer = false;
            activeLayerForHandle = null;

            redrawCanvas();
            return;
        }

        // Edit button
        const editLayer = selectedTextLayers.find(layer =>
            layer.editBounds &&
            Math.hypot(
                pos.x - layer.editBounds.x,
                pos.y - layer.editBounds.y
            ) <= layer.editBounds.radius
        );

        if (editLayer) {
            e.preventDefault();
            e.stopPropagation();

            isDraggingHandle = false;
            isDraggingLayer = false;
            activeLayerForHandle = null;

            window.PhotoCookText?.selectTextLayer(editLayer);
            return;
        }


        // 1. Check if user clicked/touched on any layer's handle
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

    function handleWindowStart(e) {
        if (!canvasElement || !window.PhotoCookLayerManager) return;
        const coords = getClientCoords(e);
        const target = document.elementFromPoint(coords.clientX, coords.clientY) || e.target;
        
        if (isEventOnHeaderOrToolbar(target)) return;

        if (target && !canvasElement.contains(target)) {
            let needsRedraw = false;
            window.PhotoCookLayerManager.getLayers().forEach(layer => {
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

    function handleMove(e) {
        if ((!isDraggingHandle && !isDraggingLayer) || !canvasElement || !window.PhotoCookLayerManager) return;
        if (e.type === 'touchmove') {
            e.preventDefault();
        }
        const pos = getCanvasMousePos(e, canvasElement);

        const dx = pos.x - dragStartX;
        const dy = pos.y - dragStartY;

        if (isDraggingHandle && activeLayerForHandle) {
            activeLayerForHandle.x += dx;
            activeLayerForHandle.y += dy;
        } else if (isDraggingLayer) {
            window.PhotoCookLayerManager.getLayers().forEach(layer => {
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

    function handleEnd() {
        isDraggingHandle = false;
        isDraggingLayer = false;
        activeLayerForHandle = null;
    }

    function init(canvas) {
        canvasElement = canvas;
        isDraggingHandle = false;
        isDraggingLayer = false;

        canvasElement.addEventListener('mousedown', handleStart);
        canvasElement.addEventListener('touchstart', handleStart, { passive: false });

        window.addEventListener('mousedown', handleWindowStart);
        window.addEventListener('touchstart', handleWindowStart, { passive: false });

        window.addEventListener('mousemove', handleMove);
        window.addEventListener('touchmove', handleMove, { passive: false });

        window.addEventListener('mouseup', handleEnd);
        window.addEventListener('touchend', handleEnd);
        window.addEventListener('touchcancel', handleEnd);
    }

    return {
        init,
        redrawCanvas
    };
})();