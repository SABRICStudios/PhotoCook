/* PhotoCook — Object / Marquee Box Selection Module */
window.PhotoCookMarquee = (() => {
    'use strict';

    let canvasElement = null;
    let selectionBoxEl = null;

    let getLayersCallback = null;
    let redrawCallback = null;

    // Shared editing tool state
    window.PhotoCookToolState ??= {
        activeTool: null,

        open(toolName) {
            this.activeTool = toolName;
            window.PhotoCookMarquee?.cancel();
        },

        close() {
            this.activeTool = null;
        },

        isToolOpen() {
            return this.activeTool !== null;
        }
    };

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

    function isEventOnHeaderOrToolbar(target) {
        if (!target) return false;
        const header = document.querySelector('header');
        const toolbar = document.getElementById('toolbar');
        const textToolbar = document.getElementById('text-sub-toolbar');
        return (header && (header === target || header.contains(target))) ||
               (toolbar && (toolbar === target || toolbar.contains(target))) ||
               (textToolbar && (textToolbar === target || textToolbar.contains(target)));
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

    /**
     * Recalculates layer bounds dynamically (especially critical for text layers)
     */
    function getLayerBounds(layer) {
        if (layer.type === 'text' && canvasElement) {
            const ctx = canvasElement.getContext('2d');
            const fontSize = layer.fontSize || 48;
            const lines = String(layer.text || '').split(/\r\n|\r|\n/);
            const lineHeight = fontSize * 1.2 + (layer.lineSpacing || 0);

            ctx.save();
            ctx.font = `${layer.isItalic ? 'italic ' : ''}${layer.isBold ? 'bold ' : ''}${fontSize}px "${layer.fontFamily || 'Arial'}"`;
            if ('letterSpacing' in ctx) ctx.letterSpacing = `${layer.letterSpacing || 0}px`;

            layer.width = Math.max(40, ...lines.map(line => ctx.measureText(line).width + 40));
            layer.height = Math.max(20, fontSize * 1.2 + (lines.length - 1) * lineHeight + 20);
            ctx.restore();
        }
        return {
            x: layer.x,
            y: layer.y,
            width: layer.width || 100,
            height: layer.height || 50
        };
    }

    /* PhotoCook — Canvas Selection Handles Overlay */
    function renderMarquee(ctx, layer) {
        if (!layer || !layer.isSelected) return;

        const bounds = getLayerBounds(layer);
        ctx.save();
        ctx.translate(layer.x, layer.y);
        if (layer.rotation) ctx.rotate((layer.rotation * Math.PI) / 180);

        const w = bounds.width;
        const h = bounds.height;

        // 1. Purple Bounding Box Border
        ctx.strokeStyle = '#8b5cf6';
        ctx.lineWidth = 2;
        ctx.strokeRect(0, 0, w, h);

        // 2. Corner Round Handle (Top-Left)
        ctx.fillStyle = '#ffffff';
        ctx.strokeStyle = '#8b5cf6';
        ctx.lineWidth = 2;
        ctx.beginPath();
        ctx.arc(0, 0, 8, 0, Math.PI * 2);
        ctx.fill();
        ctx.stroke();

        // 3. Side Vertical Pillar Handle (Right Edge)
        ctx.beginPath();
        if (typeof ctx.roundRect === 'function') {
            ctx.roundRect(w - 4, (h / 2) - 10, 8, 20, 4);
        } else {
            ctx.rect(w - 4, (h / 2) - 10, 8, 20);
        }
        ctx.fill();
        ctx.stroke();

        // 4. Floating Action Buttons (Rotate & Move) below bounding box
        const btnCenterY = h + 35;
        const rotateX = (w / 2) - 20;
        const moveX = (w / 2) + 20;

        // Rotate Button
        ctx.beginPath();
        ctx.arc(rotateX, btnCenterY, 16, 0, Math.PI * 2);
        ctx.fillStyle = '#ffffff';
        ctx.shadowColor = 'rgba(0,0,0,0.15)';
        ctx.shadowBlur = 6;
        ctx.fill();
        ctx.strokeStyle = '#d1d5db';
        ctx.stroke();

        ctx.fillStyle = '#1f2937';
        ctx.font = '14px sans-serif';
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.fillText('↻', rotateX, btnCenterY);

        // Move Button
        ctx.beginPath();
        ctx.arc(moveX, btnCenterY, 16, 0, Math.PI * 2);
        ctx.fill();
        ctx.stroke();

        ctx.fillText('✢', moveX, btnCenterY);

        ctx.restore();
    }

    function cancelMarquee() {
        isMarqueeActive = false;

        window.removeEventListener('mousemove', handleMove);
        window.removeEventListener('touchmove', handleMove);
        window.removeEventListener('mouseup', handleEnd);
        window.removeEventListener('touchend', handleEnd);
        window.removeEventListener('touchcancel', handleEnd);

        if (selectionBoxEl) {
            selectionBoxEl.style.display = 'none';
        }
    }

    function handleStart(e) {
        if (!canvasElement) return;

        const coords = getClientCoords(e);
        const target = document.elementFromPoint(coords.clientX, coords.clientY) || e.target;

        if (isEventOnHeaderOrToolbar(target)) {
            return;
        }

        const canvasPos = pageToCanvasPos(coords.clientX, coords.clientY);
        const layers = getLayersCallback ? getLayersCallback() : [];

        // Let the Interaction module handle text edit/delete buttons.
        const clickedTextAction = layers.some(layer => {
            if (layer.type !== 'text' || !layer.isSelected) return false;

            return [layer.editBounds, layer.deleteBounds].some(bounds =>
                bounds &&
                Math.hypot(
                    canvasPos.x - bounds.x,
                    canvasPos.y - bounds.y
                ) <= bounds.radius
            );
        });

        if (clickedTextAction) return;

        let clickedOnItem = false;
        for (let i = layers.length - 1; i >= 0; i--) {
            const layer = layers[i];
            const bounds = getLayerBounds(layer);
            
            // Check bounding overlap for images or text layers
            if (canvasPos.x >= bounds.x && canvasPos.x <= bounds.x + bounds.width && 
                canvasPos.y >= bounds.y && canvasPos.y <= bounds.y + bounds.height) {
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

        if (clickedOnItem && canvasElement.contains(target)) {
            return;
        }

        if (e.type === 'touchstart') {
            e.preventDefault();
        }

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

    function handleEnd(e) {
        if (!isMarqueeActive) return;

        isMarqueeActive = false;

        window.removeEventListener('mousemove', handleMove);
        window.removeEventListener('touchmove', handleMove);
        window.removeEventListener('mouseup', handleEnd);
        window.removeEventListener('touchend', handleEnd);
        window.removeEventListener('touchcancel', handleEnd);

        if (selectionBoxEl) {
            selectionBoxEl.style.display = 'none';
        }

        const startCanvas = pageToCanvasPos(startPageX, startPageY);
        const currentCanvas = pageToCanvasPos(currentPageX, currentPageY);

        const minX = Math.min(startCanvas.x, currentCanvas.x);
        const maxX = Math.max(startCanvas.x, currentCanvas.x);
        const minY = Math.min(startCanvas.y, currentCanvas.y);
        const maxY = Math.max(startCanvas.y, currentCanvas.y);

        const isClick = (Math.abs(currentPageX - startPageX) < 5 && Math.abs(currentPageY - startPageY) < 5);
        const layers = getLayersCallback ? getLayersCallback() : [];

        let selectedTextLayer = null;

        layers.forEach(layer => {
            const bounds = getLayerBounds(layer);
            if (isClick) {
                const hit = (
                    startCanvas.x >= bounds.x && startCanvas.x <= bounds.x + bounds.width &&
                    startCanvas.y >= bounds.y && startCanvas.y <= bounds.y + bounds.height
                );
                layer.isSelected = hit;
                if (hit && layer.type === 'text') {
                    selectedTextLayer = layer;
                }
            } else {
                const overlaps = !(
                    bounds.x > maxX ||
                    bounds.x + bounds.width < minX ||
                    bounds.y > maxY ||
                    bounds.y + bounds.height < minY
                );
                layer.isSelected = overlaps;
                if (overlaps && layer.type === 'text') {
                    selectedTextLayer = layer;
                }
            }
        });

        if (redrawCallback) {
            redrawCallback(false, (ctx) => {
                layers.forEach(l => renderMarquee(ctx, l));
            });
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
            const target = e.target;
            if (isEventOnHeaderOrToolbar(target)) return;
            if (!canvasElement.contains(target)) {
                handleStart(e);
            }
        });
        window.addEventListener('touchstart', (e) => {
            const coords = getClientCoords(e);
            const target = document.elementFromPoint(coords.clientX, coords.clientY) || e.target;
            if (isEventOnHeaderOrToolbar(target)) return;
            if (!canvasElement.contains(target)) {
                handleStart(e);
            }
        }, { passive: false });
    }

    return {
        init,
        renderMarquee,
        cancel: cancelMarquee
    };
})();