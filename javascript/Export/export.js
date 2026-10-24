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
                        window.PhotoCookInteraction.redrawCanvas(true); // true = isExporting
                    }

                    // 2. Immediately capture the clean canvas state into a Blob *before* any async picker prompt
                    const cleanBlob = await new Promise((resolve, reject) => {
                        canvas.toBlob((blob) => {
                            if (!blob) reject(new Error('Canvas blob creation failed'));
                            else resolve(blob);
                        }, 'image/png');
                    });

                    // 3. Restore normal canvas view immediately so the UI comes back instantly
                    if (window.PhotoCookInteraction && window.PhotoCookInteraction.redrawCanvas) {
                        window.PhotoCookInteraction.redrawCanvas(false); // false = normal view
                    }

                    // 4. Check if the browser supports the File System Access API (Desktop Chrome/Edge)
                    if (window.showSaveFilePicker) {
                        const options = {
                            suggestedName: fileName,
                            types: [{
                                description: 'PNG Image',
                                accept: { 'image/png': ['.png'] },
                            }],
                        };
                        
                        const handle = await window.showSaveFilePicker(options);
                        const writable = await handle.createWritable();
                        await writable.write(cleanBlob);
                        await writable.close();

                    } else {
                        // Fallback for Mobile devices or browsers without showSaveFilePicker
                        const url = URL.createObjectURL(cleanBlob);
                        const link = document.createElement('a');
                        link.download = fileName;
                        link.href = url;
                        document.body.appendChild(link);
                        link.click();
                        document.body.removeChild(link);
                        URL.revokeObjectURL(url);
                    }

                } catch (err) {
                    // Ensure UI view is restored even if an error/cancellation occurs
                    if (window.PhotoCookInteraction && window.PhotoCookInteraction.redrawCanvas) {
                        window.PhotoCookInteraction.redrawCanvas(false);
                    }
                    // If user cancels the picker (AbortError), ignore it gracefully
                    if (err.name !== 'AbortError') {
                        console.error('Export failed:', err);
                    }
                } finally {
                    // Release the lock once finished or cancelled
                    isExporting = false;
                }
            });
        }
    };
})();