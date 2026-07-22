async function saveCurrentTemplateToServer(customName) {
    if (!customName) return alert("Please provide a valid file name.");

    
    const payload = {
        filename: customName,
        selectedPathway: state.selectedPathway,
        selectedMajors: state.selectedMajors,
        selectedMinors: state.selectedMinors,
        selectedElectives: state.selectedElectives,
        schedule: [],
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
        fetchServerTemplates(); 
    } catch (error) {
        console.error("Save Operation Error:", error);
        alert(`Failed to save: ${error.message}`);
    }
}
