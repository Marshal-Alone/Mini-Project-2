const config = {
    API_URL: window.location.hostname === 'localhost'
        ? 'http://localhost:3000'
        : 'https://collaboard-backend-cdr6.onrender.com'
};

export default config; 