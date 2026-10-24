/* PhotoCook — Import Module */
window.PhotoCookImport = (() => {
    'use strict';

    let fileInput = null;

    function createFileInput() {
        const input = document.createElement('input');
        input.type = 'file';
        input.accept = 'image/*';
        input.multiple = true;
        input.style.display = 'none';
        document.body.appendChild(input);
        return input;
    }

    function init(triggerButtonId = 'add-img', onImageReady) {
        const addBtn = document.getElementById(triggerButtonId);
        if (!addBtn) {
            console.warn(`PhotoCookImport: Trigger button #${triggerButtonId} not found.`);
            return;
        }

        if (!fileInput) {
            fileInput = createFileInput();
            fileInput.addEventListener('change', (e) => {
                const files = e.target.files;
                if (!files || files.length === 0) return;

                Array.from(files).forEach((file) => {
                    if (!file.type.startsWith('image/')) return;
                    const reader = new FileReader();
                    reader.onload = (event) => {
                        const img = new Image();
                        img.onload = () => {
                            if (typeof onImageReady === 'function') {
                                onImageReady(img);
                            }
                        };
                        img.src = event.target.result;
                    };
                    reader.readAsDataURL(file);
                });

                fileInput.value = '';
            });
        }

        addBtn.addEventListener('click', () => {
            fileInput.click();
        });
    }

    return { init };
})();