const select = document.getElementById('groupSelect');
const container = document.getElementById('boxContainer');
// async function loadBoxGroup(group)
// {
// 	container.innerHTML = '';
	
// 	const indexResource = await fetch(`json/boxGroups/${group}`);
// 	const index = await indexResource.json();

// 	for (const file of index.data)
// 	{
// 		const fileResource = await fetch(`json/boxes/${file}`);
// 		const fileData = await fileResource.json();
		
// 		const newBox = document.createElement('div');
// 		newBox.className = 'box';
// 		newBox.style.backgroundColor = fileData.bgColor;
		
// 		newBox.innerHTML = `<h2>${fileData.title}</h2><br><p>${fileData.message}</p>`;
		
// 		container.appendChild(newBox);
// 	}
// }

async function initGroupSelect()
{
	const indexResource = await fetch('./json/courses/courses.json');
	const index = await indexResource.json();

	for (const group of index.files)
	{
		const fileResource = await fetch(`json/courses/${group}`);
		const fileData = await fileResource.json();
		coursearray.push(fileData);
		const newOption = document.createElement('option');
		newOption.value = group;
		newOption.textContent = fileData.name;
		select.appendChild(newOption);
	}

	// // Load first group by default
	// if(index.files.length > 0)
	// {
	// 	loadBoxGroup(index.files[0]);
	// 	console.log('loaded first group: '+index.files[0]);
	// }

	// // e is for event as i find out
	// select.addEventListener('change', (e) => {
	// 	loadBoxGroup(e.target.value);
	// });
	
}

initGroupSelect();
