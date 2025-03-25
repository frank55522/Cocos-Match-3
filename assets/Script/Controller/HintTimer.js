// Learn cc.Class:
//  - https://docs.cocos.com/creator/manual/en/scripting/class.html
// Learn Attribute:
//  - https://docs.cocos.com/creator/manual/en/scripting/reference/attributes.html
// Learn life-cycle callbacks:
//  - https://docs.cocos.com/creator/manual/en/scripting/life-cycle-callbacks.html

cc.Class({
    extends: cc.Component,

    properties: {
        workable: {
            default: false
        },
        
        interval: {
            default: 0
        }
    },

    onLoad: function() {
        this.time = 0;
    },
    setGameController: function(gameController) {
        this.gameController = gameController;
    },

    update: function(dt) {
        if (this.workable && this.interval) {
            this.time += dt;
            if (this.time >= this.interval)
                this.timerTrigger();
        }
    },

    timerTrigger: function() {
        this.gameController.hintTimerTrigger();
        this.time = 0;
    },

    setInterval: function(interval) {
        this.interval = interval;
    },

    setWorkable: function(tf) {
        if (tf && !this.workable) {
            this.time = 0;
            this.workable = true;
            return;
        }
        if (!tf) this.workable = false;
    }
});
