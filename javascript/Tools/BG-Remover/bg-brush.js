
/* PhotoCook — Non-Destructive Background Mask Brush */
window.PhotoCookBGBrush = (() => {
    "use strict";

    let canvas = null;
    let targetLayer = null;
    let maskData = null;
    let onChange = null;
    let drawing = false;
    let lastPoint = null;
    let strokeStart = null;
    let pointerId = null;
    let cursorOverlay = null;
    let cursorOuter = null;
    let cursorInner = null;
    let cursorVisible = false;
    let cursorPosition = null;

    const history = [];
    const redoHistory = [];
    const MAX_HISTORY = 15;

    const settings = {
        mode: "erase",
        size: 30,
        hardness: 80,
        opacity: 100
    };

    const clamp = (v, min, max) => Math.max(min, Math.min(max, v));

    function createCursor() {
        if (!canvas) return;

        cursorOverlay = document.createElement("div");
        cursorOuter = document.createElement("div");
        cursorInner = document.createElement("div");

        Object.assign(cursorOverlay.style, {
            position: "fixed",
            left: "0",
            top: "0",
            width: "0",
            height: "0",
            pointerEvents: "none",
            zIndex: "2147483647",
            display: "none"
        });

        [cursorOuter, cursorInner].forEach(circle => {
            Object.assign(circle.style, {
                position: "absolute",
                left: "0",
                top: "0",
                borderRadius: "50%",
                boxSizing: "border-box",
                transform: "translate(-50%, -50%)",
                pointerEvents: "none"
            });
        });

        Object.assign(cursorOuter.style, {
            border: "1.5px solid white",
            boxShadow: "0 0 0 1px black"
        });

        Object.assign(cursorInner.style, {
            border: "1px dashed rgba(255,255,255,0.85)",
            boxShadow: "0 0 0 1px rgba(0,0,0,0.65)"
        });

        cursorOverlay.append(cursorOuter, cursorInner);
        document.body.appendChild(cursorOverlay);
    }

    function updateCursor() {
        if (!canvas || !maskData || !targetLayer || !cursorOverlay) return;

        const rect = canvas.getBoundingClientRect();
        if (!rect.width || !rect.height) return;

        const diameterX = settings.size * targetLayer.width / maskData.width *
                        rect.width / canvas.width;

        const diameterY = settings.size * targetLayer.height / maskData.height *
                        rect.height / canvas.height;
        const hardness = settings.hardness / 100;

        cursorOuter.style.width = `${diameterX}px`;
        cursorOuter.style.height = `${diameterY}px`;

        cursorInner.style.width = `${diameterX * hardness}px`;
        cursorInner.style.height = `${diameterY * hardness}px`;

        cursorInner.style.display = hardness > 0 && hardness < 1 ? "block" : "none";

        cursorOuter.style.borderColor = settings.mode === "erase" ? "#ffffff" : "#76f7a5";

        if (cursorPosition) {
            cursorOverlay.style.left = `${cursorPosition.x}px`;
            cursorOverlay.style.top = `${cursorPosition.y}px`;
        }

        cursorOverlay.style.display = cursorVisible ? "block" : "none";
    }


    function moveCursor(event) {
        if (window.PhotoCookInteraction?.isPanEnabled?.()) {
            cursorVisible = false;
            updateCursor();
            return;
        }

        if (!canvas || !maskData || !targetLayer) return;

        const point = position(event);

        cursorVisible = !!point;
        cursorPosition = {
            x: event.clientX,
            y: event.clientY
        };

        updateCursor();
    }


    function hideCursor() {
        if (drawing) return;

        cursorVisible = false;
        updateCursor();
    }

    function removeCursor() {
        cursorOverlay?.remove();

        cursorOverlay = null;
        cursorOuter = null;
        cursorInner = null;
        cursorPosition = null;
        cursorVisible = false;
    }

    function configure(options = {}) {
        if (options.mode !== undefined) {
            if (!["erase", "restore"].includes(options.mode))
                throw new Error("Invalid brush mode.");
            settings.mode = options.mode;
        }

        if (options.size !== undefined)
            settings.size = clamp(Number(options.size) || 1, 1, 300);

        if (options.hardness !== undefined)
            settings.hardness = clamp(Number(options.hardness) || 0, 0, 100);

        if (options.opacity !== undefined)
            settings.opacity = clamp(Number(options.opacity) || 0, 0, 100);

        updateCursor();
        return { ...settings };
    }

    function setMask(data) {
        if (!data || !window.PhotoCookBGMask)
            throw new Error("BG Mask module unavailable.");

        PhotoCookBGMask.validateMask(data.mask, data.width, data.height);

        maskData = {
            mask: new Uint8Array(data.mask),
            width: data.width,
            height: data.height
        };

        history.length = 0;
        redoHistory.length = 0;
        drawing = false;
        strokeStart = null;
        lastPoint = null;
        return maskData;
    }

    function getMask() {
        if (!maskData) return null;

        return {
            mask: new Uint8Array(maskData.mask),
            width: maskData.width,
            height: maskData.height
        };
    }

    function notify() {
        if (typeof onChange === "function")
            onChange(maskData);
    }

    function paint(x, y) {
        if (!maskData) return;

        const { mask, width, height } = maskData;
        const radius = settings.size / 2;
        const hardness = settings.hardness / 100;
        const opacity = settings.opacity / 100;
        const inner = radius * hardness;
        const target = settings.mode === "restore" ? 255 : 0;

        const minX = Math.max(0, Math.floor(x - radius));
        const maxX = Math.min(width - 1, Math.ceil(x + radius));
        const minY = Math.max(0, Math.floor(y - radius));
        const maxY = Math.min(height - 1, Math.ceil(y + radius));

        for (let py = minY; py <= maxY; py++) {
            for (let px = minX; px <= maxX; px++) {
                const distance = Math.hypot(px + 0.5 - x, py + 0.5 - y);
                if (distance > radius) continue;

                let strength = 1;

                if (distance > inner && radius > inner) {
                    const t = clamp((distance - inner) / (radius - inner), 0, 1);
                    strength = 1 - t * t * (3 - 2 * t);
                }

                const index = py * width + px;
                const amount = opacity * strength;

                // Each stroke blends against its starting mask,
                // preventing excessive buildup from overlapping stamps.
                const original = strokeStart ? strokeStart[index] : mask[index];
                const desired = original + (target - original) * amount;

                if (target === 255)
                    mask[index] = Math.max(mask[index], Math.round(desired));
                else
                    mask[index] = Math.min(mask[index], Math.round(desired));
            }
        }
    }

    function strokeTo(point) {
        if (!lastPoint) {
            paint(point.x, point.y);
            lastPoint = point;
            notify();
            return;
        }

        const dx = point.x - lastPoint.x;
        const dy = point.y - lastPoint.y;
        const distance = Math.hypot(dx, dy);
        const spacing = Math.max(0.5, settings.size * 0.2);
        const steps = Math.max(1, Math.ceil(distance / spacing));

        for (let i = 1; i <= steps; i++) {
            const t = i / steps;
            paint(lastPoint.x + dx * t, lastPoint.y + dy * t);
        }

        lastPoint = point;
        notify();
    }



    function position(event) {
        if (!canvas || !maskData || !targetLayer) return null;

        const rect = canvas.getBoundingClientRect();
        if (!rect.width || !rect.height || !canvas.width || !canvas.height) return null;

        const layer = targetLayer;
        const layerWidth = Number(layer.width);
        const layerHeight = Number(layer.height);

        if (!(layerWidth > 0 && layerHeight > 0)) return null;

        // Map pointer coordinates through the displayed canvas.
        const canvasX = (event.clientX - rect.left) * canvas.width / rect.width;
        const canvasY = (event.clientY - rect.top) * canvas.height / rect.height;

        // Convert canvas coordinates to image-local coordinates.
        const centerX = Number(layer.x) + layerWidth / 2;
        const centerY = Number(layer.y) + layerHeight / 2;

        const dx = canvasX - centerX;
        const dy = canvasY - centerY;

        const angle = -(Number(layer.rotation) || 0) * Math.PI / 180;
        const cos = Math.cos(angle);
        const sin = Math.sin(angle);

        const localX = dx * cos - dy * sin + layerWidth / 2;
        const localY = dx * sin + dy * cos + layerHeight / 2;

        if (localX < 0 || localY < 0 ||
            localX >= layerWidth || localY >= layerHeight) return null;

        return {
            x: localX * maskData.width / layerWidth,
            y: localY * maskData.height / layerHeight
        };
    }



function pointerDown(event) {
    if (window.PhotoCookInteraction?.isPanEnabled?.()) return;
    if (!maskData || drawing) return;
        if (event.pointerType === "mouse" && event.button !== 0) return;

        const point = position(event);
        if (!point) return;

        event.preventDefault();
        if (event.pointerType === "mouse" || drawing) {
            moveCursor(event);
        }
        drawing = true;
        pointerId = event.pointerId;
        strokeStart = new Uint8Array(maskData.mask);
        lastPoint = null;

        canvas.setPointerCapture?.(pointerId);
        strokeTo(point);
    }

    function pointerMove(event) {
        if (window.PhotoCookInteraction?.isPanEnabled?.()) {
            if (drawing) pointerUp({ pointerId, pointerType: event.pointerType });
            cursorVisible = false;
            updateCursor();
            return;
        }

        if (drawing && event.pointerId !== pointerId) return;

        moveCursor(event);

        if (!drawing) return;

        const point = position(event);
        if (!point) return;

        event.preventDefault();
        strokeTo(point);
    }

    function pointerUp(event) {
        if (!drawing || event.pointerId !== pointerId) return;

        drawing = false;

        if (canvas?.hasPointerCapture?.(event.pointerId)) {
            canvas.releasePointerCapture(event.pointerId);
        }

        if (strokeStart) {
            history.push(strokeStart);
            if (history.length > MAX_HISTORY) history.shift();
            redoHistory.length = 0;
        }

        strokeStart = null;
        lastPoint = null;
        pointerId = null;

        if (event.pointerType !== "mouse") {
            cursorVisible = false;
            updateCursor();
        }

        notify();
    }

    function undo() {
        if (!maskData || drawing || !history.length) return false;

        redoHistory.push(new Uint8Array(maskData.mask));
        maskData.mask = history.pop();
        notify();
        return true;
    }

    function redo() {
        if (!maskData || drawing || !redoHistory.length) return false;

        history.push(new Uint8Array(maskData.mask));
        if (history.length > MAX_HISTORY) history.shift();
        maskData.mask = redoHistory.pop();
        notify();
        return true;
    }


    function attach(targetCanvas, callback, layer) {
        detach();

        if (!(targetCanvas instanceof HTMLCanvasElement))
            throw new Error("Brush requires an HTML canvas.");

        if (!layer || layer.type === "text" || !layer.img)
            throw new Error("Brush requires a valid image layer.");

        if (!maskData)
            throw new Error("Initialize the brush mask before attaching.");

        canvas = targetCanvas;
        targetLayer = layer;
        onChange = callback;

        canvas.style.cursor = "none";
        canvas.style.touchAction = "none";

        createCursor();
        updateCursor();

        canvas.addEventListener("pointerdown", pointerDown);
        canvas.addEventListener("pointermove", pointerMove);
        canvas.addEventListener("pointerup", pointerUp);
        canvas.addEventListener("pointercancel", pointerUp);
        canvas.addEventListener("pointerenter", moveCursor);
        canvas.addEventListener("pointerleave", hideCursor);
    }


    function detach() {
        if (!canvas) return;

        canvas.removeEventListener("pointerdown", pointerDown);
        canvas.removeEventListener("pointermove", pointerMove);
        canvas.removeEventListener("pointerup", pointerUp);
        canvas.removeEventListener("pointercancel", pointerUp);
        canvas.removeEventListener("pointerenter", moveCursor);
        canvas.removeEventListener("pointerleave", hideCursor);

        removeCursor();

        canvas.style.touchAction = "";
        canvas.style.cursor = "";
        canvas = null;
        targetLayer = null;
        onChange = null;
        drawing = false;
        strokeStart = null;
        lastPoint = null;
        pointerId = null;
    }

    function destroy() {
        detach();
        maskData = null;
        history.length = 0;
        redoHistory.length = 0;
    }

    return Object.freeze({
        configure,
        setMask,
        getMask,
        attach,
        detach,
        undo,
        redo,
        destroy,
        getSettings: () => ({ ...settings }),
        canUndo: () => history.length > 0,
        canRedo: () => redoHistory.length > 0
    });
})();
