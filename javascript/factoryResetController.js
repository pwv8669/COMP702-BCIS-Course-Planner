async function initFactoryResetButton() 
{
    const button = document.getElementById('factoryResetButton');

    button.addEventListener('click', async () => {
        if (!window.confirm('Restore all course-planner data to the factory defaults?')) {
            return;
        }
    
        try
        {
            const response = await fetch('./php/factory_reset.php', {
                method: 'POST'
            });
            const result = await response.json();
    
            if (!response.ok || !result.success) {
                throw new Error(result.error || 'Factory reset failed.');
            }
    
            window.alert(result.message);
            window.location.reload();
        }
        catch (error)
        {
            window.alert(error.message);
        }
    })

}

if (document.readyState === 'loading') {
    document.addEventListener(
        'DOMContentLoaded',
        initFactoryResetButton,
        { once: true }
    );
} else {
    initFactoryResetButton();
}