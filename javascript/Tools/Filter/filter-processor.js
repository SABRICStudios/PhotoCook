(() => {
    "use strict";

    const CACHE = new WeakMap();

    const FILTERS = {
        none: (r, g, b) => [r, g, b],

        bw: (r, g, b) => {
            const v = 0.299 * r + 0.587 * g + 0.114 * b;
            return [v, v, v];
        },

        sepia: (r, g, b) => [
            0.393 * r + 0.769 * g + 0.189 * b,
            0.349 * r + 0.686 * g + 0.168 * b,
            0.272 * r + 0.534 * g + 0.131 * b
        ],

        cyberpunk: (r, g, b) => [
            Math.min(255, r * 0.85 + b * 0.22),
            Math.min(255, g * 0.75 + r * 0.08),
            Math.min(255, b * 1.2 + 25)
        ],

        vintage: (r, g, b) => [
            Math.min(255, r * 1.08 + 12),
            Math.min(255, g * 0.95 + 8),
            Math.min(255, b * 0.78 + 5)
        ],

        invert: (r, g, b) => [255 - r, 255 - g, 255 - b],

        warm: (r, g, b) => [
            Math.min(255, r * 1.08 + 8),
            Math.min(255, g * 1.02),
            b * 0.88
        ],

        cool: (r, g, b) => [
            r * 0.9,
            Math.min(255, g * 1.01 + 2),
            Math.min(255, b * 1.12 + 8)
        ],

        fade: (r, g, b) => [
            r * 0.82 + 35,
            g * 0.82 + 35,
            b * 0.82 + 35
        ],

        dramatic: (r, g, b) => [
            (r - 128) * 1.3 + 128,
            (g - 128) * 1.3 + 128,
            (b - 128) * 1.3 + 128
        ],

        matte: (r, g, b) => [
            r * 0.88 + 25,
            g * 0.88 + 25,
            b * 0.88 + 25
        ],

        golden: (r, g, b) => [
            Math.min(255, r * 1.15 + 12),
            Math.min(255, g * 1.05 + 5),
            b * 0.75
        ],

        dreamy: (r, g, b) => [
            Math.min(255, r * 0.9 + 28),
            Math.min(255, g * 0.9 + 24),
            Math.min(255, b * 0.9 + 35)
        ],

        "teal-orange": (r, g, b) => [
            Math.min(255, r * 1.12 + 8),
            g * 0.94 + 3,
            Math.min(255, b * 1.08 + 8)
        ],

        film: (r, g, b) => [
            r * 0.92 + 18,
            g * 0.9 + 15,
            b * 0.86 + 12
        ],

        vivid: (r, g, b) => [
            (r - 128) * 1.2 + 128,
            (g - 128) * 1.2 + 128,
            (b - 128) * 1.2 + 128
        ],

        soft: (r, g, b) => [
            r * 0.92 + 10,
            g * 0.92 + 10,
            b * 0.92 + 10
        ],

        noir: (r, g, b) => {
            const v = 0.299 * r + 0.587 * g + 0.114 * b;
            const contrast = (v - 128) * 1.35 + 128;
            return [contrast, contrast, contrast];
        }
    };

    const PRESETS = {
        "neon-city": {
            name: "Neon City",
            filters: ["cyberpunk", "vivid"],
            adjustments: {
                brightness: 105,
                contrast: 125,
                saturate: 140
            },
            intensity: 90
        },

        "monochrome-noir": {
            name: "Monochrome Noir",
            filters: ["noir"],
            adjustments: {
                brightness: 90,
                contrast: 140,
                saturate: 0
            },
            intensity: 100
        },

        "retro-80s": {
            name: "Retro 80s",
            filters: ["vintage", "sepia"],
            adjustments: {
                brightness: 100,
                contrast: 110,
                saturate: 120
            },
            intensity: 75
        },

        "warm-film": {
            name: "Warm Film",
            filters: ["warm", "film"],
            adjustments: {
                brightness: 103,
                contrast: 108,
                saturate: 110
            },
            intensity: 85
        },

        "cool-fade": {
            name: "Cool Fade",
            filters: ["cool", "fade"],
            adjustments: {
                brightness: 105,
                contrast: 95,
                saturate: 90
            },
            intensity: 85
        },

        "golden-hour": {
            name: "Golden Hour",
            filters: ["golden", "warm"],
            adjustments: {
                brightness: 108,
                contrast: 105,
                saturate: 115
            },
            intensity: 90
        },

        "matte-editorial": {
            name: "Matte Editorial",
            filters: ["matte", "soft"],
            adjustments: {
                brightness: 102,
                contrast: 95,
                saturate: 90
            },
            intensity: 80
        },

        dramatic: {
            name: "Dramatic",
            filters: ["dramatic", "noir"],
            adjustments: {
                brightness: 95,
                contrast: 130,
                saturate: 90
            },
            intensity: 85
        },

        dreamy: {
            name: "Dreamy",
            filters: ["dreamy", "soft"],
            adjustments: {
                brightness: 108,
                contrast: 92,
                saturate: 110
            },
            intensity: 80
        },

        "sunset-glow": {
            name: "Sunset Glow",
            filters: ["golden", "dreamy"],
            adjustments: {
                brightness: 105,
                contrast: 105,
                saturate: 125
            },
            intensity: 90
        }
    };

    function clamp(value) {
        return Math.max(0, Math.min(255, value));
    }

    function getFilterList(layer) {
        if (!layer) return [];

        const rawIntensity = Number(layer.filterIntensity ?? 100);
        const layerIntensity = Number.isFinite(rawIntensity)
            ? Math.max(0, Math.min(100, rawIntensity))
            : 100;

        const items = Array.isArray(layer.filters) && layer.filters.length
            ? layer.filters
            : layer.activeFilter && layer.activeFilter !== "none"
                ? [layer.activeFilter]
                : [];

        return items.map(item => {
            const name = typeof item === "string" ? item : item?.name;
            const raw = typeof item === "object" && item
                ? Number(item.intensity ?? layerIntensity)
                : layerIntensity;

            return {
                name,
                intensity: Number.isFinite(raw)
                    ? Math.max(0, Math.min(100, raw))
                    : layerIntensity
            };
        }).filter(item =>
            typeof item.name === "string" &&
            FILTERS[item.name] &&
            item.name !== "none" &&
            item.intensity > 0
        );
    }

    function processImageData(imageData, filters) {
        const output = new ImageData(
            new Uint8ClampedArray(imageData.data),
            imageData.width,
            imageData.height
        );

        const source = imageData.data;
        const target = output.data;

        for (let i = 0; i < source.length; i += 4) {
            let r = source[i];
            let g = source[i + 1];
            let b = source[i + 2];

            for (const filter of filters) {
                const processor = FILTERS[filter.name];
                if (!processor) continue;

                const amount = Math.max(
                    0,
                    Math.min(1, Number(filter.intensity) / 100)
                );

                if (!Number.isFinite(amount) || amount <= 0) continue;

                const result = processor(r, g, b);

                if (!Array.isArray(result) || result.length < 3) continue;

                r += (result[0] - r) * amount;
                g += (result[1] - g) * amount;
                b += (result[2] - b) * amount;
            }

            target[i] = clamp(Number.isFinite(r) ? r : source[i]);
            target[i + 1] = clamp(Number.isFinite(g) ? g : source[i + 1]);
            target[i + 2] = clamp(Number.isFinite(b) ? b : source[i + 2]);
            target[i + 3] = source[i + 3];
        }

        return output;
    }

    function getProcessedImage(layer, sourceImage) {
        if (!layer || !sourceImage) return sourceImage;

        const filters = getFilterList(layer);

        if (!filters.length) return sourceImage;

        const width = sourceImage.naturalWidth ||
            sourceImage.videoWidth ||
            sourceImage.width;

        const height = sourceImage.naturalHeight ||
            sourceImage.videoHeight ||
            sourceImage.height;

        if (!width || !height) return sourceImage;

        const signature = JSON.stringify({
            filters,
            revision: layer.filterRevision || 0,
            imageRevision: layer.imageRevision || 0,
            width,
            height
        });

        const cached = CACHE.get(layer);

        if (
            cached &&
            cached.source === sourceImage &&
            cached.signature === signature
        ) {
            return cached.canvas;
        }

        try {
            const canvas = document.createElement("canvas");
            canvas.width = width;
            canvas.height = height;

            const ctx = canvas.getContext("2d", {
                willReadFrequently: true
            });

            if (!ctx) return sourceImage;

            ctx.drawImage(sourceImage, 0, 0, width, height);

            const imageData = ctx.getImageData(0, 0, width, height);
            const processed = processImageData(imageData, filters);

            ctx.putImageData(processed, 0, 0);

            CACHE.set(layer, {
                source: sourceImage,
                signature,
                canvas
            });

            return canvas;

        } catch (error) {
            console.error("[PhotoCook Filter] Processing failed:", error);
            return sourceImage;
        }
    }

    function invalidate(layer) {
        if (!layer) return;

        CACHE.delete(layer);
        layer.filterRevision = (layer.filterRevision || 0) + 1;
    }

    function getPreset(id) {
        return PRESETS[id] || null;
    }

    function getPresets() {
        return Object.entries(PRESETS).map(([id, preset]) => ({
            id,
            ...preset
        }));
    }

    function getCustomPresets() {
        try {
            const saved = JSON.parse(
                localStorage.getItem("photocook_custom_filters") || "[]"
            );

            if (!Array.isArray(saved)) return [];

            const seen = new Set();

            return saved.filter(preset => {
                if (
                    !preset ||
                    typeof preset.id !== "string" ||
                    !preset.id.startsWith("custom-") ||
                    typeof preset.name !== "string" ||
                    !preset.name.trim() ||
                    !Array.isArray(preset.filters) ||
                    !preset.filters.length
                ) return false;

                if (seen.has(preset.id)) return false;

                const validFilters = preset.filters.every(filter =>
                    typeof filter === "string" &&
                    FILTERS[filter] &&
                    filter !== "none"
                );

                const intensity = Number(preset.intensity ?? 100);

                if (!validFilters || !Number.isFinite(intensity)) return false;

                seen.add(preset.id);
                return true;
            }).map(preset => ({
                ...preset,
                name: preset.name.trim().slice(0, 40),
                intensity: Math.max(0, Math.min(100, Number(preset.intensity ?? 100))),
                filters: [...new Set(preset.filters)]
            }));

        } catch (error) {
            console.error("[PhotoCook Filter] Preset loading failed:", error);
            return [];
        }
    }

    function saveCustomPreset(preset) {
        if (!preset || typeof preset !== "object") return false;

        const name = String(preset.name || "").trim().slice(0, 40);

        if (!name || !Array.isArray(preset.filters)) return false;

        const filters = [...new Set(preset.filters)].filter(filter =>
            typeof filter === "string" &&
            FILTERS[filter] &&
            filter !== "none"
        );

        if (!filters.length) return false;

        const rawIntensity = Number(preset.intensity ?? 100);

        if (!Number.isFinite(rawIntensity)) return false;

        const intensity = Math.max(0, Math.min(100, rawIntensity));
        const presets = getCustomPresets();

        const id = `custom-${Date.now()}-${Math.random().toString(36).slice(2, 10)}`;

        presets.push({
            id,
            name,
            filters,
            adjustments: {},
            intensity
        });

        try {
            localStorage.setItem(
                "photocook_custom_filters",
                JSON.stringify(presets)
            );

            return id;

        } catch (error) {
            console.error("[PhotoCook Filter] Save failed:", error);
            return false;
        }
    }

    function deleteCustomPreset(id) {
        if (!id) return false;

        try {
            const presets = getCustomPresets().filter(
                preset => preset.id !== id
            );

            localStorage.setItem(
                "photocook_custom_filters",
                JSON.stringify(presets)
            );

            return true;
        } catch (error) {
            console.error("[PhotoCook Filter] Delete failed:", error);
            return false;
        }
    }

    window.PhotoCookFilterProcessor = {
        FILTERS,
        PRESETS,
        processImageData,
        getProcessedImage,
        getFilterList,
        getPreset,
        getPresets,
        getCustomPresets,
        saveCustomPreset,
        deleteCustomPreset,
        invalidate
    };
})();