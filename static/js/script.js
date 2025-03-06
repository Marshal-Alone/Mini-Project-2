// Preserve login and register functionality, but modify room creation
document.addEventListener('DOMContentLoaded', function() {
    // Keep login and register functionality
    // ... existing code ...
    
    // Modify Create Room functionality to just redirect to board.html
    const createRoomBtn = document.getElementById('createRoom');
    if (createRoomBtn) {
        createRoomBtn.addEventListener('click', function(e) {
            e.preventDefault();
            
            // Just redirect to board.html without creating a room in the database
            localStorage.setItem('username', 'MARSHAL');
            localStorage.setItem('roomID', 'MY_ROOM');
            window.location.href = 'board.html';
        });
    }
    
    // Modify Join Room functionality to just redirect to board.html
    const joinRoomForm = document.querySelector('.join-room-form');
    if (joinRoomForm) {
        joinRoomForm.addEventListener('submit', function(e) {
            e.preventDefault();
            
            // Just redirect to board.html without checking room in the database
            localStorage.setItem('username', 'MARSHAL');
            localStorage.setItem('roomID', 'MY_ROOM');
            window.location.href = 'board.html';
        });
    }
    
    // Disable other functionality but keep UI
    const otherButtons = document.querySelectorAll('button:not(#createRoom):not(.auth-btn)');
    otherButtons.forEach(button => {
        button.addEventListener('click', function(e) {
            if (!button.classList.contains('auth-btn')) {
                e.preventDefault();
                console.log('Functionality disabled in prototype');
            }
        });
    });
}); 