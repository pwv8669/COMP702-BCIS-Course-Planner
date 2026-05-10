const panel = document.getElementById('templates');
const openTemplates = document.getElementById('openTemplates');
const closeTemplates = document.getElementById('closeTemplates');

// Open the panel
openTemplates.addEventListener('click', () => {
    panel.showModal();
});

// Close the panel
closeTemplates.addEventListener('click', () => {
    panel.close();
});