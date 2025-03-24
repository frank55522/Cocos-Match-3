import { CELL_TYPE, CELL_TYPE_REVERSE, GOAL_TYPE, GOAL_TYPE_REVERSE} from "../Model/ConstValue"

cc.Class({
    extends: cc.Component,

    properties: {
        spriteList: [cc.SpriteFrame]  // 存放所有可能的目標圖片
    },

    onLoad: function() {
        this.currentSprite = this.getComponent(cc.Sprite);
    },

    changeSprite(goalType, cellType) {
        let index = -1;
        switch (goalType) {
        case GOAL_TYPE.SINGLE_COLOR:
            index = cellType;
            break;
        case GOAL_TYPE.STRAIGHT:
            index = 7;
            break;
        case GOAL_TYPE.WRAP:
            index = 8;
            break;
        case GOAL_TYPE.BIRD:
            index = 9;
            break;
        case GOAL_TYPE.STRAIGHT_PLUS_STRAIGHT:

            break;
        case GOAL_TYPE.STRAIGHT_PLUS_WRAP:

            break;
        case GOAL_TYPE.STRAIGHT_PLUS_BIRD:

            break;
        case GOAL_TYPE.WRAP_PLUS_WRAP:

            break;
        case GOAL_TYPE.WRAP_PLUS_BIRD:

            break;
        case GOAL_TYPE.BIRD_PLUS_BIRD:

            break;
        default:
            console.error("Unknown goalType");
            return;
        }
        if (index != -1) {
            console.log("Set Type Image");
            this.currentSprite.spriteFrame = this.spriteList[index];
        }
        else {
            console.log("目標圖片未決定");
            this.currentSprite.spriteFrame = this.spriteList[CELL_TYPE.F];
        }
    }
});
