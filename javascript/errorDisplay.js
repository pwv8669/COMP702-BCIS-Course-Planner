import { validateStudyPlan } from './planValidator.js';
import { state } from './state.js';
import { SaveFile } from './filehandler.js';

//Gets the Gets the error list container from the html and the error list from validateStudyPlan() populates it with error messages by calling renderErrors()
export function errorDisplay()
{
    const errors = validateStudyPlan();

    //removes all old errors from the list before populating with new ones. This way duplicate errors are not shown
    clearPreviousErrors();

    const errorTextContainer = document.getElementById('error-list-container');
    if (errorTextContainer) {
        errorTextContainer.innerHTML = '';
    }

    //if there are no errors at all display a success message to the user
    if (!errors || errors.length === 0) {
        if (errorTextContainer) {
            errorTextContainer.innerHTML = '<p class="success-msg"> All requirements met!</p>';
        }
        return errors;
    }

    renderErrors(errors);
    return errors;
}

function clearPreviousErrors() {
    // Clear all color codes
    document.querySelectorAll('.cell-red-error').forEach(c => c.classList.remove('cell-red-error'));
    document.querySelectorAll('.cell-yellow-warning').forEach(c => c.classList.remove('cell-yellow-warning'));
}

/*This function populates the error list on the html with the error list 
passed in from errorDisplay each entry gets an ignore button which when pressed 
opens a note creation panel.

*/
function renderErrors(errorList) {
    const container = document.getElementById("error-list-container");
    container.innerHTML = "";

    for (const error of errorList) {

        //Classifying error message type using string comparison. may change the error object struct to contain colour types instead. that way they could be more easily changed
        const isPrereqOrDuplicate =
            error.message.toLowerCase().includes('prerequisites') ||
            error.message.toLowerCase().includes('corequisites') ||
            error.message.toLowerCase().includes('appears') ||
            error.message.toLowerCase().includes('major');

        const div = document.createElement("div");

        //Colouring based on type of error message
        div.className = isPrereqOrDuplicate
            ? "error-text-item red-alert"
            : "error-text-item yellow-alert";

        div.dataset.errorId = error.id;

        div.innerHTML = 
        `   <span>${error.message}</span>
            <button class="ignore-error-btn">Ignore</button>`;

        container.appendChild(div);

        //Schedule table highlighting of errors
        if (error.positions) {
            error.positions.forEach((row, semIndex) => {
                row.forEach((isError, slotIndex) => {
                    if (isError) {
                        const cellId = `cell-${semIndex}-${slotIndex}`;
                        const cell = document.getElementById(cellId);

                        if (cell) {
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
    }

    // Attaching ignore button listeners
    document.querySelectorAll(".ignore-error-btn").forEach(btn => {
        btn.addEventListener("click", e => {
            const errorId = e.target.closest(".error-text-item").dataset.errorId;
            openIgnoreModal(errorId);
        });
    });
}

//This function populates the html ignored error list and adds delete buttons to each entry.
export function renderIgnoredErrors() {
    const container = document.getElementById("ignored-errors-list");
    if (!container) return;

    container.innerHTML = "";

    const entries = Object.entries(state.ignoredErrors);

    if (entries.length === 0) {
        container.innerHTML = "<p>No ignored errors.</p>";
        return;
    }

    for (const [id, data] of entries) {
        const div = document.createElement("div");
        div.className = "ignored-error-item";

        //This is the structuring for ignored errors (how they are shown to the user)
        div.innerHTML = `
            <strong>${id}</strong><br>
            <span>${data.note}</span><br>
            <small>${new Date(data.timestamp).toLocaleString()}</small>
            <button class="delete-ignored-btn" data-error-id="${id}">Delete</button>
        `;

        container.appendChild(div);
    }

    // Delete button logic
    document.querySelectorAll(".delete-ignored-btn").forEach(btn => {
        btn.addEventListener("click", e => {
            const id = e.target.dataset.errorId;

            delete state.ignoredErrors[id];

            renderIgnoredErrors();
            errorDisplay();
        });
    });
}


//shows the note creation page when the ignore button is pressed on a particular error.

let currentErrorId = null;

function openIgnoreModal(errorId) {
    currentErrorId = errorId;
    document.getElementById("ignoreModal").classList.remove("hidden");
}

//When a note is added to an ignored error the error is removed from the error list this is done via validateStudyPlan()
document.getElementById("saveIgnoreNoteBtn").addEventListener("click", () => {
    const noteInput = document.getElementById("ignoreNoteInput");
    const note = noteInput.value.trim();

    if (!note) {
        alert("Please add a note before saving.");
        return;
    }

    //This stores the ignored error id and note into state so that when the plan is validated errors resolved via note will not show
    state.ignoredErrors[currentErrorId] = {
        note: note,
        timestamp: Date.now()
    };
    renderIgnoredErrors();

    //Removing the error from the UI
    const errorDiv = document.querySelector(`[data-error-id="${currentErrorId}"]`);
    if (errorDiv) {
        errorDiv.remove();
    }

    //Hiding the modal
    document.getElementById("ignoreModal").classList.add("hidden");

    //Clearing the text
    noteInput.value = "";

});
//Adding event listener to the cancel button on the note creation page. If pressed adds hidden attribute to the modal
document.getElementById("cancelIgnoreBtn").addEventListener("click", () => {
    document.getElementById("ignoreModal").classList.add("hidden");
    document.getElementById("ignoreNoteInput").value = "";
});
