async function saveCurrentTemplateToServer(customName) {
    if (!customName) return alert("Please provide a valid file name.");

    // Extract current frontend data matching your import schema
    const payload = {
        filename: customName,
        selectedPathway: state.selectedPathway,
        selectedMajors: state.selectedMajors,
        selectedMinors: state.selectedMinors,
        selectedElectives: state.selectedElectives,
        schedule: [] // Populate this with your custom matrix generation logic if needed
    };

    // Reconstruct schedule array matrix from current state/UI if not already mirrored
    // Example layout: payload.schedule = currentScheduleArrayMatrix;

    try {
        const response = await fetch('./php/save_template.php', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(payload)
        });

        const result = await response.json();
        if (!response.ok) throw new Error(result.error || "Server storage failed.");

        alert(result.message);
        fetchServerTemplates(); // Instantly refreshes your modal window file tree list
    } catch (error) {
        console.error("Save Operation Error:", error);
        alert(`Failed to save: ${error.message}`);
    }
}
