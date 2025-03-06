// Disable drawing functionality and set default values
document.addEventListener('DOMContentLoaded', function() {
    // Set default room name and username
    document.getElementById('roomName').innerText = "MY ROOM";
    
    // Hide user list
    const userListContainer = document.querySelector('.users-container');
    if (userListContainer) {
        userListContainer.style.display = 'none';
    }
    
    // Disable socket connection
    // ... existing code ...
    
    // Replace socket connection with empty functions
    const socket = {
        on: function() {},
        emit: function() {}
    };
    
    // Disable drawing functionality but keep tools visible
    const canvas = document.getElementById('canvas');
    if (canvas) {
        const ctx = canvas.getContext('2d');
        
        // Clear any existing event listeners by cloning and replacing
        const newCanvas = canvas.cloneNode(true);
        canvas.parentNode.replaceChild(newCanvas, canvas);
        
        // Set a message on canvas
        const canvasCtx = newCanvas.getContext('2d');
        canvasCtx.font = '20px Arial';
        canvasCtx.fillStyle = 'gray';
        canvasCtx.textAlign = 'center';
        canvasCtx.fillText('Drawing functionality disabled in prototype', newCanvas.width/2, newCanvas.height/2);
    }
    
    // Disable tool functionality but keep them visible
    const tools = document.querySelectorAll('.tool');
    tools.forEach(tool => {
        tool.addEventListener('click', function(e) {
            e.preventDefault();
            e.stopPropagation();
            console.log('Drawing tools disabled in prototype');
        });
    });
    
    // Disable other interactive elements
    const interactiveElements = document.querySelectorAll('button:not(.auth-btn), .color-picker, .size-picker');
    interactiveElements.forEach(element => {
        element.addEventListener('click', function(e) {
            if (!element.classList.contains('auth-btn')) {
                e.preventDefault();
                e.stopPropagation();
                console.log('Functionality disabled in prototype');
            }
        });
    });
}); 