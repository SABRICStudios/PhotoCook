
/* PhotoCook — AI Background Remover Tool */
window.PhotoCookBGRemover = (() => {
    "use strict";

    let panel = null;
    let activeLayer = null;
    let pending = null;
    let processing = false;
    let session = 0;
    let activeMode = "ai";
    let brushInitialized = false;
    let resetPending = false;
    let previewFrame = 0;
    let manualMinimized = false;
    let floatingPosition = null;
    let floatingDrag = null;

    const $ = id => document.getElementById(id);

    function getSelectedImage() {
        const layer = window.PhotoCookLayerManager?.getSelectedLayer();
        return layer?.img && layer.type !== "text" ? layer : null;
    }

    function setStatus(message, progress = null, error = false, indeterminate = false) {
        const container = $("bg-tb-processing-status");
        const status = $("bg-tb-status");
        const bar = $("bg-tb-progress");
        const label = $("bg-tb-progress-label");

        if (container) container.hidden = false;

        if (status) {
            status.textContent = message;
            status.classList.toggle("error", error);
        }

        if (bar) {
            bar.hidden = progress === null && !indeterminate;
            bar.classList.toggle("indeterminate", indeterminate);

            if (indeterminate) bar.removeAttribute("value");
            else if (progress !== null) {
                bar.value = Math.max(0, Math.min(100, progress));
            } else {
                bar.removeAttribute("value");
            }
        }

        if (label) {
            label.textContent = progress !== null ? `${Math.round(progress)}%` : "";
        }
    }

    function updateButtons() {
        const hasLayer = !!activeLayer;
        const ready = !!pending && !processing;

        $("bg-tb-remove").disabled = processing || !hasLayer;
        $("bg-tb-apply").disabled = processing || (!pending && !resetPending);
        $("bg-tb-cancel").disabled = processing;
        $("bg-tb-reset").disabled = processing ||
            (!pending && !activeLayer?.bgMask && !resetPending);
    }

    function createPanel() {
        panel = document.createElement("section");
        panel.id = "bg-sub-toolbar";
        panel.hidden = true;


    panel.innerHTML = `
        <div class="bg-tb-header">
            <div>
                <h3>BACKGROUND REMOVER</h3>
                <p>AI removal and manual background editing</p>
            </div>
            <div class="bg-tb-window-actions">
                <button id="bg-tb-minimize" type="button" title="Minimize" hidden>−</button>
                <button id="bg-tb-close" type="button" aria-label="Close">×</button>
            </div>
        </div>
        <div id="bg-tb-window-body">
        <div class="bg-tb-tabs" role="tablist" aria-label="Removal method">
            <button id="bg-tab-ai" class="active" type="button"
                    role="tab" aria-selected="true">AI Remove</button>
            <button id="bg-tab-manual" type="button"
                    role="tab" aria-selected="false">Manual</button>
        </div>

        <div class="bg-tb-content">
            <div id="bg-tb-ai-section" role="tabpanel">
                <div class="bg-tb-preview">
                    <canvas id="bg-tb-preview-canvas"></canvas>

                    <span id="bg-tb-placeholder">
                        <strong>Preview will appear here</strong>
                        <small>Remove the background to see the result.</small>
                    </span>

                    <div id="bg-tb-processing-status" hidden>
                        <div class="bg-processing-status-top">
                            <span id="bg-tb-status">Ready</span>
                            <span id="bg-tb-progress-label"></span>
                        </div>
                        <progress id="bg-tb-progress" max="100" hidden></progress>
                    </div>
                </div>

                <button id="bg-tb-remove" class="bg-tb-primary" type="button">
                    Remove Background
                </button>
            </div>

            <div id="bg-tb-manual-section" role="tabpanel" hidden>
                <p class="bg-tb-manual-hint">
                    Erase or restore the background directly on the main canvas.
                </p>

                <div id="bg-tb-brush-controls" hidden>
                    <div class="bg-brush-modes">
                        <button id="bg-brush-erase" type="button">Erase</button>
                        <button id="bg-brush-restore" type="button">Restore</button>
                    </div>

                    <label>
                        Size <output id="bg-brush-size-value">30</output>
                        <input id="bg-brush-size" type="range" min="1" max="150" value="30">
                    </label>

                    <label>
                        Hardness <output id="bg-brush-hardness-value">80%</output>
                        <input id="bg-brush-hardness" type="range" min="0" max="100" value="80">
                    </label>

                    <label>
                        Opacity <output id="bg-brush-opacity-value">100%</output>
                        <input id="bg-brush-opacity" type="range" min="0" max="100" value="100">
                    </label>

                    <div class="bg-brush-history">
                        <button id="bg-brush-undo" type="button">Undo</button>
                        <button id="bg-brush-redo" type="button">Redo</button>
                    </div>
                </div>
            </div>

            <div class="bg-tb-status-area" aria-live="polite">
                <span id="bg-tb-status">Ready</span>
                <progress id="bg-tb-progress" max="100" hidden></progress>
            </div>
        </div>

        <div class="bg-tb-actions">
            <button id="bg-tb-reset" type="button">Reset</button>
            <button id="bg-tb-cancel" type="button">Cancel</button>
            <button id="bg-tb-apply" type="button">Apply</button>
        </div>
        </div>
    `;


        document.body.appendChild(panel);

        $("bg-tb-minimize").addEventListener("click", toggleManualMinimize);
        initManualDragging();
        $("bg-tab-ai").addEventListener("click", () => switchMode("ai"));
        $("bg-tab-manual").addEventListener("click", () => switchMode("manual"));
        $("bg-tb-close").addEventListener("click", close);
        $("bg-tb-cancel").addEventListener("click", close);
        $("bg-tb-remove").addEventListener("click", removeBackground);
        $("bg-tb-apply").addEventListener("click", apply);
        $("bg-tb-reset").addEventListener("click", reset);
        $("bg-brush-erase").addEventListener("click", () => updateBrushMode("erase"));
        $("bg-brush-restore").addEventListener("click", () => updateBrushMode("restore"));

        ["size", "hardness", "opacity"].forEach(name => {
            const input = $(`bg-brush-${name}`);
            const output = $(`bg-brush-${name}-value`);

            input.addEventListener("input", () => {
                PhotoCookBGBrush.configure({ [name]: Number(input.value) });
                output.textContent = input.value + (name === "size" ? "" : "%");
            });
        });

        $("bg-brush-undo").addEventListener("click", () => {
            if (PhotoCookBGBrush.undo()) updateBrushButtons();
        });

        $("bg-brush-redo").addEventListener("click", () => {
            if (PhotoCookBGBrush.redo()) updateBrushButtons();
        });
    }

    
function cancelPreviewFrame() {
    if (previewFrame) cancelAnimationFrame(previewFrame);
    previewFrame = 0;
}

function redrawPendingMask() {
    if (!activeLayer || !pending) return;

    cancelPreviewFrame();

    previewFrame = requestAnimationFrame(() => {
        previewFrame = 0;
        window.PhotoCookEngine?.setBGPreview(activeLayer, pending);
    });
}

function stopCanvasBrush() {
    window.PhotoCookBGBrush?.detach();
    window.PhotoCookInteraction?.setBGBrushEditing?.(false);
}

function startCanvasBrush() {
    const brush = window.PhotoCookBGBrush;
    const canvas = $("canvas");

    if (!brush || !canvas || !activeLayer || !pending) return;

    if (!brushInitialized) {
        brush.setMask(pending);
        brushInitialized = true;
    }

    window.PhotoCookInteraction?.setBGBrushEditing?.(true);

    brush.attach(canvas, maskData => {
        pending = maskData;
        resetPending = false;
        updateBrushButtons();
        updateButtons();
        redrawPendingMask();
    }, activeLayer);

    $("bg-tb-brush-controls").hidden = false;
    updateBrushButtons();
    redrawPendingMask();
}

function discardPendingPreview() {
    cancelPreviewFrame();
    stopCanvasBrush();
    window.PhotoCookEngine?.clearBGPreview();
}


    function updateManualWindow() {
    const manual = activeMode === "manual";

    panel.classList.toggle("bg-floating-manual", manual);
    panel.classList.toggle("bg-minimized", manual && manualMinimized);

    $("bg-tb-minimize").hidden = !manual;
    $("bg-tb-window-body").hidden = manual && manualMinimized;
    $("bg-tb-minimize").textContent = manualMinimized ? "□" : "−";

    if (manual) {
        const workspace = $("canvas-workspace")?.getBoundingClientRect();
        const width = Math.min(320, window.innerWidth - 20);

        panel.style.width = `${width}px`;

        if (!floatingPosition) {
            floatingPosition = {
                x: Math.max(10, (workspace?.right || window.innerWidth) - width - 20),
                y: Math.max(10, (workspace?.top || 70) + 65)
            };
        }

        panel.style.left = `${floatingPosition.x}px`;
        panel.style.top = `${floatingPosition.y}px`;
    } else {
        panel.style.left = "";
        panel.style.top = "";
        panel.style.width = "";
    }
}

function toggleManualMinimize() {
    if (activeMode !== "manual") return;
    manualMinimized = !manualMinimized;
    updateManualWindow();
}

function initManualDragging() {
    const header = panel.querySelector(".bg-tb-header");

    header.addEventListener("pointerdown", e => {
        if (activeMode !== "manual" || e.button !== 0 ||
            e.target.closest("button")) return;

        e.preventDefault();
        e.stopPropagation();

        floatingDrag = {
            id: e.pointerId,
            x: e.clientX,
            y: e.clientY
        };

        header.setPointerCapture(e.pointerId);
    });

    header.addEventListener("pointermove", e => {
        if (!floatingDrag || e.pointerId !== floatingDrag.id) return;

        const dx = e.clientX - floatingDrag.x;
        const dy = e.clientY - floatingDrag.y;
        const rect = panel.getBoundingClientRect();

        floatingPosition = {
            x: Math.max(0, Math.min(window.innerWidth - rect.width,
                (floatingPosition?.x ?? rect.left) + dx)),
            y: Math.max(0, Math.min(window.innerHeight - rect.height,
                (floatingPosition?.y ?? rect.top) + dy))
        };

        floatingDrag.x = e.clientX;
        floatingDrag.y = e.clientY;

        panel.style.left = `${floatingPosition.x}px`;
        panel.style.top = `${floatingPosition.y}px`;
    });

    const stopDragging = () => { floatingDrag = null; };
    header.addEventListener("pointerup", stopDragging);
    header.addEventListener("pointercancel", stopDragging);
}

    function switchMode(mode) {
        if (!["ai", "manual"].includes(mode) || processing) return;

        const isAI = mode === "ai";
        activeMode = mode;

        if (isAI) manualMinimized = false;
        updateManualWindow();

        $("bg-tab-ai").classList.toggle("active", isAI);
        $("bg-tab-manual").classList.toggle("active", !isAI);

        $("bg-tab-ai").setAttribute("aria-selected", String(isAI));
        $("bg-tab-manual").setAttribute("aria-selected", String(!isAI));

        $("bg-tb-ai-section").hidden = !isAI;
        $("bg-tb-manual-section").hidden = isAI;

        if (isAI) {
            stopCanvasBrush();
            $("bg-tb-brush-controls").hidden = true;

            if (pending) {
                window.PhotoCookEngine?.setBGPreview(activeLayer, pending);
            } else {
                window.PhotoCookEngine?.clearBGPreview();
            }

            setStatus("AI background removal is ready.");
        } else {
            if (!ensureManualMask()) {
                setStatus("Select an image layer first.", null, true);
                $("bg-tb-brush-controls").hidden = true;
                updateButtons();
                return;
            }

            startCanvasBrush();
            setStatus("Paint on the image using Erase or Restore.");
        }

        updateButtons();
    }



    function clearPreview() {
        const canvas = $("bg-tb-preview-canvas");
        const ctx = canvas.getContext("2d");

        ctx.clearRect(0, 0, canvas.width, canvas.height);
        canvas.hidden = true;
        $("bg-tb-placeholder").hidden = false;
    }

    function showPreview(image, maskData) {
        const source = window.PhotoCookBGMask.apply(
            image,
            maskData.mask,
            maskData.width,
            maskData.height
        );

        const canvas = $("bg-tb-preview-canvas");
        const ctx = canvas.getContext("2d");

        // Limit preview memory use on mobile devices.
        const scale = Math.min(1, 512 / Math.max(source.width, source.height));

        canvas.width = Math.max(1, Math.round(source.width * scale));
        canvas.height = Math.max(1, Math.round(source.height * scale));

        ctx.clearRect(0, 0, canvas.width, canvas.height);
        ctx.drawImage(source, 0, 0, canvas.width, canvas.height);

        canvas.hidden = false;
        $("bg-tb-placeholder").hidden = true;
    }

        function updateBrushButtons() {
        const brush = window.PhotoCookBGBrush;
        $("bg-brush-undo").disabled = !brush?.canUndo();
        $("bg-brush-redo").disabled = !brush?.canRedo();
    }

    function updateBrushMode(mode) {
        const brush = window.PhotoCookBGBrush;
        brush.configure({ mode });

        $("bg-brush-erase").classList.toggle("active", mode === "erase");
        $("bg-brush-restore").classList.toggle("active", mode === "restore");
    }

    

    function ensureManualMask() {
        if (!activeLayer?.img || !window.PhotoCookBGMask) return false;
        if (pending) return true;

        const image = activeLayer.img;
        const width = image.naturalWidth || image.width;
        const height = image.naturalHeight || image.height;

        if (!width || !height) return false;

        pending = {
            mask: new Uint8Array(width * height).fill(255),
            width,
            height
        };

        brushInitialized = false;
        resetPending = false;
        return true;
    }



function initializeBrush() {
    if (!pending || !activeLayer) return;

    stopCanvasBrush();

    const brush = window.PhotoCookBGBrush;
    if (!brush) return;

    brush.setMask(pending);
    brushInitialized = true;

    updateBrushMode("erase");
    updateBrushButtons();

    if (activeMode === "manual") {
        startCanvasBrush();
    } else {
        $("bg-tb-brush-controls").hidden = true;
        window.PhotoCookEngine?.setBGPreview(activeLayer, pending);
    }
}



    function open() {
        if (processing) return;

        window.PhotoCookMarquee?.cancel();
        window.PhotoCookToolState?.open("bg-remover");

        cancelPreviewFrame();
        stopCanvasBrush();
        window.PhotoCookBGBrush?.destroy();
        window.PhotoCookEngine?.clearBGPreview();

        activeLayer = getSelectedImage();
        pending = null;
        brushInitialized = false;
        resetPending = false;

        manualMinimized = false;
        floatingPosition = null;

        panel.hidden = false;
        clearPreview();
        switchMode("ai");

        if (!activeLayer) {
            setStatus("Select an image layer first.", null, true);
            updateButtons();
            return;
        }

        if (activeLayer.bgMask) {
            try {
                pending = {
                    mask: new Uint8Array(activeLayer.bgMask.mask),
                    width: activeLayer.bgMask.width,
                    height: activeLayer.bgMask.height
                };

                showPreview(activeLayer.img, pending);
                initializeBrush();
                setStatus("Existing background mask loaded.");
            } catch (error) {
                console.error("[PhotoCook BG]", error);
                pending = null;
                setStatus("Unable to load existing mask.", null, true);
            }
        } else {
            setStatus("Choose AI Remove or Manual editing.");
        }

        updateButtons();
    }


    function close() {
        if (processing) return;

        session++;
        discardPendingPreview();
        window.PhotoCookBGBrush?.destroy();

        brushInitialized = false;
        resetPending = false;
        pending = null;
        activeLayer = null;

        $("bg-tb-brush-controls").hidden = true;
        panel.hidden = true;
        clearPreview();

        if (window.PhotoCookToolState?.activeTool === "bg-remover") {
            window.PhotoCookToolState.close();
        }
    }

    async function removeBackground() {
        if (processing) return;

        const layer = activeLayer;

        if (!layer || !layer.img) {
            setStatus("Select an image layer first.", null, true);
            return;
        }

        if (!window.PhotoCookBGProcessor || !window.PhotoCookBGMask) {
            setStatus("Background removal modules unavailable.", null, true);
            return;
        }

        const currentSession = ++session;

        discardPendingPreview();
        window.PhotoCookBGBrush?.destroy();

        brushInitialized = false;
        resetPending = false;
        processing = true;
        pending = null;

        updateButtons();
        setStatus("Preparing AI model...", 0);

        try {
            const result = await window.PhotoCookBGProcessor.process(
                layer.img,
                {
                    onProgress: info => {
                        if (currentSession !== session) return;

                        setStatus(
                            info.message || "Processing...",
                            Number.isFinite(info.progress) ? info.progress : null
                        );
                    }
                }
            );

            if (currentSession !== session) return;

            if (!result?.mask || !result.width || !result.height) {
                throw new Error("AI processor returned an invalid mask.");
            }

            window.PhotoCookBGMask.validateMask(
                result.mask,
                result.width,
                result.height
            );

            // Store independent mask data, never modify the original image.
            pending = {
                mask: new Uint8Array(result.mask),
                width: result.width,
                height: result.height
            };

            showPreview(layer.img, pending);
            initializeBrush();
            setStatus("Background removed. Switch to Manual to refine the result.", 100);

        } catch (error) {
            console.error("[PhotoCook BG] Processing failed:", error);
            pending = null;
            window.PhotoCookEngine?.clearBGPreview();
            setStatus(error.message || "Background removal failed.", null, true);
        } finally {
            if (currentSession === session) {
                processing = false;
                updateButtons();
            }
        }
    }


function apply() {
    if (processing || !activeLayer || (!pending && !resetPending)) return;

    const layers = window.PhotoCookLayerManager?.getLayers() || [];

    if (!layers.includes(activeLayer)) {
        setStatus("The selected layer no longer exists.", null, true);
        return;
    }

    // Get the latest brush mask, including Undo/Redo changes.
    if (activeMode === "manual" && brushInitialized && pending) {
        pending = window.PhotoCookBGBrush?.getMask() || pending;
    }

    // Commit only when Apply is pressed.
    if (resetPending && !pending) {
        delete activeLayer.bgMask;
    } else if (pending) {
        activeLayer.bgMask = {
            mask: new Uint8Array(pending.mask),
            width: pending.width,
            height: pending.height
        };
    }

    close();
    window.PhotoCookInteraction?.redrawCanvas?.();
}



function reset() {
    if (processing || !activeLayer) return;

    discardPendingPreview();
    window.PhotoCookBGBrush?.destroy();

    pending = null;
    brushInitialized = false;
    resetPending = true;

    clearPreview();
    $("bg-tb-brush-controls").hidden = true;

    if (activeMode === "manual") {
        ensureManualMask();
        startCanvasBrush();
    }

    setStatus("Mask reset. Click Apply to save or Cancel to discard.");
    updateButtons();
}


    function init(buttonId = "bg-remover") {
        const button = $(buttonId);

        if (!button) {
            console.warn("[PhotoCook BG] Toolbar button not found.");
            return;
        }

        if (panel) return;

        createPanel();

        button.addEventListener("click", () => {
            if (panel.hidden) open();
            else close();
        });

        updateButtons();
    }

    return Object.freeze({
        init,
        open,
        close,
        isOpen: () => Boolean(panel && !panel.hidden),
        getPendingMask: () => pending
    });
})();
