// GlobalData.js
const GlobalData = {
    playerId: "",
    
    setPlayerId: function(id) {
        this.playerId = id;
    },
    
    getPlayerId: function() {
        return this.playerId || "";
    }
};

module.exports = GlobalData;