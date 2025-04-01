cc.Class({
    extends: cc.Component,

    properties: {
        workable: {
            default: false
        },
        
        interval: {
            default: 1
        },
        
        timeLimit: {
            default: 10,
        }
    },

    onLoad: function() {
        this.currentTime = this.timeLimit;
        this.timeLabel = this.getComponent(cc.Label);
        if (!this.timeLabel) {
            console.warn("ThinkingTimer 找不到 Label 組件");
        }
    },
    
    setGameController: function(gameController) {
        this.gameController = gameController;
    },

    update: function(dt) {
        if (this.workable && this.interval) {
            this.currentTime -= dt;
            
            // 更新顯示
            if (this.timeLabel) {
                this.timeLabel.string = `倒數時間: ${Math.ceil(this.currentTime)} 秒`;
            }
            
            if (this.currentTime <= 0) {
                this.timerTrigger();
            }
        }
    },

    timerTrigger: function() {
        if (this.gameController) {
            this.gameController.thinkingTimerTrigger();
        }
        this.resetTimer(); // 觸發後重置計時器
    },

    resetTimer: function() {
        this.currentTime = this.timeLimit;
        if (this.timeLabel) {
            this.timeLabel.string = `倒數時間: ${Math.ceil(this.currentTime)} 秒`;
        }
    },

    setTimeLimit: function(seconds) {
        this.timeLimit = seconds;
        this.resetTimer();
    },

    setWorkable: function(tf) {
        if (tf && !this.workable) {
            this.resetTimer();
            this.workable = true;
            return;
        }
        if (!tf) {
            this.workable = false;
        }
    },
    
    getCurrentTime: function() {
        return this.currentTime;
    }
});