document.addEventListener('DOMContentLoaded', () => {
    // Target the file input inside your templates dialog box
    const templateInput = document.querySelector('#templates input[type="file"]');
    const uploadForm = document.querySelector('#templates form');

    if (uploadForm) {
        // Stop the form from trying to submit to a backend server URL (/upload)
        uploadForm.addEventListener('submit', (e) => {
            e.preventDefault();
            handleTemplateUpload();
        });
    }

    function handleTemplateUpload() {
        if (!templateInput || templateInput.files.length === 0) {
            alert("Please select a valid JSON template file first.");
            return;
        }

        const file = templateInput.files[0];
        const reader = new FileReader();

        reader.onload = function (event) {
            try {
                // Parse the file data safely right inside the client browser
                const templateData = JSON.parse(event.target.result);
                console.log("Template parsed successfully:", templateData);

                // Trigger your UI generation logic
                createNewTemplateButton(file.name, templateData);

            } catch (error) {
                console.error("Malformed JSON file layout:", error);
                alert("Error: The uploaded file is not a valid JSON template.");
            }
        };

        reader.readAsText(file);
    }

    function createNewTemplateButton(fileName, data) {
        const container = document.getElementById('templateBtnContainer');
        if (!container) return;

        // Clean up extension string for button display name
        const displayName = fileName.replace(/\.[^/.]+$/, "");

        const newBtn = document.createElement('button');
        newBtn.type = "button";
        newBtn.style.margin = "5px";
        newBtn.textContent = `Load: ${displayName}`;

        newBtn.addEventListener('click', () => {
            console.log(`Applying template layout configuration: ${displayName}`, data);
            // Add your function here to map this template data onto your course plan state!
        });

        container.appendChild(newBtn);
    }
});