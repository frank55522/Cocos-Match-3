// LeaderboardService.js
// 負責處理與伺服器的排行榜相關通信

cc.Class({
    extends: cc.Component,
    
    properties: {
        serverUrl: {
            default: "https://cocosmatch3-leaderboard-d9f72e8259a4.herokuapp.com/api",
            tooltip: "排行榜伺服器 API 地址"
        },
        maxRetries: {
            default: 3,
            tooltip: "連接失敗時的最大重試次數"
        },
        offlineMode: {
            default: false,
            tooltip: "是否啟用離線模式（當無法連接伺服器時自動啟用）"
        }
    },

    // 初始化
    onLoad() {
        this.retryCount = 0;
        this.pendingScores = [];
        this.lastConnectionCheck = 0;
        
        // 在 Cocos Creator 編輯器環境中強制啟用離線模式
        if (CC_EDITOR) {
            this.offlineMode = true;
            console.log("在編輯器中強制啟用離線模式");
        } else {
            // 嘗試從本地緩存加載待上傳的分數
            this.loadPendingScores();
            // 檢查網絡連接狀態
            this.checkServerConnection();
        }
    },

    start() {
        // 檢查網絡連接狀態
        this.checkServerConnection();
    },

    // 檢查伺服器連接
    checkServerConnection() {
        var self = this;
        var xhr = new XMLHttpRequest();
        xhr.timeout = 5000; // 5秒超時
        
        xhr.onreadystatechange = function() {
            if (xhr.readyState === 4) {
                if (xhr.status >= 200 && xhr.status < 300) {
                    console.log("伺服器連接成功");
                    self.offlineMode = false;
                    self.connectionError = null;
                    // 如果有待上傳的分數，嘗試上傳
                    if (self.pendingScores.length > 0) {
                        self.uploadPendingScores();
                    }
                } else {
                    console.warn("伺服器連接失敗，狀態碼：", xhr.status);
                    self.connectionError = `伺服器返回錯誤碼: ${xhr.status}`;
                    self.enableOfflineMode();
                }
            }
        };
        
        xhr.onerror = function(e) {
            console.error("伺服器連接錯誤", e);
            self.connectionError = "網絡連接錯誤";
            self.enableOfflineMode();
        };
        
        xhr.ontimeout = function() {
            console.error("伺服器連接超時");
            self.connectionError = "連接超時";
            self.enableOfflineMode();
        };
        
        try {
            xhr.open("GET", this.serverUrl + "/health", true);
            xhr.send();
        } catch (e) {
            console.error("發送請求時出錯：", e);
            this.connectionError = `請求錯誤: ${e.message}`;
            this.enableOfflineMode();
        }
    },
    
    // 啟用離線模式
    enableOfflineMode() {
        this.offlineMode = true;
        console.log("已啟用離線模式，分數將存儲在本地，並在下次連接到伺服器時上傳");
    },
    
    // 獲取排行榜數據
    getLeaderboard(callback) {
        // 如果是離線模式，從本地獲取
        if (this.offlineMode) {
            var localLeaderboard = this.getLocalLeaderboard();
            callback(this.connectionError, localLeaderboard);
            return;
        }
        
        var self = this;
        var xhr = new XMLHttpRequest();
        xhr.timeout = 5000;
        
        xhr.onreadystatechange = function() {
            if (xhr.readyState === 4) {
                if (xhr.status >= 200 && xhr.status < 300) {
                    try {
                        var response = JSON.parse(xhr.responseText);
                        if (response && response.data) {
                            // 更新本地緩存
                            self.saveLocalLeaderboard(response.data);
                            callback(null, response.data);
                        } else {
                            throw new Error("伺服器返回無效數據格式");
                        }
                    } catch (e) {
                        console.error("解析排行榜數據時出錯：", e);
                        self.retryOrFallback("getLeaderboard", callback, e);
                    }
                } else {
                    console.warn("獲取排行榜失敗，狀態碼：", xhr.status);
                    self.retryOrFallback("getLeaderboard", callback, new Error(`伺服器返回錯誤碼: ${xhr.status}`));
                }
            }
        };
        
        xhr.onerror = function(e) {
            console.error("獲取排行榜時出錯", e);
            self.retryOrFallback("getLeaderboard", callback, new Error("網絡連接錯誤"));
        };
        
        xhr.ontimeout = function() {
            console.error("獲取排行榜超時");
            self.retryOrFallback("getLeaderboard", callback, new Error("請求超時"));
        };
        
        try {
            xhr.open("GET", this.serverUrl + "/leaderboard", true);
            xhr.send();
        } catch (e) {
            console.error("發送獲取排行榜請求時出錯：", e);
            this.retryOrFallback("getLeaderboard", callback, e);
        }
    },
    
    // 添加分數到排行榜
    addScore(playerId, score, callback) {
        // 如果是離線模式，保存到待上傳隊列
        if (this.offlineMode) {
            this.addToPendingScores(playerId, score);
            var rank = this.getLocalRank(playerId);
            callback && callback(null, { rank: rank });
            return;
        }
        
        var self = this;
        var xhr = new XMLHttpRequest();
        xhr.timeout = 5000;
        
        xhr.onreadystatechange = function() {
            if (xhr.readyState === 4) {
                if (xhr.status >= 200 && xhr.status < 300) {
                    try {
                        var response = JSON.parse(xhr.responseText);
                        // 更新本地排行榜以確保同步
                        self.updateLocalLeaderboardWithScore(playerId, score);
                        callback && callback(null, response);
                    } catch (e) {
                        console.error("解析添加分數響應時出錯：", e);
                        self.addToPendingScores(playerId, score);
                        callback && callback(e, null);
                    }
                } else {
                    console.warn("添加分數失敗，狀態碼：", xhr.status);
                    self.addToPendingScores(playerId, score);
                    callback && callback(new Error("添加分數失敗"), null);
                }
            }
        };
        
        xhr.onerror = function() {
            console.error("添加分數時出錯");
            self.addToPendingScores(playerId, score);
            callback && callback(new Error("添加分數時出錯"), null);
        };
        
        try {
            xhr.open("POST", this.serverUrl + "/leaderboard", true);
            xhr.setRequestHeader("Content-Type", "application/json");
            xhr.send(JSON.stringify({
                playerId: playerId,
                score: score,
                date: new Date().toISOString()
            }));
        } catch (e) {
            console.error("發送添加分數請求時出錯：", e);
            this.addToPendingScores(playerId, score);
            callback && callback(e, null);
        }
    },
    
    // 重試或回退到本地模式
    retryOrFallback(funcName, callback, error) {
        if (this.retryCount < this.maxRetries) {
            this.retryCount++;
            console.log("重試操作，第 " + this.retryCount + " 次");
            var self = this;
            setTimeout(function() {
                if (funcName === "getLeaderboard") {
                    self.getLeaderboard(callback);
                }
            }, 1000 * this.retryCount); // 每次重試增加延遲
        } else {
            this.retryCount = 0;
            this.enableOfflineMode();
            // 保存錯誤信息
            this.connectionError = error ? error.message : "未知錯誤";
            // 使用本地數據
            var localLeaderboard = this.getLocalLeaderboard();
            callback(error, localLeaderboard);
        }
    },
    
    // 獲取本地排行榜
    getLocalLeaderboard() {
        var leaderboardData = cc.sys.localStorage.getItem('leaderboard');
        if (leaderboardData) {
            try {
                return JSON.parse(leaderboardData);
            } catch (e) {
                console.error('無法解析本地排行榜數據：', e);
                return [];
            }
        }
        return [];
    },
    
    // 保存排行榜到本地
    saveLocalLeaderboard(leaderboard) {
        cc.sys.localStorage.setItem('leaderboard', JSON.stringify(leaderboard));
    },
    
    // 更新本地排行榜中的玩家分數
    updateLocalLeaderboardWithScore(playerId, score) {
        var leaderboard = this.getLocalLeaderboard();
        var existingEntry = leaderboard.find(entry => entry.playerId === playerId);
        
        if (existingEntry) {
            if (score > existingEntry.score) {
                existingEntry.score = score;
                existingEntry.date = new Date().toISOString();
            }
        } else {
            leaderboard.push({
                playerId: playerId,
                score: score,
                date: new Date().toISOString()
            });
        }
        
        // 重新排序並保存
        leaderboard.sort((a, b) => b.score - a.score);
        this.saveLocalLeaderboard(leaderboard);
    },
    
    // 獲取玩家在本地排行榜中的排名
    getLocalRank(playerId) {
        var leaderboard = this.getLocalLeaderboard();
        for (var i = 0; i < leaderboard.length; i++) {
            if (leaderboard[i].playerId === playerId) {
                return i + 1;
            }
        }
        return -1;
    },
    
    // 添加到待上傳隊列
    addToPendingScores(playerId, score) {
        // 檢查是否已存在相同玩家的待上傳分數
        var existingIndex = this.pendingScores.findIndex(entry => entry.playerId === playerId);
        
        if (existingIndex !== -1) {
            // 如果新分數更高，則更新
            if (score > this.pendingScores[existingIndex].score) {
                this.pendingScores[existingIndex].score = score;
                this.pendingScores[existingIndex].date = new Date().toISOString();
            }
        } else {
            this.pendingScores.push({
                playerId: playerId,
                score: score,
                date: new Date().toISOString()
            });
        }
        
        this.savePendingScores();
        this.updateLocalLeaderboardWithScore(playerId, score);
    },
    
    // 保存待上傳的分數
    savePendingScores() {
        cc.sys.localStorage.setItem('pendingScores', JSON.stringify(this.pendingScores));
    },
    
    // 加載待上傳的分數
    loadPendingScores() {
        var pendingData = cc.sys.localStorage.getItem('pendingScores');
        if (pendingData) {
            try {
                this.pendingScores = JSON.parse(pendingData);
            } catch (e) {
                console.error('無法解析待上傳分數數據：', e);
                this.pendingScores = [];
            }
        } else {
            this.pendingScores = [];
        }
    },
    
    // 上傳待處理的分數
    uploadPendingScores() {
        if (this.pendingScores.length === 0 || this.offlineMode) {
            return;
        }
        
        console.log("嘗試上傳 " + this.pendingScores.length + " 條待處理分數");
        
        var self = this;
        var xhr = new XMLHttpRequest();
        xhr.timeout = 10000; // 給批量上傳更多時間
        
        xhr.onreadystatechange = function() {
            if (xhr.readyState === 4) {
                if (xhr.status >= 200 && xhr.status < 300) {
                    console.log("成功上傳待處理分數");
                    self.pendingScores = [];
                    self.savePendingScores();
                } else {
                    console.warn("上傳待處理分數失敗，狀態碼：", xhr.status);
                }
            }
        };
        
        xhr.onerror = function() {
            console.error("上傳待處理分數時出錯");
        };
        
        try {
            xhr.open("POST", this.serverUrl + "/leaderboard/batch", true);
            xhr.setRequestHeader("Content-Type", "application/json");
            xhr.send(JSON.stringify({
                scores: this.pendingScores
            }));
        } catch (e) {
            console.error("發送批量上傳請求時出錯：", e);
        }
    },
    
    // 獲取連線狀態描述
    getConnectionStatusDescription() {
        if (!this.offlineMode) {
            return "已連接到在線排行榜服務";
        } else if (this.connectionError) {
            return `網絡連接不可用: ${this.connectionError}`;
        } else {
            return "網絡連接不可用，顯示本地排行榜";
        }
    },
    
    // 檢查網絡連接並嘗試上傳未同步的分數
    update(dt) {
        // 每30秒檢查一次連接並嘗試上傳
        if (this.offlineMode && (!this.lastConnectionCheck || 
            Date.now() - this.lastConnectionCheck > 30000)) {
            this.lastConnectionCheck = Date.now();
            this.checkServerConnection();
        }
    }
});