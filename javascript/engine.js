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
            layers.forEach(layer => {
                if (layer.type === 'text') {
                    ctxRef.save();
                    const fontSize = layer.fontSize || 48;
                    const lines = String(layer.text || '').split(/\r\n|\r|\n/);
                    const lineHeight = fontSize * 1.2 + (layer.lineSpacing || 0);
                    const paddingX = 20;
                    const paddingY = 10;

                    ctxRef.font = `${layer.isItalic ? 'italic ' : ''}${layer.isBold ? 'bold ' : ''}${fontSize}px "${layer.fontFamily || 'Arial'}"`;
                    if ('letterSpacing' in ctxRef) ctxRef.letterSpacing = `${layer.letterSpacing || 0}px`;

                    const textWidth = Math.max(0, ...lines.map(line => ctxRef.measureText(line).width));
                    layer.width = Math.max(40, textWidth + paddingX * 2);
                    layer.height = Math.max(20, fontSize * 1.2 + (lines.length - 1) * lineHeight + paddingY * 2);
                    layer.textPaddingX = paddingX;
                    layer.textPaddingY = paddingY;
                    ctxRef.restore();

                }
                drawLayer(ctxRef, layer);
            });
        }

        // 3. Render UI Overlays (Selection Marquee, Handles) when not exporting
        if (!isExporting && overlayCallback && typeof overlayCallback === 'function') {
            overlayCallback(ctxRef);
        }
    }

    function drawTextLabel(ctx, layer, lines, fontSize, lineHeight, paddingX, paddingY, align, textX) {
        if (!layer.labelEnabled || layer.labelPreset === 'none') return;

        const preset = layer.labelPreset || 'rectangle';
        const color = layer.labelColor || '#ffff00';
        const color2 = layer.labelColor2 || '#8b5cf6';
        const pad = Math.max(0, Number(layer.labelPadding ?? 12));
        const radius = Math.max(0, Number(layer.labelRadius ?? 12));
        const opacity = Math.max(0, Math.min(100, Number(layer.labelOpacity ?? 100))) / 100;
        if (opacity <= 0 || !lines.some(line => line.length)) return;

        const widths = lines.map(line => ctx.measureText(line).width);
        const width = Math.max(...widths, 0);
        const textHeight = fontSize * 1.2 + (lines.length - 1) * lineHeight;
        const x = align === 'center' ? textX - width / 2 - pad : align === 'right' ? textX - width - pad : textX - pad;
        const y = paddingY - pad;
        const w = Math.max(1, width + pad * 2);
        const h = Math.max(1, textHeight + pad * 2);
        const r = Math.min(radius, w / 2, h / 2);

        function roundedRect(x, y, w, h, r) {
            ctx.beginPath();
            ctx.roundRect(x, y, w, h, Math.min(r, w / 2, h / 2));
        }

        function polygon(points) {
            ctx.beginPath();
            ctx.moveTo(points[0][0], points[0][1]);
            points.slice(1).forEach(p => ctx.lineTo(p[0], p[1]));
            ctx.closePath();
        }

        ctx.save();
        ctx.globalAlpha *= opacity;
        ctx.fillStyle = color;
        ctx.strokeStyle = color;
        ctx.lineWidth = Math.max(2, Math.min(5, fontSize * 0.07));
        ctx.lineJoin = 'round';
        ctx.shadowColor = 'transparent';
        ctx.shadowBlur = 0;
        ctx.shadowOffsetX = 0;
        ctx.shadowOffsetY = 0;

        switch (preset) {
            case 'rounded':
                roundedRect(x, y, w, h, r);
                ctx.fill();
                break;

            case 'pill':
                roundedRect(x, y, w, h, h / 2);
                ctx.fill();
                break;

            case 'outline':
                roundedRect(x, y, w, h, r);
                ctx.stroke();
                break;

            case 'underline':
                ctx.fillRect(x, y + h - Math.max(3, fontSize * 0.12), w, Math.max(3, fontSize * 0.12));
                break;

            case 'highlight':
                ctx.fillRect(x, y + h * 0.35, w, h * 0.65);
                break;

            case 'side-accent':
                ctx.save();
                ctx.globalAlpha *= 0.18;
                ctx.fillRect(x, y, w, h);
                ctx.restore();
                ctx.fillRect(x, y, Math.max(4, fontSize * 0.12), h);
                break;

            case 'ribbon': {
                const cut = Math.min(w * 0.12, h * 0.25);
                polygon([[x, y], [x + w, y], [x + w - cut, y + h / 2], [x + w, y + h], [x, y + h], [x + cut, y + h / 2]]);
                ctx.fill();
                break;
            }

            case 'gradient': {
                const gradient = ctx.createLinearGradient(x, y, x + w, y + h);
                gradient.addColorStop(0, color);
                gradient.addColorStop(1, color2);
                ctx.fillStyle = gradient;
                roundedRect(x, y, w, h, r);
                ctx.fill();
                break;
            }

            case 'speech': {
                const tail = Math.min(18, h * 0.3);
                roundedRect(x, y, w, h, r);
                ctx.fill();
                polygon([[x + pad, y + h - 1], [x + pad, y + h + tail], [x + pad + tail, y + h - 1]]);
                ctx.fill();
                break;
            }

            case 'sticker':
                ctx.save();
                ctx.strokeStyle = color2;
                ctx.lineWidth = Math.max(4, fontSize * 0.14);
                roundedRect(x, y, w, h, r);
                ctx.stroke();
                ctx.restore();
                roundedRect(x, y, w, h, r);
                ctx.fill();
                break;

            case 'double-border':
                roundedRect(x, y, w, h, r);
                ctx.stroke();
                ctx.save();
                ctx.lineWidth = Math.max(1, ctx.lineWidth / 2);
                roundedRect(x + 6, y + 6, Math.max(1, w - 12), Math.max(1, h - 12), Math.max(0, r - 6));
                ctx.stroke();
                ctx.restore();
                break;

            case 'neon':
                ctx.save();
                ctx.shadowColor = color;
                ctx.shadowBlur = 12 + fontSize * 0.3;
                ctx.lineWidth = 3;
                roundedRect(x, y, w, h, r);
                ctx.stroke();
                ctx.restore();
                break;

            case 'glass':
                ctx.save();
                ctx.globalAlpha *= 0.25;
                roundedRect(x, y, w, h, r);
                ctx.fill();
                ctx.restore();
                ctx.save();
                ctx.strokeStyle = color2;
                ctx.lineWidth = 1.5;
                roundedRect(x, y, w, h, r);
                ctx.stroke();
                ctx.restore();
                break;

            case 'marker':
                polygon([
                    [x, y + h * 0.25], [x + w, y + h * 0.12],
                    [x + w * 0.97, y + h * 0.9], [x + w * 0.03, y + h]
                ]);
                ctx.fill();
                break;

            case 'slanted': {
                const offset = Math.min(16, w * 0.12);
                polygon([[x + offset, y], [x + w, y], [x + w - offset, y + h], [x, y + h]]);
                ctx.fill();
                break;
            }

            case 'cut-corners': {
                const cut = Math.min(16, w * 0.12, h * 0.25);
                polygon([
                    [x + cut, y], [x + w - cut, y], [x + w, y + cut],
                    [x + w, y + h - cut], [x + w - cut, y + h],
                    [x + cut, y + h], [x, y + h - cut], [x, y + cut]
                ]);
                ctx.fill();
                break;
            }

            case 'bracket': {
                const arm = Math.min(15, w * 0.15);
                ctx.beginPath();
                ctx.moveTo(x + arm, y);
                ctx.lineTo(x, y);
                ctx.lineTo(x, y + h);
                ctx.lineTo(x + arm, y + h);
                ctx.moveTo(x + w - arm, y);
                ctx.lineTo(x + w, y);
                ctx.lineTo(x + w, y + h);
                ctx.lineTo(x + w - arm, y + h);
                ctx.stroke();
                break;
            }

            case 'top-bottom':
                ctx.beginPath();
                ctx.moveTo(x, y);
                ctx.lineTo(x + w, y);
                ctx.moveTo(x, y + h);
                ctx.lineTo(x + w, y + h);
                ctx.stroke();
                break;

            case 'banner': {
                const cut = Math.min(18, w * 0.12);
                polygon([[x, y], [x + w, y], [x + w - cut, y + h / 2], [x + w, y + h], [x, y + h], [x + cut, y + h / 2]]);
                ctx.fill();
                ctx.save();
                ctx.strokeStyle = color2;
                ctx.lineWidth = 2;
                ctx.stroke();
                ctx.restore();
                break;
            }

            case 'rectangle':
            default:
                ctx.fillRect(x, y, w, h);
                break;
        }

        ctx.restore();
    }

    /**
     * Draw an individual layer with transforms & adjustments applied
     */
    
    function drawLayer(ctx, layer) {
        ctx.save();

        if (layer.type === 'text') {
            ctx.translate(layer.x, layer.y);
            if (layer.rotation) ctx.rotate(layer.rotation * Math.PI / 180);

            // Apply opacity to the complete text layer.
            ctx.globalAlpha = Math.max(0, Math.min(100, Number(layer.opacity ?? 100))) / 100;

            const fontSize = layer.fontSize || 48;
            const lines = String(layer.text || '').split(/\r\n|\r|\n/);
            const lineHeight = fontSize * 1.2 + (layer.lineSpacing || 0);
            
            const paddingX = layer.textPaddingX ?? 20;
            const paddingY = layer.textPaddingY ?? 10;
            const align = layer.align || 'left';

            ctx.font = `${layer.isItalic ? 'italic ' : ''}${layer.isBold ? 'bold ' : ''}${fontSize}px "${layer.fontFamily || 'Arial'}"`;
            ctx.textBaseline = 'top';
            ctx.textAlign = align;
            ctx.lineJoin = 'round';

            if ('letterSpacing' in ctx) ctx.letterSpacing = `${layer.letterSpacing || 0}px`;

            const textX = align === 'center' ? layer.width / 2 : align === 'right' ? layer.width - paddingX : paddingX;
            const fillColor = layer.fill || '#000000';
            const strokeColor = layer.strokeColor || '#000000';
            const strokeWidth = Number(layer.strokeWidth) || 0;

            // Convert a hex color to RGBA
            function toRGBA(hex, opacity) {
                const match = /^#([0-9a-f]{3}|[0-9a-f]{6})$/i.exec(hex);
                if (!match) return hex;

                let value = match[1];
                if (value.length === 3) value = value.split('').map(c => c + c).join('');

                const r = parseInt(value.slice(0, 2), 16);
                const g = parseInt(value.slice(2, 4), 16);
                const b = parseInt(value.slice(4, 6), 16);

                return `rgba(${r}, ${g}, ${b}, ${opacity})`;
            }

            // Shadow settings
            const shadowEnabled = layer.shadowEnabled === true;
            const shadowOpacity = Math.max(0, Math.min(100, Number(layer.shadowOpacity ?? 50))) / 100;
            const shadowColor = toRGBA(layer.shadowColor || '#000000', shadowOpacity);
            const shadowX = Number(layer.shadowOffsetX) || 0;
            const shadowY = Number(layer.shadowOffsetY) || 0;
            const shadowBlur = Math.max(0, Number(layer.shadowBlur) || 0);

            // Glow settings
            const glowEnabled = layer.glowEnabled === true;
            const glowIntensity = Math.max(0, Math.min(100, Number(layer.glowIntensity) || 0)) / 100;
            const glowColor = layer.glowColor || '#8b5cf6';
            const glowType = layer.glowType || 'soft';

            // Draw the label behind all text lines and effects.
            drawTextLabel(ctx, layer, lines, fontSize, lineHeight, paddingX, paddingY, align, textX);

            lines.forEach((line, index) => {
                const textY = paddingY + index * lineHeight;
                if (!line.length) return;

                // 1. Shadow
                if (shadowEnabled && shadowOpacity > 0) {
                    ctx.save();

                    ctx.shadowColor = shadowColor;
                    ctx.shadowOffsetX = shadowX;
                    ctx.shadowOffsetY = shadowY;
                    ctx.shadowBlur = shadowBlur;

                    // Draw the shadow without permanently covering the text
                    ctx.fillStyle = fillColor;
                    ctx.fillText(line, textX, textY);

                    ctx.restore();
                }

                // 2. Glow
                if (glowEnabled && glowIntensity > 0) {
                    ctx.save();

                    ctx.shadowOffsetX = 0;
                    ctx.shadowOffsetY = 0;
                    ctx.shadowColor = glowColor;

                    if (glowType === 'soft') {
                        ctx.shadowBlur = 10 + glowIntensity * 50;
                        ctx.globalAlpha = glowIntensity;
                        ctx.fillStyle = glowColor;
                        ctx.fillText(line, textX, textY);
                    } else if (glowType === 'strong') {
                        ctx.shadowBlur = 10 + glowIntensity * 35;
                        ctx.fillStyle = glowColor;

                        for (let i = 0; i < 3; i++) {
                            ctx.globalAlpha = glowIntensity * 0.65;
                            ctx.fillText(line, textX, textY);
                        }
                    } else if (glowType === 'outline') {
                        ctx.shadowBlur = 5 + glowIntensity * 30;
                        ctx.strokeStyle = glowColor;
                        ctx.lineWidth = Math.max(1, glowIntensity * 8);
                        ctx.globalAlpha = glowIntensity;
                        ctx.strokeText(line, textX, textY);
                    }

                    ctx.restore();
                }

                // 3. Original text and border
                ctx.save();

                ctx.shadowColor = 'transparent';
                ctx.shadowBlur = 0;
                ctx.shadowOffsetX = 0;
                ctx.shadowOffsetY = 0;

                ctx.fillStyle = fillColor;
                ctx.strokeStyle = strokeColor;
                ctx.lineWidth = strokeWidth;

                if (strokeWidth > 0) ctx.strokeText(line, textX, textY);
                ctx.fillText(line, textX, textY);

                ctx.restore();

                // 4. Underline
                if (layer.isUnderline) {
                    ctx.save();

                    const width = ctx.measureText(line).width;
                    const startX = align === 'center' ? textX - width / 2 : align === 'right' ? textX - width : textX;
                    const underlineY = textY + fontSize + 2;

                    ctx.beginPath();
                    ctx.strokeStyle = fillColor;
                    ctx.lineWidth = Math.max(1, fontSize / 15);
                    ctx.moveTo(startX, underlineY);
                    ctx.lineTo(startX + width, underlineY);
                    ctx.stroke();

                    ctx.restore();
                }
            });

        } else {
            // Image layer rendering
            ctx.translate(layer.x + layer.width / 2, layer.y + layer.height / 2);
            if (layer.rotation) ctx.rotate(layer.rotation * Math.PI / 180);

            ctx.filter = layer.filterString || 'none';
            ctx.drawImage(layer.img, -layer.width / 2, -layer.height / 2, layer.width, layer.height);
        }

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