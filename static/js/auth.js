// Keep login and register functionality intact

// Add a function to check if user is logged in for prototype
function isLoggedInPrototype() {
    return localStorage.getItem('token') !== null;
}

// Add function to redirect unauthorized users in prototype
function protectBoardPage() {
    if (!isLoggedInPrototype()) {
        window.location.href = 'index.html';
    } else {
        // Set default values for prototype
        document.getElementById('username').innerText = 'MARSHAL';
        
        // Don't hide the users list - it should always be visible
    }
}

// Check for board page and apply protection
if (window.location.pathname.includes('board.html')) {
    protectBoardPage();
} 