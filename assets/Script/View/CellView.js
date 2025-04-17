import {CELL_STATUS, CELL_WIDTH, CELL_HEIGHT, ANITIME} from '../Model/ConstValue';

cc.Class({
    extends: cc.Component,

    properties: {
        defaultFrame:{
            default: null,
            type: cc.SpriteFrame
        }
    },

    // use this for initialization
    onLoad: function () {
        this.isSelect = false;
        
        // 創建一個用於提示效果的邊框節點
        this.hintBorder = new cc.Node("HintBorder");
        this.hintBorder.parent = this.node;
        
        // 為邊框添加圖形組件
        let graphics = this.hintBorder.addComponent(cc.Graphics);
        
        // 設置較寬的邊框線寬，使其更明顯
        graphics.lineWidth = 6;
        
        // 使用鮮豔的紅色，在任何背景下都非常醒目
        graphics.strokeColor = cc.color(255, 0, 0, 255); // 鮮紅色
        
        // 繪製略大於方塊的矩形
        const borderSize = Math.min(CELL_WIDTH, CELL_HEIGHT) - 8;
        graphics.rect(-borderSize/2, -borderSize/2, borderSize, borderSize);
        graphics.stroke();
        
        // 初始時隱藏邊框
        this.hintBorder.active = false;
    },
    
    initWithModel: function(model){
        this.model = model;
        var x = model.startX;
        var y = model.startY;
        this.node.x = CELL_WIDTH * (x - 0.5);
        this.node.y = CELL_HEIGHT * (y - 0.5);
        var animation  = this.node.getComponent(cc.Animation);
        if (model.status == CELL_STATUS.COMMON){
            animation.stop();
        } 
        else{
            animation.play(model.status);
        }
    },
    
    setGridViewScript: function(gridViewScript) {
        this.gridViewScript = gridViewScript;
    },

    // 执行移动动作
    updateView: function(){
        var cmd = this.model.cmd;
        if(cmd.length <= 0){
            return ;
        }
        var actionArray = [];
        var curTime = 0;
        let deathTime = 0;
        for(var i in cmd){
            if( cmd[i].playTime > curTime){
                var delay = cc.delayTime(cmd[i].playTime - curTime);
                actionArray.push(delay);
            }
            if(cmd[i].action == "moveTo"){
                var x = (cmd[i].pos.x - 0.5) * CELL_WIDTH;
                var y = (cmd[i].pos.y - 0.5) * CELL_HEIGHT;
                var move = cc.moveTo(ANITIME.TOUCH_MOVE, cc.v2(x,y));
                actionArray.push(move);
            }
            else if(cmd[i].action == "toDie"){
                if(this.status == CELL_STATUS.BIRD){
                    let animation = this.node.getComponent(cc.Animation);
                    animation.play("effect");
                    actionArray.push(cc.delayTime(ANITIME.BOMB_BIRD_DELAY));
                    deathTime += ANITIME.BOMB_BIRD_DELAY;
                }
                var callFunc = cc.callFunc(function(){
                    this.node.destroy();
                },this);
                actionArray.push(callFunc);
                deathTime += curTime;
            }
            else if(cmd[i].action == "setVisible"){
                let isVisible = cmd[i].isVisible;
                actionArray.push(cc.callFunc(function(){
                    if(isVisible){
                        this.node.opacity = 255;
                    }
                    else{
                        this.node.opacity = 0;
                    }
                },this));
            }
            else if(cmd[i].action == "toShake"){
                let rotateRight = cc.rotateBy(0.06,30);
                let rotateLeft = cc.rotateBy(0.12, -60);
                actionArray.push(cc.repeat(cc.sequence(rotateRight, rotateLeft, rotateRight), 2));
            }
            curTime = cmd[i].playTime + cmd[i].keepTime;
        }

        // goalLeft--(view)
        if (this.model.goalMinus) {
            setTimeout(() => { this.gridViewScript.goalLeftMinus(); }, deathTime * 1000);
        }
        /**
         * 智障的引擎设计，一群SB
         */
        if(actionArray.length == 1){
            this.node.runAction(actionArray[0]);
        }
        else{
            this.node.runAction(cc.sequence(...actionArray));
        }

    },

    setSelect: function(flag){
        var animation = this.node.getComponent(cc.Animation);
        var bg = this.node.getChildByName("select");
        if(flag == false && this.isSelect && this.model.status == CELL_STATUS.COMMON){
            animation.stop();
            this.node.getComponent(cc.Sprite).spriteFrame = this.defaultFrame;
        }
        else if(flag && this.model.status == CELL_STATUS.COMMON){
            animation.play(CELL_STATUS.CLICK);
        }
        else if(flag && this.model.status == CELL_STATUS.BIRD){
            animation.play(CELL_STATUS.CLICK);
        }
        bg.active = flag; 
        this.isSelect = flag;
    },

    // 啟動更醒目的提示效果
    startHintEffect: function() {
        if (this.hintAction) return; // 如果已經有提示動畫正在運行則不重複開始
        
        // 確保邊框可見
        this.hintBorder.active = true;
        
        // 重置邊框透明度和縮放
        this.hintBorder.opacity = 255;
        this.hintBorder.scale = 1.0;
        
        // 建立更醒目的邊框動畫：縮放 + 閃爍效果
        const scaleUp = cc.scaleTo(0.5, 1.1);
        const scaleDown = cc.scaleTo(0.5, 0.9);
        const fadeOut = cc.fadeTo(0.5, 180);
        const fadeIn = cc.fadeTo(0.5, 255);
        
        // 組合動畫：同時進行縮放和透明度變化
        const pulseAction = cc.spawn(
            cc.sequence(scaleUp, scaleDown),
            cc.sequence(fadeOut, fadeIn)
        );
        
        // 重複執行動畫
        this.hintAction = this.hintBorder.runAction(cc.repeatForever(pulseAction));
        
        // 設置自動停止計時器
        this.hintTimer = setTimeout(() => {
            this.stopHintEffect();
        }, 4000); // 4秒後自動停止提示
    },

    // 停止高亮邊框提示效果
    stopHintEffect: function() {
        // 清除計時器
        if (this.hintTimer) {
            clearTimeout(this.hintTimer);
            this.hintTimer = null;
        }
        
        // 停止動畫
        if (this.hintAction) {
            this.hintBorder.stopAction(this.hintAction);
            this.hintAction = null;
        }
        
        // 隱藏邊框
        this.hintBorder.active = false;
    },

    // 替換舊的閃爍方法，調用新的提示效果
    startBlinking: function() {
        this.startHintEffect();
    },

    // 替換舊的停止閃爍方法
    stopBlinking: function() {
        this.stopHintEffect();
    }
});