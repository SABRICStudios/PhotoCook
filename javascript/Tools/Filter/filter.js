(() => {
    "use strict";

    const Processor = () => window.PhotoCookFilterProcessor;

    const FILTER_LIST = [
        ["none", "Original"],
        ["bw", "B&W"],
        ["sepia", "Sepia"],
        ["cyberpunk", "Cyberpunk"],
        ["vintage", "Vintage"],
        ["invert", "Invert"],
        ["warm", "Warm"],
        ["cool", "Cool"],
        ["fade", "Fade"],
        ["dramatic", "Dramatic"],
        ["matte", "Matte"],
        ["golden", "Golden"],
        ["dreamy", "Dreamy"],
        ["teal-orange", "Teal Orange"],
        ["film", "Film"],
        ["vivid", "Vivid"],
        ["soft", "Soft"],
        ["noir", "Noir"]
    ];

    let panel;
    let currentView = "filters";
    let selectedPreset = null;
    let activeLayer = null;
    let intensity = 100;
    let customSelectedFilters = [];
    let customIntensity = 100;
    let customPresetName = "";

    const $ = (selector, root = panel) =>
        root?.querySelector(selector);

    function escapeHTML(value) {
        return String(value ?? "").replace(/[&<>"']/g, char => ({
            "&": "&amp;",
            "<": "&lt;",
            ">": "&gt;",
            '"': "&quot;",
            "'": "&#39;"
        })[char]);
    }

    function getLayer() {
        return window.PhotoCookLayerManager?.getSelectedLayer?.() ||
            window.selectedLayer ||
            window.editor?.selectedLayer ||
            null;
    }

    function redraw() {
        const engine = window.PhotoCookEngine;

        if (typeof engine?.render === "function") {
            engine.render();
        } else if (typeof engine?.redraw === "function") {
            engine.redraw();
        } else if (typeof window.renderCanvas === "function") {
            window.renderCanvas();
        } else if (typeof window.drawCanvas === "function") {
            window.drawCanvas();
        }
    }

    function refreshLayer() {
        activeLayer = getLayer();

        if (!activeLayer || !activeLayer.img) return false;

        return true;
    }

    function clearPresetAdjustments(layer) {
        layer.filterPresetString = "none";
        layer.filterPresetAdjustments = null;
        layer.activePresetId = null;
    }

    function makeFilterString(adjustments = {}) {
        const getValue = (key, fallback) => {
            const value = Number(adjustments[key] ?? fallback);
            return Number.isFinite(value)
                ? Math.max(0, Math.min(300, value))
                : fallback;
        };

        const brightness = getValue("brightness", 100);
        const contrast = getValue("contrast", 100);
        const saturate = getValue("saturate", 100);

        return `brightness(${brightness}%) contrast(${contrast}%) saturate(${saturate}%)`;
    }


    function applySingleFilter(name) {
        if (!refreshLayer()) return;

        if (name === "none") {
            activeLayer.filters = [];
            activeLayer.activeFilter = "none";
            activeLayer.filterIntensity = 100;
            clearPresetAdjustments(activeLayer);
        } else {
            activeLayer.filters = [name];
            activeLayer.activeFilter = name;
            activeLayer.filterIntensity = intensity;
            clearPresetAdjustments(activeLayer);
        }

        intensity = Number(activeLayer.filterIntensity);

        Processor().invalidate(activeLayer);
        redraw();

        // Update selected filter border immediately.
        panel.querySelectorAll(".pc-filter-card[data-filter]").forEach(card => {
            const selected = card.dataset.filter === name;

            card.classList.toggle("active", selected);
            card.setAttribute("aria-pressed", String(selected));
        });

        // Refresh the filter panel.
        renderFilters();
    }


    function applyPreset(preset) {
        if (!refreshLayer() || !preset) return;

        activeLayer.activePresetId = preset.id;
        activeLayer.filters = [...preset.filters];
        activeLayer.activeFilter = preset.filters[0] || "none";
        activeLayer.filterIntensity = preset.intensity ?? 100;

        activeLayer.filterPresetAdjustments = {
            ...(preset.adjustments || {})
        };

        activeLayer.filterPresetString = makeFilterString(
            preset.adjustments || {}
        );

        Processor().invalidate(activeLayer);
        redraw();

        closePanel();
    }

    function renderHeader() {
        return `
            <div class="pc-filter-header">
                <div class="pc-filter-heading">Filters</div>
                <button class="pc-filter-icon-btn"
                    type="button" data-action="close"
                    aria-label="Close filters">×</button>
            </div>
        `;
    }

    function renderTabs() {
        return `
            <div class="pc-filter-tabs">
                <button class="pc-filter-tab ${currentView === "filters" ? "active" : ""}"
                    data-action="view-filters">Filters</button>
                <button class="pc-filter-tab ${currentView !== "filters" ? "active" : ""}"
                    data-action="view-presets">Presets</button>
            </div>
        `;
    }



    function renderFilters() {
        if (!refreshLayer()) {
            return `
                <div class="pc-filter-content">
                    <div class="pc-filter-empty">
                        Select an image layer to use filters.
                    </div>
                </div>
            `;
        }

        const activeFilters = new Set(
            Processor().getFilterList(activeLayer).map(item => item.name)
        );

        const activeFilter = activeFilters.size
            ? null
            : "none";
        intensity = Number(activeLayer.filterIntensity ?? 100);

        const imageSource =
            activeLayer.img.currentSrc ||
            activeLayer.img.src ||
            "";

        const safeSource = escapeHTML(imageSource);

        return `
            <div class="pc-filter-content pc-filter-main-content">
                <div class="pc-filter-section-title">Choose a filter</div>

                <div class="pc-filter-gallery">
                    ${FILTER_LIST.map(([id, name]) => {
                        const isActive = id === "none"
                            ? activeFilter === "none"
                            : activeFilters.has(id);

                        return `
                            <button type="button"
                                class="pc-filter-card ${isActive ? "active" : ""}"
                                data-filter="${id}"
                                aria-pressed="${isActive}">

                                <div class="pc-filter-preview">
                                    <img
                                        src="${safeSource}"
                                        class="pc-filter-preview-image pc-filter-preview-${id.replace(/[^a-z0-9-]/gi, "")}"
                                        alt=""
                                        loading="lazy">
                                </div>

                                <span>${name}</span>
                            </button>
                        `;
                    }).join("")}
                </div>

                <div class="pc-filter-slider-wrap">
                    <div class="pc-filter-slider-heading">
                        <span>Filter intensity</span>
                        <span id="pcFilterIntensityValue">${intensity}%</span>
                    </div>

                    <input
                        class="pc-filter-slider"
                        id="pcFilterIntensity"
                        type="range"
                        min="0"
                        max="100"
                        value="${intensity}">
                </div>
            </div>
        `;
    }



    function renderPresets() {
        const presets = getAllPresets();
        const appliedPresetId = getLayer()?.activePresetId;

        return `
            <div class="pc-filter-content pc-filter-main-content">

                <div class="pc-filter-section-title">
                    Create or choose a preset
                </div>

                <div class="pc-filter-preset-gallery">

                    <button type="button"
                        class="pc-filter-preset-card pc-filter-create-card"
                        data-action="create-custom-preset">

                        <span class="pc-filter-create-icon">+</span>
                        <span class="pc-filter-create-name">Custom Preset</span>
                        <small>Create your own</small>

                    </button>

                    ${presets.map(preset => `
                        <button type="button"
                            class="pc-filter-preset-card ${
                                preset.id === appliedPresetId ||
                                preset.id === selectedPreset?.id
                                    ? "active"
                                    : ""
                            }"
                            data-preset="${escapeHTML(preset.id)}">

                            <span class="pc-filter-preset-card-name">
                                ${escapeHTML(preset.name)}
                            </span>

                            <small>
                                ${preset.filters.map(escapeHTML).join(" · ")}
                            </small>

                            <span class="pc-filter-preset-arrow">›</span>
                        </button>
                    `).join("")}

                </div>

                ${!presets.length ? `
                    <div class="pc-filter-empty">
                        No saved presets yet.
                    </div>
                ` : ""}

            </div>
        `;
    }

    function getAllPresets() {
        const builtins = Processor().getPresets();
        const custom = Processor().getCustomPresets();

        return [...builtins, ...custom];
    }

    function openCustomBuilder() {
        customSelectedFilters = [];
        customIntensity = 100;
        currentView = "custom-builder";
        customPresetName = "";
        selectedPreset = null;
        render();
    }

    function renderCustomBuilder() {
        return `
            <div class="pc-filter-content">
                <button class="pc-filter-secondary"
                    data-action="back-presets">
                    ← Back to presets
                </button>

                <div class="pc-filter-section-title">
                    Select filters to combine
                </div>

                <div class="pc-filter-grid">
                    ${FILTER_LIST.filter(([id]) => id !== "none").map(([id, name]) => `
                        <button type="button"
                            class="pc-filter-card ${customSelectedFilters.includes(id) ? "active" : ""}"
                            data-builder-filter="${id}">
                            <div class="pc-filter-preview">Aa</div>
                            ${name}
                            ${customSelectedFilters.includes(id) ? " ✓" : ""}
                        </button>
                    `).join("")}
                </div>

                <div class="pc-filter-slider-wrap">
                    <div class="pc-filter-slider-heading">
                        <span>Combined filter intensity</span>
                        <span id="pcCustomIntensityValue">${customIntensity}%</span>
                    </div>
                    <input class="pc-filter-slider"
                        id="pcCustomIntensity"
                        type="range"
                        min="0"
                        max="100"
                        value="${customIntensity}">
                </div>

                <div class="pc-filter-name-wrap">
                    <label for="pcCustomPresetName">Preset name</label>
                    <input id="pcCustomPresetName"
                        class="pc-filter-name-input"
                        type="text"
                        maxlength="40"
                        value="${escapeHTML(customPresetName)}"
                        placeholder="Enter preset name">
                </div>

                <div class="pc-filter-selected-count" id="pcCustomSelectedCount">
                    ${customSelectedFilters.length} filters selected
                </div>

                <button class="pc-filter-action"
                    data-action="save-custom-preset">
                    Save & Apply to Image
                </button>
            </div>
        `;
    }

    function saveCustomPreset() {
        if (!refreshLayer()) {
            alert("Select an image layer first.");
            return;
        }

        const name = customPresetName.trim();

        if (!name) {
            alert("Enter a name for your preset.");
            return;
        }

        if (!customSelectedFilters.length) {
            alert("Select at least one filter.");
            return;
        }

        const savedId = Processor().saveCustomPreset({
            name,
            filters: [...customSelectedFilters],
            adjustments: {},
            intensity: customIntensity
        });

        if (!savedId) {
            alert("Could not save this preset.");
            return;
        }

        const savedPreset = Processor().getCustomPresets().find(
            preset => preset.id === savedId
        );

        if (!savedPreset) {
            alert("Preset was saved, but could not be loaded.");
            currentView = "presets";
            render();
            return;
        }

        applyPreset(savedPreset);
    }

    function renderPresetDetail(preset) {
        if (!preset) return renderPresets();

        const adjustments = preset.adjustments || {};

        return `
            <div class="pc-filter-content">
                <button class="pc-filter-secondary"
                    data-action="back-presets">← Back to presets</button>

                <div class="pc-filter-detail-title">${escapeHTML(preset.name)}</div>

                <div class="pc-filter-section-title">Filters used</div>

                <div class="pc-filter-chip-list">
                    ${preset.filters.map(name => `
                        <span class="pc-filter-chip">${escapeHTML(name)}</span>
                    `).join("")}
                </div>

                <div class="pc-filter-section-title">Preset adjustments</div>

                ${Object.entries(adjustments).map(([key, value]) => `
                    <div class="pc-filter-adjustment">
                        <span>${escapeHTML(key)}</span>
                        <span>${escapeHTML(value)}%</span>
                    </div>
                `).join("")}

                <button class="pc-filter-action"
                    data-action="apply-preset"
                    data-preset="${escapeHTML(preset.id)}">
                    Apply preset
                </button>

                ${String(preset.id).startsWith("custom-") ? `
                    <button class="pc-filter-secondary"
                        data-action="delete-preset"
                        data-preset="${escapeHTML(preset.id)}">
                        Delete custom preset
                    </button>
                ` : ""}
            </div>
        `;
    }

    function render() {
        if (!panel) return;

        let content = "";

        if (currentView === "filters") {
            content = renderFilters();
        } else if (currentView === "presets") {
            content = renderPresets();
        } else if (currentView === "preset-detail") {
            content = renderPresetDetail(selectedPreset);
        } else if (currentView === "custom-builder") {
            content = renderCustomBuilder();
        }

        panel.innerHTML =
            renderHeader() +
            (currentView === "preset-detail" || currentView === "custom-builder"
                ? ""
                : renderTabs()) +
            content;
    }

    function openPanel() {
        if (!panel) return;

        panel.classList.add("open");
        currentView = "filters";
        selectedPreset = null;

        const layer = getLayer();
        intensity = layer?.filterIntensity ?? 100;

        render();
    }

    function closePanel() {
        panel?.classList.remove("open");

        document.querySelectorAll(".sub-toolbar.open").forEach(item => {
            item.classList.remove("open");
        });
    }

    function showPresetDetail(id) {
        selectedPreset = getAllPresets().find(
            preset => preset.id === id
        );

        if (!selectedPreset) return;

        currentView = "preset-detail";
        render();
    }

    function saveCurrentPreset() {
        if (!refreshLayer()) {
            alert("Select an image layer first.");
            return;
        }

        const name = prompt("Enter a name for this preset:");
        if (!name || !name.trim()) return;

        const filters = Processor().getFilterList(activeLayer)
            .map(item => item.name);
        if (!filters.length) {
            alert("Apply at least one filter before saving a preset.");
            return;
        }

        const saved = Processor().saveCustomPreset({
            name: name.trim(),
            filters,
            adjustments: activeLayer.filterPresetAdjustments || {},
            intensity: activeLayer.filterIntensity ?? 100
        });

        if (!saved) {
            alert("Could not save this preset.");
            return;
        }

        currentView = "presets";
        render();
    }

    function handleClick(event) {
        const target = event.target.closest(
            "[data-action], [data-filter], [data-preset], [data-builder-filter]"
        );

        if (!target || !panel.contains(target)) return;

        if (target.dataset.builderFilter) {
            const name = target.dataset.builderFilter;

            if (customSelectedFilters.includes(name)) {
                customSelectedFilters = customSelectedFilters.filter(item => item !== name);
            } else {
                customSelectedFilters.push(name);
            }

            render();
            return;
        }

        if (target.dataset.filter) {
            applySingleFilter(target.dataset.filter);
            return;
        }

        if (target.dataset.preset && !target.dataset.action) {
            showPresetDetail(target.dataset.preset);
            return;
        }

        const action = target.dataset.action;

        if (action === "close") {
            closePanel();
        } else if (action === "view-filters") {
            currentView = "filters";
            render();
        } else if (action === "view-presets") {
            currentView = "presets";
            render();
        } else if (action === "back-presets") {
            currentView = "presets";
            render();
        } else if (action === "apply-preset") {
            const preset = getAllPresets().find(
                item => item.id === target.dataset.preset
            );
            applyPreset(preset);
        } else if (action === "create-custom-preset") {
            openCustomBuilder();
        } else if (action === "save-custom-preset") {
            saveCustomPreset();
          } else if (action === "delete-preset") {
            const id = target.dataset.preset;

            if (confirm("Delete this custom preset?")) {
                Processor().deleteCustomPreset(id);
                currentView = "presets";
                selectedPreset = null;
                render();
            }
        }
    }
    function handleInput(event) {
        if (event.target.id === "pcCustomPresetName") {
            customPresetName = event.target.value;
            return;
        }
        if (event.target.id === "pcCustomIntensity") {
            customIntensity = Number(event.target.value);

            const value = $("#pcCustomIntensityValue");
            if (value) value.textContent = `${customIntensity}%`;

            return;
        }

        if (event.target.id === "pcFilterIntensity") {
            intensity = Number(event.target.value);

            const value = $("#pcFilterIntensityValue");
            if (value) value.textContent = `${intensity}%`;

            if (!refreshLayer()) return;

            if (Processor().getFilterList(activeLayer).length) {
                activeLayer.filterIntensity = intensity;

                Processor().invalidate(activeLayer);
                redraw();
            }
        }
    }
    function createPanel() {
        panel = document.getElementById("photocookFilterPanel");

        if (!panel) {
            panel = document.createElement("div");
            panel.id = "photocookFilterPanel";

            const host =
                document.querySelector(".editor-container") ||
                document.querySelector(".editor-workspace") ||
                document.querySelector("main") ||
                document.body;

            host.appendChild(panel);
        }

        if (panel.dataset.filterEventsBound) return;

        panel.dataset.filterEventsBound = "true";
        panel.addEventListener("click", handleClick);
        panel.addEventListener("input", handleInput);
        panel.addEventListener("pointerdown", event => event.stopPropagation());
        panel.addEventListener("mousedown", event => event.stopPropagation());
        panel.addEventListener("touchstart", event => event.stopPropagation(), {
            passive: true
        });
    }

    function init(buttonId = "filter") {
        if (!Processor()) {
            console.error(
                "[PhotoCook Filter] Load filter-processor.js before filter.js."
            );
            return;
        }
        createPanel();

        const button = document.getElementById(buttonId + "Btn") ||
            document.getElementById(buttonId);

        if (button && !button.dataset.filterBound) {
            button.dataset.filterBound = "true";

            button.addEventListener("click", () => {
                if (panel.classList.contains("open")) {
                    closePanel();
                } else {
                    openPanel();
                }
            });
        }

        console.log("[PhotoCook Filter] Initialized.");
    }

    window.PhotoCookFilter = {
        init,
        open: openPanel,
        close: closePanel,
        savePreset: openCustomBuilder,
        applyPreset,
        applySingleFilter
    };
})();