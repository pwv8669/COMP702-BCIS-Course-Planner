import { refreshStudyPlan } from './app.js';
import { state, scheduleConfig } from './state.js';
import { importschedule, getSelectedPathwayCode, getCode } from './filehandler.js';

/*This code handles all the premade studyplan template buttons it dynamically generates
buttons based on the stored files in the json templates folder of the web app.
This means study plans can be saved to the web app itself so that other programme leads can easily 
share their unique solutions to common circumstances for students*/




// initTemplatesController: Function that sets up the functionalities for saving and loading of the given templates
function initTemplatesController() {
    //selecting the relevant html elements
    const panel = document.getElementById('templates');
    const openTemplates = document.getElementById('openTemplates');
    const closeTemplates = document.getElementById('closeTemplates');
    const btnContainer = document.getElementById('templateBtnContainer');

    // Adding eventlisteners to the "Save" pop up window
    const saveModal = document.getElementById('saveModal');
    const openSave = document.getElementById('openSave');
    const closeSaveModal = document.getElementById('closeSaveModal');
    
    // Adding eventlisteners to the "Editor" pop up window
    const editorModal = document.getElementById('editorModal');
    const openEditor = document.getElementById('openEditor');
    const closeEditorModal = document.getElementById('closeEditorModal');
    
    // Adding event listeners to "File" pop up window
    const fileModal = document.getElementById('fileModal');
    const openFileFunctions = document.getElementById('openFileFunctions');
    const closeFileModal = document.getElementById('closeFileModal');


    const templateInput = document.getElementById('localJsonFileInput');
    const uploadForm = document.getElementById('uploadTemplateForm');
    const saveBtn = document.getElementById('saveTemplateBtn'); 

    // adding event listeners to the open, close, upload, and save buttons
    if (openTemplates && panel) {
        openTemplates.addEventListener('click', () => {
            panel.showModal();
            fetchServerTemplates(); 
        });
    }

    if (openSave && saveModal) {
        openSave.addEventListener('click', () => {
            saveModal.showModal();
        });
    }

    if (openEditor && editorModal) {
        openEditor.addEventListener('click', () => {
            editorModal.showModal();
        });
    }

    if (openFileFunctions && fileModal) {
        openFileFunctions.addEventListener('click', () => {
            fileModal.showModal();
        });
    }


    if (closeTemplates && panel) {
        closeTemplates.addEventListener('click', () => panel.close());
    }

    if (closeSaveModal && saveModal) {
        closeSaveModal.addEventListener('click', () => {
            saveModal.close();
        });
    }

    if (closeEditorModal && editorModal) {
        closeEditorModal.addEventListener('click', () => {
            editorModal.close();
        });
    }

    if (closeFileModal && fileModal) {
        closeFileModal.addEventListener('click', () => {
            fileModal.close();
        });
    }

    if (uploadForm) {
        uploadForm.addEventListener('submit', (e) => {
            e.preventDefault();
            handleTemplateUpload();
        });
    }

    if (saveBtn) {
        saveBtn.addEventListener('click', async () => {
            const fileNameInput = prompt("Enter a unique filename for your study plan layout:");
            if (fileNameInput) {
                await saveCurrentTemplateToServer(fileNameInput);
            }
        });
    }

    // storage and fetch

    async function saveCurrentTemplateToServer(customName) {
        if (!customName) {
            alert("Please provide a valid file name.");
            return;
        }

        const selectedPathway = getSelectedPathwayCode();
        if (!selectedPathway) {
            alert("Please select a pathway before saving a template.");
            return;
        }

        const payload = {
            filename: customName,
            selectedPathway,
            selectedMajors: state.selectedMajors.map(getCode),
            selectedMinors: state.selectedMinors.map(getCode),
            selectedElectives: state.selectedElectives.map(getCode),
            schedule: state.coursePlan.map(semester =>
                semester.map(course => getCode(course))
            ),
            mode: scheduleConfig.mode,
            ignoredErrors: state.ignoredErrors ?? {}
        };

        try {
            const response = await fetch('./php/save_template.php', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(payload)
            });

            const result = await response.json();
            if (!response.ok) {
                throw new Error(result.error || "Server storage failed.");
            }

            alert(result.message);
            if (panel?.open) await fetchServerTemplates();
        } catch (error) {
            console.error("Save Operation Error:", error);
            alert(`Failed to save: ${error.message}`);
        }
    }


    async function fetchServerTemplates() {
        if (!btnContainer) return;
        btnContainer.innerHTML = 'Searching templates directory...';

        try {
            const response = await fetch('./php/get_templates.php');
            if (!response.ok) throw new Error("Failed to scan templates directory.");
            
            const files = await response.json();
            if (!Array.isArray(files)) {
                throw new Error("Template scanner returned invalid data.");
            }
            btnContainer.innerHTML = ''; 

            if (files.length === 0) {
                btnContainer.innerHTML = '<p style="color:#777; font-size:calc(1.4 * var(--scale));">No templates found.</p>';
                return;
            }

            files.forEach(file => {
                const btn = document.createElement('button');
                btn.type = 'button';
                btn.style.margin = 'calc(.5 * var(--scale))';
                btn.textContent = file.display_name; 

                btn.addEventListener('click', async () => {
                    try {
                        const fileResponse = await fetch(file.filepath);
                        if (!fileResponse.ok) throw new Error("Could not load template file.");
                        
                        const templateData = await fileResponse.json();
                        importschedule(templateData);
                        await refreshStudyPlan();
                        if (panel.open) panel.close();
                    } catch (err) {
                        console.error(`Failed to process template file: ${file.filepath}`, err);
                        alert(`Incompatible template: ${err.message}`);
                    }
                });
                btnContainer.appendChild(btn);
            });
        } catch (error) {
            console.error("Error communicating with template scanner:", error);
            btnContainer.innerHTML = '<p style="color:red; font-size:calc(1.4 * var(--scale));">Error connecting to templates folder.</p>';
        }
    }

    // Reads an uploaded offline file directly from the user device storage
    function handleTemplateUpload() {
        if (!templateInput || templateInput.files.length === 0) {
            alert("Please select a valid JSON template file first.");
            return;
        }

        const file = templateInput.files[0];
        const reader = new FileReader();

        reader.onload = async function (event) {
            try {
                const templateData = JSON.parse(event.target.result);
                importschedule(templateData);
                await refreshStudyPlan();
                if (panel?.open) panel.close();
            } catch (error) {
                console.error("Malformed JSON file layout:", error);
                alert(`Invalid template: ${error.message}`);
            }
        };
        reader.readAsText(file);
    }

    
}

if (document.readyState === 'loading') {
    document.addEventListener(
        'DOMContentLoaded',
        initTemplatesController,
        { once: true }
    );
} else {
    initTemplatesController();
}
