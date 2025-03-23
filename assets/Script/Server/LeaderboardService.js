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
        },
        connectionTimeout: {
            default: 5,
            tooltip: "連接超時時間(秒)"
        }
    },

    // 初始化
    onLoad() {
        this.retryCount = 0;
        this.pendingScores = [];
        this.lastConnectionCheck = 0;
        this.connectionError = null;
        
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
        if (this.isCheckingConnection) return; // 避免重複檢查
        
        this.isCheckingConnection = true;
        var self = this;
        var xhr = new XMLHttpRequest();
        xhr.timeout = this.connectionTimeout * 1000;
        
        xhr.onreadystatechange = function() {
            if (xhr.readyState === 4) {
                self.isCheckingConnection = false;
                
                if (xhr.status >= 200 && xhr.status < 300) {
                    console.log("伺服器連接成功");
                    self.offlineMode = false;
                    self.connectionError = null;
                    self.retryCount = 0;
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
            self.isCheckingConnection = false;
            console.error("伺服器連接錯誤", e);
            self.connectionError = "網絡連接錯誤";
            self.enableOfflineMode();
        };
        
        xhr.ontimeout = function() {
            self.isCheckingConnection = false;
            console.error("伺服器連接超時");
            self.connectionError = "連接超時";
            self.enableOfflineMode();
        };
        
        try {
            xhr.open("GET", this.serverUrl + "/health", true);
            xhr.send();
        } catch (e) {
            this.isCheckingConnection = false;
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
    getLeaderboard(callback, forceRefresh) {
        // 如果是離線模式，從本地獲取
        if (this.offlineMode) {
            var localLeaderboard = this.getLocalLeaderboard();
            callback(this.connectionError ? new Error(this.connectionError) : new Error("離線模式"), localLeaderboard);
            return;
        }
        
        console.log("LeaderboardService: 開始獲取排行榜數據, 強制刷新:", forceRefresh);
        
        // 如果強制刷新，清除快取
        if (forceRefresh) {
            this.cachedLeaderboard = null;
            console.log("強制刷新已啟用，清除排行榜快取");
        } else if (this.cachedLeaderboard) {
            console.log("使用緩存的排行榜數據，條目數量:", this.cachedLeaderboard.length);
            callback(null, this.cachedLeaderboard);
            return;
        }
        
        var self = this;
        var xhr = new XMLHttpRequest();
        // 增加超時時間，避免超時問題
        xhr.timeout = this.connectionTimeout * 3000; // 遠大於預設值
        
        // 添加時間戳和更多隨機參數以避免快取問題
        let url = this.serverUrl + "/leaderboard";
        let cacheBusters = [];
        
        if (forceRefresh) {
            cacheBusters.push("t=" + Date.now());
            cacheBusters.push("nocache=" + Math.random());
            cacheBusters.push("refresh=true");
            cacheBusters.push("client_id=" + Math.random().toString(36).substring(2, 15));
        }
        
        if (cacheBusters.length > 0) {
            url += "?" + cacheBusters.join("&");
            console.log("使用防快取URL:", url);
        }
        
        // 添加請求開始時間戳記，用於計算請求耗時
        let requestStartTime = Date.now();
        
        xhr.onreadystatechange = function() {
            if (xhr.readyState === 4) {
                // 計算請求耗時
                let requestTime = Date.now() - requestStartTime;
                console.log(`排行榜請求耗時: ${requestTime}ms`);
                
                if (xhr.status >= 200 && xhr.status < 300) {
                    try {
                        var response = JSON.parse(xhr.responseText);
                        if (response && response.data) {
                            // 輸出資料供除錯
                            console.log("從服務器獲取的排行榜資料:", response.data.length, "條記錄");
                            
                            // 更新本地緩存
                            self.cachedLeaderboard = response.data;
                            self.saveLocalLeaderboard(response.data);
                            self.retryCount = 0; // 成功後重置重試計數
                            
                            callback(null, response.data);
                        } else {
                            throw new Error("伺服器返回無效數據格式");
                        }
                    } catch (e) {
                        console.error("解析排行榜數據時出錯：", e);
                        // 提供更詳細的錯誤信息
                        console.error("原始回應:", xhr.responseText);
                        self.retryOrFallback("getLeaderboard", callback, e);
                    }
                } else {
                    console.warn("獲取排行榜失敗，狀態碼：", xhr.status);
                    console.warn("響應文本:", xhr.responseText);
                    self.retryOrFallback("getLeaderboard", callback, new Error(`伺服器返回錯誤碼: ${xhr.status}`));
                }
            }
        };
        
        xhr.onerror = function(e) {
            console.error("獲取排行榜時出錯", e);
            // 提供更多錯誤詳情
            console.error("錯誤類型:", e.type);
            console.error("錯誤目標:", e.target);
            self.retryOrFallback("getLeaderboard", callback, new Error("網絡連接錯誤"));
        };
        
        xhr.ontimeout = function() {
            console.error("獲取排行榜超時，超時設置為:", self.connectionTimeout * 3000, "ms");
            // 在超時情況下，嘗試增加重試次數
            if (self.retryCount < self.maxRetries * 2) { // 允許更多重試次數
                self.retryCount++;
                console.log("排行榜請求超時，嘗試重試 #" + self.retryCount);
                setTimeout(function() {
                    self.getLeaderboard(callback, forceRefresh);
                }, 1000); // 延遲1秒後重試
            } else {
                self.retryOrFallback("getLeaderboard", callback, new Error("請求超時"));
            }
        };
        
        try {
            xhr.open("GET", url, true);
            
            // 添加請求頭，告訴伺服器不要返回快取
            if (forceRefresh) {
                xhr.setRequestHeader("Cache-Control", "no-cache, no-store, must-revalidate");
                xhr.setRequestHeader("Pragma", "no-cache");
                xhr.setRequestHeader("Expires", "0");
                xhr.setRequestHeader("X-Requested-At", Date.now().toString());
            }
            
            xhr.send();
        } catch (e) {
            console.error("發送獲取排行榜請求時出錯：", e);
            console.error("錯誤堆疊:", e.stack);
            this.retryOrFallback("getLeaderboard", callback, e);
        }
    },
    
    // 添加分數到排行榜
    addScore(playerId, score, callback) {
        // 如果是離線模式，保存到待上傳隊列
        if (this.offlineMode) {
            this.addToPendingScores(playerId, score);
            var rank = this.getLocalRank(playerId);
            callback && callback(new Error("離線模式，分數將在連接恢復後上傳"), { rank: rank });
            return;
        }
        
        console.log("LeaderboardService: 開始向服務器添加分數, 玩家:", playerId, "分數:", score);
        
        var self = this;
        var xhr = new XMLHttpRequest();
        xhr.timeout = this.connectionTimeout * 3000; // 增加超時時間 (3倍)
        
        xhr.onreadystatechange = function() {
            if (xhr.readyState === 4) {
                if (xhr.status >= 200 && xhr.status < 300) {
                    try {
                        var response = JSON.parse(xhr.responseText);
                        
                        // 改進日誌輸出，顯示完整的伺服器回應內容
                        console.log("添加分數伺服器回應:", JSON.stringify(response, null, 2));
                        
                        // 更新本地排行榜以確保同步
                        self.updateLocalLeaderboardWithScore(playerId, score);
                        
                        // 重要變更：分數上傳成功後清除排行榜快取，確保下次獲取最新資料
                        self.cachedLeaderboard = null;
                        
                        self.retryCount = 0; // 成功後重置重試計數
                        
                        // 添加強制延遲，確保服務器有足夠時間處理數據
                        console.log("等待服務器處理數據...");
                        setTimeout(() => {
                            console.log("服務器處理完成，準備返回回調");
                            callback && callback(null, response);
                        }, 300); // 較短延遲，加快響應
                    } catch (e) {
                        console.error("解析添加分數響應時出錯：", e);
                        console.error("原始回應:", xhr.responseText);
                        self.addToPendingScores(playerId, score);
                        callback && callback(e, null);
                    }
                } else {
                    console.warn("添加分數失敗，狀態碼：", xhr.status);
                    console.warn("響應文本:", xhr.responseText);
                    self.addToPendingScores(playerId, score);
                    callback && callback(new Error(`添加分數失敗: ${xhr.status}`), null);
                }
            }
        };
        
        xhr.onerror = function(e) {
            console.error("添加分數時出錯", e);
            console.error("錯誤類型:", e.type);
            self.addToPendingScores(playerId, score);
            callback && callback(new Error("網絡連接錯誤"), null);
        };
        
        xhr.ontimeout = function() {
            console.error("添加分數請求超時，超時設置為:", self.connectionTimeout * 3000, "ms");
            
            // 嘗試重試
            if (self.retryCount < self.maxRetries) {
                self.retryCount++;
                console.log(`添加分數請求超時，正在重試 (${self.retryCount}/${self.maxRetries})...`);
                
                setTimeout(function() {
                    self.addScore(playerId, score, callback);
                }, 1000); // 延遲1秒後重試
                return;
            }
            
            self.addToPendingScores(playerId, score);
            callback && callback(new Error("請求超時"), null);
        };
        
        try {
            console.log(`正在上傳分數: 玩家=${playerId}, 分數=${score}`);
            
            // 添加分數到伺服器
            xhr.open("POST", this.serverUrl + "/leaderboard", true);
            xhr.setRequestHeader("Content-Type", "application/json");
            
            // 添加時間戳避免快取，以及一些其他數據確保請求的唯一性
            const payload = {
                playerId: playerId,
                score: score,
                date: new Date().toISOString(),
                timestamp: Date.now(),
                client_id: Math.random().toString(36).substring(2, 15) // 添加隨機ID確保請求唯一
            };
            
            console.log("發送請求數據:", JSON.stringify(payload, null, 2));
            
            xhr.send(JSON.stringify(payload));
        } catch (e) {
            console.error("發送添加分數請求時出錯：", e);
            console.error("錯誤堆疊:", e.stack);
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
        if (Array.isArray(leaderboard)) {
            cc.sys.localStorage.setItem('leaderboard', JSON.stringify(leaderboard));
        }
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
        xhr.timeout = this.connectionTimeout * 2000;
        
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