/* PhotoCook — Canvas Selection Script */
(() => {
    'use strict';

    const cards = document.querySelectorAll('.canvas_card');
    const selectBtn = document.getElementById('canvas_selection_btn');
    
    // Modal & Custom Input Elements
    const modalOverlay = document.getElementById('freesize_modal_overlay');
    const applyCustomBtn = document.getElementById('custom-dimension-apply-btn');
    const cancelCustomBtn = document.getElementById('cd-cancle-btn');
    const inputHeight = document.getElementById('height');
    const inputWidth = document.getElementById('width');

    let selectedWidth = 1080;
    let selectedHeight = 1080;
    let isFreeSizeSelected = false;

    // Default to the 1:1 card initially (index 1)
    if (cards.length > 1) {
        cards[1].classList.add('active');
        updateDimensions(cards[1]);
    }

    // Handle card click selection
    cards.forEach(card => {
        card.addEventListener('click', () => {
            cards.forEach(c => c.classList.remove('active'));
            card.classList.add('active');
            updateDimensions(card);
        });
    });

    function updateDimensions(card) {
        const pText = card.querySelector('p').textContent.trim();
        
        if (pText.includes('Free Size')) {
            isFreeSizeSelected = true;
        } else {
            isFreeSizeSelected = false;
            // Parse dimensions from text like "1080 × 1080"
            const parts = pText.split('×').map(val => parseInt(val.trim(), 10));
            if (parts.length === 2 && !isNaN(parts[0]) && !isNaN(parts[1])) {
                selectedWidth = parts[0];
                selectedHeight = parts[1];
            }
        }
    }

    // When "Select Canvas" button is clicked
    if (selectBtn) {
        selectBtn.addEventListener('click', () => {
            if (isFreeSizeSelected) {
                // Open the custom canvas dimension modal overlay
                if (modalOverlay) {
                    modalOverlay.classList.add('active');
                    inputHeight.focus();
                }
            } else {
                // Save preset dimensions and go straight to editor
                saveAndRedirect(selectedWidth, selectedHeight);
            }
        });
    }

    // When "Apply Dimension" is clicked inside the Free Size modal
    if (applyCustomBtn) {
        applyCustomBtn.addEventListener('click', () => {
            const hVal = parseInt(inputHeight.value, 10);
            const wVal = parseInt(inputWidth.value, 10);

            if (hVal > 0 && wVal > 0) {
                selectedHeight = hVal;
                selectedWidth = wVal;
                
                // Save custom dimensions and open editor
                saveAndRedirect(selectedWidth, selectedHeight);
            } else {
                alert('Please enter valid positive numbers for height and width.');
            }
        });
    }

    // When "Cancel" button is clicked inside the Free Size modal
    if (cancelCustomBtn) {
        cancelCustomBtn.addEventListener('click', () => {
            if (modalOverlay) {
                modalOverlay.classList.remove('active');
                // Clear inputs on cancel (optional)
                inputHeight.value = '';
                inputWidth.value = '';
            }
        });
    }

    // Also close modal if clicking outside the modal box on the dark overlay
    if (modalOverlay) {
        modalOverlay.addEventListener('click', (e) => {
            if (e.target === modalOverlay) {
                modalOverlay.classList.remove('active');
            }
        });
    }

    function saveAndRedirect(width, height) {
        const settings = {
            width: width,
            height: height
        };
        sessionStorage.setItem('photocookCanvasSettings', JSON.stringify(settings));
        window.location.href = 'photo-editor.html';
    }
})();