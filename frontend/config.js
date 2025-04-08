const config = {
    API_URL: process.env.NODE_ENV === 'production'
        ? 'https://collaboard-backend.onrender.com'
        : 'http://localhost:3000'
};

export default config; 