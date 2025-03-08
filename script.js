document.addEventListener('DOMContentLoaded', function() {
  // Check if user is logged in
  const checkAuth = async () => {
    try {
      const response = await fetch('/api/user', {
        headers: {
          'Authorization': `Bearer ${localStorage.getItem('token')}`
        }
      });
      
      if (response.ok) {
        const data = await response.json();
        return data.user;
      }
      return null;
    } catch (error) {
      console.error('Auth check error:', error);
      return null;
    }
  };
  
  // Update UI based on auth status
  const updateAuthUI = (user) => {
    const authLinks = document.querySelector('.nav-links');
    const userNameDisplay = document.getElementById('userNameDisplay');
    const welcomeMessageContainer = document.getElementById('welcomeMessageContainer');
    
    // Show/hide welcome message based on user login status
    if (welcomeMessageContainer) {
      welcomeMessageContainer.style.display = user ? 'block' : 'none';
    }
    
    if (userNameDisplay && user) {
      userNameDisplay.textContent = user.name;
    }
    
    if (authLinks) {
      if (user) {
        authLinks.innerHTML = `
          <a href="#features">Features</a>
          <a href="#pricing">Pricing</a>
          <a href="#about">About</a>
          <span style="font-size: 1.2rem; font-weight: bold;" class="user-greeting" title="Logged in as ${user.email || ''}">
            ${user.name}
          </span>
          <button id="logoutBtn" class="btn btn-outline">Log out</button>
        `;
        
        // Add logout handler
        document.getElementById('logoutBtn').addEventListener('click', async () => {
          try {
            await fetch('/api/logout', { method: 'POST' });
            localStorage.removeItem('token');
            localStorage.removeItem('user');
            window.location.href = '/';
          } catch (error) {
            console.error('Logout error:', error);
          }
        });
      } else {
        authLinks.innerHTML = `
          <a href="#features">Features</a>
          <a href="#pricing">Pricing</a>
          <a href="#about">About</a>
          <a href="/login" class="btn btn-outline">Log in</a>
          <a href="/register" class="btn btn-primary">Sign up</a>
        `;
      }
    }
  };
  
  // Check auth on page load
  checkAuth().then(user => {
    if (user) {
      localStorage.setItem('user', JSON.stringify(user));
      updateAuthUI(user);
    }
  });
  
  // Generate random room name
  const generateRandomName = () => {
    const adjectives = ['Amazing', 'Brilliant', 'Creative', 'Dynamic', 'Energetic', 'Fantastic', 'Gorgeous', 'Happy'];
    const nouns = ['Board', 'Canvas', 'Drawing', 'Idea', 'Project', 'Session', 'Space', 'Whiteboard'];
    const randomAdjective = adjectives[Math.floor(Math.random() * adjectives.length)];
    const randomNoun = nouns[Math.floor(Math.random() * nouns.length)];
    const randomNumber = Math.floor(Math.random() * 1000);
    return `${randomAdjective}${randomNoun}${randomNumber}`;
  };

  // Handle room creation
  const roomNameInput = document.getElementById('roomName');
  const startBoardingButton = document.getElementById('startBoarding');
  
  if (roomNameInput && startBoardingButton) {
    // Set initial placeholder
    roomNameInput.placeholder = "Enter your room name...";

    // Change placeholder to random name after 3 seconds
    setTimeout(() => {
      const updatePlaceholder = () => {
        roomNameInput.placeholder = `e.g. ${generateRandomName()}`;
      };

      updatePlaceholder(); // Initial update
      const intervalId = setInterval(updatePlaceholder, 3000); // Update every 3 seconds

      // Clear interval when the user starts typing
      roomNameInput.addEventListener('input', () => {
        clearInterval(intervalId);
        roomNameInput.placeholder = ""; // Clear placeholder when typing
      });
    }, 3000); // Start changing after 3 seconds
    
    startBoardingButton.addEventListener('click', async () => {
      let roomName = roomNameInput.value.trim();
      
      // If no room name is provided, generate a random one
      if (!roomName) {
        roomName = roomNameInput.placeholder.replace("e.g. ", ""); // Get the random name
      }
      
      // Check if the entered name is a 6-digit code (all numbers, exactly 6 digits)
      const isBoardCode = /^\d{6}$/.test(roomName);
      
      // If it's a board code, try to find the corresponding board
      if (isBoardCode) {
        try {
          // Call API to find board by code
          const response = await fetch(`/api/boards/code/${roomName}`);
          
          if (response.ok) {
            const data = await response.json();
            
            // Redirect to the existing board
            window.location.href = `/board?room=${encodeURIComponent(data.roomId)}&name=${encodeURIComponent(data.name)}`;
            return; // Exit function early
          } 
          // If not found or error, continue to create a new board
        } catch (error) {
          console.log('Error finding board by code:', error);
          // Continue with board creation
        }
      }
      
      const user = JSON.parse(localStorage.getItem('user') || '{}');
      
      if (user && user.id) {
        // Create board in database if logged in
        try {
          const response = await fetch('/api/boards', {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
              'Authorization': `Bearer ${localStorage.getItem('token')}`
            },
            body: JSON.stringify({ name: roomName })
          });
          
          if (response.ok) {
            const data = await response.json();
            // Pass room ID as a query parameter
            window.location.href = `/board?room=${encodeURIComponent(data.roomId)}&name=${encodeURIComponent(roomName)}`;
          } else {
            alert('Failed to create board. Please try again.');
          }
        } catch (error) {
          console.error('Board creation error:', error);
          alert('Failed to create board. Please try again.');
        }
      } else {
        // Just redirect to a new room if not logged in
        const roomId = Math.random().toString(36).substring(2, 15);
        // Pass room name as a query parameter
        window.location.href = `/board?room=${encodeURIComponent(roomId)}&name=${encodeURIComponent(roomName)}`;
      }
    });
  }

  // Handle login form submission
  const loginForm = document.getElementById('loginForm');
  if (loginForm) {
    loginForm.addEventListener('submit', async (e) => {
      e.preventDefault();
      const email = document.getElementById('email').value;
      const password = document.getElementById('password').value;
      
      try {
        const response = await fetch('/api/login', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json'
          },
          body: JSON.stringify({ email, password })
        });
        
        const data = await response.json();
        
        if (response.ok) {
          localStorage.setItem('token', data.token);
          localStorage.setItem('user', JSON.stringify(data.user));
          window.location.href = '/';
        } else {
          alert(data.error || 'Login failed. Please check your credentials.');
        }
      } catch (error) {
        console.error('Login error:', error);
        alert('Login failed. Please try again.');
      }
    });
  }

  // Handle registration form submission
  const registerForm = document.getElementById('registerForm');
  if (registerForm) {
    registerForm.addEventListener('submit', async (e) => {
      e.preventDefault();
      const fullName = document.getElementById('fullName').value;
      const email = document.getElementById('email').value;
      const password = document.getElementById('password').value;
      const confirmPassword = document.getElementById('confirmPassword').value;
      
      // Simple validation
      if (password !== confirmPassword) {
        alert('Passwords do not match!');
        return;
      }
      
      if (password.length < 8) {
        alert('Password must be at least 8 characters long!');
        return;
      }
      
      try {
        const response = await fetch('/api/register', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json'
          },
          body: JSON.stringify({ fullName, email, password })
        });
        
        const data = await response.json();
        
        if (response.ok) {
          localStorage.setItem('token', data.token);
          localStorage.setItem('user', JSON.stringify(data.user));
          window.location.href = '/';
        } else {
          alert(data.error || 'Registration failed. Please try again.');
        }
      } catch (error) {
        console.error('Registration error:', error);
        alert('Registration failed. Please try again.');
      }
    });
  }
});