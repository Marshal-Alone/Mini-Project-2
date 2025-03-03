document.addEventListener('DOMContentLoaded', function() {
  // Socket.io setup
  const socket = io();
  let currentUserId = null;
  
  // Get URL parameters
  const urlParams = new URLSearchParams(window.location.search);
  const roomId = urlParams.get('room') || 'Untitled Board';
  const roomName = urlParams.get('name') || 'Untitled Board';
  
  // Set room name in the UI
  document.getElementById('roomName').textContent = roomName;
  
  // Set the title of the page
  document.title = `${roomName} - Collaboard`;
  
  // Canvas setup
  const canvas = document.getElementById('whiteboard');
  const ctx = canvas.getContext('2d');
  let isDrawing = false;
  let lastX = 0;
  let lastY = 0;
  
  // Drawing settings
  let currentTool = 'brush';
  let currentColor = '#000000';
  let currentWidth = 5; // Default brush size
  
  // History for undo/redo
  const history = [];
  let historyIndex = -1;
  
  // Resize canvas to fit window
  function resizeCanvas() {
    const container = document.querySelector('.board-container');
    canvas.width = container.offsetWidth;
    canvas.height = container.offsetHeight;
    
    // Redraw canvas after resize
    if (historyIndex >= 0) {
      ctx.drawImage(history[historyIndex], 0, 0);
    }
  }
  
  // Initialize canvas size
  resizeCanvas();
  window.addEventListener('resize', resizeCanvas);
  
  // Save current state to history
  function saveState() {
    // Remove any states after current index if we've gone back in history
    if (historyIndex < history.length - 1) {
      history.splice(historyIndex + 1);
    }
    
    // Create a new image from the canvas
    const newState = new Image();
    newState.src = canvas.toDataURL();
    
    // Add to history once image is loaded
    newState.onload = function() {
      history.push(newState);
      historyIndex++;
      
      // Enable/disable undo/redo buttons
      document.getElementById('undoBtn').disabled = historyIndex <= 0;
      document.getElementById('redoBtn').disabled = historyIndex >= history.length - 1;
    };
  }
  
  // Save initial blank state
  saveState();
  
  // Add event listener for brush size selection
  const brushSizeSelect = document.getElementById('brushSize');
  brushSizeSelect.addEventListener('change', (e) => {
    currentWidth = parseInt(e.target.value);
  });
  
  // Drawing functions
  function startDrawing(e) {
    isDrawing = true;
    
    // Get mouse position relative to canvas
    const rect = canvas.getBoundingClientRect();
    lastX = e.clientX - rect.left;
    lastY = e.clientY - rect.top;
    
    // For shapes, we'll start a new path
    if (currentTool !== 'brush' && currentTool !== 'pencil') {
      ctx.beginPath();
      ctx.moveTo(lastX, lastY);
    }
  }
  
  function draw(e) {
    if (!isDrawing) return;
    
    // Get current mouse position
    const rect = canvas.getBoundingClientRect();
    const currentX = e.clientX - rect.left;
    const currentY = e.clientY - rect.top;
    
    // Set drawing styles
    ctx.lineWidth = currentWidth; // Use the selected brush size
    ctx.lineCap = 'round';
    ctx.lineJoin = 'round';
    
    // Draw based on selected tool
    switch (currentTool) {
      case 'brush':
        ctx.strokeStyle = currentColor;
        ctx.globalAlpha = brushOpacitySlider.value / 100; // Use the selected opacity
        ctx.beginPath();
        ctx.moveTo(lastX, lastY);
        ctx.lineTo(currentX, currentY);
        ctx.stroke();
        
        // Emit draw event to server
        socket.emit('drawEvent', {
          tool: 'brush',
          startX: lastX,
          startY: lastY,
          endX: currentX,
          endY: currentY,
          color: currentColor,
          width: currentWidth,
          opacity: ctx.globalAlpha // Send opacity
        });
        break;
        
      case 'eraser':
        // Set composite operation to destination-out for erasing
        ctx.globalCompositeOperation = 'destination-out';
        ctx.beginPath();
        ctx.arc(currentX, currentY, parseInt(eraserSizeSelect.value) / 2, 0, Math.PI * 2, false);
        ctx.fill();
        
        // Emit erase event to server
        socket.emit('drawEvent', {
          tool: 'eraser',
          startX: currentX,
          startY: currentY,
          width: parseInt(eraserSizeSelect.value) // Send eraser size
        });
        break;
        
      case 'line':
        ctx.clearRect(0, 0, canvas.width, canvas.height);
        if (historyIndex >= 0) {
          ctx.drawImage(history[historyIndex], 0, 0);
        }
        ctx.beginPath();
        ctx.moveTo(lastX, lastY);
        ctx.lineTo(currentX, currentY);
        ctx.stroke();
        break;
        
      case 'rectangle':
        ctx.clearRect(0, 0, canvas.width, canvas.height);
        if (historyIndex >= 0) {
          ctx.drawImage(history[historyIndex], 0, 0);
        }
        ctx.beginPath();
        const width = currentX - lastX;
        const height = currentY - lastY;
        ctx.rect(lastX, lastY, width, height);
        ctx.stroke();
        break;
        
      case 'circle':
        ctx.clearRect(0, 0, canvas.width, canvas.height);
        if (historyIndex >= 0) {
          ctx.drawImage(history[historyIndex], 0, 0);
        }
        ctx.beginPath();
        const radius = Math.sqrt(Math.pow(currentX - lastX, 2) + Math.pow(currentY - lastY, 2));
        ctx.arc(lastX, lastY, radius, 0, Math.PI * 2);
        ctx.stroke();
        break;
        
      case 'text':
        // Handle text drawing logic here
        break;
    }
    
    // Update last position for brush and eraser tools
    if (currentTool === 'brush' || currentTool === 'eraser') {
      lastX = currentX;
      lastY = currentY;
    }
    
    // After drawing or erasing
    ctx.globalCompositeOperation = 'source-over'; // Reset to default
  }
  
  function stopDrawing(event) {
    if (!isDrawing) return;
    isDrawing = false;
    
    // Get current mouse position
    const rect = canvas.getBoundingClientRect();
    const currentX = event.clientX - rect.left;
    const currentY = event.clientY - rect.top;
    
    // Emit shape drawing events
    if (currentTool !== 'brush' && currentTool !== 'pencil') {
      switch (currentTool) {
        case 'line':
          socket.emit('drawEvent', {
            tool: 'line',
            startX: lastX,
            startY: lastY,
            endX: currentX,
            endY: currentY,
            color: currentColor,
            width: currentWidth
          });
          break;
          
        case 'rectangle':
          socket.emit('drawEvent', {
            tool: 'rectangle',
            startX: lastX,
            startY: lastY,
            width: currentX - lastX,
            height: currentY - lastY,
            color: currentColor,
            lineWidth: currentWidth
          });
          break;
          
        case 'circle':
          const radius = Math.sqrt(Math.pow(currentX - lastX, 2) + Math.pow(currentY - lastY, 2));
          socket.emit('drawEvent', {
            tool: 'circle',
            centerX: lastX,
            centerY: lastY,
            radius: radius,
            color: currentColor,
            lineWidth: currentWidth
          });
          break;
      }
    }
    
    // Save the current state for undo/redo
    saveState();
    
    // If text tool is selected, prompt for text input
    if (currentTool === 'text') {
      const text = prompt('Enter text:');
      if (text) {
        ctx.font = `${currentWidth * 3}px Arial`;
        ctx.fillStyle = currentColor;
        ctx.fillText(text, lastX, lastY);
        
        // Emit text event
        socket.emit('drawEvent', {
          tool: 'text',
          x: lastX,
          y: lastY,
          text: text,
          color: currentColor,
          fontSize: currentWidth * 3
        });
        
        saveState();
      }
    }
  }
  
  // Handle received drawing events
  socket.on('drawEvent', (data) => {
    ctx.lineWidth = data.width; // Set line width

    switch (data.tool) {
      case 'brush':
        ctx.strokeStyle = data.color;
        ctx.globalAlpha = data.opacity; // Set opacity from the event
        ctx.beginPath();
        ctx.moveTo(data.startX, data.startY);
        ctx.lineTo(data.endX, data.endY);
        ctx.stroke();
        break;
        
      case 'eraser':
        // Set composite operation to destination-out for erasing
        ctx.globalCompositeOperation = 'destination-out';
        ctx.beginPath();
        ctx.arc(data.startX, data.startY, data.width / 2, 0, Math.PI * 2, false);
        ctx.fill();
        break;
        
      case 'line':
        ctx.beginPath();
        ctx.moveTo(data.startX, data.startY);
        ctx.lineTo(data.endX, data.endY);
        ctx.stroke();
        saveState();
        break;
        
      case 'rectangle':
        ctx.beginPath();
        ctx.rect(data.startX, data.startY, data.width, data.height);
        ctx.stroke();
        saveState();
        break;
        
      case 'circle':
        ctx.beginPath();
        ctx.arc(data.centerX, data.centerY, data.radius, 0, Math.PI * 2);
        ctx.stroke();
        saveState();
        break;
        
      case 'text':
        ctx.font = `${data.fontSize}px Arial`;
        ctx.fillStyle = data.color;
        ctx.fillText(data.text, data.x, data.y);
        saveState();
        break;
    }
  });
  
  // Handle clear canvas event
  socket.on('clearCanvas', () => {
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    saveState();
  });
  
  // Add event listeners for drawing
  canvas.addEventListener('mousedown', startDrawing);
  canvas.addEventListener('mousemove', draw);
  canvas.addEventListener('mouseup', stopDrawing);
  canvas.addEventListener('mouseout', stopDrawing);
  
  // Add touch support for mobile devices
  canvas.addEventListener('touchstart', (e) => {
    e.preventDefault();
    const touch = e.touches[0];
    const mouseEvent = new MouseEvent('mousedown', {
      clientX: touch.clientX,
      clientY: touch.clientY
    });
    canvas.dispatchEvent(mouseEvent);
  });
  
  canvas.addEventListener('touchmove', (e) => {
    e.preventDefault();
    const touch = e.touches[0];
    const mouseEvent = new MouseEvent('mousemove', {
      clientX: touch.clientX,
      clientY: touch.clientY
    });
    canvas.dispatchEvent(mouseEvent);
  });
  
  canvas.addEventListener('touchend', (e) => {
    e.preventDefault();
    const mouseEvent = new MouseEvent('mouseup', {});
    canvas.dispatchEvent(mouseEvent);
  });
  
  // Tool selection
  const toolButtons = document.querySelectorAll('.tool-btn[data-tool]');
  const brushSettingsPopup = document.getElementById('brushSettings');
  const brushColorInput = document.getElementById('brushColor');
  const brushSizeSlider = document.getElementById('brushSizeSlider');
  const brushOpacitySlider = document.getElementById('brushOpacity');
  const eraserSettings = document.getElementById('eraserSettings');
  const eraserSizeSelect = document.getElementById('eraserSize');
  
  toolButtons.forEach(button => {
    button.addEventListener('click', () => {
      // Remove active class from all tool buttons
      toolButtons.forEach(btn => btn.classList.remove('active'));
      
      // Add active class to clicked button
      button.classList.add('active');
      
      // Set current tool
      currentTool = button.dataset.tool;

      // Show brush settings if brush tool is selected
      if (currentTool === 'brush') {
        brushSettingsPopup.style.display = 'block';
      } else {
        brushSettingsPopup.style.display = 'none';
      }

      // Show eraser settings if eraser tool is selected
      if (currentTool === 'eraser') {
        eraserSettings.style.display = 'block';
        canvas.classList.add('eraser-cursor');
      } else {
        eraserSettings.style.display = 'none';
        canvas.classList.remove('eraser-cursor');
      }
    });
  });
  
  // Color picker
  const colorPicker = document.getElementById('colorPicker');
  colorPicker.addEventListener('input', () => {
    currentColor = colorPicker.value;
  });
  
  // Stroke width
  const strokeButtons = document.querySelectorAll('.stroke-btn');
  strokeButtons.forEach(button => {
    button.addEventListener('click', () => {
      // Remove active class from all stroke buttons
      strokeButtons.forEach(btn => btn.classList.remove('active'));
      
      // Add active class to clicked button
      button.classList.add('active');
      
      // Set current width
      currentWidth = parseInt(button.dataset.width);
    });
  });
  
  // Undo button
  document.getElementById('undoBtn').addEventListener('click', () => {
    if (historyIndex > 0) {
      historyIndex--;
      ctx.clearRect(0, 0, canvas.width, canvas.height);
      ctx.drawImage(history[historyIndex], 0, 0);
      
      // Update button states
      document.getElementById('undoBtn').disabled = historyIndex <= 0;
      document.getElementById('redoBtn').disabled = false;
    }
  });
  
  // Redo button
  document.getElementById('redoBtn').addEventListener('click', () => {
    if (historyIndex < history.length - 1) {
      historyIndex++;
      ctx.clearRect(0, 0, canvas.width, canvas.height);
      ctx.drawImage(history[historyIndex], 0, 0);
      
      // Update button states
      document.getElementById('redoBtn').disabled = historyIndex >= history.length - 1;
      document.getElementById('undoBtn').disabled = false;
    }
  });
  
  // Clear button
  document.getElementById('clearBtn').addEventListener('click', () => {
    if (confirm('Are you sure you want to clear the entire board?')) {
      ctx.clearRect(0, 0, canvas.width, canvas.height);
      saveState();
      
      // Emit clear event
      socket.emit('clearCanvas');
    }
  });
  
  // Share button and modal
  const shareModal = document.getElementById('shareModal');
  const shareBtn = document.getElementById('shareBtn');
  const closeBtn = document.querySelector('.close-btn');
  const shareLink = document.getElementById('shareLink');
  const copyLinkBtn = document.getElementById('copyLinkBtn');
  
  shareBtn.addEventListener('click', () => {
    // Set the share link
    shareLink.value = window.location.href;
    
    // Show the modal
    shareModal.classList.add('active');
  });
  
  closeBtn.addEventListener('click', () => {
    shareModal.classList.remove('active');
  });
  
  // Close modal when clicking outside
  window.addEventListener('click', (e) => {
    if (e.target === shareModal) {
      shareModal.classList.remove('active');
    }
  });
  
  // Copy link button
  copyLinkBtn.addEventListener('click', () => {
    shareLink.select();
    document.execCommand('copy');
    
    // Show toast notification
    showToast('Link copied to clipboard!');
  });
  
  // Password protection toggle
  const enablePasswordCheckbox = document.getElementById('enablePassword');
  const passwordInput = document.querySelector('.password-input');
  
  enablePasswordCheckbox.addEventListener('change', () => {
    passwordInput.style.display = enablePasswordCheckbox.checked ? 'flex' : 'none';
  });
  
  // Set password button
  document.getElementById('setPasswordBtn').addEventListener('click', () => {
    const password = document.getElementById('boardPassword').value;
    if (password) {
      // In a real app, this would set the password on the server
      showToast('Password protection enabled');
      shareModal.classList.remove('active');
    } else {
      alert('Please enter a password');
    }
  });
  
  // Save button
  document.getElementById('saveBtn').addEventListener('click', () => {
    // Create a temporary link element
    const link = document.createElement('a');
    link.download = `${roomName}.png`;
    link.href = canvas.toDataURL('image/png');
    
    // Trigger download
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    
    showToast('Board saved as PNG');
  });
  
  // Toast notification
  function showToast(message) {
    const toast = document.getElementById('toast');
    const toastMessage = document.getElementById('toastMessage');
    
    toastMessage.textContent = message;
    toast.classList.add('active');
    
    // Hide toast after 3 seconds
    setTimeout(() => {
      toast.classList.remove('active');
    }, 3000);
  }
  
  // Get user info from localStorage
  function getUserInfo() {
    try {
      const userJson = localStorage.getItem('user');
      if (userJson) {
        return JSON.parse(userJson);
      }
    } catch (e) {
      console.error('Error parsing user data:', e);
    }
    return null;
  }
  
  // User name prompt
  function promptForUserName() {
    // First try to get name from logged in user
    const user = getUserInfo();
    if (user && user.name) {
      return user.name;
    }
    
    // Otherwise check localStorage or prompt
    let userName = localStorage.getItem('collaboard_username');
    
    if (!userName) {
      userName = prompt('Enter your name to join the whiteboard:', 'Guest ' + Math.floor(Math.random() * 1000));
      if (!userName) userName = 'Guest ' + Math.floor(Math.random() * 1000);
      localStorage.setItem('collaboard_username', userName);
    }
    
    return userName;
  }
  
  // Join room
  const userName = promptForUserName();
  const user = getUserInfo();
  socket.emit('joinRoom', { 
    roomId, 
    userName,
    userId: user ? user.id : null
  });
  
  // Handle room data (users and history)
  socket.on('roomData', ({ users, history: roomHistory }) => {
    console.log('Received room data with', users.length, 'users and', roomHistory.length, 'history items');
    
    // Update users list
    updateUsersList(users);
    
    // Apply drawing history
    if (roomHistory && roomHistory.length > 0) {
      roomHistory.forEach(data => {
        ctx.strokeStyle = data.color;
        ctx.lineWidth = data.width || data.lineWidth;
        ctx.lineCap = 'round';
        ctx.lineJoin = 'round';
        
        switch (data.tool) {
          case 'brush':
            ctx.beginPath();
            ctx.moveTo(data.startX, data.startY);
            ctx.lineTo(data.endX, data.endY);
            ctx.stroke();
            break;
            
          case 'line':
            ctx.beginPath();
            ctx.moveTo(data.startX, data.startY);
            ctx.lineTo(data.endX, data.endY);
            ctx.stroke();
            break;
            
          case 'rectangle':
            ctx.beginPath();
            ctx.rect(data.startX, data.startY, data.width, data.height);
            ctx.stroke();
            break;
            
          case 'circle':
            ctx.beginPath();
            ctx.arc(data.centerX, data.centerY, data.radius, 0, Math.PI * 2);
            ctx.stroke();
            break;
            
          case 'text':
            ctx.font = `${data.fontSize}px Arial`;
            ctx.fillStyle = data.color;
            ctx.fillText(data.text, data.x, data.y);
            break;
        }
      });
      
      saveState();
    }
  });
  
  // Handle user joined
  socket.on('userJoined', (userData) => {
    console.log('User joined:', userData);
    
    if (userData.id === socket.id) {
      currentUserId = userData.id;
    }
    
    // Add user to list
    addUserToList(userData);
    
    // Show notification
    if (userData.id !== socket.id) {
      showToast(`${userData.name} joined the board`);
    }
  });
  
  // Handle user left
  socket.on('userLeft', (userData) => {
    console.log('User left:', userData);
    
    // Remove user from list
    removeUserFromList(userData.id);
    
    // Show notification
    showToast(`${userData.name} left the board`);
  });
  
  // Handle user count update
  socket.on('userCount', (count) => {
    console.log('User count updated:', count);
    document.getElementById('usersCount').textContent = `${count} user${count !== 1 ? 's' : ''}`;
  });
  
  // Update connection status
  socket.on('connect', () => {
    console.log('Connected to server with socket ID:', socket.id);
    
    const connectionStatus = document.getElementById('connectionStatus');
    connectionStatus.innerHTML = '<i class="fas fa-circle connected"></i> Connected';
    connectionStatus.classList.add('connected');
    connectionStatus.classList.remove('disconnected');
    
    // If we were previously connected and have a room ID, rejoin
    if (roomId && userName) {
      const user = getUserInfo();
      socket.emit('joinRoom', { 
        roomId, 
        userName,
        userId: user ? user.id : null
      });
    }
  });
  
  socket.on('disconnect', () => {
    console.log('Disconnected from server');
    
    const connectionStatus = document.getElementById('connectionStatus');
    connectionStatus.innerHTML = '<i class="fas fa-circle disconnected"></i> Disconnected';
    connectionStatus.classList.remove('connected');
    connectionStatus.classList.add('disconnected');
    
    showToast('Disconnected from server. Trying to reconnect...');
  });
  
  // Users list functions
  function updateUsersList(users) {
    console.log('Updating users list with', users.length, 'users');
    
    const usersList = document.getElementById('usersList');
    usersList.innerHTML = '';
    
    users.forEach(user => {
      addUserToList(user);
    });
  }
  
  function addUserToList(user) {
    const usersList = document.getElementById('usersList');
    
    // Check if user already exists
    if (document.getElementById(`user-${user.id}`)) {
      return;
    }
    
    const userItem = document.createElement('div');
    userItem.className = 'user-item';
    userItem.id = `user-${user.id}`;
    
    const isCurrentUser = user.id === socket.id;
    
    userItem.innerHTML = `
      <div class="user-avatar" style="background-color: ${user.color};">
        <span>${user.initial}</span>
      </div>
      <div class="user-name">${user.name} ${isCurrentUser ? '(You)' : ''}</div>
    `;
    
    usersList.appendChild(userItem);
  }
  
  function removeUserFromList(userId) {
    const userItem = document.getElementById(`user-${userId}`);
    if (userItem) {
      userItem.remove();
    }
  }
  
  // Update brush color
  brushColorInput.addEventListener('input', (e) => {
    currentColor = e.target.value;
  });
  
  // Update brush size
  brushSizeSlider.addEventListener('input', (e) => {
    currentWidth = e.target.value;
  });
  
  // Update brush opacity
  brushOpacitySlider.addEventListener('input', (e) => {
    ctx.globalAlpha = e.target.value / 100; // Convert to 0-1 range
  });
  
  // Update eraser size
  eraserSizeSelect.addEventListener('change', (e) => {
    currentWidth = parseInt(e.target.value);
  });
});