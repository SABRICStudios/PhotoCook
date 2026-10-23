/* PhotoCook — Import Module */
window.PhotoCookImport = (() => {
    'use strict';

    let canvasElement = null;
    let fileInput = null;
    let imageLayers = []; // Stores all active image objects on the canvas

    /**
     * Creates a hidden file input element configured for multiple images
     */
    function createFileInput() {
        const input = document.createElement('input');
        input.type = 'file';
        input.accept = 'image/*';
        input.multiple = true;
        input.style.display = 'none';
        document.body.appendChild(input);
        return input;
    }

    /**
     * Redraws the entire canvas from scratch containing the white background 
     * and all accumulated image layers in order.
     */
    function redrawCanvas() {
        if (!canvasElement) return;

        const ctx = canvasElement.getContext('2d');
        const canvasWidth = canvasElement.width;
        const canvasHeight = canvasElement.height;

        // 1. Reset canvas with white background
        ctx.fillStyle = '#ffffff';
        ctx.fillRect(0, 0, canvasWidth, canvasHeight);

        // 2. Draw every image layer in sequence
        imageLayers.forEach((img) => {
            const scale = Math.min(canvasWidth / img.width, canvasHeight / img.height);
            const drawWidth = img.width * scale;
            const drawHeight = img.height * scale;

            const x = (canvasWidth - drawWidth) / 2;
            const y = (canvasHeight - drawHeight) / 2;

            ctx.drawImage(img, x, y, drawWidth, drawHeight);
        });
    }

    /**
     * Handles file selection for multiple files
     */
    function handleFileSelect(event) {
        const files = event.target.files;
        if (!files || files.length === 0) return;

        const fileArray = Array.from(files).filter(file => file.type.startsWith('image/'));
        if (fileArray.length === 0) return;

        let loadedCount = 0;

        fileArray.forEach((file) => {
            const reader = new FileReader();

            reader.onload = (e) => {
                const img = new Image();
                img.onload = () => {
                    // Add to our persistent layers array
                    imageLayers.push(img);
                    loadedCount++;

                    // Once all newly selected files are loaded into memory, redraw the canvas once
                    if (loadedCount === fileArray.length) {
                        redrawCanvas();
                    }
                };
                img.src = e.target.result;
            };

            reader.readAsDataURL(file);
        });

        // Reset input value so selecting the same files again works correctly
        fileInput.value = '';
    }

    /**
     * Initializes the Import module
     * @param {HTMLCanvasElement} canvas 
     * @param {string} triggerButtonId 
     */
    function init(canvas, triggerButtonId = 'add-img') {
        canvasElement = canvas;
        imageLayers = []; // Reset layers on fresh init
        const addBtn = document.getElementById(triggerButtonId);

        if (!addBtn) {
            console.warn(`PhotoCookImport: Trigger button #${triggerButtonId} not found.`);
            return;
        }

        // Create file input element once
        if (!fileInput) {
            fileInput = createFileInput();
            fileInput.addEventListener('change', handleFileSelect);
        }

        // Attach click listener to the '+' add-img button
        addBtn.addEventListener('click', () => {
            fileInput.click();
        });
    }

    return {
        init,
        redrawCanvas
    };
})();