import { validateStudyPlan } from './planValidator.js';

export function errorDisplay()
{
    const errors = validateStudyPlan();

    clearPreviousErrors();

    const errorTextContainer = document.getElementById('error-list-container');
    if (errorTextContainer) {
        errorTextContainer.innerHTML = '';
    }

    if (!errors || errors.length === 0) {
        if (errorTextContainer) {
            errorTextContainer.innerHTML = '<p class="success-msg"> All requirements met!</p>';
        }
        return errors;
    }

    errors.forEach(errorObj => {
        // Determine error classification
        const isPrereqOrDuplicate = 
            errorObj.message.toLowerCase().includes('prerequisites') || 
            errorObj.message.toLowerCase().includes('appears');

        // Renders the text element with specific theme classes
        if (errorTextContainer) {
            const msgDiv = document.createElement('div');
            // Assigns 'error-red' for prequisite and duplicate errors, or 'warning-yellow' for anything else
            msgDiv.className = isPrereqOrDuplicate ? 'error-text-item red-alert' : 'error-text-item yellow-alert';
            msgDiv.textContent = errorObj.message;
            errorTextContainer.appendChild(msgDiv);
        }

        //Highlights grid positions if the error object contains positional data
        if (errorObj.positions) {
            errorObj.positions.forEach((row, semIndex) => {
                row.forEach((isError, slotIndex) => {
                    if (isError) {
                        const cellId = `cell-${semIndex}-${slotIndex}`;
                        const cell = document.getElementById(cellId);
                        
                        if (cell) {
                            // Apply red for prerequisites/duplicates, yellow for amything else
                            if (isPrereqOrDuplicate) {
                                cell.classList.add('cell-red-error');
                            } else {
                                cell.classList.add('cell-yellow-warning');
                            }
                        }
                    }
                });
            });
        }
    });

    return errors;
}

function clearPreviousErrors() {
    // Clear all color codes
    document.querySelectorAll('.cell-red-error').forEach(c => c.classList.remove('cell-red-error'));
    document.querySelectorAll('.cell-yellow-warning').forEach(c => c.classList.remove('cell-yellow-warning'));
}
