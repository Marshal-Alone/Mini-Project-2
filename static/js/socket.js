// Disable all socket functionality for prototype
const socket = {
    on: function() {},
    emit: function() {},
    connect: function() {},
    disconnect: function() {}
};

// Export a dummy socket object that does nothing
if (typeof module !== 'undefined' && module.exports) {
    module.exports = socket;
} 