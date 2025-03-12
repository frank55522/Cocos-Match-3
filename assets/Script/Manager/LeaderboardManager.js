// LeaderboardManager.js
cc.Class({
    extends: cc.Component,
    
    properties: {
      maxEntries: 10, // 排行榜最多顯示的玩家數量
    },
    
    // 初始化
    initialize() {
      this.leaderboard = this.loadLeaderboard();
    },
    
    // 載入排行榜數據
    loadLeaderboard() {
      let leaderboardData = cc.sys.localStorage.getItem('leaderboard');
      if (leaderboardData) {
        try {
          return JSON.parse(leaderboardData);
        } catch (e) {
          console.error('無法解析排行榜數據:', e);
          return [];
        }
      }
      return [];
    },
    
    // 儲存排行榜數據
    saveLeaderboard() {
      cc.sys.localStorage.setItem('leaderboard', JSON.stringify(this.leaderboard));
    },
    
    // 添加新的玩家成績
    addScore(playerId, score) {
      if (!playerId) return;
      
      // 檢查玩家是否已經在排行榜中
      let existingEntry = this.leaderboard.find(entry => entry.playerId === playerId);
      
      if (existingEntry) {
        // 如果新分數更高則更新
        if (score > existingEntry.score) {
          existingEntry.score = score;
          existingEntry.date = new Date().toISOString();
        }
      } else {
        // 新增玩家到排行榜
        this.leaderboard.push({
          playerId: playerId,
          score: score,
          date: new Date().toISOString()
        });
      }
      
      // 重新排序排行榜
      this.leaderboard.sort((a, b) => b.score - a.score);
      
      // 如果超過最大數量，則移除多餘的項目
      if (this.leaderboard.length > this.maxEntries) {
        this.leaderboard = this.leaderboard.slice(0, this.maxEntries);
      }
      
      // 儲存更新後的排行榜
      this.saveLeaderboard();
      
      return this.getRank(playerId);
    },
    
    // 獲取玩家在排行榜中的排名
    getRank(playerId) {
      for (let i = 0; i < this.leaderboard.length; i++) {
        if (this.leaderboard[i].playerId === playerId) {
          return i + 1;
        }
      }
      return -1;
    },
    
    // 獲取排行榜數據
    getLeaderboard() {
      return this.leaderboard;
    }
  });