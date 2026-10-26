/* PhotoCook — Crop Module (Inline UI & Aspect Ratios) */
window.PhotoCookCrop = (() => {
    'use strict';

    let cropperInstance = null;
    let activeImageElement = null;
    let cropWrapper = null;
    let subToolbar = null;

    function init(cropButtonId, onCropApplied) {
        const cropBtn = document.getElementById(cropButtonId);
        if (!cropBtn) return;

        cropBtn.addEventListener('click', () => {
            if (!window.PhotoCookLayerManager) return;
            const selectedLayer = window.PhotoCookLayerManager.getSelectedLayer();

            if (!selectedLayer) {
                alert('Please select a layer to crop first.');
                return;
            }

            startCropping(selectedLayer, onCropApplied);
        });
    }

    function startCropping(layer, onCropApplied) {
        destroyCropper();
        window.PhotoCookToolState?.open('crop');

        // 1. Hide main toolbar
        const canvas = document.getElementById('canvas');
        if (!canvas) return;

        const mainToolbar = document.getElementById('toolbar');
        if (mainToolbar) mainToolbar.style.display = 'none';

        // 2. Create inline wrapper positioned exactly over the canvas
        cropWrapper = document.createElement('div');
        cropWrapper.className = 'photocook-crop-wrapper';
        cropWrapper.style.position = 'absolute';
        cropWrapper.style.top = `${canvas.offsetTop}px`;
        cropWrapper.style.left = `${canvas.offsetLeft}px`;
        cropWrapper.style.width = `${canvas.offsetWidth}px`;
        cropWrapper.style.height = `${canvas.offsetHeight}px`;
        cropWrapper.style.overflow = 'hidden';
        cropWrapper.style.zIndex = '100';

        // Create a single unique image element for Cropper.js
        activeImageElement = document.createElement('img');
        activeImageElement.src = layer.img.src;
        // Fix styling so it doesn't tile or repeat
        activeImageElement.style.display = 'block';
        activeImageElement.style.maxHeight = '100%';
        activeImageElement.style.maxWidth = '100%';
        activeImageElement.style.width = '100%';
        activeImageElement.style.height = '100%';
        activeImageElement.style.objectFit = 'contain';

        cropWrapper.appendChild(activeImageElement);
        canvas.parentNode.insertBefore(cropWrapper, canvas.nextSibling);

        // 3. Create Crop Sub-Toolbar with Ratios, Confirm, and Discard
        subToolbar = document.createElement('div');
        subToolbar.id = 'crop-sub-toolbar';

        const ratios = [
            { label: 'Free', value: NaN },
            { label: '1:1', value: 1 / 1 },
            { label: '4:5', value: 4 / 5 },
            { label: '16:9', value: 16 / 9 }
        ];

        ratios.forEach((r, index) => {
                const ratioBtn = document.createElement('button');

                ratioBtn.textContent = r.label;
                ratioBtn.type = 'button';
                ratioBtn.className = 'crop-ratio-btn';

                if (index === 0) {
                    ratioBtn.classList.add('ratio-active');
                }

                ratioBtn.addEventListener('click', () => {
                    subToolbar.querySelectorAll('.crop-ratio-btn')
                        .forEach(btn => btn.classList.remove('ratio-active'));

                    ratioBtn.classList.add('ratio-active');
                    cropperInstance?.setAspectRatio(r.value);
                });

            subToolbar.appendChild(ratioBtn);
        });

        // Confirm (Apply) Button
        const confirmBtn = document.createElement('button');
        confirmBtn.textContent = 'Confirm';
        confirmBtn.type = 'button';
        confirmBtn.className = 'crop-confirm-btn';
        
        confirmBtn.onclick = () => {
        
            if (!cropperInstance) {
                console.error("PhotoCookCrop: Cropper not initialized.");
                return;
            }

            const croppedCanvas = cropperInstance.getCroppedCanvas({
                imageSmoothingEnabled: true,
                imageSmoothingQuality: 'high'
            });

            if (!croppedCanvas || !croppedCanvas.width || !croppedCanvas.height) {
                console.error("PhotoCookCrop: Invalid cropped canvas.");
                return;
            }

            const newImg = new Image();

            newImg.onload = () => {
                try {
                    if (typeof onCropApplied !== 'function') {
                        throw new Error("Crop callback missing.");
                    }

                    onCropApplied(
                        newImg,
                        croppedCanvas.width,
                        croppedCanvas.height,
                        layer
                    );

                    destroyCropper();

                    console.log(
                        `PhotoCook: Crop applied ${croppedCanvas.width}×${croppedCanvas.height}`
                    );
                } catch (error) {
                    console.error("PhotoCook: Crop application failed:", error);
                }
            };

            newImg.onerror = () => {
                console.error("PhotoCook: Failed to load cropped image.");
            };

            newImg.src = croppedCanvas.toDataURL('image/png');
        };

        // Discard (Cancel) Button
        const discardBtn = document.createElement('button');
        discardBtn.textContent = 'Discard';
        discardBtn.type = 'button';
        discardBtn.className = 'crop-discard-btn';
        discardBtn.addEventListener('click', () => {
            destroyCropper();
        });

        subToolbar.appendChild(discardBtn);
        subToolbar.appendChild(confirmBtn);
        document.body.appendChild(subToolbar);

        // 4. Initialize Cropper.js instance cleanly
        cropperInstance = new Cropper(activeImageElement, {
            aspectRatio: NaN,
            viewMode: 1,
            autoCropArea: 0.9,
            responsive: true
        });
    }

    function destroyCropper() {
        if (cropperInstance) {
            cropperInstance.destroy();
            cropperInstance = null;
        }
        if (cropWrapper) {
            cropWrapper.remove();
            cropWrapper = null;
        }
        if (subToolbar) {
            subToolbar.remove();
            subToolbar = null;
        }
        activeImageElement = null;
        window.PhotoCookToolState?.close();

        // Restore main toolbar visibility
        const mainToolbar = document.getElementById('toolbar');
        if (mainToolbar) mainToolbar.style.display = 'flex';
    }

    return {
        init
    };
})();