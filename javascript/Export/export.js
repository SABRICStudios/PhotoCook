/* PhotoCook — Export Module */
(() => {
    'use strict';

    let isExporting = false; // Lock flag to prevent multiple triggers

    window.PhotoCookExport = {
        init(canvas, actualWidth, actualHeight) {
            const exportBtn = document.getElementById('export-btn');
            if (!exportBtn || !canvas) return;

            // Prevent attaching the listener multiple times if init() is called more than once
            if (exportBtn.dataset.listenerAttached === 'true') return;
            exportBtn.dataset.listenerAttached = 'true';

            exportBtn.addEventListener('click', async (e) => {
                e.preventDefault();
                e.stopPropagation();

                // If an export is already in progress, ignore this click entirely
                if (isExporting) return;
                isExporting = true;

                const fileName = `photocook-${actualWidth}x${actualHeight}.png`;

                try {
                    // 1. Hide selection outlines and move handles for a clean export view
                    if (window.PhotoCookInteraction && window.PhotoCookInteraction.redrawCanvas) {
                        window.PhotoCookInteraction.redrawCanvas(true);
                    }

                    // 2. Generate the blob from the canvas first
                    const cleanBlob = await new Promise((resolve, reject) => {
                        if (!canvas.width || !canvas.height) {
                            reject(new Error('Export canvas has zero dimensions.'));
                            return;
                        }

                        canvas.toBlob(blob => {
                            if (!blob || blob.size === 0) {
                                reject(new Error('Canvas produced an empty PNG.'));
                                return;
                            }
                            resolve(blob);
                        }, 'image/png');
                    });

                    // 3. Restore normal canvas view
                    if (window.PhotoCookInteraction && window.PhotoCookInteraction.redrawCanvas) {
                        window.PhotoCookInteraction.redrawCanvas(false);
                    }

                    // 4. Standard robust download trigger (avoids 0-byte ghost files and permission errors)
                    const url = URL.createObjectURL(cleanBlob);
                    const link = document.createElement('a');

                    link.href = url;
                    link.download = fileName;
                    link.style.display = 'none';

                    document.body.appendChild(link);
                    link.click();

                    setTimeout(() => {
                        link.remove();
                        URL.revokeObjectURL(url);
                    }, 1500);

                } catch (err) {
                    if (window.PhotoCookInteraction && window.PhotoCookInteraction.redrawCanvas) {
                        window.PhotoCookInteraction.redrawCanvas(false);
                    }
                    console.error('Export failed:', err);
                } finally {
                    isExporting = false;
                }
            });
        }
    };
})();