import { placeCourse, PathwayRefresh } from './app.js';
import { renderCoursePlan } from './renderCoursePlan.js';
import { state, Pathways } from './state.js';

document.addEventListener('DOMContentLoaded', () => {
    // 1. UI ELEMENT SELECTION TARGETS
    const panel = document.getElementById('templates');
    const openTemplates = document.getElementById('openTemplates');
    const closeTemplates = document.getElementById('closeTemplates');
    const btnContainer = document.getElementById('templateBtnContainer');
    
    const templateInput = document.getElementById('localJsonFileInput');
    const uploadForm = document.getElementById('uploadTemplateForm');
    const saveBtn = document.getElementById('saveTemplateBtn'); 

    // 2. UI HOOK INTEGRATIONS & EVENT LISTENERS
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

    // 3. STORAGE & FETCHING FUNCTION PIPELINES

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
        schedule: cleanedSchedule 
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
                        executeScheduleImport(templateData);
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
                executeScheduleImport(templateData);
                if (panel) panel.close();
            } catch (error) {
                console.error("Malformed JSON file layout:", error);
                alert("Error: The uploaded file is not a valid JSON template.");
            }
        };
        reader.readAsText(file);
    }

    function executeScheduleImport(JsonInput) {
        try {
            const arraytoparse = JsonInput.schedule;
            for (let semester = 0; semester < arraytoparse.length; semester++) {
                for (let course = 0; course < arraytoparse[semester].length; course++) {
                    placeCourse(semester, course, arraytoparse[semester][course]);
                }
            }

            const pathwaySelect = document.getElementById('pathwaySelect');
            if (pathwaySelect) pathwaySelect.value = JsonInput.selectedPathway;
            
            state.selectedPathway = JsonInput.selectedPathway;
            
            if (state.selectedPathway == Pathways.doubleMajors) {
                state.selectedMinors = [null, null];
                state.selectedElectives = [null, null, null, null];
            } else if (state.selectedPathway == Pathways.doubleMinors) {
                state.selectedMajors[1] = null;
                state.selectedElectives = [null, null, null, null];
            } else if (state.selectedPathway == Pathways.electives) {
                state.selectedMajors[1] = null;
                state.selectedMinors[1] = null;
            }
            
            PathwayRefresh();
            
            state.selectedElectives = JsonInput.selectedElectives;
            state.selectedMajors = JsonInput.selectedMajors;
            state.selectedMinors = JsonInput.selectedMinors;
            
            const major1 = document.getElementById('major1');
            const major2 = document.getElementById('major2');
            const minor1 = document.getElementById('minor1');
            const minor2 = document.getElementById('minor2');
            
            if (major1) major1.value = state.selectedMajors[0];
            
            if (state.selectedPathway == Pathways.doubleMajors) {
                if (major2) major2.value = state.selectedMajors[1];
            } else {
                if (minor1) minor1.value = state.selectedMinors[0];
                if (state.selectedPathway == Pathways.doubleMinors) {
                    if (minor2) minor2.value = state.selectedMinors[1];
                }
            }
            
            PathwayRefresh();
            renderCoursePlan(state); 
            console.log("State updated successfully:", state);
        } catch (err) {
            console.error(err);
            alert("Incompatible File!");
        }
    }
});
