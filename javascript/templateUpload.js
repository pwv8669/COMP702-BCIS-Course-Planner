import express from 'express';
import multer from 'multer';
import fs from 'fs';
const app = express();

const upload = multer({ dest: '../json/templates/customTemplates/' }); // Files saved to /json/templates/customTemplates

// Endpoint to get all file names
app.get('../json/templates/customTemplates', (req, res) => {
    fs.readdir('../json/templates/customTemplates', (err, files) => {
        res.json(files.filter(f => f.endsWith('.json')));
    });
});

// Endpoint to upload a new file
app.post('../json/templates/customTemplates', upload.single('jsonFile'), (req, res) => {
    res.send('File uploaded! Refreshing buttons...');
});

app.listen(3000);

async function loadButtons()
{
    const response = await fetch('../json/templates/customTemplates'); // Fetch the list from the server
    const files = await response.json();
    const container = document.getElementById('templateBtnContainer');
    container.innerHTML = ''; // Clear old buttons

    files.forEach(file => {
        const btn = document.createElement('button');
        btn.innerText = file;
        container.appendChild(btn);
    });

}