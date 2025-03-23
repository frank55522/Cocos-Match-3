cc.Class({
  extends: cc.Component,
  
  properties: {
    maxEntries: {
      default: 10,
      tooltip: "排行榜最多顯示的玩家數量"
    },
    leaderboardService: {
      default: null,
      type: cc.Node,
      tooltip: "LeaderboardService 節點"
    },
    showLoadingIndicator: {
      default: true,
      tooltip: "加載排行榜時是否顯示讀取指示器"
    },
    requestTimeout: {
      default: 5,
      tooltip: "請求超時時間(秒)"
    }
  },
  
  // 初始化
  initialize() {
    // 創建 LeaderboardService 服務如果沒有指定
    if (!this.leaderboardService) {
      this.leaderboardService = this.createLeaderboardService();
    }
    
    // 初始化本地緩存的排行榜
    this.leaderboard = [];
    this.isLoading = false;
    this.lastErrorMessage = "";
    this.pendingRequests = [];
    
    // 加載排行榜數據
    this.loadLeaderboard();
  },
  
  createLeaderboardService() {
    let serviceNode = new cc.Node('LeaderboardService');
    let service = serviceNode.addComponent('LeaderboardService');
    serviceNode.parent = this.node;
    return serviceNode;
  },
  
  // 載入排行榜數據
  loadLeaderboard(callback, forceRefresh) {
    // 確保清除之前的超時計時器
    if (this._timeoutId) {
        clearTimeout(this._timeoutId);
    }
    
    // 如果正在加載中，添加到待處理隊列
    if (this.isLoading) {
        if (callback) {
            this.pendingRequests.push(callback);
        }
        return;
    }
    
    console.log("LeaderboardManager: 開始載入排行榜數據, 強制刷新:", forceRefresh);
    
    this.isLoading = true;
    if (this.showLoadingIndicator) {
        this.showLoading(true);
    }
    
    // 先加載本地緩存的排行榜數據
    this.leaderboard = this.loadLocalLeaderboard();
    
    // 如果本地沒有數據，創建一個空陣列
    if (!this.leaderboard || !Array.isArray(this.leaderboard)) {
        this.leaderboard = [];
    }
    
    let self = this;
    let serviceComp = this.leaderboardService.getComponent('LeaderboardService');
    
    // 檢查是否有網絡連接
    if (serviceComp && !serviceComp.offlineMode) {
        // 設置一個更長的超時時間 - 15秒
        const timeoutDuration = 15000;
        
        this._timeoutId = setTimeout(() => {
            // 只有在尚未獲得回應時才處理超時
            if (self.isLoading) {
                console.warn("獲取排行榜數據超時，超時設置:", timeoutDuration, "ms");
                self.isLoading = false;
                
                if (self.showLoadingIndicator) {
                    self.showLoading(false);
                }
                
                self.lastErrorMessage = "請求超時";
                
                // 處理回調
                self.handleCallbacks(new Error("排行榜請求超時"), self.leaderboard);
            }
        }, timeoutDuration);
        
        // 使用強制刷新選項，避免獲取到舊數據
        serviceComp.getLeaderboard(function(err, data) {
            // 清除超時計時器
            clearTimeout(self._timeoutId);
            self._timeoutId = null;
            
            self.isLoading = false;
            
            if (self.showLoadingIndicator) {
                self.showLoading(false);
            }
            
            if (err) {
                console.error("加載排行榜數據時出錯：", err);
                // 保存錯誤信息，但不顯示給用戶
                self.lastErrorMessage = err.message || "未知錯誤";
                
                // 通知待處理回調
                self.handleCallbacks(err, self.leaderboard);
            } else {
                self.lastErrorMessage = "";
                
                // 確保數據是有效的陣列
                if (data && Array.isArray(data)) {
                    console.log("成功從服務器獲取排行榜數據，條目數量:", data.length);
                    
                    self.leaderboard = data;
                    // 確保數據量不超過最大顯示數量
                    if (self.leaderboard.length > self.maxEntries) {
                        self.leaderboard = self.leaderboard.slice(0, self.maxEntries);
                    }
                    
                    // 保存到本地存儲
                    cc.sys.localStorage.setItem('leaderboard', JSON.stringify(self.leaderboard));
                    
                    // 通知待處理回調
                    self.handleCallbacks(null, self.leaderboard);
                } else {
                    console.warn("從服務器獲取的排行榜數據格式無效");
                    self.handleCallbacks(new Error("數據格式無效"), self.leaderboard);
                }
            }
        }, forceRefresh); // 傳入強制刷新參數
    } else {
        // 離線模式，直接使用本地數據
        this.isLoading = false;
        
        if (this.showLoadingIndicator) {
            this.showLoading(false);
        }
        
        console.log("處於離線模式，使用本地排行榜數據");
        
        // 通知待處理回調
        this.handleCallbacks(new Error("離線模式"), this.leaderboard);
    }
    
    // 無論如何，都返回已加載的本地數據
    return this.leaderboard;
  },
  
  // 處理所有待處理的回調
  handleCallbacks(err, data) {
    // 執行傳入的回調
    if (this.pendingRequests.length > 0) {
      let callbacks = [...this.pendingRequests];
      this.pendingRequests = [];
      
      callbacks.forEach(function(callback) {
        try {
          callback(err, data || this.leaderboard);
        } catch (e) {
          console.error("執行排行榜回調出錯:", e);
        }
      }, this);
    }
  },
  
  // 從本地存儲加載排行榜（作為備用）
  loadLocalLeaderboard() {
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
  
  // 顯示/隱藏加載指示器
  showLoading(show) {
    let canvas = cc.director.getScene().getComponentInChildren(cc.Canvas);
    let loadingNode = canvas.node.getChildByName("LeaderboardLoading");
    
    if (show) {
      if (!loadingNode) {
        loadingNode = new cc.Node("LeaderboardLoading");
        loadingNode.parent = canvas.node;
        
        // 創建背景
        let bg = new cc.Node("Background");
        bg.width = 200;
        bg.height = 100;
        
        let graphics = bg.addComponent(cc.Graphics);
        graphics.fillColor = cc.color(0, 0, 0, 150);
        graphics.roundRect(-100, -50, 200, 100, 10);
        graphics.fill();
        
        bg.parent = loadingNode;
        
        // 創建文本
        let label = new cc.Node("Label");
        let textComp = label.addComponent(cc.Label);
        textComp.string = "載入排行榜中...";
        textComp.fontSize = 20;
        textComp.lineHeight = 20;
        label.parent = loadingNode;
        
        // 居中顯示
        loadingNode.position = cc.v2(0, 0);
      }
      loadingNode.active = true;
    } else if (loadingNode) {
      loadingNode.active = false;
    }
  },
  
  // 檢查連線狀態
  getConnectionStatus() {
    let service = this.leaderboardService.getComponent('LeaderboardService');
    if (!service) {
      return {
        isOffline: true,
        status: "服務未初始化"
      };
    }
    
    // 使用新的連接狀態方法
    if (typeof service.getConnectionStatusDescription === 'function') {
      return {
        isOffline: service.offlineMode,
        status: service.getConnectionStatusDescription()
      };
    }
    
    // 向下兼容的方式
    return {
      isOffline: service.offlineMode,
      status: service.offlineMode ? "網絡連接不可用，顯示本地排行榜" : "已連接到在線排行榜服務"
    };
  },
  
  // 添加新的玩家成績
  addScore(playerId, score, callback) {
    // 確保清除之前的超時計時器
    if (this._addScoreTimeoutId) {
        clearTimeout(this._addScoreTimeoutId);
    }
    
    if (!playerId) {
        if (callback) callback(new Error("玩家 ID 無效"), null);
        return -1;
    }
    
    console.log("LeaderboardManager: 開始添加分數, 玩家:", playerId, "分數:", score);
    
    let self = this;
    let serviceComp = this.leaderboardService.getComponent('LeaderboardService');
    
    // 先更新本地記錄以便立即顯示
    let localRank = this.addScoreLocally(playerId, score);
    console.log("本地排行榜更新完成, 玩家:", playerId, "本地排名:", localRank);
    
    // 如果處於離線模式，直接返回
    if (!serviceComp || serviceComp.offlineMode) {
        console.log("處於離線模式，僅更新本地排行榜");
        if (callback) callback(new Error("離線模式"), { rank: localRank });
        return localRank;
    }
    
    // 設置超時計時器 - 15秒
    const timeoutDuration = 15000;
    
    this._addScoreTimeoutId = setTimeout(() => {
        console.warn("添加分數請求超時，超時設置:", timeoutDuration, "ms");
        if (callback) callback(new Error("請求超時"), { rank: localRank });
    }, timeoutDuration);
    
    console.log("正在向服務器發送分數更新請求");
    
    // 嘗試發送到服務器
    serviceComp.addScore(playerId, score, function(err, result) {
        // 清除超時計時器
        clearTimeout(self._addScoreTimeoutId);
        self._addScoreTimeoutId = null;
        
        if (err) {
            console.error("向服務器添加分數時出錯：", err);
            
            // 已經更新了本地排行榜，回調返回本地排名
            if (callback) callback(err, { rank: localRank });
        } else {
            console.log("成功向服務器添加分數，伺服器回應:", result);
            console.log("伺服器返回的排名:", result && result.rank ? result.rank : "未知");
            
            // 重要：確保數據已經被服務器處理
            console.log("等待伺服器處理完成...");
            
            // 為了確保伺服器有時間處理，我們延遲回調
            setTimeout(() => {
                console.log("伺服器處理完成，準備加載最新排行榜");
                
                // 返回回調，讓 GameModel 處理後續流程
                if (callback) {
                    callback(null, result || { rank: localRank });
                }
            }, 500); // 添加適當的延遲
        }
    });
    
    // 返回當前本地緩存中的排名
    return localRank;
  },
  
  // 本地添加分數（備用方法）
  addScoreLocally(playerId, score) {
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
    
    // 保存到本地存儲
    cc.sys.localStorage.setItem('leaderboard', JSON.stringify(this.leaderboard));
    
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
  },
  
  // 清除排行榜
  clearLeaderboard(callback) {
    // 本地清除
    this.leaderboard = [];
    cc.sys.localStorage.removeItem('leaderboard');
    
    // 清除待上傳的分數
    let serviceComp = this.leaderboardService.getComponent('LeaderboardService');
    if (serviceComp && serviceComp.pendingScores) {
      serviceComp.pendingScores = [];
      serviceComp.savePendingScores();
    }
    
    if (callback) {
      callback(new Error("伺服器端排行榜清除需要管理員權限"));
    }
    
    console.log("本地排行榜已清除");
  }
});