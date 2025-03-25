import { CELL_TYPE, CELL_TYPE_REVERSE, GOAL_TYPE, GOAL_TYPE_REVERSE} from "../Model/ConstValue"

cc.Class({
    extends: cc.Component,

    properties: {
        spriteList: [cc.SpriteFrame],  // 存放所有可能的目標圖片
        GoalTypeImgLeft: {
            default: null,
            type: cc.Node,
            tooltip: "左側的目標圖片節點"
        },
        Plus: {
            default: null,
            type: cc.Node,
            tooltip: "中間的加號節點"
        },
        GoalTypeImgRight: {
            default: null,
            type: cc.Node,
            tooltip: "右側的目標圖片節點"
        }
    },

    onLoad: function() {
        if (!this.GoalTypeImgLeft) {
            this.GoalTypeImgLeft = this.node.getChildByName("GoalTypeImgLeft");
        }
        
        if (!this.Plus) {
            this.Plus = this.node.getChildByName("Plus");
        }
        
        if (!this.GoalTypeImgRight) {
            this.GoalTypeImgRight = this.node.getChildByName("GoalTypeImgRight");
        }
        
        // 獲取節點上的精靈組件
        if (this.GoalTypeImgLeft) {
            this.leftSprite = this.GoalTypeImgLeft.getComponent(cc.Sprite);
        } else {
            console.error("GoalTypeImgLeft node not found!");
        }
        
        if (this.GoalTypeImgRight) {
            this.rightSprite = this.GoalTypeImgRight.getComponent(cc.Sprite);
        } else {
            console.error("GoalTypeImgRight node not found!");
        }
    },

    changeSprite(goalType, cellType) {
        this.toggleRightImageAndPlus(false);

        let leftIndex = -1;
        let rightIndex = -1;

        switch (goalType) {
        case GOAL_TYPE.SINGLE_COLOR:
            leftIndex = cellType;
            break;
        case GOAL_TYPE.STRAIGHT:
            leftIndex  = 7;
            break;
        case GOAL_TYPE.WRAP:
            leftIndex  = 8;
            break;
        case GOAL_TYPE.BIRD:
            leftIndex  = 9;
            break;
        case GOAL_TYPE.STRAIGHT_PLUS_STRAIGHT:
            leftIndex = 7;
            rightIndex = 7;
            this.toggleRightImageAndPlus(true);
            break;
        case GOAL_TYPE.STRAIGHT_PLUS_WRAP:
            leftIndex = 7;
            rightIndex = 8;
            this.toggleRightImageAndPlus(true);
            break;
        case GOAL_TYPE.STRAIGHT_PLUS_BIRD:
            leftIndex = 7;
            rightIndex = 9;
            this.toggleRightImageAndPlus(true);
            break;
        case GOAL_TYPE.WRAP_PLUS_WRAP:
            leftIndex = 8;
            rightIndex = 8;
            this.toggleRightImageAndPlus(true);
            break;
        case GOAL_TYPE.WRAP_PLUS_BIRD:
            leftIndex = 8;
            rightIndex = 9;
            this.toggleRightImageAndPlus(true);
            break;
        case GOAL_TYPE.BIRD_PLUS_BIRD:
            leftIndex = 9;
            rightIndex = 9;
            this.toggleRightImageAndPlus(true);
            break;
        default:
            console.error("Unknown goalType");
            return;
        }
        if (leftIndex != -1 && this.leftSprite) {
            console.log("Set Left Type Image:", leftIndex);
            this.leftSprite.spriteFrame = this.spriteList[leftIndex];
        }
        else {
            console.log("左側目標圖片未決定或不可用");
        }
        
        if (rightIndex != -1 && this.rightSprite) {
            console.log("Set Right Type Image:", rightIndex);
            this.rightSprite.spriteFrame = this.spriteList[rightIndex];
        }
    },

    toggleRightImageAndPlus(show) {
        if (this.Plus) {
            this.Plus.active = show;
        } else {
            console.warn("Plus node not found");
        }
        
        if (this.GoalTypeImgRight) {
            this.GoalTypeImgRight.active = show;
        } else {
            console.warn("Right goal type image node not found");
        }
    }
});
