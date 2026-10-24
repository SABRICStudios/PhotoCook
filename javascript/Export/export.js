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
                    // 1. Hide selection outlines and move handles for a clean export
                    if (window.PhotoCookInteraction && window.PhotoCookInteraction.redrawCanvas) {
                        window.PhotoCookInteraction.redrawCanvas(true); // true = isExporting
                    }

                    // Check if the browser supports the File System Access API (Desktop browsers like Chrome, Edge, etc.)
                    if (window.showSaveFilePicker) {
                        const options = {
                            suggestedName: fileName,
                            types: [{
                                description: 'PNG Image',
                                accept: { 'image/png': ['.png'] },
                            }],
                        };
                        
                        // Open native "Save As" picker
                        const handle = await window.showSaveFilePicker(options);
                        const writable = await handle.createWritable();
                        
                        // Convert canvas to blob and write to disk
                        await new Promise((resolve, reject) => {
                            canvas.toBlob(async (blob) => {
                                if (!blob) {
                                    reject(new Error('Canvas blob creation failed'));
                                    return;
                                }
                                try {
                                    await writable.write(blob);
                                    await writable.close();
                                    resolve();
                                } catch (err) {
                                    reject(err);
                                }
                            }, 'image/png');
                        });

                    } else {
                        // Fallback for Mobile devices or browsers that don't support showSaveFilePicker
                        const link = document.createElement('a');
                        link.download = fileName;
                        link.href = canvas.toDataURL('image/png');
                        document.body.appendChild(link);
                        link.click();
                        document.body.removeChild(link);
                    }

                } catch (err) {
                    // If user cancels the picker (AbortError), ignore it gracefully
                    if (err.name !== 'AbortError') {
                        console.error('Export failed:', err);
                    }
                } finally {
                    // 2. Restore normal canvas view (brings back selection handles on screen)
                    if (window.PhotoCookInteraction && window.PhotoCookInteraction.redrawCanvas) {
                        window.PhotoCookInteraction.redrawCanvas(false); // false = normal view
                    }
                    // Release the lock once finished or cancelled
                    isExporting = false;
                }
            });
        }
    };
})();