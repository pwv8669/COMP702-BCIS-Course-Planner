import { placeCourse, PathwayRefresh, refreshStudyPlan } from './app.js';
import { renderCoursePlan } from './renderCoursePlan.js';
import { state, Pathways } from './state.js';
import { initDragAndDrop } from './dragAndDropController.js';
import { importschedule } from './filehandler.js';

/*This code handles all the premade studyplan template buttons it dynamically generates
buttons based on the stored files in the json templates folder of the web app.
This means study plans can be saved to the web app itself so that other programme leads can easily 
share their unique solutions to common circumstances for students*/
document.addEventListener('DOMContentLoaded', () => {
    //selecting the relevant html elements
    const panel = document.getElementById('templates');
    const openTemplates = document.getElementById('openTemplates');
    const closeTemplates = document.getElementById('closeTemplates');
    const btnContainer = document.getElementById('templateBtnContainer');
    
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

    if (closeTemplates && panel) {
        closeTemplates.addEventListener('click', () => panel.close());
    }

    if (uploadForm) {
        uploadForm.addEventListener('submit', (e) => {
            e.preventDefault();
            handleTemplateUpload();
        });
    }

    if (saveBtn) {
        saveBtn.addEventListener('click', () => {
            const fileNameInput = prompt("Enter a unique filename for your study plan layout:");
            if (fileNameInput) {
                saveCurrentTemplateToServer(fileNameInput);
            }
        });
    }

    // storage and fetch

    async function saveCurrentTemplateToServer(customName) {
    if (!customName) return alert("Please provide a valid file name.");

    const cleanedSchedule = (state.coursePlan || []).map(semesterArray => {
        return semesterArray.map(course => {
            if (!course) return null;
            
            return typeof course === 'object' ? (course.code) : course;
        });
    });

    const payload = {
        filename: customName,
        selectedPathway: state.selectedPathway,
        selectedMajors: state.selectedMajors,
        selectedMinors: state.selectedMinors,
        selectedElectives: state.selectedElectives,
        schedule: cleanedSchedule,
        ignoredErrors: state.ignoredErrors
    };

    try {
        const response = await fetch('./php/save_template.php', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(payload)
        });

        const result = await response.json();
        if (!response.ok) throw new Error(result.error || "Server storage failed.");

        alert(result.message);
        if (panel && panel.open) fetchServerTemplates(); 
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
            btnContainer.innerHTML = ''; 

            if (files.length === 0) {
                btnContainer.innerHTML = '<p style="color:#777; font-size:14px;">No templates found.</p>';
                return;
            }

            files.forEach(file => {
                const btn = document.createElement('button');
                btn.type = 'button';
                btn.style.margin = '5px';
                btn.textContent = file.display_name; 

                btn.addEventListener('click', async () => {
                    try {
                        const fileResponse = await fetch(file.filepath);
                        if (!fileResponse.ok) throw new Error("Could not load template file.");
                        
                        const templateData = await fileResponse.json();
                        importschedule(templateData);
                        panel.close(); 
                    } catch (err) {
                        console.error(`Failed to process template file: ${file.filepath}`, err);
                        alert("Incompatible File Structure!");
                    }
                });
                btnContainer.appendChild(btn);
            });
        } catch (error) {
            console.error("Error communicating with template scanner:", error);
            btnContainer.innerHTML = '<p style="color:red; font-size:14px;">Error connecting to templates folder.</p>';
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

        reader.onload = function (event) {
            try {
                const templateData = JSON.parse(event.target.result);
                importschedule(templateData);
                if (panel) panel.close();
            } catch (error) {
                console.error("Malformed JSON file layout:", error);
                alert("Error: The uploaded file is not a valid JSON template.");
            }
        };
        reader.readAsText(file);
    }

    
});
