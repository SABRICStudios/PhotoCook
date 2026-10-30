
/* PhotoCook — WebGL2 Adjust Processor | Stage 1: Light */
window.PhotoCookAdjustProcessor = (() => {
    'use strict';

   
    const KEYS = [
        'Exposure', 'Brightness', 'Contrast', 'Highlights', 'Shadows', 'Whites', 'Blacks',
        'Temperature', 'Tint', 'Saturation', 'Vibrance',
        'Sharpening', 'Clarity', 'Texture',
        'Dehaze', 'Fade', 'Vignette', 'Grain'
    ];



    const cache = new WeakMap();

    let gl = null;
    let gpuCanvas = null;
    let program = null;
    let texture = null;
    let uniforms = null;
    let unavailable = false;
    let warned = false;

    const vertexSource = `#version 300 es
        precision highp float;
        out vec2 vUV;

        void main() {
            vec2 p = vec2(
                gl_VertexID == 1 ? 3.0 : -1.0,
                gl_VertexID == 2 ? 3.0 : -1.0
            );

            vUV = (p + 1.0) * 0.5;
            gl_Position = vec4(p, 0.0, 1.0);
        }`;

    const fragmentSource = `#version 300 es
        precision highp float;

        in vec2 vUV;

        uniform sampler2D uImage;
        uniform float uExposure;
        uniform float uBrightness;
        uniform float uContrast;
        uniform float uHighlights;
        uniform float uShadows;
        uniform float uWhites;
        uniform float uBlacks;
        uniform float uTemperature;
        uniform float uTint;
        uniform float uSaturation;
        uniform float uVibrance;
        uniform float uSharpening;
        uniform float uClarity;
        uniform float uTexture;
        uniform float uDehaze;
        uniform float uFade;
        uniform float uVignette;
        uniform float uGrain;
        uniform vec2 uTexelSize;


        out vec4 outColor;



        float luminance(vec3 c) {
            return dot(c, vec3(0.2126, 0.7152, 0.0722));
        }

        void main() {
            vec4 src = texture(uImage, vUV);
            vec3 color = src.rgb;

            // Exposure, brightness and contrast
            color *= exp2(uExposure);
            color += vec3(uBrightness * 0.0025);
            color = (color - 0.5) * (1.0 + uContrast * 0.01) + 0.5;

            // Tonal masks
            float luma = luminance(clamp(color, 0.0, 1.0));

            float shadowMask = 1.0 - smoothstep(0.05, 0.65, luma);
            float highlightMask = smoothstep(0.35, 0.95, luma);
            float blackMask = 1.0 - smoothstep(0.0, 0.32, luma);
            float whiteMask = smoothstep(0.68, 1.0, luma);

            // Shadows, highlights, blacks and whites

            color += vec3(uShadows * 0.0035 * shadowMask);
            color += vec3(uHighlights * 0.0035 * highlightMask);
            color += vec3(uBlacks * 0.0025 * blackMask);
            color += vec3(uWhites * 0.0025 * whiteMask);

            // COLOR — Temperature and Tint
            float temperature = uTemperature * 0.01;
            float tint = uTint * 0.01;

            color += temperature * vec3(0.10, 0.025, -0.10);
            color += tint * vec3(0.055, -0.08, 0.055);

            // COLOR — Saturation

            float sat = uSaturation * 0.01;
            float gray = luminance(color);

            color = mix(vec3(gray), color, max(0.0, 1.0 + sat));

            // COLOR — Vibrance
            float vibrance = uVibrance * 0.01;

            float maxChannel = max(color.r, max(color.g, color.b));
            float minChannel = min(color.r, min(color.g, color.b));
            float chroma = maxChannel - minChannel;

            // Protect highly saturated colors from excessive boosting
            float protection = 1.0 - smoothstep(0.0, 0.8, chroma);
            float vibranceStrength = vibrance >= 0.0
                ? vibrance * protection
                : vibrance;

            float currentLuma = luminance(color);
            color = mix(
                vec3(currentLuma),
                color,
                max(0.0, 1.0 + vibranceStrength)
            );


            // DETAILS — Neighbor sampling

            vec2 px = uTexelSize;

            // Immediate neighbors for fine detail
            vec3 left   = texture(uImage, vUV - vec2(px.x, 0.0)).rgb;
            vec3 right  = texture(uImage, vUV + vec2(px.x, 0.0)).rgb;
            vec3 top    = texture(uImage, vUV + vec2(0.0, px.y)).rgb;
            vec3 bottom = texture(uImage, vUV - vec2(0.0, px.y)).rgb;

            vec3 fineBlur = (src.rgb * 4.0 + left + right + top + bottom) / 8.0;

            // Sharpening — fine edge enhancement
            float sharpAmount = uSharpening * 0.01;
            vec3 sharpDetail = src.rgb - fineBlur;

            // Reduce sharpening of very small differences
            float sharpEdge = smoothstep(0.005, 0.04, length(sharpDetail));
            color += sharpDetail * sharpAmount * 2.0 * sharpEdge;

            // Texture — fine-frequency enhancement or softening
            float textureAmount = uTexture * 0.01;
            vec3 textureDetail = src.rgb - fineBlur;
            color += textureDetail * textureAmount * 1.5;

            // Clarity — wider local contrast
            vec2 radius = px * 4.0;

            vec3 wideLeft = texture(uImage, vUV - vec2(radius.x, 0.0)).rgb;
            vec3 wideRight = texture(uImage, vUV + vec2(radius.x, 0.0)).rgb;
            vec3 wideTop = texture(uImage, vUV + vec2(0.0, radius.y)).rgb;
            vec3 wideBottom = texture(uImage, vUV - vec2(0.0, radius.y)).rgb;

            vec3 localAverage = (
                src.rgb * 2.0 +
                wideLeft + wideRight + wideTop + wideBottom
            ) / 6.0;

            float clarityAmount = uClarity * 0.01;
            float localDifference = luminance(src.rgb) - luminance(localAverage);

            // Focus clarity primarily on midtones
            float midtoneMask = 1.0 - smoothstep(0.15, 0.65, abs(luminance(src.rgb) - 0.5));

            color += vec3(localDifference * clarityAmount * 1.8 * midtoneMask);


            // EFFECTS — Dehaze
            
            float dehaze = uDehaze * 0.01;
            float dehazeStrength = abs(dehaze);

            if (dehaze > 0.0) {
                // Increase contrast and restore color intensity
                float contrastBoost = 1.0 + dehazeStrength * 0.55;
                color = (color - 0.5) * contrastBoost + 0.5;

                float luma = luminance(color);
                color = mix(vec3(luma), color, 1.0 + dehazeStrength * 0.25);
            } else if (dehaze < 0.0) {
                // Introduce a soft atmospheric haze
                color = mix(color, vec3(0.78, 0.82, 0.86), dehazeStrength * 0.45);
            }

            // EFFECTS — Fade
            float fade = clamp(uFade * 0.01, 0.0, 1.0);

            // Lift blacks and gently compress tonal range
            color = color * (1.0 - fade * 0.18) + vec3(fade * 0.16);

            // EFFECTS — Vignette
            float vignette = uVignette * 0.01;

            // Aspect-corrected distance from image center
            vec2 centeredUV = vUV - 0.5;
            float aspect = uTexelSize.y / max(uTexelSize.x, 0.000001);

            vec2 vignetteUV = centeredUV;
            vignetteUV.x *= aspect;

            float cornerDistance = length(vec2(0.5 * aspect, 0.5));
            float normalizedDistance = length(vignetteUV) / max(cornerDistance, 0.000001);

            float vignetteMask = smoothstep(0.25, 1.0, normalizedDistance);

            if (vignette < 0.0) {
                // Negative values darken edges
                color *= 1.0 - vignetteMask * abs(vignette) * 0.85;
            } else if (vignette > 0.0) {
                // Positive values brighten edges
                color = mix(color, vec3(1.0), vignetteMask * vignette * 0.55);
            }

            // EFFECTS — Grain
            float grain = clamp(uGrain * 0.01, 0.0, 1.0);

            if (grain > 0.0) {
                // Deterministic pseudo-random noise per image pixel
                vec2 pixelPosition = floor(vUV / uTexelSize);

                float noise = fract(
                    sin(dot(pixelPosition, vec2(12.9898, 78.233))) * 43758.5453
                );

                noise = noise * 2.0 - 1.0;

                // More visible in midtones, reduced in deep shadows and highlights
                float grainLuma = luminance(clamp(color, 0.0, 1.0));
                float grainMask = 1.0 - abs(grainLuma - 0.5) * 1.2;

                color += vec3(noise * grain * 0.12 * max(0.0, grainMask));
            }

            // Final output — preserve original transparency
            outColor = vec4(clamp(color, 0.0, 1.0), src.a);



        }`;

    function compile(type, source) {
        const shader = gl.createShader(type);
        gl.shaderSource(shader, source);
        gl.compileShader(shader);

        if (!gl.getShaderParameter(shader, gl.COMPILE_STATUS)) {
            const error = gl.getShaderInfoLog(shader);
            gl.deleteShader(shader);
            throw new Error(error);
        }

        return shader;
    }

    function init() {
        if (unavailable) return false;
        if (gl && program) return true;

        try {
            gpuCanvas = document.createElement('canvas');

            gl = gpuCanvas.getContext('webgl2', {
                alpha: true,
                premultipliedAlpha: false,
                preserveDrawingBuffer: true,
                antialias: false,
                depth: false,
                stencil: false
            });

            if (!gl) throw new Error('WebGL2 unavailable');

            const vs = compile(gl.VERTEX_SHADER, vertexSource);
            const fs = compile(gl.FRAGMENT_SHADER, fragmentSource);

            program = gl.createProgram();

            gl.attachShader(program, vs);
            gl.attachShader(program, fs);
            gl.linkProgram(program);

            gl.deleteShader(vs);
            gl.deleteShader(fs);

            if (!gl.getProgramParameter(program, gl.LINK_STATUS)) {
                throw new Error(gl.getProgramInfoLog(program));
            }

            uniforms = Object.fromEntries(
                KEYS.map(name => [
                    name,
                    gl.getUniformLocation(program, 'u' + name)
                ])
            );

            texture = gl.createTexture();

            gl.bindTexture(gl.TEXTURE_2D, texture);
            gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR);
            gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
            gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
            gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);

            gl.useProgram(program);
            gl.uniform1i(gl.getUniformLocation(program, 'uImage'), 0);

            gpuCanvas.addEventListener('webglcontextlost', event => {
                event.preventDefault();
                gl = null;
                program = null;
                texture = null;
                uniforms = null;
            });

            return true;

        } catch (error) {
            unavailable = true;

            if (!warned) {
                console.warn('PhotoCook Adjust: GPU processing unavailable.', error);
                warned = true;
            }

            return false;
        }
    }

    function getProcessedImage(layer) {
        if (!layer?.img || layer.type === 'text') {
            return layer?.img || null;
        }

        const settings = layer.adjustments || {};

        const values = KEYS.map(name => {
            const value = Number(settings[name] ?? 0);
            return Number.isFinite(value) ? value : 0;
        });

        // No adjustments: draw the original image
        if (values.every(value => value === 0)) return layer.img;

        const image = layer.img;
        const width = image.naturalWidth || image.videoWidth || image.width;
        const height = image.naturalHeight || image.videoHeight || image.height;

        if (!width || !height || !init()) return image;

        const key = values.join(',');
        const old = cache.get(layer);

        // Reuse the previous result when nothing has changed
        if (
            old &&
            old.image === image &&
            old.key === key &&
            old.width === width &&
            old.height === height
        ) {
            return old.canvas;
        }

        try {
            const maxSize = gl.getParameter(gl.MAX_TEXTURE_SIZE);
            const scale = Math.min(1, maxSize / Math.max(width, height));

            const w = Math.max(1, Math.floor(width * scale));
            const h = Math.max(1, Math.floor(height * scale));

            gpuCanvas.width = w;
            gpuCanvas.height = h;

            gl.viewport(0, 0, w, h);
            gl.disable(gl.BLEND);
            gl.useProgram(program);

            gl.activeTexture(gl.TEXTURE0);
            gl.bindTexture(gl.TEXTURE_2D, texture);

            gl.pixelStorei(gl.UNPACK_FLIP_Y_WEBGL, true);
            gl.pixelStorei(gl.UNPACK_PREMULTIPLY_ALPHA_WEBGL, false);

            gl.texImage2D(
                gl.TEXTURE_2D,
                0,
                gl.RGBA,
                gl.RGBA,
                gl.UNSIGNED_BYTE,
                image
            );


            KEYS.forEach((name, i) => {
                gl.uniform1f(uniforms[name], values[i]);
            });

            gl.uniform2f(
                gl.getUniformLocation(program, 'uTexelSize'),
                1 / w,
                1 / h
            );

            gl.drawArrays(gl.TRIANGLES, 0, 3);


            // Copy the processed GPU result to a Canvas2D-compatible image
            const result = document.createElement('canvas');
            result.width = w;
            result.height = h;

            result.getContext('2d').drawImage(gpuCanvas, 0, 0);

            cache.set(layer, {
                image,
                key,
                width,
                height,
                canvas: result
            });

            return result;

        } catch (error) {
            console.warn('PhotoCook Adjust: Processing failed.', error);
            return image;
        }
    }

    function invalidate(layer) {
        if (layer) cache.delete(layer);
    }

    return {
        getProcessedImage,
        invalidate,
        isSupported: () => init()
    };
})();
