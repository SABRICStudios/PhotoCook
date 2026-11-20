
/* PhotoCook — Selection Brush */
(() => {
    'use strict';

    if (window.PhotoCookSelectionBrush) return;

    const Brush = {
        isDrawing: false,
        lastPoint: null,

        settings: {
            size: 30,
            hardness: 80,
            opacity: 100,
            mode: 'add'
        },

        canvas: null,
        mask: null,
        width: 0,
        height: 0,

        configure(options = {}) {
            if (Number.isFinite(options.size)) {
                this.settings.size = Math.max(1, Math.min(500, options.size));
            }

            if (Number.isFinite(options.hardness)) {
                this.settings.hardness = Math.max(0, Math.min(100, options.hardness));
            }

            if (Number.isFinite(options.opacity)) {
                this.settings.opacity = Math.max(0, Math.min(100, options.opacity));
            }

            if (options.mode === 'add' || options.mode === 'subtract') {
                this.settings.mode = options.mode;
            }
        },

        attach(mask, width, height) {
            if (
                !mask ||
                !Number.isInteger(width) ||
                !Number.isInteger(height) ||
                width <= 0 ||
                height <= 0 ||
                mask.length !== width * height
            ) {
                return false;
            }

            this.mask = mask;
            this.width = width;
            this.height = height;

            return true;
        },

        begin(x, y) {
            if (!this.mask || this.isDrawing) return false;

            this.isDrawing = true;
            this.lastPoint = { x, y };

            this.paint(x, y);
            return true;
        },

        move(x, y) {
            if (!this.isDrawing || !this.lastPoint) return;

            const dx = x - this.lastPoint.x;
            const dy = y - this.lastPoint.y;
            const distance = Math.hypot(dx, dy);
            const spacing = Math.max(1, this.settings.size * 0.12);
            const steps = Math.max(1, Math.ceil(distance / spacing));

            for (let i = 1; i <= steps; i++) {
                const t = i / steps;

                this.paint(
                    this.lastPoint.x + dx * t,
                    this.lastPoint.y + dy * t
                );
            }

            this.lastPoint = { x, y };
        },

        end() {
            this.isDrawing = false;
            this.lastPoint = null;
        },

        paint(centerX, centerY) {
            if (!this.mask) return;

            const radius = this.settings.size / 2;
            const hardness = this.settings.hardness / 100;
            const opacity = this.settings.opacity / 100;

            const minX = Math.max(0, Math.floor(centerX - radius));
            const maxX = Math.min(this.width - 1, Math.ceil(centerX + radius));
            const minY = Math.max(0, Math.floor(centerY - radius));
            const maxY = Math.min(this.height - 1, Math.ceil(centerY + radius));

            for (let y = minY; y <= maxY; y++) {
                for (let x = minX; x <= maxX; x++) {
                    const distance = Math.hypot(
                        x + 0.5 - centerX,
                        y + 0.5 - centerY
                    );

                    if (distance > radius) continue;

                    const normalized = distance / radius;

                    let falloff = 1;

                    if (normalized > hardness && hardness < 1) {
                        falloff = 1 - (
                            (normalized - hardness) / (1 - hardness)
                        );

                        falloff = Math.max(0, falloff);
                    }

                    const strength = opacity * falloff * 255;
                    const index = y * this.width + x;
                    const current = this.mask[index];

                    if (this.settings.mode === 'subtract') {
                        this.mask[index] = Math.max(
                            0,
                            Math.round(current - strength)
                        );
                    } else {
                        this.mask[index] = Math.min(
                            255,
                            Math.round(current + strength)
                        );
                    }
                }
            }
        },

        getMask() {
            return this.mask ? new Uint8Array(this.mask) : null;
        },

        setMask(mask) {
            if (!this.mask || !mask || mask.length !== this.mask.length) {
                return false;
            }

            this.mask.set(mask);
            return true;
        },

        detach() {
            this.end();
            this.mask = null;
            this.width = 0;
            this.height = 0;
        }
    };

    window.PhotoCookSelectionBrush = Brush;

})();
