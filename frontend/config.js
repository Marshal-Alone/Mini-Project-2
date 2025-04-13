const config = {
    API_URL: window.location.hostname === 'localhost'
        ? 'http://localhost:3000'
        : 'https://whiteboard-backend-p0l5.onrender.com/'
};

export default config; 